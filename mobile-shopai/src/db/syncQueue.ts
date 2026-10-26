import db from './sqlite';
import { supabase } from '../lib/supabase';
import NetInfo from '@react-native-community/netinfo';
import { getStoredShopId, getHasConsent } from '../utils/storage';
import { isDeviceConflict, verifyActiveDevice } from '../services/deviceLock';

const MAX_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 30000;
const BACKOFF_MAX_MS = 3600000;
let isFlushing = false;

interface SyncItem {
  id: number;
  table_name: string;
  operation: string;
  data_id: string;
  payload: string;
  attempts: number;
}

/**
 * Transient errors (offline, expired auth, throttling, server trouble) say nothing
 * about the row itself, so they must not burn an attempt. Anything else is permanent.
 */
export const classifySyncError = (e: unknown): 'transient' | 'permanent' => {
  const err = (e ?? {}) as { name?: string; message?: unknown; status?: unknown; code?: unknown };
  const message = typeof err.message === 'string' ? err.message : '';
  // A TypeError is only a network failure when its message says so; a programming
  // TypeError must be permanent so it backs off instead of blocking the queue forever.
  if (
    (e instanceof TypeError || err.name === 'TypeError') &&
    /network request failed|failed to fetch|load failed|network|timeout|aborted/i.test(message)
  ) return 'transient';
  if (message.includes('Network request failed') || message.includes('JWT expired')) return 'transient';
  if (err.code === 'PGRST301' || err.code === 'PGRST000' || err.code === 'PGRST002') return 'transient';
  const status = Number(err.status);
  if (status === 401 || status === 408 || status === 429 || status >= 500) return 'transient';
  return 'permanent';
};

/** Random RFC 4122 v4-shaped id; op_ids are a global primary key in shopai_applied_deltas. */
export const newOpId = (): string =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });

export const addToSyncQueue = (
  tableName: string,
  operation: string,
  dataId: string,
  payload: any
) => {
  // Each DELTA carries its own op_id so the server applies it at most once, even when a
  // response is lost and the client re-sends.
  if (operation === 'DELTA' && !payload?.op_id) payload = { ...payload, op_id: newOpId() };
  // Shop updates are partial; a later one must not drop fields from an earlier unsynced one.
  if (tableName === 'shop') {
    const olds = db.getAllSync(
      'SELECT payload FROM sync_queue WHERE table_name = ? AND data_id = ? ORDER BY id ASC',
      [tableName, dataId]
    ) as { payload: string | null }[];
    let merged: any = {};
    for (const o of olds) {
      try { merged = { ...merged, ...JSON.parse(o.payload ?? '{}') }; } catch (_) {}
    }
    payload = { ...merged, ...payload };
  }
  // DELTA entries (stock/udhar changes) are additive: a new DELTA never dedupes anything,
  // and only an INSERT (absolute snapshot, below) removes queued DELTAs.
  if (operation !== 'DELTA') {
    // Promotion: an UPDATE replacing a not-yet-synced INSERT must stay an INSERT so the
    // first upload keeps the absolute stock/udhar that syncUpsert strips from UPDATEs.
    if (operation === 'UPDATE') {
      const queuedInsert = db.getFirstSync(
        "SELECT id FROM sync_queue WHERE table_name = ? AND data_id = ? AND operation = 'INSERT' LIMIT 1",
        [tableName, dataId]
      );
      if (queuedInsert) operation = 'INSERT';
    }
    // Remove any previously failed entries for the same record before inserting a fresh one,
    // so exhausted-attempt items don't silently block re-syncs. DELTAs survive, except under
    // an INSERT (fresh or promoted): its absolute snapshot already contains every earlier
    // delta, applied or not, so replaying one (e.g. after a backoff) would double-count it.
    db.runSync(
      operation === 'INSERT'
        ? 'DELETE FROM sync_queue WHERE table_name = ? AND data_id = ?'
        : "DELETE FROM sync_queue WHERE table_name = ? AND data_id = ? AND operation != 'DELTA'",
      [tableName, dataId]
    );
  }
  db.runSync(
    'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
    [tableName, operation, dataId, JSON.stringify(payload)]
  );

  // Automatically flush queue immediately if internet is available and user has cloud consent
  getHasConsent().then((consent) => {
    if (consent) {
      flushSyncQueue().catch(() => {});
    }
  }).catch(() => {});
};

export const getPendingSyncCount = (): number => {
  const result = db.getFirstSync(
    'SELECT COUNT(*) as count FROM sync_queue WHERE attempts < ?',
    [MAX_ATTEMPTS]
  ) as { count: number } | null;
  return result?.count ?? 0;
};

export const getStuckSyncCount = (): number => {
  const result = db.getFirstSync(
    'SELECT COUNT(*) as count FROM sync_queue WHERE attempts >= ?',
    [MAX_ATTEMPTS]
  ) as { count: number } | null;
  return result?.count ?? 0;
};

export const retryStuckSyncItems = (): void => {
  db.runSync(
    'UPDATE sync_queue SET attempts = 0, next_attempt_at = 0 WHERE attempts >= ?',
    [MAX_ATTEMPTS]
  );
};

export type PendingIds = Record<string, Set<string>>;

/**
 * Every queued record, keyed by table_name, regardless of attempts — an
 * exhausted entry is still an unsynced local change that a pull must not clobber.
 */
export const getPendingIds = (): PendingIds => {
  const rows = db.getAllSync('SELECT table_name, data_id FROM sync_queue') as
    { table_name: string; data_id: string }[];
  const out: PendingIds = {};
  for (const r of rows) {
    (out[r.table_name] ??= new Set()).add(String(r.data_id));
  }
  return out;
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
  // A device that lost the session must never write; 'unknown' also aborts (retry on next trigger).
  if (isDeviceConflict()) return;
  isFlushing = true;

  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;

    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    if ((await verifyActiveDevice()) !== 'ok') return;

    const queue = db.getAllSync(
      'SELECT * FROM sync_queue WHERE attempts < ? AND next_attempt_at <= ? ORDER BY id ASC',
      [MAX_ATTEMPTS, Date.now()]
    ) as SyncItem[];

    if (queue.length === 0) return;

    for (const item of queue) {
      // A DELTA must apply after the row's first upload: while an earlier INSERT for the
      // same row is still queued (failed or backed off), the RPC would silently hit no row
      // and the change would be lost when the INSERT later lands with its older snapshot.
      if (item.operation === 'DELTA' && db.getFirstSync(
        "SELECT 1 FROM sync_queue WHERE table_name = ? AND data_id = ? AND operation = 'INSERT' AND id < ? LIMIT 1",
        [item.table_name, item.data_id, item.id]
      )) continue;
      try {
        const payload = JSON.parse(item.payload);
        await syncItem(item.table_name, item.operation, item.data_id, payload);
        db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      } catch (e) {
        console.error(`[syncQueue] Failed to sync ${item.table_name}/${item.operation} id=${item.data_id}:`, e);
        // Transient: leave the row untouched and stop — the rest would fail the same way.
        if (classifySyncError(e) === 'transient') break;
        const attempts = item.attempts + 1;
        const delay = Math.min(BACKOFF_BASE_MS * 2 ** attempts, BACKOFF_MAX_MS);
        const err = e as { message?: unknown };
        const lastError = String(typeof err?.message === 'string' ? err.message : e).slice(0, 500);
        db.runSync(
          'UPDATE sync_queue SET attempts = ?, next_attempt_at = ?, last_error = ? WHERE id = ?',
          [attempts, Date.now() + delay, lastError, item.id]
        );
      }
    }
  } finally {
    isFlushing = false;
  }
};

// postgrest-js drops the HTTP status from `error`; it lives on the response.
function throwIfError(res: { error: any; status?: number }): void {
  if (!res.error) return;
  const { error, status } = res;
  throw Object.assign(new Error(error.message ?? 'Request failed'), error, { status });
}

async function syncItem(
  tableName: string,
  operation: string,
  dataId: string,
  payload: any
): Promise<void> {
  if (operation === 'DELETE') {
    await syncDelete(tableName, dataId);
  } else if (operation === 'DELTA') {
    await syncDelta(tableName, dataId, payload);
  } else {
    await syncUpsert(tableName, operation, payload);
  }
}

// Stock/udhar changes are applied server-side as deltas so concurrent devices add up
// instead of overwriting each other. RLS (SECURITY INVOKER) scopes the row to this shop.
async function syncDelta(tableName: string, dataId: string, payload: any): Promise<void> {
  const delta = Number(payload?.delta);
  const opId = payload?.op_id;
  if (!Number.isFinite(delta)) throw new Error(`Invalid delta for ${tableName}/${dataId}`);
  if (typeof opId !== 'string' || !opId) throw new Error(`Missing op_id for ${tableName}/${dataId}`);
  switch (tableName) {
    case 'products':
      throwIfError(await supabase.rpc('shopai_adjust_stock', { p_product_id: dataId, p_delta: delta, p_op_id: opId }));
      break;
    case 'customers':
      throwIfError(await supabase.rpc('shopai_adjust_udhar', { p_customer_id: dataId, p_delta: delta, p_op_id: opId }));
      break;
    default:
      throw new Error(`DELTA not supported for table: ${tableName}`);
  }
}

// Absolute stock/udhar values travel only on INSERT (first upload); on UPDATE they are
// owned by DELTA ops and must not overwrite the server's running total.
const DELTA_OWNED_COLUMN: Record<string, string> = {
  products: 'stock_quantity',
  customers: 'udhar_balance',
};

// Derives the shop UUID from the locally stored login session.
async function getShopId(): Promise<string> {
  const uuid = await getStoredShopId();
  if (!uuid) throw new Error('Not logged in — cannot sync');
  return uuid;
}

async function syncUpsert(tableName: string, operation: string, payload: any): Promise<void> {
  switch (tableName) {
    case 'products':
    case 'categories':
    case 'brands':
    case 'customers':
    case 'sales_log':
    case 'purchase_log': {
      // RLS requires shop_id = UUID on every row — inject it from the live session.
      const shopId = await getShopId();
      const row = { ...payload };
      const owned = DELTA_OWNED_COLUMN[tableName];
      if (owned && operation === 'UPDATE') delete row[owned];
      throwIfError(await supabase
        .from(tableName)
        .upsert({ ...row, shop_id: shopId }, { onConflict: 'id' }));
      break;
    }

    case 'shop': {
      const uuid = await getShopId();
      // phone is intentionally ignored — it's the login identifier and RLS no
      // longer grants authenticated UPDATE on shops.phone. This also drops
      // any `phone` field left over in queued entries from older app versions.
      const { shopName, ownerName, category, whatsappNumber, allowOutOfStockBilling } = payload;

      // active_device_id is deliberately never written here: only claimSession may take the session.
      const updatePayload: any = {};
      if (shopName !== undefined) updatePayload.shop_name = shopName;
      if (ownerName !== undefined) updatePayload.owner_name = ownerName;
      if (category !== undefined) updatePayload.business_category = category ?? null;
      if (whatsappNumber !== undefined) updatePayload.whatsapp_number = whatsappNumber ?? null;
      if (allowOutOfStockBilling !== undefined) updatePayload.allow_out_of_stock_billing = allowOutOfStockBilling ? true : false;

      throwIfError(await supabase.from('shops').update(updatePayload).eq('id', uuid));
      break;
    }

    case 'bills': {
      // Payload: { bill, items, salesLog } — all three need shop_id for RLS.
      const shopId = await getShopId();
      const { bill, items, salesLog } = payload;

      throwIfError(await supabase
        .from('bills')
        .upsert({ ...bill, shop_id: shopId }, { onConflict: 'id' }));

      if (items?.length) {
        // bill_items has no shop_id — RLS derives access via parent bill.
        throwIfError(await supabase
          .from('bill_items')
          .upsert(items, { onConflict: 'id' }));
      }

      if (salesLog?.length) {
        throwIfError(await supabase
          .from('sales_log')
          .upsert(salesLog.map((l: any) => ({ ...l, shop_id: shopId })), { onConflict: 'id' }));
      }
      break;
    }

    default:
      // Unknown table — drop from queue so it doesn't block others
      throw new Error(`Unknown table: ${tableName}`);
  }
}

async function syncDelete(tableName: string, dataId: string): Promise<void> {
  if (tableName === 'shop') {
    // No-op: the shops row is account data managed server-side; authenticated
    // has no DELETE on shops under the RLS lockdown.
    return;
  }
  throwIfError(await supabase
    .from(tableName)
    .delete()
    .eq('id', dataId));
}
