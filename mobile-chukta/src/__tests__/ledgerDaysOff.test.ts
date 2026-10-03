import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, DayOff, ResolvedSettings } from '../domain/types';

// 2026-09-01 is a Tuesday; Sundays are 6, 13, 20, 27. The default weekly off is Sunday (0).
const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar',
  offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null, ...over,
});
let n = 0;
const att = (date: string, status: AttendanceEntry['status'], hours: number | null = null): AttendanceEntry => ({
  id: `a${n++}`, property_id: 'p', worker_id: 'w', date, status, hours, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const off = (date: string, over: Partial<DayOff> = {}): DayOff => ({
  id: `d${n++}`, property_id: 'p', date, name: 'H', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', is_active: 1,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T09:00:00Z`, server_updated_at: null, ...over,
});
const week = { joiningDate: '2026-09-01', today: '2026-09-07', leftDate: null, advances: [], payments: [] };
const run = (s: ResolvedSettings, rate: number, daysOff: DayOff[], attendance: AttendanceEntry[] = [], extra = {}) =>
  calculateWorkerLedger({ ...week, settings: s, ratePaise: rate, attendance, daysOff, ...extra });

test('daily: a by-basis holiday is unpaid; all_paid pays it', () => {
  expect(run(S(), 50000, [off('2026-09-02')]).earnedPaise).toBe(250000);
  expect(run(S(), 50000, [off('2026-09-02', { pay_rule: 'all_paid' })]).earnedPaise).toBe(300000);
});

test('weekly: a by-basis holiday is paid; all_unpaid deducts a day', () => {
  expect(run(S({ payBasis: 'weekly' }), 70000, [off('2026-09-02')]).earnedPaise).toBe(70000);
  expect(run(S({ payBasis: 'weekly' }), 70000, [off('2026-09-02', { pay_rule: 'all_unpaid' })]).earnedPaise).toBe(60000);
});

test('monthly: a by-basis holiday keeps the full salary; all_unpaid deducts salary/30', () => {
  const month = { joiningDate: '2026-09-01', today: '2026-09-30' };
  const s = S({ payBasis: 'monthly' });
  expect(run(s, 3000000, [off('2026-09-10')], [], month).earnedPaise).toBe(3000000);
  expect(run(s, 3000000, [off('2026-09-10', { pay_rule: 'all_unpaid' })], [], month).earnedPaise).toBe(2900000);
});

test('hourly: an all_paid holiday pays a full shift', () => {
  expect(run(S({ payBasis: 'hourly', attendanceMode: 'hours' }), 6000, [off('2026-09-02', { pay_rule: 'all_paid' })]).earnedPaise)
    .toBe(6 * 8 * 6000);
});

test('a holiday on the weekly off counts once and is paid if either rule pays', () => {
  // daily: weekly off is unpaid, the holiday says all_paid → paid once.
  expect(run(S(), 50000, [off('2026-09-06', { pay_rule: 'all_paid' })]).earnedPaise).toBe(350000);
  // monthly: weekly off is paid, the holiday says all_unpaid → still paid (either pays).
  const month = { joiningDate: '2026-09-01', today: '2026-09-30' };
  expect(run(S({ payBasis: 'monthly' }), 3000000, [off('2026-09-06', { pay_rule: 'all_unpaid' })], [], month).earnedPaise).toBe(3000000);
});

test('half-day closure (daily, unpaid off half) with each attendance status', () => {
  const half = off('2026-09-03', { kind: 'closure', portion: 'half' });
  expect(run(S(), 50000, [half]).earnedPaise).toBe(275000); // no entry → works the open half
  expect(run(S(), 50000, [half], [att('2026-09-03', 'absent')]).earnedPaise).toBe(250000);
  expect(run(S(), 50000, [half], [att('2026-09-03', 'half_day')]).earnedPaise).toBe(275000);
  expect(run(S(), 50000, [half], [att('2026-09-03', 'hours', 2)]).earnedPaise).toBe(262500); // 2h / 8h = 0.25
  expect(run(S(), 50000, [{ ...half, pay_rule: 'all_paid' }]).earnedPaise).toBe(300000); // paid off half + worked half
});

test('a deactivated holiday has no effect', () => {
  expect(run(S(), 50000, [off('2026-09-02', { is_active: 0 })]).earnedPaise).toBe(300000);
});

test('days off before joining are ignored', () => {
  expect(run(S(), 50000, [off('2026-08-30', { pay_rule: 'all_paid' })]).earnedPaise).toBe(300000);
});

test('the explanation counts paid and unpaid days off', () => {
  const r = run(S(), 50000, [off('2026-09-02'), off('2026-09-03', { pay_rule: 'all_paid' })]);
  expect(r.explanation).toEqual(expect.arrayContaining([
    { key: 'ledger.explain.daysOffPaid', params: { days: 1 } },
    { key: 'ledger.explain.daysOffUnpaid', params: { days: 1 } },
  ]));
  expect(r.basePaise).toBe(r.earnedPaise);
});
