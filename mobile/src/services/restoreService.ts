import { supabase } from '../lib/supabase';
import { importFromJson, BackupData, ImportSummary } from '../db/backup';

export interface RestoreResult {
  success: boolean;
  summary?: ImportSummary;
  error?: string;
}

export interface DeleteFromCloudResult {
  success: boolean;
  error?: string;
  /** Per-table errors when a partial failure occurred */
  tableErrors?: Record<string, string>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Supabase's PostgREST has a practical limit of ~100 values in an IN filter
 * before the query-string becomes too long for some HTTP proxies.
 * This helper splits a large id list into 100-item chunks and merges results.
 * (C3)
 */
const CHUNK_SIZE = 100;

async function fetchByIds(
  table: string,
  column: string,
  ids: string[],
): Promise<any[]> {
  const results: any[] = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { data, error } = await supabase.from(table).select('*').in(column, chunk);
    if (error) throw error;
    if (data) results.push(...data);
  }
  return results;
}

async function deleteByIds(
  table: string,
  column: string,
  ids: string[],
): Promise<void> {
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    const chunk = ids.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase.from(table).delete().in(column, chunk);
    if (error) throw error;
  }
}

// ── Restore ───────────────────────────────────────────────────────────────────

/**
 * Fetches all shop data from Supabase (scoped by RLS to the authenticated user)
 * and inserts it into the local SQLite database using INSERT OR REPLACE.
 *
 * Safe to call on a non-empty database — existing rows with the same ID are
 * replaced with the cloud version. New rows are added.
 */
export const restoreFromCloud = async (): Promise<RestoreResult> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Not authenticated' };

    const phone = session.user.phone?.slice(-10) ?? '';
    if (!phone) return { success: false, error: 'Could not determine shop phone' };

    // ── Fetch all tables in parallel ─────────────────────────────────────────
    const [
      shopRes,
      categoriesRes,
      brandsRes,
      productsRes,
      customersRes,
      billsRes,
      salesLogRes,
    ] = await Promise.all([
      supabase.from('shops').select('*').eq('id', phone).single(),
      supabase.from('categories').select('*').eq('shop_id', phone),
      supabase.from('brands').select('*').eq('shop_id', phone),
      supabase.from('products').select('*').eq('shop_id', phone),
      supabase.from('customers').select('*').eq('shop_id', phone),
      supabase.from('bills').select('*').eq('shop_id', phone),
      supabase.from('sales_log').select('*').eq('shop_id', phone),
    ]);

    // Fetch bill_items separately, chunked to handle shops with many bills (C3)
    const billIds = (billsRes.data ?? []).map((b: any) => b.id);
    const billItems = billIds.length > 0
      ? await fetchByIds('bill_items', 'bill_id', billIds)
      : [];

    // ── Map Supabase rows → SQLite shape ─────────────────────────────────────
    const stripShopId = (rows: any[] | null) =>
      (rows ?? []).map(({ shop_id: _s, ...rest }) => rest);

    // C9: Supabase returns TIMESTAMPTZ (e.g. "2024-01-01T12:00:00+05:30").
    // Normalise to plain ISO 8601 UTC text so SQLite date queries work correctly.
    const normaliseBills = (rows: any[] | null) =>
      (rows ?? []).map(({ shop_id: _s, bill_date, ...rest }) => ({
        ...rest,
        bill_date: bill_date
          ? new Date(bill_date).toISOString()
          : new Date().toISOString(),
      }));

    const shopRow = shopRes.data
      ? {
          id: shopRes.data.id,
          shop_name: shopRes.data.shop_name,
          owner_name: shopRes.data.owner_name,
          phone: shopRes.data.phone,
          whatsapp_number: shopRes.data.whatsapp_number ?? null,
          business_category: shopRes.data.business_category ?? null,
          ai_consent: shopRes.data.ai_consent ? 1 : 0,
          is_active: shopRes.data.is_active ? 1 : 0,
          created_at: shopRes.data.created_at,
        }
      : null;

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      shop: shopRow,
      categories: stripShopId(categoriesRes.data),
      brands: stripShopId(brandsRes.data),
      products: stripShopId(productsRes.data),
      customers: stripShopId(customersRes.data),
      bills: normaliseBills(billsRes.data),   // C9
      billItems,                              // bill_items has no shop_id column
      salesLog: stripShopId(salesLogRes.data),
    };

    const summary = importFromJson(backup);
    return { success: true, summary };
  } catch (e: any) {
    console.error('[restoreService] restoreFromCloud error:', e);
    return { success: false, error: e?.message ?? 'Restore failed' };
  }
};

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Deletes all rows for this shop from every Supabase table.
 * Order matters — children before parents to avoid FK violations.
 *
 * C7: Continues on partial failure and reports per-table errors rather than
 * aborting at the first error, so the user can retry instead of being left
 * with an inconsistent cloud state.
 */
export const deleteFromCloud = async (): Promise<DeleteFromCloudResult> => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { success: false, error: 'Not authenticated' };

    const phone = session.user.phone?.slice(-10) ?? '';
    if (!phone) return { success: false, error: 'Could not determine shop phone' };

    const tableErrors: Record<string, string> = {};

    // 1. sales_log
    const { error: slErr } = await supabase.from('sales_log').delete().eq('shop_id', phone);
    if (slErr) tableErrors['sales_log'] = slErr.message;

    // 2. bill_items — no shop_id; delete via parent bill IDs in chunks (C3)
    const { data: billRows, error: billFetchErr } = await supabase
      .from('bills').select('id').eq('shop_id', phone);
    if (billFetchErr) {
      tableErrors['bill_items'] = `Could not fetch bill IDs: ${billFetchErr.message}`;
    } else {
      const billIds = (billRows ?? []).map((b: any) => b.id);
      if (billIds.length > 0) {
        try {
          await deleteByIds('bill_items', 'bill_id', billIds);
        } catch (e: any) {
          tableErrors['bill_items'] = e?.message ?? 'Unknown error';
        }
      }
    }

    // 3. bills
    const { error: bErr } = await supabase.from('bills').delete().eq('shop_id', phone);
    if (bErr) tableErrors['bills'] = bErr.message;

    // 4. customers
    const { error: cErr } = await supabase.from('customers').delete().eq('shop_id', phone);
    if (cErr) tableErrors['customers'] = cErr.message;

    // 5. products
    const { error: pErr } = await supabase.from('products').delete().eq('shop_id', phone);
    if (pErr) tableErrors['products'] = pErr.message;

    // 6. brands
    const { error: brErr } = await supabase.from('brands').delete().eq('shop_id', phone);
    if (brErr) tableErrors['brands'] = brErr.message;

    // 7. categories
    const { error: catErr } = await supabase.from('categories').delete().eq('shop_id', phone);
    if (catErr) tableErrors['categories'] = catErr.message;

    // 8. shops row
    const { error: shErr } = await supabase.from('shops').delete().eq('id', phone);
    if (shErr) tableErrors['shops'] = shErr.message;

    if (Object.keys(tableErrors).length > 0) {
      const failed = Object.keys(tableErrors).join(', ');
      console.error('[restoreService] deleteFromCloud partial failure:', tableErrors);
      return {
        success: false,
        error: `Some data could not be deleted (${failed}). Check your connection and try again.`,
        tableErrors,
      };
    }

    return { success: true };
  } catch (e: any) {
    console.error('[restoreService] deleteFromCloud error:', e);
    return { success: false, error: e?.message ?? 'Cloud delete failed' };
  }
};
