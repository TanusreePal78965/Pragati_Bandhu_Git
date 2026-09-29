import type { SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';
import type { SyncOp } from '../repos/write';

export type RemoteError = { status: number | null; code: string | null; message: string };
export type { SyncOp };
export type PushItem = { table: SyncedTable; op: SyncOp; rowId: string; payload: Record<string, unknown> };
export interface RemoteWriter {
  write(item: PushItem): Promise<RemoteError | null>;
}

/** Retryable server-side errors give up after this many attempts (network errors and 401 never do). */
export const MAX_SERVER_ATTEMPTS = 20;

/** PGRST0xx = cannot reach the database; PGRST106 = schema not exposed; PGRST200-205 (not 204) = stale schema cache. */
const RETRYABLE_PGRST = /^PGRST(0\d\d|106|20[0-35])$/;

/** An error that will never succeed on retry: dead-letter it right away. */
export function isPermanent(err: RemoteError): boolean {
  // A lost session (401) or throttle/timeout can carry a misleading Postgres code (e.g. 42501 from an
  // anon-role RLS fallback) — the HTTP status is the ground truth for these and must win, so check it first.
  if (err.status === null || err.status === 0 || [401, 408, 429].includes(err.status)) return false;
  if (err.code && RETRYABLE_PGRST.test(err.code)) return false;
  if (err.code && /^(22|23|42)/.test(err.code)) return true;
  if (err.code && /^PGRST/.test(err.code)) return true;
  return err.status >= 400 && err.status < 500;
}

/** A transient failure reported by the server (not the network, not the session): retried, but only up to the cap. */
export function countsTowardCap(err: RemoteError): boolean {
  if (isPermanent(err)) return false;
  return err.status !== null && err.status !== 0 && err.status !== 401;
}

type QueueRow = { seq: number; table_name: SyncedTable; row_id: string; op: SyncOp; payload: string; attempts: number };

async function markDead(db: SqlDb, row: QueueRow, message: string): Promise<void> {
  await db.runAsync("update sync_queue set status = 'dead', attempts = attempts + 1, last_error = ? where seq = ?", [message, row.seq]);
  if (row.op === 'update') {
    // The server version is now stranded: pull skipped this row while it was pending, and other
    // devices' changes may have moved the cursor past it. Drop the cursor so the next pull re-reads
    // the table from scratch and restores the authoritative server row over our dead-lettered patch.
    await db.runAsync('delete from sync_cursor where table_name = ?', [row.table_name]);
  }
}

export async function flushPush(
  db: SqlDb, remote: RemoteWriter, hasSession: () => Promise<boolean>,
): Promise<{ pushed: number; dead: number; stopped: boolean }> {
  if (!(await hasSession())) return { pushed: 0, dead: 0, stopped: true };
  const rows = await db.getAllAsync<QueueRow>(
    "select seq, table_name, row_id, op, payload, attempts from sync_queue where status = 'pending' order by seq");
  let pushed = 0;
  let dead = 0;
  for (const row of rows) {
    const err = await remote.write({ table: row.table_name, op: row.op, rowId: row.row_id, payload: JSON.parse(row.payload) });
    if (!err) {
      await db.runAsync('delete from sync_queue where seq = ?', [row.seq]);
      pushed++;
      continue;
    }
    if (isPermanent(err) || (countsTowardCap(err) && row.attempts + 1 >= MAX_SERVER_ATTEMPTS)) {
      await markDead(db, row, err.message);
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
