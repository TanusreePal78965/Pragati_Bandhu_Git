import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { RepoContext } from '../repos/context';
import { markAttendance } from '../repos/attendance';
import { addDayOff, updateDayOff } from '../repos/daysOff';
import { addAdjustment, addAdvance, addPayment, listPayments, voidPayment } from '../repos/money';
import { addOvertime } from '../repos/overtime';
import { getDueSettlement, listSettlements, settleWorker, unlockSettlement } from '../repos/settlements';
import { insertManyAndEnqueue, upsertLocal } from '../repos/write';
import { property, worker } from './helpers/fixtures';

async function ctx(role: RepoContext['role'] = 'owner'): Promise<RepoContext> {
  const db = openTestDb();
  await migrate(db);
  await upsertLocal(db, 'properties', property());
  await upsertLocal(db, 'workers', worker()); // w1: daily ₹500 from 2026-09-01, weekly off Sunday, weeks end Saturday
  let i = 0;
  return { db, userId: 'u1', role, now: () => new Date('2026-09-14T10:00:00Z'), newId: () => `id-${++i}` };
}
const P = property();
const W = worker();
const queue = (c: RepoContext) => c.db.getAllAsync<{ table_name: string }>('select table_name from sync_queue order by seq');

test('the due period is the first week (1–5 Sep) with its draft', async () => {
  const c = await ctx();
  const due = await getDueSettlement(c.db, W, P, '2026-09-14');
  expect(due?.period).toEqual({ start: '2026-09-01', end: '2026-09-05' });
  expect(due?.draft.earnedPaise).toBe(250000);
});

test('settle writes settlement, payment and repayment in order, linked; the next week becomes due', async () => {
  const c = await ctx();
  await addAdvance(c, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-02', mode: 'cash' });
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 200000, recoveredPaise: 30000, mode: 'cash' });
  expect(s).toMatchObject({ period_start: '2026-09-01', period_end: '2026-09-05', paid_now_paise: 200000, advance_recovered_paise: 30000,
    advance_after_paise: 0, closing_balance_paise: 20000, earned_paise: 250000 });
  expect((await queue(c)).map((q) => q.table_name)).toEqual(['advance_entries', 'settlements', 'wage_payments', 'advance_entries']);
  const payments = await listPayments(c.db, 'w1');
  expect(payments).toEqual([expect.objectContaining({ amount_paise: 200000, date: '2026-09-05', settlement_id: s.id })]);
  expect((await getDueSettlement(c.db, W, P, '2026-09-14'))?.period).toEqual({ start: '2026-09-06', end: '2026-09-12' });
  expect((await getDueSettlement(c.db, W, P, '2026-09-14'))?.draft.openingBalancePaise).toBe(20000);
});

test('zero parts write no money rows; staff cannot settle; bad amounts are refused', async () => {
  const staff = await ctx('staff');
  await expect(settleWorker(staff, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null }))
    .rejects.toThrow('only the owner can settle');
  const c = await ctx();
  await expect(settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 100, recoveredPaise: 0, mode: null }))
    .rejects.toThrow();
  await expect(settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 1, mode: null }))
    .rejects.toThrow();
  await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  expect((await queue(c)).map((q) => q.table_name)).toEqual(['settlements']);
});

test('nothing is due before the week ends', async () => {
  const c = await ctx();
  expect(await getDueSettlement(c.db, W, P, '2026-09-05')).toBeNull();
  await expect(settleWorker(c, { worker: W, property: P, today: '2026-09-05', paidNowPaise: 0, recoveredPaise: 0, mode: null }))
    .rejects.toThrow('nothing is due');
});

test('a settled period is locked in every repo; unlocking frees it', async () => {
  const c = await ctx();
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  await expect(markAttendance(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', status: 'absent' })).rejects.toThrow('period is settled');
  await expect(addPayment(c, { propertyId: 'p1', workerId: 'w1', amountPaise: 100, date: '2026-09-04', mode: 'cash' })).rejects.toThrow('period is settled');
  await expect(addDayOff(c, { propertyId: 'p1', date: '2026-09-04', name: 'H', kind: 'holiday', portion: 'full', payRule: 'by_basis' }))
    .rejects.toThrow('period is settled');
  const [linked] = await listPayments(c.db, 'w1');
  await expect(voidPayment(c, linked.id)).rejects.toThrow('period is settled');
  await markAttendance(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-07', status: 'absent' }); // after the period: fine
  await unlockSettlement(c, s.id, '2026-09-14');
  await markAttendance(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', status: 'absent' });
  const rows = await listSettlements(c.db, 'w1');
  expect(rows).toHaveLength(2);
  expect(rows.filter((r) => r.voids_id === s.id)).toHaveLength(1);
});

test('only the latest settlement can be unlocked; staff cannot unlock', async () => {
  const c = await ctx();
  const first = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  const second = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  await expect(unlockSettlement(c, first.id, '2026-09-14')).rejects.toThrow('unlock newer settlements first');
  const staff = { ...c, role: 'staff' as const };
  await expect(unlockSettlement(staff, second.id, '2026-09-14')).rejects.toThrow('only the owner can unlock');
});

test('overtime and adjustments are locked too', async () => {
  const c = await ctx();
  await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  await expect(addOvertime(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 2 })).rejects.toThrow('period is settled');
  await expect(addAdjustment(c, { propertyId: 'p1', workerId: 'w1', type: 'bonus', amountPaise: 100, date: '2026-09-03' }))
    .rejects.toThrow('period is settled');
});

test('on a settled date a holiday rename is allowed but deactivating is refused', async () => {
  const c = await ctx();
  await addDayOff(c, { propertyId: 'p1', date: '2026-09-04', name: 'H', kind: 'holiday', portion: 'full', payRule: 'by_basis' });
  const [h] = await c.db.getAllAsync<{ id: string }>('select id from days_off');
  await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  await updateDayOff(c, h.id, { name: 'Renamed', is_active: 1, portion: 'full', pay_rule: 'by_basis' });
  await expect(updateDayOff(c, h.id, { name: 'Renamed', is_active: 0 })).rejects.toThrow('period is settled');
});

test('a double tap settles once', async () => {
  const c = await ctx();
  const args = { worker: W, property: P, today: '2026-09-14', paidNowPaise: 100000, recoveredPaise: 0, mode: 'cash' as const };
  const results = await Promise.allSettled([settleWorker(c, args), settleWorker(c, args)]);
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  expect(await c.db.getFirstAsync('select count(*) as n from settlements')).toEqual({ n: 1 });
  expect(await listPayments(c.db, 'w1')).toHaveLength(1);
});

test('a failing precheck writes nothing', async () => {
  const c = await ctx();
  await expect(insertManyAndEnqueue(c, [{ table: 'wage_payments', row: { id: 'x', property_id: 'p1', worker_id: 'w1', amount_paise: 1,
    date: '2026-09-05', mode: 'cash', note: null, voids_id: null, settlement_id: null, created_by: 'u1', created_by_role: 'owner',
    created_at: 't', server_updated_at: null } }], async () => { throw new Error('stale'); })).rejects.toThrow('stale');
  expect(await listPayments(c.db, 'w1')).toHaveLength(0);
  expect(await queue(c)).toHaveLength(0);
});

test('the property must match the worker', async () => {
  const c = await ctx();
  await expect(settleWorker(c, { worker: W, property: { ...P, id: 'other' }, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null }))
    .rejects.toThrow('property does not match worker');
});

test('re-settling after unlock counts the earlier linked payment as paid in the period', async () => {
  const c = await ctx();
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 100000, recoveredPaise: 0, mode: 'cash' });
  await unlockSettlement(c, s.id, '2026-09-14');
  const due = await getDueSettlement(c.db, W, P, '2026-09-14');
  expect(due?.draft.paidInPeriodPaise).toBe(100000);
  expect(due?.draft.wageDuePaise).toBe(150000);
});

test('after an unlock the linked payment can be voided and the void is not linked', async () => {
  const c = await ctx();
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 100000, recoveredPaise: 0, mode: 'cash' });
  await unlockSettlement(c, s.id, '2026-09-14');
  const [linked] = await listPayments(c.db, 'w1');
  const voided = await voidPayment(c, linked.id);
  expect(voided).toMatchObject({ voids_id: linked.id, settlement_id: null, date: '2026-09-05' });
});
