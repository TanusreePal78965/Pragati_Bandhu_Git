import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, ResolvedSettings } from '../domain/types';

const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar',
  offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null, ...over,
});
let n = 0;
const att = (date: string, status: AttendanceEntry['status'], hours: number | null = null): AttendanceEntry => ({
  id: `a${n++}`, property_id: 'p', worker_id: 'w', date, status, hours, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const base = { leftDate: null, advances: [], payments: [] };

test('spec example: daily ₹500, Sunday off, Sep 1–7, one absence, one 4/8h day → ₹2,250', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-09-01', today: '2026-09-07',
    attendance: [att('2026-09-03', 'absent'), att('2026-09-05', 'hours', 4)],
  });
  expect(r.earnedPaise).toBe(225000);
  expect(r.explanation).toEqual([{ key: 'ledger.explain.daily', params: { days: 4.5, rate: 50000 } }]);
});

test('daily: work on the weekly off is paid as work on a day off (1×); off days otherwise unpaid', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-09-06', today: '2026-09-07',
    attendance: [att('2026-09-06', 'present')],
  });
  // Monday 7th (50000) + Sunday worked at 1× as extra (50000); spec §5.5.
  expect(r.earnedPaise).toBe(100000);
});

test('hourly: base capped at shift; hours above shift are automatic overtime (spec §5.7)', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'hourly', attendanceMode: 'hours' }), ratePaise: 6000,
    joiningDate: '2026-09-01', today: '2026-09-02', attendance: [att('2026-09-02', 'hours', 12)],
  });
  expect(r.basePaise).toBe(16 * 6000);
  expect(r.overtimePaise).toBe(4 * 6000);
  expect(r.earnedPaise).toBe(120000);
});

test('weekly: off day paid, absence deducts rate/7', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'weekly' }), ratePaise: 350000, joiningDate: '2026-09-01', today: '2026-09-07',
    attendance: [att('2026-09-02', 'absent')],
  });
  expect(r.earnedPaise).toBe(300000); // 6 of 7 days × 3500/7
});

test.each([
  ['calendar', '2026-02-01', '2026-02-28'],
  ['26', '2026-02-01', '2026-02-28'],
  ['30', '2026-02-01', '2026-02-28'],
  ['30', '2026-08-01', '2026-08-31'],
] as const)('monthly full month with no absences = exact salary (divisor %s)', (divisor, from, to) => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly', monthlyDivisor: divisor }), ratePaise: 3000000, joiningDate: from, today: to, attendance: [],
  });
  expect(r.earnedPaise).toBe(3000000);
});

test('monthly calendar: one absence in September deducts salary/30', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-01', today: '2026-09-30',
    attendance: [att('2026-09-10', 'absent')],
  });
  expect(r.earnedPaise).toBe(2900000);
});

test('monthly: joining mid-month pays eligible days only', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-21', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(1000000); // 10 days × 1000
});

test('monthly: leaving mid-month stops at left_date', () => {
  const r = calculateWorkerLedger({
    ...base, leftDate: '2026-09-10', settings: S({ payBasis: 'monthly' }), ratePaise: 3000000,
    joiningDate: '2026-09-01', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(1000000);
});

test('future joining date earns nothing', () => {
  const r = calculateWorkerLedger({ ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-10-01', today: '2026-09-30', attendance: [] });
  expect(r.earnedPaise).toBe(0);
});

test('correction: latest entry wins, and voided money rows are excluded', () => {
  const r = calculateWorkerLedger({
    settings: S(), ratePaise: 50000, joiningDate: '2026-09-01', today: '2026-09-01', leftDate: null,
    attendance: [
      { ...att('2026-09-01', 'absent'), created_at: '2026-09-01T09:00:00Z' },
      { ...att('2026-09-01', 'present'), created_at: '2026-09-01T12:00:00Z' },
    ],
    advances: [
      { id: 'x1', property_id: 'p', worker_id: 'w', type: 'advance', amount_paise: 500000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
      { id: 'x2', property_id: 'p', worker_id: 'w', type: 'advance', amount_paise: 500000, date: '2026-09-01', mode: 'cash', note: null, voids_id: 'x1', created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
      { id: 'x3', property_id: 'p', worker_id: 'w', type: 'advance', amount_paise: 50000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
      { id: 'x4', property_id: 'p', worker_id: 'w', type: 'repayment', amount_paise: 10000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
    ],
    payments: [
      { id: 'y1', property_id: 'p', worker_id: 'w', amount_paise: 20000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
    ],
  });
  expect(r.earnedPaise).toBe(50000);
  expect(r.paidPaise).toBe(20000);
  expect(r.wageDuePaise).toBe(30000);
  expect(r.advanceOutstandingPaise).toBe(40000);
});

test('monthly divisor 26 partial month counts working days only', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly', monthlyDivisor: '26' }), ratePaise: 2600000, joiningDate: '2026-09-21', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(900000); // 9 working days (Sun 27th off) × 1,00,000
  expect(r.explanation[0].params).toMatchObject({ divisor: 26, eligibleDays: 9 });
});

test('monthly divisor 30 partial month', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly', monthlyDivisor: '30' }), ratePaise: 3000000, joiningDate: '2026-09-21', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(1000000);
});

test('monthly floors at zero when every working day is absent', () => {
  const absences: AttendanceEntry[] = [];
  for (let d = 1; d <= 31; d++) absences.push(att(`2026-10-${String(d).padStart(2, '0')}`, 'absent'));
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly', monthlyDivisor: '26' }), ratePaise: 2600000, joiningDate: '2026-10-01', today: '2026-10-31', attendance: absences,
  });
  expect(r.earnedPaise).toBe(0);
});

test('weeklyOff null makes every day a working day', () => {
  const r = calculateWorkerLedger({ ...base, settings: S({ weeklyOff: null }), ratePaise: 50000, joiningDate: '2026-09-01', today: '2026-09-07', attendance: [] });
  expect(r.earnedPaise).toBe(350000);
});

test('hourly half_day pays half a shift', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'hourly', attendanceMode: 'hours' }), ratePaise: 6000, joiningDate: '2026-09-01', today: '2026-09-01',
    attendance: [att('2026-09-01', 'half_day')],
  });
  expect(r.earnedPaise).toBe(24000);
});

test('monthly across several months', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3100000, joiningDate: '2026-07-15', today: '2026-09-10', attendance: [],
  });
  expect(r.earnedPaise).toBe(5833333); // 17/31 + full Aug + 10/30
});

test('half-up rounding is exact for odd-paise rates (multiply before divide)', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly', monthlyDivisor: '26' }), ratePaise: 106513, joiningDate: '2026-09-16', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(53257); // 13 working days × 106513 / 26 = 53256.5 → 53257
});

test('non-positive shift hours fall back to 8', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'hourly', attendanceMode: 'hours', shiftHours: 0 }), ratePaise: 6000, joiningDate: '2026-09-01', today: '2026-09-01', attendance: [],
  });
  expect(r.earnedPaise).toBe(48000);
});

test('explanation key: whole month vs partial month', () => {
  const whole = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-01', today: '2026-09-30', attendance: [],
  });
  expect(whole.explanation.map((e) => e.key)).toEqual(['ledger.explain.monthly']);
  const partial = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-21', today: '2026-09-30', attendance: [],
  });
  expect(partial.explanation[0]).toMatchObject({ key: 'ledger.explain.monthlyPartial', params: { eligibleDays: 10 } });
});
