import type { SqlDb } from '../db/sqlDb';
import { isDue, nextPeriod, type Period } from '../domain/cycles';
import { activeSettlements, lastSettledEnd } from '../domain/lock';
import { buildSettlementDraft, closingBalance, type LedgerData, type SettlementDraft } from '../domain/settlement';
import { resolveSettings } from '../domain/settings';
import type { PaymentMode, Property, Settlement, Worker } from '../domain/types';
import { listAttendance } from './attendance';
import type { RepoContext } from './context';
import { listDaysOff } from './daysOff';
import { listAdjustments, listAdvances, listPayments } from './money';
import { listOvertime } from './overtime';
import { insertManyAndEnqueue } from './write';

export type DueSettlement = { period: Period; draft: SettlementDraft };

export function parseSettlement(row: Record<string, unknown>): Settlement {
  const raw = row.summary;
  return { ...(row as unknown as Settlement), summary: typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Settlement['summary']) ?? {} };
}

export async function listSettlements(db: SqlDb, workerId: string): Promise<Settlement[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'select * from settlements where worker_id = ? order by period_start desc, created_at desc, id desc', [workerId]);
  return rows.map(parseSettlement);
}

export async function listPropertySettlements(db: SqlDb, propertyId: string): Promise<Settlement[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>('select * from settlements where property_id = ?', [propertyId]);
  return rows.map(parseSettlement);
}

export async function loadLedgerData(db: SqlDb, worker: Worker, property: Property, upTo: string): Promise<LedgerData> {
  const [attendance, advances, payments, daysOff, overtime, adjustments] = await Promise.all([
    listAttendance(db, worker.id, worker.joining_date, upTo), listAdvances(db, worker.id), listPayments(db, worker.id),
    listDaysOff(db, property.id), listOvertime(db, worker.id), listAdjustments(db, worker.id),
  ]);
  return { attendance, advances, payments, daysOff, overtime, adjustments };
}

export async function getDueSettlement(db: SqlDb, worker: Worker, property: Property, today: string): Promise<DueSettlement | null> {
  const settings = resolveSettings(worker, property);
  const period = nextPeriod({ joiningDate: worker.joining_date, leftDate: worker.left_date,
    lastSettledEnd: lastSettledEnd(await listSettlements(db, worker.id), worker.id), settings });
  if (!period || !isDue(period, today)) return null;
  const draft = buildSettlementDraft({ worker, settings, period, data: await loadLedgerData(db, worker, property, period.end) });
  return { period, draft };
}

function audit(ctx: RepoContext) {
  return { created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null };
}

const whole = (n: number) => Number.isInteger(n) && n >= 0;

export async function settleWorker(ctx: RepoContext, input: {
  worker: Worker; property: Property; today: string; paidNowPaise: number; recoveredPaise: number; mode: PaymentMode | null; note?: string;
}): Promise<Settlement> {
  if (ctx.role !== 'owner') throw new Error('only the owner can settle');
  const due = await getDueSettlement(ctx.db, input.worker, input.property, input.today);
  if (!due) throw new Error('nothing is due');
  const { draft, period } = due;
  if (!whole(input.paidNowPaise)) throw new Error('paid now must be whole paise ≥ 0');
  if (!whole(input.recoveredPaise) || input.recoveredPaise > draft.advanceOutstandingPaise) {
    throw new Error('recovery must be between 0 and the advance outstanding');
  }
  if (input.paidNowPaise > 0 && !input.mode) throw new Error('a payment mode is required');
  const id = ctx.newId();
  const settlement: Settlement = {
    id, property_id: input.worker.property_id, worker_id: input.worker.id, period_start: period.start, period_end: period.end,
    settled_on: input.today, pay_basis: draft.payBasis, rate_paise: draft.ratePaise, opening_balance_paise: draft.openingBalancePaise,
    base_paise: draft.basePaise, offday_extra_paise: draft.offdayExtraPaise, overtime_paise: draft.overtimePaise,
    bonus_paise: draft.bonusPaise, deduction_paise: draft.deductionPaise, earned_paise: draft.earnedPaise,
    paid_in_period_paise: draft.paidInPeriodPaise, paid_now_paise: input.paidNowPaise, advance_recovered_paise: input.recoveredPaise,
    advance_after_paise: draft.advanceOutstandingPaise - input.recoveredPaise,
    closing_balance_paise: closingBalance(draft, input.paidNowPaise, input.recoveredPaise),
    summary: draft.summary, note: input.note?.trim() || null, voids_id: null, ...audit(ctx),
  };
  const items: { table: 'settlements' | 'wage_payments' | 'advance_entries'; row: Record<string, unknown> }[] = [
    { table: 'settlements', row: settlement as unknown as Record<string, unknown> },
  ];
  if (input.paidNowPaise > 0) {
    items.push({ table: 'wage_payments', row: { id: ctx.newId(), property_id: settlement.property_id, worker_id: settlement.worker_id,
      amount_paise: input.paidNowPaise, date: period.end, mode: input.mode, note: null, voids_id: null, settlement_id: id, ...audit(ctx) } });
  }
  if (input.recoveredPaise > 0) {
    items.push({ table: 'advance_entries', row: { id: ctx.newId(), property_id: settlement.property_id, worker_id: settlement.worker_id,
      type: 'repayment', amount_paise: input.recoveredPaise, date: period.end, mode: null, note: null, voids_id: null,
      settlement_id: id, ...audit(ctx) } });
  }
  await insertManyAndEnqueue(ctx, items);
  return settlement;
}

export async function unlockSettlement(ctx: RepoContext, settlementId: string, today: string): Promise<Settlement> {
  if (ctx.role !== 'owner') throw new Error('only the owner can unlock');
  const row = await ctx.db.getFirstAsync<Record<string, unknown>>('select * from settlements where id = ?', [settlementId]);
  if (!row) throw new Error('settlement not found');
  const target = parseSettlement(row);
  const all = await listSettlements(ctx.db, target.worker_id);
  if (target.voids_id || !activeSettlements(all).some((s) => s.id === target.id)) throw new Error('settlement is not active');
  if (lastSettledEnd(all, target.worker_id) !== target.period_end) throw new Error('unlock newer settlements first');
  const zero = { opening_balance_paise: 0, base_paise: 0, offday_extra_paise: 0, overtime_paise: 0, bonus_paise: 0, deduction_paise: 0,
    earned_paise: 0, paid_in_period_paise: 0, paid_now_paise: 0, advance_recovered_paise: 0, advance_after_paise: 0, closing_balance_paise: 0 };
  const voidRow: Settlement = {
    ...target, ...zero, id: ctx.newId(), settled_on: today, summary: {}, note: null, voids_id: target.id, ...audit(ctx),
  };
  await insertManyAndEnqueue(ctx, [{ table: 'settlements', row: voidRow as unknown as Record<string, unknown> }]);
  return voidRow;
}
