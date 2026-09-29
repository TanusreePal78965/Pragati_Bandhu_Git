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
  if (err.code && /^(22|23|42)/.test(err.code)) return true;
  if (err.status === null) return false;
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
