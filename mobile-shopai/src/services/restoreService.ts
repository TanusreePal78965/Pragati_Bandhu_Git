import { supabase } from '../lib/supabase';
import { importFromJson, BackupData, ImportSummary } from '../db/backup';
import { getStoredShopId } from '../utils/storage';

export interface RestoreResult {
  success: boolean;
  summary?: ImportSummary;
  error?: string;
  /** Per-table errors when a partial failure occurred */
  tableErrors?: Record<string, string>;
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
    const uuid = await getStoredShopId();
    if (!uuid) return { success: false, error: 'Not authenticated' };

    // ── Fetch all tables individually — continue on per-table errors ──────────
    const tableErrors: Record<string, string> = {};

    const safeQuery = async <T>(
      query: Promise<{ data: T | null; error: any }>,
      table: string,
    ): Promise<T | null> => {
      try {
        const { data, error } = await query;
        if (error) { tableErrors[table] = error.message; return null; }
        return data;
      } catch (e: any) {
        tableErrors[table] = e?.message ?? 'Unknown error';
        return null;
      }
    };

    const shopData      = await safeQuery(supabase.from('shops').select('*').eq('id', uuid).single() as any, 'shops');
    const categoriesData = await safeQuery(supabase.from('categories').select('*').eq('shop_id', uuid) as any, 'categories');
    const brandsData     = await safeQuery(supabase.from('brands').select('*').eq('shop_id', uuid) as any, 'brands');
    const productsData   = await safeQuery(supabase.from('products').select('*').eq('shop_id', uuid) as any, 'products');
    const customersData  = await safeQuery(supabase.from('customers').select('*').eq('shop_id', uuid) as any, 'customers');
    const billsData      = await safeQuery(supabase.from('bills').select('*').eq('shop_id', uuid) as any, 'bills');
    const salesLogData   = await safeQuery(supabase.from('sales_log').select('*').eq('shop_id', uuid) as any, 'sales_log');
    const purchaseLogData = await safeQuery(supabase.from('purchase_log').select('*').eq('shop_id', uuid) as any, 'purchase_log');

    // Fetch bill_items separately, chunked to handle shops with many bills (C3)
    const billIds = ((billsData as any[] | null) ?? []).map((b: any) => b.id);
    let billItems: any[] = [];
    if (billIds.length > 0) {
      try {
        billItems = await fetchByIds('bill_items', 'bill_id', billIds);
      } catch (e: any) {
        tableErrors['bill_items'] = e?.message ?? 'Unknown error';
      }
    }

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

    const shopDataTyped = shopData as any;
    const shopRow = shopDataTyped
      ? {
          id: shopDataTyped.id,
          shop_name: shopDataTyped.shop_name,
          owner_name: shopDataTyped.owner_name,
          phone: shopDataTyped.phone,
          whatsapp_number: shopDataTyped.whatsapp_number ?? null,
          business_category: shopDataTyped.business_category ?? null,
          ai_consent: shopDataTyped.ai_consent ? 1 : 0,
          is_active: shopDataTyped.is_active ? 1 : 0,
          created_at: shopDataTyped.created_at,
        }
      : null;

    const backup: BackupData = {
      version: 1,
      exportedAt: new Date().toISOString(),
      shop: shopRow,
      categories: stripShopId(categoriesData as any[] | null),
      brands: stripShopId(brandsData as any[] | null),
      products: stripShopId(productsData as any[] | null),
      customers: stripShopId(customersData as any[] | null),
      bills: normaliseBills(billsData as any[] | null),   // C9
      billItems,                                          // bill_items has no shop_id column
      salesLog: stripShopId(salesLogData as any[] | null),
      purchaseLog: stripShopId(purchaseLogData as any[] | null),
    };

    const summary = importFromJson(backup);
    const hasErrors = Object.keys(tableErrors).length > 0;
    return {
      success: true,
      summary,
      ...(hasErrors && { tableErrors }),
    };
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
    const uuid = await getStoredShopId();
    if (!uuid) return { success: false, error: 'Not authenticated' };

    const tableErrors: Record<string, string> = {};

    // 1. sales_log
    const { error: slErr } = await supabase.from('sales_log').delete().eq('shop_id', uuid);
    if (slErr) tableErrors['sales_log'] = slErr.message;

    // 1.5 purchase_log
    const { error: plErr } = await supabase.from('purchase_log').delete().eq('shop_id', uuid);
    if (plErr) tableErrors['purchase_log'] = plErr.message;

    // 2. bill_items — no shop_id; delete via parent bill IDs in chunks (C3)
    const { data: billRows, error: billFetchErr } = await supabase
      .from('bills').select('id').eq('shop_id', uuid);
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
    const { error: bErr } = await supabase.from('bills').delete().eq('shop_id', uuid);
    if (bErr) tableErrors['bills'] = bErr.message;

    // 4. customers
    const { error: cErr } = await supabase.from('customers').delete().eq('shop_id', uuid);
    if (cErr) tableErrors['customers'] = cErr.message;

    // 5. products
    const { error: pErr } = await supabase.from('products').delete().eq('shop_id', uuid);
    if (pErr) tableErrors['products'] = pErr.message;

    // 6. brands
    const { error: brErr } = await supabase.from('brands').delete().eq('shop_id', uuid);
    if (brErr) tableErrors['brands'] = brErr.message;

    // 7. categories
    const { error: catErr } = await supabase.from('categories').delete().eq('shop_id', uuid);
    if (catErr) tableErrors['categories'] = catErr.message;

    // 8. shops row
    const { error: shErr } = await supabase.from('shops').delete().eq('id', uuid);
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
