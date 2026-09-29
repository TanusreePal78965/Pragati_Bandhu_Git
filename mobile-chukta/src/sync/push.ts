import type { SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';
import type { SyncOp } from '../repos/write';

export type RemoteError = { status: number | null; code: string | null; message: string };
export type { SyncOp };
export type PushItem = { table: SyncedTable; op: SyncOp; rowId: string; payload: Record<string, unknown> };
export interface RemoteWriter {
  write(item: PushItem): Promise<RemoteError | null>;
}

/** 4xx (except auth/throttle/timeout) or a Postgres class 22/23/42 error will never succeed on retry. */
export function isPermanent(err: RemoteError): boolean {
  // A lost session (401) or throttle/timeout can carry a misleading Postgres code (e.g. 42501 from an
  // anon-role RLS fallback) — the HTTP status is the ground truth for these and must win, so check it first.
  if (err.status === null || err.status === 0 || [401, 408, 429].includes(err.status)) return false;
  if (err.code && /^(22|23|42)/.test(err.code)) return true;
  return err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}

type QueueRow = { seq: number; table_name: SyncedTable; row_id: string; op: SyncOp; payload: string };

export async function flushPush(
  db: SqlDb, remote: RemoteWriter, hasSession: () => Promise<boolean>,
): Promise<{ pushed: number; dead: number; stopped: boolean }> {
  if (!(await hasSession())) return { pushed: 0, dead: 0, stopped: true };
  const rows = await db.getAllAsync<QueueRow>("select seq, table_name, row_id, op, payload from sync_queue where status = 'pending' order by seq");
  let pushed = 0;
  let dead = 0;
  for (const row of rows) {
    const err = await remote.write({ table: row.table_name, op: row.op, rowId: row.row_id, payload: JSON.parse(row.payload) });
    if (!err) {
      await db.runAsync('delete from sync_queue where seq = ?', [row.seq]);
      pushed++;
      continue;
    }
    if (isPermanent(err)) {
      await db.runAsync("update sync_queue set status = 'dead', attempts = attempts + 1, last_error = ? where seq = ?", [err.message, row.seq]);
      if (row.op === 'update') {
        // The server version is now stranded: pull skipped this row while it was pending, and other
        // devices' changes may have moved the cursor past it. Drop the cursor so the next pull re-reads
        // the table from scratch and restores the authoritative server row over our dead-lettered patch.
        await db.runAsync('delete from sync_cursor where table_name = ?', [row.table_name]);
      }
      dead++;
      continue;
    }
    // Retryable: keep order (children depend on parents), try again next flush.
    await db.runAsync('update sync_queue set attempts = attempts + 1, last_error = ? where seq = ?', [err.message, row.seq]);
    return { pushed, dead, stopped: true };
  }
  return { pushed, dead, stopped: false };
}

export async function listDead(db: SqlDb) {
  return db.getAllAsync<{ seq: number; table_name: string; row_id: string; last_error: string | null }>(
    "select seq, table_name, row_id, last_error from sync_queue where status = 'dead' order by seq");
}
