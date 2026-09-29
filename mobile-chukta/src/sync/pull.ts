import { SYNCED_TABLES, type SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';
import { upsertLocal } from '../repos/write';
import type { RemoteError } from './push';

export type Cursor = { ts: string; id: string };
export interface RemoteReader {
  fetchSince(table: SyncedTable, cursor: Cursor | null, limit: number): Promise<{ rows: Record<string, unknown>[]; error: RemoteError | null }>;
}

async function getCursor(db: SqlDb, table: SyncedTable): Promise<Cursor | null> {
  const row = await db.getFirstAsync<{ cursor: string }>('select cursor from sync_cursor where table_name = ?', [table]);
  return row ? (JSON.parse(row.cursor) as Cursor) : null;
}

export type CursorFilter = { kind: 'gte'; ts: string } | { kind: 'after'; or: string };

/** PostgREST filter for rows after a cursor. An overlap cursor (id '') re-reads everything at or after ts;
 *  otherwise strict (ts, id) ordering. Never emits an empty uuid comparison. */
export function cursorFilter(cursor: Cursor): CursorFilter {
  if (cursor.id === '') return { kind: 'gte', ts: cursor.ts };
  return { kind: 'after', or: `server_updated_at.gt.${cursor.ts},and(server_updated_at.eq.${cursor.ts},id.gt.${cursor.id})` };
}

export async function pullAll(db: SqlDb, remote: RemoteReader, pageSize = 500): Promise<Record<SyncedTable, number>> {
  const counts = Object.fromEntries(SYNCED_TABLES.map((t) => [t, 0])) as Record<SyncedTable, number>;
  for (const table of SYNCED_TABLES) {
    const stored = await getCursor(db, table);
    // Re-read a 60s overlap each run: server_updated_at is stamped before commit, so a late-committing row
    // can carry an earlier timestamp than rows already pulled. Upserts are idempotent.
    let cursor: Cursor | null = stored ? { ts: new Date(Date.parse(stored.ts) - 60_000).toISOString(), id: '' } : null;
    for (;;) {
      const { rows, error } = await remote.fetchSince(table, cursor, pageSize);
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      if (rows.length === 0) break;
      await db.withTransactionAsync(async () => {
        const pendingIds = new Set(
          (await db.getAllAsync<{ row_id: string }>("select row_id from sync_queue where table_name = ? and status = 'pending'", [table]))
            .map((r) => r.row_id));
        for (const row of rows) {
          if (!pendingIds.has(row.id as string)) await upsertLocal(db, table, row);
        }
        const last = rows[rows.length - 1];
        cursor = { ts: last.server_updated_at as string, id: last.id as string };
        await db.runAsync('insert or replace into sync_cursor (table_name, cursor) values (?, ?)', [table, JSON.stringify(cursor)]);
      });
      counts[table] += rows.length;
      if (rows.length < pageSize) break;
    }
  }
  return counts;
}
