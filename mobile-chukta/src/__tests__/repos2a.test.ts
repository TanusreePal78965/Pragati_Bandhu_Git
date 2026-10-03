import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { RepoContext } from '../repos/context';
import { addDayOff, listDaysOff, updateDayOff } from '../repos/daysOff';
import { addOvertime, listOvertime, listOvertimeForDate } from '../repos/overtime';
import { addAdjustment, listAdjustments, voidAdjustment } from '../repos/money';
import { markAttendance } from '../repos/attendance';
import { createWorker, updateWorker } from '../repos/workers';

async function ctx(role: RepoContext['role'] = 'owner'): Promise<RepoContext> {
  const db = openTestDb();
  await migrate(db);
  let i = 0;
  return { db, userId: 'u1', role, now: () => new Date('2026-09-30T10:00:00Z'), newId: () => `id-${++i}` };
}
const queue = (c: RepoContext) => c.db.getAllAsync<{ table_name: string; op: string; payload: string }>('select * from sync_queue order by seq');
const D = { propertyId: 'p1', date: '2026-10-20', name: 'Durga Puja', kind: 'holiday' as const, portion: 'full' as const, payRule: 'by_basis' as const };

test('owner adds and deactivates a holiday; both are queued', async () => {
  const c = await ctx();
  const d = await addDayOff(c, D);
  await updateDayOff(c, d.id, { is_active: 0 });
  expect((await listDaysOff(c.db, 'p1')).map((x) => [x.name, x.is_active])).toEqual([['Durga Puja', 0]]);
  expect((await queue(c)).map((q) => `${q.table_name}:${q.op}`)).toEqual(['days_off:insert', 'days_off:update']);
});

test('staff may add a closure but not a holiday, and cannot edit days off', async () => {
  const c = await ctx('staff');
  await expect(addDayOff(c, D)).rejects.toThrow();
  const closure = await addDayOff(c, { ...D, kind: 'closure', name: 'Bandh' });
  await expect(updateDayOff(c, closure.id, { name: 'x' })).rejects.toThrow();
});

test('staff closure must use the by-basis pay rule (mirrors server RLS)', async () => {
  const c = await ctx('staff');
  await expect(addDayOff(c, { ...D, kind: 'closure', name: 'Bandh', payRule: 'all_paid' })).rejects.toThrow();
  await expect(addDayOff(c, { ...D, kind: 'closure', name: 'Bandh', payRule: 'all_unpaid' })).rejects.toThrow();
});

test('overtime: staff cannot set a custom amount; reads by worker and by date', async () => {
  const s = await ctx('staff');
  await expect(addOvertime(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 2, customAmountPaise: 100 })).rejects.toThrow();
  await addOvertime(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 2 });
  expect((await listOvertime(s.db, 'w1')).map((o) => o.hours)).toEqual([2]);
  expect((await listOvertimeForDate(s.db, 'p1', '2026-09-03')).length).toBe(1);
  await expect(addOvertime(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 17 })).rejects.toThrow();
});

test('adjustments: owner only, deduction needs a note, voidable once', async () => {
  const staff = await ctx('staff');
  await expect(addAdjustment(staff, { propertyId: 'p1', workerId: 'w1', type: 'bonus', amountPaise: 100, date: '2026-09-05' })).rejects.toThrow();
  const c = await ctx();
  await expect(addAdjustment(c, { propertyId: 'p1', workerId: 'w1', type: 'deduction', amountPaise: 100, date: '2026-09-05' })).rejects.toThrow();
  const b = await addAdjustment(c, { propertyId: 'p1', workerId: 'w1', type: 'bonus', amountPaise: 50000, date: '2026-09-05' });
  await voidAdjustment(c, b.id);
  await expect(voidAdjustment(c, b.id)).rejects.toThrow('entry already corrected');
  expect((await listAdjustments(c.db, 'w1')).map((a) => a.voids_id)).toEqual([null, b.id]);
});

test('attendance custom amount is owner only', async () => {
  const s = await ctx('staff');
  await expect(markAttendance(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-06', status: 'present', customAmountPaise: 100 })).rejects.toThrow();
  const o = await ctx();
  const row = await markAttendance(o, { propertyId: 'p1', workerId: 'w1', date: '2026-09-06', status: 'present', customAmountPaise: 40000 });
  expect(row.custom_amount_paise).toBe(40000);
});

test('updateDayOff rejects a blank name and stores the trimmed one', async () => {
  const c = await ctx();
  const d = await addDayOff(c, D);
  await expect(updateDayOff(c, d.id, { name: '   ' })).rejects.toThrow();
  await updateDayOff(c, d.id, { name: '  Diwali ' });
  expect((await listDaysOff(c.db, 'p1'))[0].name).toBe('Diwali');
});

describe('worker pay settings are owner only', () => {
  const W = { propertyId: 'p1', name: 'Ram', payBasis: 'daily' as const, ratePaise: 50000, joiningDate: '2026-09-01' };
  test('staff createWorker with an override throws; without one succeeds', async () => {
    const s = await ctx('staff');
    await expect(createWorker(s, { ...W, otMode: 'fixed' })).rejects.toThrow();
    await expect(createWorker(s, W)).resolves.toMatchObject({ name: 'Ram', ot_mode: null });
  });
  test('staff updateWorker with a pay-setting key throws; other edits work', async () => {
    const o = await ctx();
    const w = await createWorker(o, W);
    const s: RepoContext = { ...o, role: 'staff' };
    await expect(updateWorker(s, w.id, { ot_mode: 'fixed' })).rejects.toThrow();
    await expect(updateWorker(s, w.id, { name: 'Ramu' })).resolves.toBeUndefined();
  });
  test('owner may set them', async () => {
    const o = await ctx();
    const w = await createWorker(o, { ...W, otMode: 'fixed', otRatePaise: 7000 });
    await updateWorker(o, w.id, { ot_mode: 'multiplier' });
    expect(w.ot_rate_paise).toBe(7000);
  });
});
