import { activeSettlements, isSettled, lastSettledEnd } from '../domain/lock';
import { calculateWorkerLedger } from '../domain/ledger';
import { buildSettlementDraft, closingBalance, type LedgerData } from '../domain/settlement';
import { resolveSettings } from '../domain/settings';
import type { AdvanceEntry, Settlement, WagePayment } from '../domain/types';
import { att, property, worker } from './helpers/fixtures';

const W = worker(); // daily ₹500, joined 2026-09-01, weekly off Sunday
const S = resolveSettings(W, property());
const pay = (id: string, date: string, amount: number): WagePayment => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: amount, date, mode: 'cash', note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const advance = (id: string, date: string, amount: number): AdvanceEntry => ({
  id, property_id: 'p1', worker_id: 'w1', type: 'advance', amount_paise: amount, date, mode: 'cash', note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const empty = { attendance: [], advances: [], payments: [], daysOff: [], overtime: [], adjustments: [] };

test('first week: opening 0, 5 days earned, full advance recovered by default', () => {
  const d = buildSettlementDraft({ worker: W, settings: S, period: { start: '2026-09-01', end: '2026-09-05' },
    data: { ...empty, attendance: [att('2026-09-03', 'absent')], advances: [advance('a1', '2026-09-02', 30000)] } });
  expect(d.openingBalancePaise).toBe(0);
  expect(d.earnedPaise).toBe(200000);           // 1, 2, 4, 5 Sep
  expect(d.wageDuePaise).toBe(200000);
  expect(d.advanceOutstandingPaise).toBe(30000);
  expect(d.suggestedRecoveryPaise).toBe(30000);
  expect(d.suggestedPaidNowPaise).toBe(170000);
  expect(d.summary).toMatchObject({ present: 4, half: 0, absent: 1 }); // 1, 2, 4, 5 Sep; no entry on a working day = present
  expect(closingBalance(d, 170000, 30000)).toBe(0);
  expect(closingBalance(d, 100000, 30000)).toBe(70000);   // carried forward, owed
});

test('second week carries the first week\'s unpaid remainder as opening balance', () => {
  // Week 1 earned 250000; 100000 was paid on the 5th → opening 150000. Week 2 (6–12) earns 300000; 40000 paid on the 10th.
  const d = buildSettlementDraft({ worker: W, settings: S, period: { start: '2026-09-06', end: '2026-09-12' },
    data: { ...empty, payments: [pay('p1', '2026-09-05', 100000), pay('p2', '2026-09-10', 40000)] } });
  expect(d.openingBalancePaise).toBe(150000);
  expect(d.paidInPeriodPaise).toBe(40000);
  expect(d.wageDuePaise).toBe(410000);   // 150000 + 300000 − 40000
});

test('overpaid opening: paid now suggested 0, recovery capped at 0', () => {
  const d = buildSettlementDraft({ worker: W, settings: S, period: { start: '2026-09-06', end: '2026-09-12' },
    data: { ...empty, payments: [pay('p1', '2026-09-05', 700000)], advances: [advance('a1', '2026-09-02', 30000)] } });
  expect(d.openingBalancePaise).toBe(-450000);
  expect(d.wageDuePaise).toBe(-150000);
  expect(d.suggestedRecoveryPaise).toBe(0);
  expect(d.suggestedPaidNowPaise).toBe(0);
});

test('lock helpers ignore voided settlements and voids', () => {
  const st = (id: string, start: string, end: string, voids: string | null = null): Settlement => ({
    id, property_id: 'p1', worker_id: 'w1', period_start: start, period_end: end, settled_on: end, pay_basis: 'daily', rate_paise: 50000,
    opening_balance_paise: 0, base_paise: 0, offday_extra_paise: 0, overtime_paise: 0, bonus_paise: 0, deduction_paise: 0, earned_paise: 0,
    paid_in_period_paise: 0, paid_now_paise: 0, advance_recovered_paise: 0, advance_after_paise: 0, closing_balance_paise: 0,
    summary: {}, note: null, voids_id: voids, created_by: 'u1', created_by_role: 'owner', created_at: `${end}T10:00:00Z`, server_updated_at: null,
  });
  const rows = [st('s1', '2026-09-01', '2026-09-05'), st('s2', '2026-09-06', '2026-09-12'), st('v2', '2026-09-06', '2026-09-12', 's2')];
  expect(activeSettlements(rows).map((r) => r.id)).toEqual(['s1']);
  expect(lastSettledEnd(rows, 'w1')).toBe('2026-09-05');
  expect(isSettled(rows, 'w1', '2026-09-03')).toBe(true);
  expect(isSettled(rows, 'w1', '2026-09-08')).toBe(false);
  expect(isSettled(rows, 'w2', '2026-09-03')).toBe(false);
});

const allTime = (w: ReturnType<typeof worker>, s: typeof S, today: string, data: LedgerData) =>
  calculateWorkerLedger({ settings: s, ratePaise: w.rate_paise, joiningDate: w.joining_date, leftDate: w.left_date, today, ...data });

test('monthly divisor 26: chained months carry exactly, no rounding drift', () => {
  const w = worker({ pay_basis: 'monthly', rate_paise: 2600000, joining_date: '2026-07-01' });
  const s = resolveSettings(w, property({ monthly_divisor: '26' }));
  const data = { ...empty, attendance: [att('2026-07-08', 'absent'), att('2026-08-12', 'absent'), att('2026-09-16', 'absent')] };
  const drafts = [['2026-07-01', '2026-07-31'], ['2026-08-01', '2026-08-31'], ['2026-09-01', '2026-09-30']]
    .map(([start, end]) => buildSettlementDraft({ worker: w, settings: s, period: { start, end }, data }));
  expect(drafts[0].openingBalancePaise).toBe(0);
  expect(drafts[1].openingBalancePaise).toBe(drafts[0].wageDuePaise);
  expect(drafts[2].openingBalancePaise).toBe(drafts[1].wageDuePaise);
  expect(drafts[2].wageDuePaise).toBe(allTime(w, s, '2026-09-30', data).wageDuePaise);
  for (const d of drafts) expect(d.wageDuePaise).toBe(d.openingBalancePaise + d.earnedPaise - d.paidInPeriodPaise);
});

test('fractional overtime paise chain exactly across weeks', () => {
  const w = worker();
  const s = resolveSettings(w, property({ default_attendance_mode: 'hours', ot_multiplier: 1.5 }));
  const data = { ...empty, attendance: ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-08', '2026-09-09', '2026-09-10']
    .map((d) => att(d, 'hours', { hours: 9.5 })) };
  const w1 = buildSettlementDraft({ worker: w, settings: s, period: { start: '2026-09-01', end: '2026-09-06' }, data });
  const w2 = buildSettlementDraft({ worker: w, settings: s, period: { start: '2026-09-07', end: '2026-09-13' }, data });
  expect(w2.openingBalancePaise).toBe(w1.wageDuePaise);
  expect(w2.wageDuePaise).toBe(allTime(w, s, '2026-09-13', data).wageDuePaise);
  expect(w2.wageDuePaise).toBe(w2.openingBalancePaise + w2.earnedPaise - w2.paidInPeriodPaise);
});

test('final period of a worker who left includes a payment dated after leaving', () => {
  const w = worker({ left_date: '2026-09-09', status: 'left' });
  const d = buildSettlementDraft({ worker: w, settings: S, period: { start: '2026-09-06', end: '2026-09-09' },
    data: { ...empty, payments: [pay('p9', '2026-09-20', 100000)] } });
  expect(d.paidInPeriodPaise).toBe(100000);
  expect(d.wageDuePaise).toBe(d.openingBalancePaise + d.earnedPaise - 100000);
});
