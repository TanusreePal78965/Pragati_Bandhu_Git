import { calculateWorkerLedger } from '../domain/ledger';
import { resolveSettings } from '../domain/settings';
import type { AdvanceEntry, EarningAdjustment, WagePayment } from '../domain/types';
import { property, worker } from './helpers/fixtures';

const pay = (id: string, date: string, amount: number, over: Partial<WagePayment> = {}): WagePayment => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: amount, date, mode: 'cash', note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});
const adv = (id: string, type: AdvanceEntry['type'], date: string, amount: number, over: Partial<AdvanceEntry> = {}): AdvanceEntry => ({
  id, property_id: 'p1', worker_id: 'w1', type, amount_paise: amount, date, mode: null, note: type === 'writeoff' ? 'x' : null,
  voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});
const bonus = (id: string, date: string, amount: number): EarningAdjustment => ({
  id, property_id: 'p1', worker_id: 'w1', type: 'bonus', amount_paise: amount, date, note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});

// Daily ₹500, joined 2026-09-01, weekly off Sunday (fixture default). 2026-09-06 and -13 are Sundays.
const W = worker();
const base = {
  settings: resolveSettings(W, property()), ratePaise: 50000, joiningDate: '2026-09-01', leftDate: null, today: '2026-09-20',
  attendance: [], daysOff: [], overtime: [],
};

test('no window: unchanged except settlement repayments also count as paid', () => {
  const l = calculateWorkerLedger({ ...base, advances: [adv('a1', 'advance', '2026-09-02', 30000),
    adv('r1', 'repayment', '2026-09-05', 20000, { settlement_id: 's1' }), adv('r2', 'repayment', '2026-09-08', 5000)],
    payments: [pay('p1', '2026-09-05', 100000)], adjustments: [] });
  expect(l.paidPaise).toBe(120000);             // 100000 cash + 20000 settlement repayment; r2 is an ordinary repayment
  expect(l.advanceOutstandingPaise).toBe(5000); // 30000 − 20000 − 5000
});

test('window: one week (Sun 6 – Sat 12) earns 6 days; money and bonuses outside the window are ignored', () => {
  const l = calculateWorkerLedger({ ...base, window: { from: '2026-09-06', to: '2026-09-12' },
    advances: [adv('a1', 'advance', '2026-09-02', 30000), adv('a2', 'advance', '2026-09-15', 1000)],
    payments: [pay('p1', '2026-09-05', 100000), pay('p2', '2026-09-10', 40000), pay('p3', '2026-09-14', 9000)],
    adjustments: [bonus('b1', '2026-09-04', 700), bonus('b2', '2026-09-11', 1100)] });
  expect(l.basePaise).toBe(300000);   // 7–12 Sep = 6 working days × 50000 (Sun 6th unpaid)
  expect(l.bonusPaise).toBe(1100);
  expect(l.paidPaise).toBe(40000);
  expect(l.advanceOutstandingPaise).toBe(30000); // advances dated ≤ to only
});

test('window to the day before a period = the opening balance', () => {
  const l = calculateWorkerLedger({ ...base, window: { from: '2026-09-01', to: '2026-09-05' },
    advances: [], payments: [pay('p1', '2026-09-05', 100000), pay('p2', '2026-09-10', 40000)], adjustments: [] });
  expect(l.earnedPaise).toBe(250000); // 1–5 Sep
  expect(l.wageDuePaise).toBe(150000);
});

test('window: a void dated outside the window still cancels its target inside it', () => {
  const l = calculateWorkerLedger({ ...base, window: { from: '2026-09-06', to: '2026-09-12' }, advances: [], adjustments: [],
    payments: [pay('p2', '2026-09-10', 40000), pay('v2', '2026-09-10', 40000, { voids_id: 'p2', created_at: '2026-09-16T10:00:00Z' })] });
  expect(l.paidPaise).toBe(0);
});

test('window is clipped to joining and leaving dates', () => {
  const l = calculateWorkerLedger({ ...base, joiningDate: '2026-09-09', leftDate: '2026-09-11',
    window: { from: '2026-09-06', to: '2026-09-12' }, advances: [], payments: [], adjustments: [] });
  expect(l.basePaise).toBe(150000); // 9, 10, 11
});

test('monthly: a full calendar-month window equals the month in the all-time ledger', () => {
  const s = resolveSettings(worker({ pay_basis: 'monthly', rate_paise: 3000000 }), property());
  const common = { ...base, settings: s, ratePaise: 3000000, advances: [], payments: [], adjustments: [] };
  const month = calculateWorkerLedger({ ...common, window: { from: '2026-09-01', to: '2026-09-30' } });
  expect(month.basePaise).toBe(3000000);
});
