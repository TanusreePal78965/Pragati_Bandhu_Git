import { TABLE_COLUMNS, type SyncedTable } from '../db/schema';
import type { SqlDb, SqlParam } from '../db/sqlDb';
import type { RepoContext } from './context';

const toParam = (v: unknown): SqlParam => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as SqlParam));

/** Local upsert of known columns only (used by pull; never enqueues). */
export async function upsertLocal(db: SqlDb, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  const cols = TABLE_COLUMNS[table].filter((c) => c in row);
  const placeholders = cols.map(() => '?').join(', ');
  await db.runAsync(`insert or replace into ${table} (${cols.join(', ')}) values (${placeholders})`, cols.map((c) => toParam(row[c])));
}

async function enqueue(ctx: RepoContext, table: SyncedTable, id: string, row: Record<string, unknown>): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const c of TABLE_COLUMNS[table]) if (c !== 'server_updated_at' && c in row) payload[c] = row[c];
  await ctx.db.runAsync(
    'insert into sync_queue (table_name, row_id, payload, created_at) values (?, ?, ?, ?)',
    [table, id, JSON.stringify(payload), ctx.now().toISOString()],
  );
}

export async function insertAndEnqueue(ctx: RepoContext, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  await ctx.db.withTransactionAsync(async () => {
    await upsertLocal(ctx.db, table, row);
    await enqueue(ctx, table, row.id as string, row);
  });
}

/** Updates a mutable table locally and enqueues the full resulting row (upsert by id on the server). */
export async function updateAndEnqueue(
  ctx: RepoContext, table: 'properties' | 'workers', id: string, patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let merged: Record<string, unknown> = {};
  await ctx.db.withTransactionAsync(async () => {
    const current = await ctx.db.getFirstAsync<Record<string, unknown>>(`select * from ${table} where id = ?`, [id]);
    if (!current) throw new Error(`${table} ${id} not found`);
    merged = { ...current, ...patch };
    await upsertLocal(ctx.db, table, merged);
    await enqueue(ctx, table, id, merged);
  });
  return merged;
}
