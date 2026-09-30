import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { upsertLocal } from '../repos/write';
import { buildTodayRows } from '../view/today';
import { buildMonthGrid, shiftMonth } from '../view/monthGrid';
import { buildMoneyHistory } from '../view/moneyHistory';
import { getWorkerLedger, listWorkerSummaries } from '../view/ledgerQueries';
import { resolveSettings } from '../domain/settings';
import { adv, att, pay, property, worker } from './helpers/fixtures';

// 2026-09-01 is a Tuesday; 2026-09-06 is a Sunday.

test('today rows: weekly off, latest entry wins, not-joined and left workers are hidden', () => {
  const ws = [
    worker({ id: 'w1' }),
    worker({ id: 'w2', joining_date: '2026-09-10' }),
    worker({ id: 'w3', status: 'left', left_date: '2026-09-02' }),
    worker({ id: 'w4', weekly_off_override: 1, weekly_off: 1 }),
  ];
  const entries = [
    att('2026-09-07', 'absent', { worker_id: 'w1', created_at: '2026-09-07T09:00:00Z' }),
    att('2026-09-07', 'present', { worker_id: 'w1', created_at: '2026-09-07T11:00:00Z' }),
  ];
  const rows = buildTodayRows(ws, property(), entries, '2026-09-07'); // Monday
  expect(rows.map((r) => [r.worker.id, r.isOff, r.entry?.status ?? null])).toEqual([['w1', false, 'present'], ['w4', true, null]]);
  expect(buildTodayRows([worker()], property(), [], '2026-09-06')[0].isOff).toBe(true);
});

test('today rows carry the resolved attendance mode (hourly forces hours)', () => {
  const rows = buildTodayRows([worker({ pay_basis: 'hourly' })], property(), [], '2026-09-07');
  expect(rows[0].settings.attendanceMode).toBe('hours');
});

test('month grid: leading blanks, outside / future / off / working cells with credit', () => {
  const g = buildMonthGrid({
    year: 2026, month: 9, settings: resolveSettings(worker(), property()), joiningDate: '2026-09-02', leftDate: null, today: '2026-09-08',
    attendance: [att('2026-09-03', 'absent'), att('2026-09-04', 'half_day'), att('2026-09-05', 'hours', { hours: 4 })],
  });
  expect(g.leadingBlanks).toBe(2);
  expect(g.cells).toHaveLength(30);
  const kind = (d: number) => g.cells[d - 1].kind;
  expect([kind(1), kind(2), kind(6), kind(9)]).toEqual(['outside', 'working', 'off', 'future']);
  expect(g.cells.slice(1, 5).map((c) => c.credit)).toEqual([1, 0, 0.5, 0.5]);
  expect(g.cells[2].entry?.status).toBe('absent');
});

test('shiftMonth wraps years', () => {
  expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
});

test('money history: newest first; voids flagged; only untouched entries can be corrected', () => {
  const items = buildMoneyHistory(
    [adv('a1'), adv('a2', { voids_id: 'a1', created_at: '2026-09-03T10:00:00Z' }), adv('a3', { type: 'repayment', date: '2026-09-06' })],
    [pay('p1')],
  );
  expect(items.map((i) => [i.id, i.kind, i.isVoid, i.isVoided, i.canCorrect])).toEqual([
    ['a3', 'repayment', false, false, true],
    ['p1', 'payment', false, false, true],
    ['a2', 'advance', true, false, false],
    ['a1', 'advance', false, true, false],
  ]);
});

async function seeded() {
  const db = openTestDb();
  await migrate(db);
  await upsertLocal(db, 'properties', property());
  await upsertLocal(db, 'workers', worker());
  await upsertLocal(db, 'workers', worker({ id: 'w2', name: 'Sita' }));
  await upsertLocal(db, 'attendance_entries', att('2026-09-03', 'absent'));
  await upsertLocal(db, 'attendance_entries', att('2026-09-08', 'absent')); // after "today": ignored
  await upsertLocal(db, 'advance_entries', adv('a1'));
  await upsertLocal(db, 'wage_payments', pay('p1'));
  return db;
}

test('worker ledger from SQLite: Sep 1–7, Sunday off, one absence → 5 days; minus payment; advance', async () => {
  const db = await seeded();
  const l = await getWorkerLedger(db, worker(), property(), '2026-09-07');
  expect(l).toMatchObject({ earnedPaise: 250000, paidPaise: 50000, wageDuePaise: 200000, advanceOutstandingPaise: 100000 });
});

test('summaries compute every worker from three batched queries', async () => {
  const db = await seeded();
  const s = await listWorkerSummaries(db, property(), '2026-09-07');
  expect(s.map((x) => [x.worker.name, x.ledger.wageDuePaise, x.ledger.advanceOutstandingPaise])).toEqual([
    ['Ram', 200000, 100000],
    ['Sita', 300000, 0],
  ]);
});
