import { TABLE_COLUMNS, type SyncedTable } from '../db/schema';
import type { SqlDb, SqlParam } from '../db/sqlDb';
import type { RepoContext } from './context';

const toParam = (v: unknown): SqlParam => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as SqlParam));

export const UPDATABLE_COLUMNS = {
  properties: ['name', 'address', 'is_active', 'default_pay_basis', 'default_attendance_mode', 'shift_hours', 'weekly_off', 'monthly_divisor',
    'offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise'],
  workers: ['name', 'phone', 'pay_basis', 'rate_paise', 'joining_date', 'status', 'left_date', 'attendance_mode', 'shift_hours',
    'weekly_off_override', 'weekly_off', 'monthly_divisor', 'offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise'],
  days_off: ['name', 'kind', 'portion', 'pay_rule', 'is_active'],
} as const;
export type SyncOp = 'insert' | 'update';

/** Local upsert of known columns only (used by pull; never enqueues). */
export async function upsertLocal(db: SqlDb, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  const cols = TABLE_COLUMNS[table].filter((c) => c in row);
  const placeholders = cols.map(() => '?').join(', ');
  await db.runAsync(`insert or replace into ${table} (${cols.join(', ')}) values (${placeholders})`, cols.map((c) => toParam(row[c])));
}

async function enqueue(ctx: RepoContext, table: SyncedTable, id: string, op: SyncOp, payload: Record<string, unknown>): Promise<void> {
  await ctx.db.runAsync(
    'insert into sync_queue (table_name, row_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
    [table, id, op, JSON.stringify(payload), ctx.now().toISOString()],
  );
}

export async function insertAndEnqueue(ctx: RepoContext, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  await ctx.db.withTransactionAsync(async () => {
    await upsertLocal(ctx.db, table, row);
    const payload: Record<string, unknown> = {};
    for (const c of TABLE_COLUMNS[table]) if (c !== 'server_updated_at' && c in row) payload[c] = row[c];
    await enqueue(ctx, table, row.id as string, 'insert', payload);
  });
}

/** Updates a mutable table locally and enqueues the patch only (server will UPDATE by id). */
export async function updateAndEnqueue(
  ctx: RepoContext, table: keyof typeof UPDATABLE_COLUMNS, id: string, patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // Validate all patch keys are updatable
  const updatable = UPDATABLE_COLUMNS[table];
  for (const key of Object.keys(patch)) {
    if (!updatable.includes(key as never)) {
      throw new Error(`${table}.${key} is not updatable`);
    }
  }

  let merged: Record<string, unknown> = {};
  await ctx.db.withTransactionAsync(async () => {
    const current = await ctx.db.getFirstAsync<Record<string, unknown>>(`select * from ${table} where id = ?`, [id]);
    if (!current) throw new Error(`${table} ${id} not found`);
    merged = { ...current, ...patch };
    await upsertLocal(ctx.db, table, merged);
    await enqueue(ctx, table, id, 'update', { id, ...patch });
  });
  return merged;
}
