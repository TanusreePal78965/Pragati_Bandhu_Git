import db from './sqlite';
import client from '../api/client';
import NetInfo from '@react-native-community/netinfo';

export const addToSyncQueue = (tableName: string, operation: string, dataId: string, payload: any) => {
  db.runSync(
    'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
    [tableName, operation, dataId, JSON.stringify(payload)]
  );
};

interface SyncItem {
  id: number;
  table_name: string;
  operation: string;
  data_id: string;
  payload: string;
  attempts: number;
}

export const flushSyncQueue = async () => {
  const state = await NetInfo.fetch();
  if (!state.isConnected) return;

  const queue = db.getAllSync('SELECT * FROM sync_queue ORDER BY id ASC') as SyncItem[];

  for (const item of queue) {
    try {
      // Logic for each operation (INSERT, UPDATE, DELETE)
      // Example: await client.post(`/api/${item.table_name.toLowerCase()}`, JSON.parse(item.payload));
      
      // If success, remove from queue
      db.runSync('DELETE FROM sync_queue WHERE id = ?', [item.id]);
    } catch (error) {
      console.error(`Sync failed for item ${item.id}:`, error);
      // Increment attempts? If too high, maybe move to "failed_sync" log.
      db.runSync('UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?', [item.id]);
    }
  }
};
