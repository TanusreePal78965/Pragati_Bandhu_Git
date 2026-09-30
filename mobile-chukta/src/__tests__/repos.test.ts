import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { RepoContext } from '../repos/context';
import { createProperty, listAllProperties, listProperties, updatePropertySettings } from '../repos/properties';
import { createWorker, listWorkers, updateWorker } from '../repos/workers';
import { listAttendance, listAttendanceForDate, markAttendance } from '../repos/attendance';
import { addAdvance, listAdvances, voidAdvance } from '../repos/money';
import { listStaff } from '../repos/staff';

async function ctx(role: RepoContext['role'] = 'owner'): Promise<RepoContext> {
  const db = openTestDb();
  await migrate(db);
  let i = 0;
  return { db, userId: 'u1', role, now: () => new Date('2026-09-30T10:00:00Z'), newId: () => `id-${++i}` };
}
const queue = (c: RepoContext) => c.db.getAllAsync<{ table_name: string; row_id: string; op: string; payload: string }>('select * from sync_queue order by seq');

test('create property + worker writes locally and enqueues in order', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  const w = await createWorker(c, { propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01' });
  expect((await listProperties(c.db)).map((x) => x.name)).toEqual(['Main']);
  expect((await listWorkers(c.db, p.id)).map((x) => x.id)).toEqual([w.id]);
  const q = await queue(c);
  expect(q.map((r) => `${r.table_name}:${r.row_id}`)).toEqual([`properties:${p.id}`, `workers:${w.id}`]);
  expect(q.map((r) => r.op)).toEqual(['insert', 'insert']);
  expect(JSON.parse(q[1].payload)).toMatchObject({ created_by: 'u1', created_by_role: 'owner', rate_paise: 50000 });
});

test('updates enqueue only the patch as op update; workers can be archived', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  await updatePropertySettings(c, p.id, { weekly_off: 5, shift_hours: 9 });
  const w = await createWorker(c, { propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01' });
  await updateWorker(c, w.id, { status: 'left', left_date: '2026-09-20' });
  expect(await listWorkers(c.db, p.id)).toEqual([]);
  expect((await listWorkers(c.db, p.id, true))[0].status).toBe('left');
  const last = (await queue(c)).at(-1)!;
  expect(last.op).toBe('update');
  expect(JSON.parse(last.payload)).toEqual({ id: w.id, status: 'left', left_date: '2026-09-20' });
});

test('switching a worker to hourly pay forces attendance_mode to hours', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  const w = await createWorker(c, {
    propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01', attendanceMode: 'day',
  });
  await updateWorker(c, w.id, { pay_basis: 'hourly' });
  const last = (await queue(c)).at(-1)!;
  expect(JSON.parse(last.payload)).toMatchObject({ id: w.id, pay_basis: 'hourly', attendance_mode: 'hours' });
});

test('staff cannot create or update properties', async () => {
  const c = await ctx('staff');
  await expect(createProperty(c, { shopId: 'shop1', name: 'Main' })).rejects.toThrow('owner');
  const owner = await ctx();
  const p = await createProperty(owner, { shopId: 'shop1', name: 'Main' });
  await expect(updatePropertySettings(c, p.id, { name: 'New' })).rejects.toThrow('owner');
});

test('attendance rows are appended, never updated', async () => {
  const c = await ctx('staff');
  await markAttendance(c, { propertyId: 'p', workerId: 'w', date: '2026-09-02', status: 'absent' });
  await markAttendance(c, { propertyId: 'p', workerId: 'w', date: '2026-09-02', status: 'present' });
  const rows = await listAttendance(c.db, 'w', '2026-09-01', '2026-09-30');
  expect(rows.map((r) => r.status)).toEqual(['absent', 'present']);
  expect(rows[0].created_by_role).toBe('staff');
});

test('markAttendance validates hours', async () => {
  const c = await ctx();
  await expect(markAttendance(c, { propertyId: 'p', workerId: 'w', date: '2026-09-02', status: 'hours' })).rejects.toThrow('hours');
});

test('voidAdvance copies the target and links voids_id; staff cannot void', async () => {
  const c = await ctx();
  const a = await addAdvance(c, { propertyId: 'p', workerId: 'w', type: 'advance', amountPaise: 300000, date: '2026-09-02' });
  const v = await voidAdvance(c, a.id);
  expect(v).toMatchObject({ voids_id: a.id, amount_paise: 300000, type: 'advance', worker_id: 'w' });
  expect((await listAdvances(c.db, 'w')).length).toBe(2);
  const s = { ...c, role: 'staff' as const };
  await expect(voidAdvance(s, a.id)).rejects.toThrow('owner');
});

test('writeoff requires a note', async () => {
  const c = await ctx();
  await expect(addAdvance(c, { propertyId: 'p', workerId: 'w', type: 'writeoff', amountPaise: 100, date: '2026-09-02' })).rejects.toThrow('note');
});

test('non-updatable columns are rejected before any write', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  const before = (await queue(c)).length;
  await expect(updatePropertySettings(c, p.id, { shop_id: 'other' } as never)).rejects.toThrow('not updatable');
  expect((await queue(c)).length).toBe(before);
});

test('an entry can only be corrected once', async () => {
  const c = await ctx();
  const a = await addAdvance(c, { propertyId: 'p', workerId: 'w', type: 'advance', amountPaise: 1000, date: '2026-09-02' });
  await voidAdvance(c, a.id);
  await expect(voidAdvance(c, a.id)).rejects.toThrow('already corrected');
});

test('listAttendanceForDate returns all rows for the property on that date only', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  const w = await createWorker(c, { propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01' });
  await markAttendance(c, { propertyId: p.id, workerId: w.id, date: '2026-09-03', status: 'absent' });
  await markAttendance(c, { propertyId: p.id, workerId: w.id, date: '2026-09-04', status: 'absent' });
  expect((await listAttendanceForDate(c.db, p.id, '2026-09-03')).map((a) => a.date)).toEqual(['2026-09-03']);
  expect(await listAttendanceForDate(c.db, 'other', '2026-09-03')).toEqual([]);
});

test('listAllProperties lists active first, then archived, each by name', async () => {
  const c = await ctx();
  const b = await createProperty(c, { shopId: 'shop1', name: 'B' });
  await createProperty(c, { shopId: 'shop1', name: 'C' });
  await createProperty(c, { shopId: 'shop1', name: 'A' });
  await updatePropertySettings(c, b.id, { is_active: 0 });
  expect((await listAllProperties(c.db)).map((p) => p.name)).toEqual(['A', 'C', 'B']);
});

test('listStaff returns the property staff, active first', async () => {
  const c = await ctx();
  await c.db.runAsync(`insert into staff_users (id, property_id, name, auth_user_id, is_active, created_at) values
    ('s1', 'p1', 'Zed', 'a1', 1, 't'), ('s2', 'p1', 'Amy', 'a2', 0, 't'), ('s3', 'p2', 'Bob', 'a3', 1, 't')`);
  expect((await listStaff(c.db, 'p1')).map((s) => s.name)).toEqual(['Zed', 'Amy']);
});
