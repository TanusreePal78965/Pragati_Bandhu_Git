import { SYNCED_TABLES, type SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';

export type DeadGroup = { error: string; count: number; tables: SyncedTable[]; seqs: number[] };
type DeadRow = { seq: number; table_name: SyncedTable; row_id: string; op: 'insert' | 'update'; last_error: string | null };

const isSyncedTable = (t: string): t is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(t);

/** Dead rows grouped by their error (the usual root cause), ordered by the first row of each group. */
export async function listDeadGroups(db: SqlDb): Promise<DeadGroup[]> {
  const rows = await db.getAllAsync<DeadRow>(
    "select seq, table_name, row_id, op, last_error from sync_queue where status = 'dead' order by seq");
  const groups = new Map<string, DeadGroup>();
  for (const r of rows) {
    const key = r.last_error ?? 'unknown';
    const g = groups.get(key) ?? { error: key, count: 0, tables: [], seqs: [] };
    g.count++;
    g.seqs.push(r.seq);
    if (!g.tables.includes(r.table_name)) g.tables.push(r.table_name);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Back to pending in their original positions (seq is unchanged, so parent-before-child order holds). */
export async function requeueDead(db: SqlDb, seqs: number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const seq of seqs) {
      await db.runAsync("update sync_queue set status = 'pending', attempts = 0, last_error = null where seq = ? and status = 'dead'", [seq]);
    }
  });
}

/**
 * Gives up on dead rows. An insert the server never accepted is removed from this phone (only if it was never
 * pulled, i.e. server_updated_at is null). An update clears the table cursor so the next pull restores the server row.
 */
export async function discardDead(db: SqlDb, seqs: number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const seq of seqs) {
      const row = await db.getFirstAsync<DeadRow>(
        "select seq, table_name, row_id, op, last_error from sync_queue where seq = ? and status = 'dead'", [seq]);
      if (!row || !isSyncedTable(row.table_name)) continue;
      if (row.op === 'insert') {
        await db.runAsync(`delete from ${row.table_name} where id = ? and server_updated_at is null`, [row.row_id]);
      } else {
        await db.runAsync('delete from sync_cursor where table_name = ?', [row.table_name]);
      }
      await db.runAsync('delete from sync_queue where seq = ?', [seq]);
    }
  });
}
