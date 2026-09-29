import type { SqlDb } from '../db/sqlDb';
import type { AdvanceEntry, AdvanceType, PaymentMode, WagePayment } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue } from './write';

type Base = { propertyId: string; workerId: string; amountPaise: number; date: string; mode?: PaymentMode; note?: string };

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive number of paise');
}

function audit(ctx: RepoContext) {
  return { created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null };
}

export async function addAdvance(ctx: RepoContext, input: Base & { type: AdvanceType }): Promise<AdvanceEntry> {
  assertAmount(input.amountPaise);
  if (input.type === 'writeoff' && !input.note?.trim()) throw new Error('a note is required for a write-off');
  const row: AdvanceEntry = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, type: input.type, amount_paise: input.amountPaise,
    date: input.date, mode: input.mode ?? null, note: input.note ?? null, voids_id: null, ...audit(ctx),
  };
  await insertAndEnqueue(ctx, 'advance_entries', row);
  return row;
}

export async function addPayment(ctx: RepoContext, input: Base): Promise<WagePayment> {
  assertAmount(input.amountPaise);
  const row: WagePayment = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, amount_paise: input.amountPaise,
    date: input.date, mode: input.mode ?? null, note: input.note ?? null, voids_id: null, ...audit(ctx),
  };
  await insertAndEnqueue(ctx, 'wage_payments', row);
  return row;
}

async function voidRow<T extends AdvanceEntry | WagePayment>(
  ctx: RepoContext, table: 'advance_entries' | 'wage_payments', targetId: string,
): Promise<T> {
  if (ctx.role !== 'owner') throw new Error('only the owner can correct money entries');
  const target = await ctx.db.getFirstAsync<T>(`select * from ${table} where id = ?`, [targetId]);
  if (!target) throw new Error('entry not found');
  if (target.voids_id) throw new Error('cannot correct a correction');
  const existing = await ctx.db.getFirstAsync<{ id: string }>(`select id from ${table} where voids_id = ?`, [targetId]);
  if (existing) throw new Error('entry already corrected');
  const row = { ...target, id: ctx.newId(), voids_id: target.id, note: null, ...audit(ctx) } as T;
  await insertAndEnqueue(ctx, table, row as unknown as Record<string, unknown>);
  return row;
}

export const voidAdvance = (ctx: RepoContext, targetId: string) => voidRow<AdvanceEntry>(ctx, 'advance_entries', targetId);
export const voidPayment = (ctx: RepoContext, targetId: string) => voidRow<WagePayment>(ctx, 'wage_payments', targetId);

export async function listAdvances(db: SqlDb, workerId: string): Promise<AdvanceEntry[]> {
  return db.getAllAsync<AdvanceEntry>('select * from advance_entries where worker_id = ? order by date, created_at', [workerId]);
}

export async function listPayments(db: SqlDb, workerId: string): Promise<WagePayment[]> {
  return db.getAllAsync<WagePayment>('select * from wage_payments where worker_id = ? order by date, created_at', [workerId]);
}
