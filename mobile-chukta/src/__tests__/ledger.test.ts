import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, ResolvedSettings } from '../domain/types';

const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar', ...over,
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

test('daily: weekly-off entries are ignored and off days unpaid', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-09-06', today: '2026-09-07',
    attendance: [att('2026-09-06', 'present')],
  });
  expect(r.earnedPaise).toBe(50000); // only Monday 7th
});

test('hourly: normal day = shift hours, entries capped at shift', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'hourly', attendanceMode: 'hours' }), ratePaise: 6000,
    joiningDate: '2026-09-01', today: '2026-09-02', attendance: [att('2026-09-02', 'hours', 12)],
  });
  expect(r.earnedPaise).toBe(16 * 6000);
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
