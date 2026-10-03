import type { SqlDb } from '../db/sqlDb';
import type { OvertimeEntry } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue } from './write';

/** Append-only; the newest entry per worker and date wins (0 hours clears overtime for that date). */
export async function addOvertime(
  ctx: RepoContext,
  input: { propertyId: string; workerId: string; date: string; hours: number; customAmountPaise?: number | null; note?: string },
): Promise<OvertimeEntry> {
  if (!(input.hours >= 0 && input.hours <= 16)) throw new Error('overtime hours must be between 0 and 16');
  const custom = input.customAmountPaise ?? null;
  if (custom !== null && ctx.role !== 'owner') throw new Error('only the owner can set a custom amount');
  if (custom !== null && !(Number.isInteger(custom) && custom >= 0)) throw new Error('custom amount must be whole paise');
  const row: OvertimeEntry = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, date: input.date, hours: input.hours,
    custom_amount_paise: custom, note: input.note ?? null,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'overtime_entries', row);
  return row;
}

export async function listOvertime(db: SqlDb, workerId: string): Promise<OvertimeEntry[]> {
  return db.getAllAsync<OvertimeEntry>('select * from overtime_entries where worker_id = ? order by date, created_at', [workerId]);
}

export async function listOvertimeForDate(db: SqlDb, propertyId: string, date: string): Promise<OvertimeEntry[]> {
  return db.getAllAsync<OvertimeEntry>(
    'select * from overtime_entries where property_id = ? and date = ? order by created_at, id', [propertyId, date]);
}
