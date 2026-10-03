import type { SqlDb } from '../db/sqlDb';
import type { DayOff, DayOffKind, DayOffPayRule, DayOffPortion } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue, updateAndEnqueue } from './write';

export type DayOffPatch = Partial<Pick<DayOff, 'name' | 'kind' | 'portion' | 'pay_rule' | 'is_active'>>;

/** Owners add any day off; staff may only add a closure ("Shop closed today") paid by basis. */
export async function addDayOff(
  ctx: RepoContext,
  input: { propertyId: string; date: string; name: string; kind: DayOffKind; portion: DayOffPortion; payRule: DayOffPayRule },
): Promise<DayOff> {
  if (ctx.role !== 'owner' && input.kind !== 'closure') throw new Error('only the owner can add holidays');
  if (ctx.role !== 'owner' && input.payRule !== 'by_basis') throw new Error('only the owner can choose how a day off is paid');
  if (!input.name.trim()) throw new Error('name is required');
  const row: DayOff = {
    id: ctx.newId(), property_id: input.propertyId, date: input.date, name: input.name.trim(), kind: input.kind,
    portion: input.portion, pay_rule: input.payRule, is_active: 1,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'days_off', row);
  return row;
}

export async function updateDayOff(ctx: RepoContext, id: string, patch: DayOffPatch): Promise<void> {
  if (ctx.role !== 'owner') throw new Error('only the owner can edit days off');
  await updateAndEnqueue(ctx, 'days_off', id, patch);
}

export async function listDaysOff(db: SqlDb, propertyId: string): Promise<DayOff[]> {
  return db.getAllAsync<DayOff>('select * from days_off where property_id = ? order by date desc, created_at desc', [propertyId]);
}

export async function getDayOff(db: SqlDb, id: string): Promise<DayOff | null> {
  return db.getFirstAsync<DayOff>('select * from days_off where id = ?', [id]);
}
