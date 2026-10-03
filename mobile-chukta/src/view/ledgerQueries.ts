import type { SqlDb } from '../db/sqlDb';
import { calculateWorkerLedger } from '../domain/ledger';
import { resolveSettings } from '../domain/settings';
import type {
  AdvanceEntry, AttendanceEntry, DayOff, EarningAdjustment, LedgerResult, OvertimeEntry, Property, WagePayment, Worker,
} from '../domain/types';
import { listAttendance } from '../repos/attendance';
import { listDaysOff } from '../repos/daysOff';
import { listAdjustments, listAdvances, listPayments } from '../repos/money';
import { listOvertime } from '../repos/overtime';
import { listWorkers } from '../repos/workers';

export type WorkerSummary = { worker: Worker; ledger: LedgerResult };

function ledgerFor(
  worker: Worker, property: Property, today: string, attendance: AttendanceEntry[], advances: AdvanceEntry[], payments: WagePayment[],
  daysOff: DayOff[], overtime: OvertimeEntry[], adjustments: EarningAdjustment[],
) {
  return calculateWorkerLedger({
    settings: resolveSettings(worker, property), ratePaise: worker.rate_paise, joiningDate: worker.joining_date,
    leftDate: worker.left_date, today, attendance, advances, payments,
    daysOff, overtime, adjustments,
  });
}

export async function getWorkerLedger(db: SqlDb, worker: Worker, property: Property, today: string): Promise<LedgerResult> {
  const [attendance, advances, payments, daysOff, overtime, adjustments] = await Promise.all([
    listAttendance(db, worker.id, worker.joining_date, today), listAdvances(db, worker.id), listPayments(db, worker.id),
    listDaysOff(db, property.id), listOvertime(db, worker.id), listAdjustments(db, worker.id),
  ]);
  return ledgerFor(worker, property, today, attendance, advances, payments, daysOff, overtime, adjustments);
}

function groupByWorker<T extends { worker_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.worker_id) ?? [];
    list.push(r);
    m.set(r.worker_id, list);
  }
  return m;
}

/** Balances for every worker of a property, from three queries (not one per worker). */
export async function listWorkerSummaries(db: SqlDb, property: Property, today: string, includeLeft = false): Promise<WorkerSummary[]> {
  const [workers, attendance, advances, payments, daysOff, overtime, adjustments] = await Promise.all([
    listWorkers(db, property.id, includeLeft),
    db.getAllAsync<AttendanceEntry>('select * from attendance_entries where property_id = ? and date <= ?', [property.id, today]),
    db.getAllAsync<AdvanceEntry>('select * from advance_entries where property_id = ?', [property.id]),
    db.getAllAsync<WagePayment>('select * from wage_payments where property_id = ?', [property.id]),
    db.getAllAsync<DayOff>('select * from days_off where property_id = ?', [property.id]),
    db.getAllAsync<OvertimeEntry>('select * from overtime_entries where property_id = ? and date <= ?', [property.id, today]),
    db.getAllAsync<EarningAdjustment>('select * from earning_adjustments where property_id = ?', [property.id]),
  ]);
  const att = groupByWorker(attendance);
  const adv = groupByWorker(advances);
  const pay = groupByWorker(payments);
  const ot = groupByWorker(overtime);
  const adj = groupByWorker(adjustments);
  return workers.map((worker) => ({
    worker,
    ledger: ledgerFor(worker, property, today, att.get(worker.id) ?? [], adv.get(worker.id) ?? [], pay.get(worker.id) ?? [],
      daysOff, ot.get(worker.id) ?? [], adj.get(worker.id) ?? []),
  }));
}
