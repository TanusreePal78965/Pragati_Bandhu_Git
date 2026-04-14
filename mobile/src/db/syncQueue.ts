import db from './sqlite';
import { supabase } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';

const MAX_ATTEMPTS = 5;

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
    // INSERT and UPDATE both use upsert
    await syncUpsert(tableName, payload);
  }
}

async function syncUpsert(tableName: string, payload: any): Promise<void> {
  switch (tableName) {
    case 'products':
    case 'categories':
    case 'brands':
    case 'customers': {
      const { error } = await supabase
        .from(tableName)
        .upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      break;
    }

    case 'shop': {
      // Derive phone from the live session — never trust the payload's phone field,
      // since it may be stale or empty and the RLS policy keys on id = phone.
      const { data: { session } } = await supabase.auth.getSession();
      const rawPhone = session?.user?.phone ?? '';
      // Mirror the RLS policy exactly: right(auth.jwt() ->> 'phone', 10)
      // auth.users.phone may be '+919876543210', '919876543210', or '9876543210'
      const phone = rawPhone.slice(-10);
      if (!phone) throw new Error('No authenticated session — cannot sync shop');

      const { shopName, ownerName, category, whatsappNumber, aiConsent } = payload;
      const { error } = await supabase.from('shops').upsert(
        {
          id: phone,
          phone,
          shop_name: shopName,
          owner_name: ownerName,
          business_category: category ?? null,
          whatsapp_number: whatsappNumber ?? null,
          ai_consent: aiConsent ?? false,
        },
        { onConflict: 'id' }
      );
      if (error) throw error;
      break;
    }

    case 'bills': {
      // Sales payload: { bill, items, salesLog }
      const { bill, items, salesLog } = payload;

      const { error: billError } = await supabase
        .from('bills')
        .upsert(bill, { onConflict: 'id' });
      if (billError) throw billError;

      if (items?.length) {
        const { error: itemsError } = await supabase
          .from('bill_items')
          .upsert(items, { onConflict: 'id' });
        if (itemsError) throw itemsError;
      }

      if (salesLog?.length) {
        const { error: logError } = await supabase
          .from('sales_log')
          .upsert(salesLog, { onConflict: 'id' });
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
