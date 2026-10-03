import { i18n, initI18n } from '../i18n';
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { Settlement } from '../domain/types';
import { settleWorker } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { formatPeriod, listDueSettlements } from '../view/dueList';
import { buildPayslipView } from '../view/payslip';
import { buildTodayRows } from '../view/today';
import { property, worker } from './helpers/fixtures';

beforeAll(() => initI18n('en'));
const t = (key: string, params?: Record<string, unknown>) => i18n.t(key, params) as string;

test('formatPeriod', () => {
  expect(formatPeriod({ start: '2026-09-01', end: '2026-09-05' }, t)).toBe('1–5 Sep');
  expect(formatPeriod({ start: '2026-09-27', end: '2026-10-03' }, t)).toBe('27 Sep–3 Oct');
  expect(formatPeriod({ start: '2026-12-27', end: '2027-01-02' }, t)).toBe('27 Dec 2026–2 Jan 2027');
});

test('due list: one row per worker with an ended, unsettled period, oldest first', async () => {
  const db = openTestDb();
  await migrate(db);
  await upsertLocal(db, 'properties', property());
  await upsertLocal(db, 'workers', worker({ id: 'w1', name: 'Ram', joining_date: '2026-09-06' }));
  await upsertLocal(db, 'workers', worker({ id: 'w2', name: 'Sita', joining_date: '2026-09-01', status: 'left', left_date: '2026-09-08' }));
  await upsertLocal(db, 'workers', worker({ id: 'w3', name: 'New', joining_date: '2026-09-13' }));
  await upsertLocal(db, 'workers', worker({ id: 'w4', name: 'Asha', joining_date: '2026-09-01' }));
  const rows = await listDueSettlements(db, property(), '2026-09-14');
  // No settlements yet, so each first period catches up to the last week that ended (Sat 12 Sep), cut to a leaving date.
  // Sita 1–8 Sep: 7 working days (Sun 6 Sep off) × ₹500; Asha 1–12 Sep: 11 days; Ram 6–12 Sep: 6 days. New's week has not ended.
  expect(rows.map((r) => [r.worker.name, r.period.start, r.period.end, r.wageDuePaise])).toEqual([
    ['Sita', '2026-09-01', '2026-09-08', 350000],
    ['Asha', '2026-09-01', '2026-09-12', 550000],
    ['Ram', '2026-09-06', '2026-09-12', 300000],
  ]);
  const c = { db, userId: 'u1', role: 'owner' as const, now: () => new Date('2026-09-14T10:00:00Z'), newId: (() => { let i = 0; return () => `id-${++i}`; })() };
  await settleWorker(c, { worker: worker({ id: 'w2', name: 'Sita', joining_date: '2026-09-01', status: 'left', left_date: '2026-09-08' }), property: property(),
    periodStart: '2026-09-01', today: '2026-09-14', paidNowPaise: 350000, recoveredPaise: 0, mode: 'cash' });
  expect((await listDueSettlements(db, property(), '2026-09-14')).map((r) => [r.worker.name, r.period.start]))
    .toEqual([['Asha', '2026-09-01'], ['Ram', '2026-09-06']]); // same end date → by name
});

const settlement = (over: Partial<Settlement> = {}): Settlement => ({
  id: 's1', property_id: 'p1', worker_id: 'w1', period_start: '2026-09-01', period_end: '2026-09-05', settled_on: '2026-09-06',
  pay_basis: 'daily', rate_paise: 50000, opening_balance_paise: 0, base_paise: 200000, offday_extra_paise: 0, overtime_paise: 12500,
  bonus_paise: 0, deduction_paise: 5000, earned_paise: 207500, paid_in_period_paise: 0, paid_now_paise: 177500, advance_recovered_paise: 30000,
  advance_after_paise: 0, closing_balance_paise: 0, note: null, voids_id: null, created_by: 'u1', created_by_role: 'owner',
  created_at: '2026-09-06T10:00:00Z', server_updated_at: null,
  summary: { present: 4, half: 0, absent: 1, hoursTotal: 0, daysOffPaid: 0, daysOffUnpaid: 0, offdayWorked: 0, otHours: 2, explanation: [] },
  ...over,
});

test('payslip view: only non-zero lines, carry forward wording', () => {
  const v = buildPayslipView(settlement(), false);
  expect(v.attendance.map((l) => l.key)).toEqual(['payslip.present', 'payslip.half', 'payslip.absent', 'payslip.otHours']);
  expect(v.earnings.map((l) => [l.key, l.amountPaise])).toEqual([['payslip.base', 200000], ['payslip.overtime', 12500]]);
  expect(v.deductions.map((l) => [l.key, l.amountPaise])).toEqual([['payslip.deduction', 5000], ['payslip.advanceRecovered', 30000]]);
  expect(v.carry.key).toBe('payslip.carryClear');
  expect(buildPayslipView(settlement({ closing_balance_paise: 2000 }), false).carry).toEqual({ key: 'payslip.carryOwed', amountPaise: 2000 });
  expect(buildPayslipView(settlement({ closing_balance_paise: -700 }), false).carry).toEqual({ key: 'payslip.carryOverpaid', amountPaise: 700 });
  expect(buildPayslipView(settlement({ summary: {} }), true).attendance).toEqual([]);
});

test('payslip view: a negative carried-in uses the overpaid wording with a positive amount', () => {
  expect(buildPayslipView(settlement({ opening_balance_paise: -700 }), false).balance[0])
    .toEqual({ key: 'settle.openingOverpaid', amountPaise: 700, amountInText: true });
  expect(buildPayslipView(settlement({ opening_balance_paise: 2000 }), false).balance[0])
    .toEqual({ key: 'payslip.opening', amountPaise: 2000 });
});

test('today rows are flagged settled', () => {
  const rows = buildTodayRows([worker()], property(), [], '2026-09-03', [], [], [settlement()]);
  expect(rows[0].settled).toBe(true);
  expect(buildTodayRows([worker()], property(), [], '2026-09-08', [], [], [settlement()])[0].settled).toBe(false);
});
