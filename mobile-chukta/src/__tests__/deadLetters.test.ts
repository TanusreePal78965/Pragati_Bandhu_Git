import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { discardDead, listDeadGroups, requeueDead } from '../sync/deadLetters';

async function setup() {
  const db = openTestDb();
  await migrate(db);
  const q = (table: string, id: string, op: string, status: string, err: string | null) =>
    db.runAsync('insert into sync_queue (table_name, row_id, op, payload, status, attempts, last_error, created_at) values (?, ?, ?, ?, ?, 3, ?, ?)',
      [table, id, op, JSON.stringify({ id }), status, err, 't']);
  await q('workers', 'w1', 'insert', 'dead', 'violates check constraint');
  await q('attendance_entries', 'a1', 'insert', 'dead', 'violates check constraint');
  await q('workers', 'w2', 'update', 'dead', 'not found or not permitted');
  await q('workers', 'w3', 'insert', 'pending', null);
  return db;
}

test('groups dead rows by error, in queue order, with tables and seqs', async () => {
  const db = await setup();
  expect(await listDeadGroups(db)).toEqual([
    { error: 'violates check constraint', count: 2, tables: ['workers', 'attendance_entries'], seqs: [1, 2] },
    { error: 'not found or not permitted', count: 1, tables: ['workers'], seqs: [3] },
  ]);
});

test('requeue puts rows back to pending with attempts reset, keeping their order', async () => {
  const db = await setup();
  await requeueDead(db, [1, 2]);
  const rows = await db.getAllAsync<{ seq: number; status: string; attempts: number; last_error: string | null }>(
    'select seq, status, attempts, last_error from sync_queue order by seq');
  expect(rows.slice(0, 2)).toEqual([
    { seq: 1, status: 'pending', attempts: 0, last_error: null },
    { seq: 2, status: 'pending', attempts: 0, last_error: null },
  ]);
  expect(rows[2].status).toBe('dead');
});

test('discard: a never-synced insert removes the local row; an update clears the cursor; pending rows are untouched', async () => {
  const db = await setup();
  await db.runAsync(`insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at, server_updated_at)
    values ('w1', 'p', 'Local', 'daily', 100, '2026-09-01', 'u', 'owner', 't', null),
           ('w2', 'p', 'Server', 'daily', 100, '2026-09-01', 'u', 'owner', 't', '2026-09-01T00:00:00Z')`);
  await db.runAsync("insert into sync_cursor (table_name, cursor) values ('workers', '{}')");
  await discardDead(db, [1, 3]);
  expect(await db.getAllAsync<{ id: string }>('select id from workers order by id')).toEqual([{ id: 'w2' }]);
  expect(await db.getFirstAsync("select 1 from sync_cursor where table_name = 'workers'")).toBeNull();
  expect((await db.getAllAsync<{ seq: number }>('select seq from sync_queue order by seq')).map((r) => r.seq)).toEqual([2, 4]);
});

test('discard never deletes a row that the server already has', async () => {
  const db = await setup();
  await db.runAsync(`insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at, server_updated_at)
    values ('w1', 'p', 'Pulled', 'daily', 100, '2026-09-01', 'u', 'owner', 't', '2026-09-01T00:00:00Z')`);
  await discardDead(db, [1]);
  expect(await db.getFirstAsync("select id from workers where id = 'w1'")).toEqual({ id: 'w1' });
});
