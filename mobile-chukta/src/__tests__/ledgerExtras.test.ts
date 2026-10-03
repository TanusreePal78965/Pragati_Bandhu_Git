// mobile-chukta/src/__tests__/ledgerExtras.test.ts
import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, EarningAdjustment, OvertimeEntry, ResolvedSettings } from '../domain/types';

// 2026-09-01 is a Tuesday; Sunday 2026-09-06 is the weekly off.
const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar',
  offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null, ...over,
});
let n = 0;
const att = (date: string, status: AttendanceEntry['status'], over: Partial<AttendanceEntry> = {}): AttendanceEntry => ({
  id: `a${n++}`, property_id: 'p', worker_id: 'w', date, status, hours: null, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});
const ot = (date: string, hours: number, over: Partial<OvertimeEntry> = {}): OvertimeEntry => ({
  id: `o${n++}`, property_id: 'p', worker_id: 'w', date, hours, custom_amount_paise: null, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T18:00:00Z`, server_updated_at: null, ...over,
});
const adj = (id: string, type: EarningAdjustment['type'], amount: number, over: Partial<EarningAdjustment> = {}): EarningAdjustment => ({
  id, property_id: 'p', worker_id: 'w', type, amount_paise: amount, date: '2026-09-05', note: type === 'deduction' ? 'damage' : null,
  voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null, ...over,
});
const week = { joiningDate: '2026-09-01', today: '2026-09-07', leftDate: null, advances: [], payments: [] };
const run = (s: ResolvedSettings, rate: number, extra: Partial<Parameters<typeof calculateWorkerLedger>[0]> = {}) =>
  calculateWorkerLedger({ ...week, settings: s, ratePaise: rate, attendance: [], ...extra });

test('work on the weekly off pays an extra day at the multiplier', () => {
  const r = run(S(), 50000, { attendance: [att('2026-09-06', 'present')] });
  expect([r.basePaise, r.offdayExtraPaise, r.earnedPaise]).toEqual([300000, 50000, 350000]);
  expect(run(S({ offdayMultiplier: 1.5 }), 50000, { attendance: [att('2026-09-06', 'present')] }).offdayExtraPaise).toBe(75000);
  expect(run(S(), 50000, { attendance: [att('2026-09-06', 'half_day')] }).offdayExtraPaise).toBe(25000);
  expect(run(S(), 50000, { attendance: [att('2026-09-06', 'absent')] }).offdayExtraPaise).toBe(0);
});

test('an owner custom amount replaces the computed day-off pay', () => {
  const r = run(S({ offdayMultiplier: 2 }), 50000, { attendance: [att('2026-09-06', 'present', { custom_amount_paise: 40000 })] });
  expect(r.offdayExtraPaise).toBe(40000);
});

test('monthly: work on a day off uses that month\'s per-day rate and keeps the salary whole', () => {
  const r = run(S({ payBasis: 'monthly' }), 3000000, { today: '2026-09-30', attendance: [att('2026-09-06', 'present')] });
  expect([r.basePaise, r.offdayExtraPaise]).toEqual([3000000, 100000]);
});

test('explicit overtime: multiplier, fixed rate, custom amount', () => {
  expect(run(S({ otMultiplier: 1.5 }), 50000, { overtime: [ot('2026-09-03', 2)] }).overtimePaise).toBe(18750); // 2h × ₹62.50 × 1.5
  expect(run(S({ otMode: 'fixed', otRatePaise: 6000 }), 50000, { overtime: [ot('2026-09-03', 2)] }).overtimePaise).toBe(12000);
  expect(run(S(), 50000, { overtime: [ot('2026-09-03', 2, { custom_amount_paise: 10000 })] }).overtimePaise).toBe(10000);
});

test('fixed mode with no rate falls back to 1× the hourly base', () => {
  expect(run(S({ otMode: 'fixed', otRatePaise: null }), 50000, { overtime: [ot('2026-09-03', 2)] }).overtimePaise).toBe(12500);
});

test('hours above the shift become overtime automatically; an explicit entry replaces that', () => {
  const s = S({ payBasis: 'hourly', attendanceMode: 'hours' });
  const auto = run(s, 6000, { attendance: [att('2026-09-03', 'hours', { hours: 10 })] });
  expect([auto.basePaise, auto.overtimePaise]).toEqual([6 * 8 * 6000, 2 * 6000]);
  const explicit = run(s, 6000, { attendance: [att('2026-09-03', 'hours', { hours: 10 })], overtime: [ot('2026-09-03', 1)] });
  expect(explicit.overtimePaise).toBe(6000);
});

test('the latest overtime entry for a date wins; 0 hours clears it', () => {
  const r = run(S(), 50000, { overtime: [ot('2026-09-03', 2, { created_at: '2026-09-03T18:00:00Z' }), ot('2026-09-03', 0, { created_at: '2026-09-03T19:00:00Z' })] });
  expect(r.overtimePaise).toBe(0);
});

test('monthly overtime uses that month\'s hourly base', () => {
  const r = run(S({ payBasis: 'monthly' }), 3000000, { today: '2026-09-30', overtime: [ot('2026-09-10', 2)] });
  expect(r.overtimePaise).toBe(25000); // (₹30,000 / 30) / 8 × 2
});

test('bonus adds, deduction subtracts, voided rows are ignored', () => {
  const r = run(S(), 50000, { adjustments: [adj('b1', 'bonus', 50000), adj('d1', 'deduction', 20000), adj('b2', 'bonus', 99999), adj('v', 'bonus', 99999, { voids_id: 'b2' })] });
  expect([r.bonusPaise, r.deductionPaise, r.earnedPaise]).toEqual([50000, 20000, 300000 + 50000 - 20000]);
});

test('earned is the sum of the rounded components, and explanation lines appear only when non-zero', () => {
  const r = run(S({ otMultiplier: 1.5 }), 50000, {
    attendance: [att('2026-09-06', 'present')], overtime: [ot('2026-09-03', 2)], adjustments: [adj('b1', 'bonus', 50000)],
  });
  expect(r.earnedPaise).toBe(r.basePaise + r.offdayExtraPaise + r.overtimePaise + r.bonusPaise - r.deductionPaise);
  expect(r.explanation.map((e) => e.key)).toEqual(
    ['ledger.explain.daily', 'ledger.explain.offdayWork', 'ledger.explain.overtime', 'ledger.explain.bonus']);
  expect(r.explanation[2].params).toEqual({ hours: 2, amount: 18750 });
});

test('a deduction larger than earned makes wage due negative', () => {
  const r = run(S(), 50000, { adjustments: [adj('d1', 'deduction', 500000)] });
  expect(r.wageDuePaise).toBe(300000 - 500000);
});

test('a 0-hour explicit overtime entry clears the date, even with a custom amount and hours above the shift', () => {
  const s = S({ payBasis: 'hourly', attendanceMode: 'hours' });
  const r = run(s, 6000, {
    attendance: [att('2026-09-03', 'hours', { hours: 10 })],
    overtime: [ot('2026-09-03', 0, { custom_amount_paise: 50000 })],
  });
  expect(r.overtimePaise).toBe(0);
});

test('overtime and day-off work dated before joining or after today are ignored', () => {
  const r = run(S(), 50000, {
    joiningDate: '2026-09-02', today: '2026-09-05',
    overtime: [ot('2026-09-01', 2), ot('2026-09-06', 2)],
    attendance: [att('2026-08-30', 'present'), att('2026-09-06', 'present')],
  });
  expect([r.overtimePaise, r.offdayExtraPaise]).toEqual([0, 0]);
});

test('a voided deduction does not count', () => {
  const r = run(S(), 50000, { adjustments: [adj('d1', 'deduction', 20000), adj('v', 'deduction', 20000, { voids_id: 'd1' })] });
  expect(r.deductionPaise).toBe(0);
  expect(r.earnedPaise).toBe(300000);
});

test('fractional components are each rounded half-up, then summed', () => {
  const s = S({ payBasis: 'hourly', attendanceMode: 'hours', otMultiplier: 1.5, offdayMultiplier: 1.5 });
  const r = run(s, 6251, {
    attendance: [att('2026-09-06', 'hours', { hours: 3 })],
    overtime: [ot('2026-09-03', 1.25)],
  });
  expect(r.offdayExtraPaise).toBe(28130); // 3/8 x 50008 x 1.5 = 28129.5
  expect(r.overtimePaise).toBe(11721); // 1.25 x 6251 x 1.5 = 11720.625
  expect(r.earnedPaise).toBe(r.basePaise + 28130 + 11721);
  expect(r.basePaise).toBe(6 * 8 * 6251);
});
