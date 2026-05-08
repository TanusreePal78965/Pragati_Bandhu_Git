import db from './sqlite';
import { supabase } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { getOrCreateDeviceId } from '../utils/storage';

const MAX_ATTEMPTS = 5;
let isFlushing = false;

interface SyncItem {
  id: number;
  table_name: string;
  operation: string;
  data_id: string;
  payload: string;
  attempts: number;
}

export const addToSyncQueue = (
  tableName: string,
  operation: string,
  dataId: string,
  payload: any
) => {
  // Remove any previously failed entries for the same record before inserting a fresh one,
  // so exhausted-attempt items don't silently block re-syncs.
  db.runSync(
    'DELETE FROM sync_queue WHERE table_name = ? AND data_id = ?',
    [tableName, dataId]
  );
  db.runSync(
    'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
    [tableName, operation, dataId, JSON.stringify(payload)]
  );
};

export const getPendingSyncCount = (): number => {
  const result = db.getFirstSync(
    'SELECT COUNT(*) as count FROM sync_queue WHERE attempts < ?',
    [MAX_ATTEMPTS]
  ) as { count: number } | null;
  return result?.count ?? 0;
};

/**
 * Flush all pending sync queue items directly to Supabase.
 * RLS policies on each table enforce shop isolation automatically —
 * no need to manually pass shop_id in every payload.
 *
 * Sales (bills) carry a compound payload: { bill, items, salesLog }
 * and are upserted across three tables sequentially.
 */
export const flushSyncQueue = async () => {
  // Guard against concurrent flushes (e.g. NetInfo + AppState firing simultaneously)
  if (isFlushing) return;
  isFlushing = true;

  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    const queue = db.getAllSync(
      'SELECT * FROM sync_queue WHERE attempts < ? ORDER BY id ASC',
      [MAX_ATTEMPTS]
    ) as SyncItem[];

    if (queue.length === 0) return;

    for (const item of queue) {
      try {
        const payload = JSON.parse(item.payload);
        await syncItem(item.table_name, item.operation, item.data_id, payload);
        db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      } catch (e) {
        console.error(`[syncQueue] Failed to sync ${item.table_name}/${item.operation} id=${item.data_id}:`, e);
        // Failure — increment attempts; item will be retried next flush
        db.runSync(
          'UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?',
          [item.id]
        );
      }
    }
  } finally {
    isFlushing = false;
  }
};

async function syncItem(
  tableName: string,
  operation: string,
  dataId: string,
  payload: any
): Promise<void> {
  if (operation === 'DELETE') {
    await syncDelete(tableName, dataId);
  } else {
    await syncUpsert(tableName, operation, payload);
  }
}

// Derives the 10-digit shop_id from the live Supabase session.
// Mirrors the RLS policy: right(auth.jwt() ->> 'phone', 10)
async function getShopId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const rawPhone = session?.user?.phone ?? '';
  const phone = rawPhone.slice(-10);
  if (!phone) throw new Error('No authenticated session — cannot sync');
  return phone;
}

async function syncUpsert(tableName: string, operation: string, payload: any): Promise<void> {
  switch (tableName) {
    case 'products':
    case 'categories':
    case 'brands':
    case 'customers':
    case 'sales_log': {
      // RLS requires shop_id = phone on every row — inject it from the live session.
      const shopId = await getShopId();
      const { error } = await supabase
        .from(tableName)
        .upsert({ ...payload, shop_id: shopId }, { onConflict: 'id' });
      if (error) throw error;
      break;
    }

    case 'shop': {
      const phone = await getShopId();
      const deviceId = await getOrCreateDeviceId();
      const { shopName, ownerName, category, whatsappNumber, aiConsent } = payload;

      if (operation === 'INSERT') {
        // First-time shop creation — include ai_consent and claim active device.
        const { error } = await supabase.from('shops').upsert(
          {
            id: phone,
            phone,
            shop_name: shopName,
            owner_name: ownerName,
            business_category: category ?? null,
            whatsapp_number: whatsappNumber ?? null,
            ai_consent: aiConsent ?? false,
            active_device_id: deviceId,
          },
          { onConflict: 'id' }
        );
        if (error) throw error;
      } else {
        // UPDATE — never overwrite ai_consent from local state; it may be stale.
        // Consent changes are pushed directly from EditShopScreen via a targeted update.
        const { error } = await supabase.from('shops').update({
          shop_name: shopName,
          owner_name: ownerName,
          business_category: category ?? null,
          whatsapp_number: whatsappNumber ?? null,
          active_device_id: deviceId,
        }).eq('id', phone);
        if (error) throw error;
      }
      break;
    }

    case 'bills': {
      // Payload: { bill, items, salesLog } — all three need shop_id for RLS.
      const shopId = await getShopId();
      const { bill, items, salesLog } = payload;

      const { error: billError } = await supabase
        .from('bills')
        .upsert({ ...bill, shop_id: shopId }, { onConflict: 'id' });
      if (billError) throw billError;

      if (items?.length) {
        // bill_items has no shop_id — RLS derives access via parent bill.
        const { error: itemsError } = await supabase
          .from('bill_items')
          .upsert(items, { onConflict: 'id' });
        if (itemsError) throw itemsError;
      }

      if (salesLog?.length) {
        const { error: logError } = await supabase
          .from('sales_log')
          .upsert(salesLog.map((l: any) => ({ ...l, shop_id: shopId })), { onConflict: 'id' });
        if (logError) throw logError;
      }
      break;
    }

    default:
      // Unknown table — drop from queue so it doesn't block others
      throw new Error(`Unknown table: ${tableName}`);
  }
}

async function syncDelete(tableName: string, dataId: string): Promise<void> {
  const table = tableName === 'shop' ? 'shops' : tableName;
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', dataId);
  if (error) throw error;
}
