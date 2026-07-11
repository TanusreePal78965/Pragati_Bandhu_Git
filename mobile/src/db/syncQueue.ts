import db from './sqlite';
import { supabase } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { getOrCreateDeviceId, getStoredShopId } from '../utils/storage';

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
    await syncUpsert(tableName, payload);
  }
}

// Derives the shop UUID from the locally stored login session.
async function getShopId(): Promise<string> {
  const uuid = await getStoredShopId();
  if (!uuid) throw new Error('Not logged in — cannot sync');
  return uuid;
}

async function syncUpsert(tableName: string, payload: any): Promise<void> {
  switch (tableName) {
    case 'products':
    case 'categories':
    case 'brands':
    case 'customers':
    case 'sales_log':
    case 'purchase_log': {
      // RLS requires shop_id = UUID on every row — inject it from the live session.
      const shopId = await getShopId();
      const { error } = await supabase
        .from(tableName)
        .upsert({ ...payload, shop_id: shopId }, { onConflict: 'id' });
      if (error) throw error;
      break;
    }

    case 'shop': {
      // Shops are created exclusively by the register-shop Edge Function (web
      // registration flow) — the app never inserts a shop row, only updates
      // the one it already logged into.
      const uuid = await getShopId();
      const deviceId = await getOrCreateDeviceId();
      const { shopName, ownerName, category, whatsappNumber, phone } = payload;

      // Never overwrite ai_consent from local state; it may be stale.
      // Consent changes are pushed directly from EditShopScreen via a targeted update.
      const { error } = await supabase.from('shops').update({
        phone: phone,
        shop_name: shopName,
        owner_name: ownerName,
        business_category: category ?? null,
        whatsapp_number: whatsappNumber ?? null,
        active_device_id: deviceId,
      }).eq('id', uuid);
      if (error) throw error;
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
