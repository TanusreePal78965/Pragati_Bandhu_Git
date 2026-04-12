import db from './sqlite';
import client from '../api/client';
import NetInfo from '@react-native-community/netinfo';

// Maps SQLite table names to their backend API routes
const ROUTE_MAP: Record<string, string> = {
  products: '/api/products',
  categories: '/api/categories',
  brands: '/api/brands',
  customers: '/api/customers',
  bills: '/api/sales',   // bills carry full payload: { bill, items, salesLog }
  shop: '/api/shops',
};

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

export const flushSyncQueue = async () => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const queue = db.getAllSync(
    'SELECT * FROM sync_queue WHERE attempts < ? ORDER BY id ASC',
    [MAX_ATTEMPTS]
  ) as SyncItem[];

  if (queue.length === 0) return;

  for (const item of queue) {
    const route = ROUTE_MAP[item.table_name];

    if (!route) {
      // Unknown table — drop from queue so it doesn't block others
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
      continue;
    }

    try {
      const payload = JSON.parse(item.payload);

      if (item.operation === 'DELETE') {
        await client.delete(`${route}/${item.data_id}`);
      } else {
        // INSERT and UPDATE both use upsert (POST)
        await client.post(route, payload);
      }

      // Success — remove from queue
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
    } catch (error) {
      // Failure — increment attempts; item will be retried next flush
      db.runSync(
        'UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?',
        [item.id]
      );
    }
  }
};
