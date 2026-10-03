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

// ---- Final-review money-path tests (spec section 5) ----
const MONTH = { joiningDate: '2026-09-01', today: '2026-09-30' };

test('monthly /26, 26000: all_unpaid full holiday + by-basis half closure', () => {
  const s = S({ payBasis: 'monthly', monthlyDivisor: '26' });
  const hol = off('2026-09-10', { pay_rule: 'all_unpaid' });
  const half = off('2026-09-15', { kind: 'closure', portion: 'half' });
  // perDay = 2,600,000 / 26 = 100,000; whole month so base = 2,600,000.
  // Holiday all_unpaid deducts 1 day (100,000). By-basis half closure on monthly: off half paid (0.5) + open half
  // worked (no entry = 0.5) = 1 -> no deduction. Total 2,600,000 - 100,000 = 2,500,000.
  expect(run(s, 2600000, [hol, half], [], MONTH).earnedPaise).toBe(2500000);
  // Absent on the open half: work half 0 -> deducts 0.5 day (50,000). Total 2,600,000 - 100,000 - 50,000 = 2,450,000.
  expect(run(s, 2600000, [hol, half], [att('2026-09-15', 'absent')], MONTH).earnedPaise).toBe(2450000);
});

test('monthly /26, joined on the 15th, one unpaid holiday', () => {
  const s = S({ payBasis: 'monthly', monthlyDivisor: '26' });
  // Sept 15..30 = 16 days; Sundays 20 and 27 are weekly offs -> 14 eligible. perDay = 100,000.
  // base = 14 * 100,000 = 1,400,000; unpaid holiday on Wed 23rd deducts 1 day -> 1,300,000.
  const r = run(s, 2600000, [off('2026-09-23', { pay_rule: 'all_unpaid' })], [], { joiningDate: '2026-09-15', today: '2026-09-30' });
  expect(r.earnedPaise).toBe(1300000);
});

test('monthly /30, half closure with 2 of 8 hours worked', () => {
  const s = S({ payBasis: 'monthly', monthlyDivisor: '30', attendanceMode: 'hours' });
  const att2 = [att('2026-09-15', 'hours', 2)];
  // perDay = 3,000,000 / 30 = 100,000. Work half = min(2/8, 0.5) = 0.25.
  // all_unpaid: off half 0 -> credit 0.25, deducts 0.75 day = 75,000 -> 2,925,000 (the reviewer's 29,250).
  const unpaid = off('2026-09-15', { kind: 'closure', portion: 'half', pay_rule: 'all_unpaid' });
  expect(run(s, 3000000, [unpaid], att2, MONTH).earnedPaise).toBe(2925000);
  // by_basis (monthly = paid off half): credit 0.5 + 0.25 = 0.75, deducts 0.25 day = 25,000 -> 2,975,000.
  const byBasis = off('2026-09-15', { kind: 'closure', portion: 'half' });
  expect(run(s, 3000000, [byBasis], att2, MONTH).earnedPaise).toBe(2975000);
});

test('hourly 100/h, 8h shift, by-basis half closure, 6h worked -> open half capped at half a shift', () => {
  const s = S({ payBasis: 'hourly', attendanceMode: 'hours' });
  const half = off('2026-09-03', { kind: 'closure', portion: 'half' });
  // Off half unpaid for hourly (0); work half = min(6/8, 0.5) = 0.5 -> 0.5 * 8h = 4h * 10,000 = 40,000.
  expect(run(s, 10000, [half], [att('2026-09-03', 'hours', 6)], { joiningDate: '2026-09-03', today: '2026-09-03' }).earnedPaise).toBe(40000);
});

test('a half-portion days_off row on the weekly off counts as a full unpaid day off for a daily worker', () => {
  const half = off('2026-09-06', { kind: 'closure', portion: 'half' });
  // Sun 6th is the weekly off (always full, unpaid for daily). Other days Tue-Sat + Mon = 6 * 500 = 3,000.
  const r = run(S(), 50000, [half]);
  expect(r.earnedPaise).toBe(300000);
  expect(r.explanation).toEqual(expect.arrayContaining([{ key: 'ledger.explain.daysOffUnpaid', params: { days: 1 } }]));
  // Worked the whole day: a full day off, so work credit 1 * 500 * 1x = 500 extra (a half portion would give 0.5 open half only).
  expect(run(S(), 50000, [half], [att('2026-09-06', 'present')]).earnedPaise).toBe(350000);
});

test('a day off dated after left_date is ignored', () => {
  // Left 2026-09-04: Tue 1..Fri 4 = 4 days * 500 = 2,000. A paid holiday on Sat 5th adds nothing.
  const r = run(S(), 50000, [off('2026-09-05', { pay_rule: 'all_paid' })], [], { leftDate: '2026-09-04' });
  expect(r.earnedPaise).toBe(200000);
});

test('monthly /26 with a mid-month leaving date: paid vs unpaid holiday', () => {
  const s = S({ payBasis: 'monthly', monthlyDivisor: '26' });
  const left = { leftDate: '2026-09-12', today: '2026-09-30' };
  // Sept 1..12 = 12 days; Sunday 6th is a weekly off -> 11 eligible. perDay = 100,000 -> base 1,100,000.
  // Paid holiday on Wed 9th: no deduction -> 1,100,000. Unpaid: -100,000 -> 1,000,000.
  expect(run(s, 2600000, [off('2026-09-09', { pay_rule: 'all_paid' })], [], left).earnedPaise).toBe(1100000);
  expect(run(s, 2600000, [off('2026-09-09', { pay_rule: 'all_unpaid' })], [], left).earnedPaise).toBe(1000000);
});
