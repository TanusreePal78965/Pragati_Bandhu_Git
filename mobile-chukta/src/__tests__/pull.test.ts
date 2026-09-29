import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate, type SyncedTable } from '../db/schema';
import { cursorFilter, pullAll, type Cursor, type RemoteReader } from '../sync/pull';

const worker = (id: string, ts: string, name = id) => ({
  id, property_id: 'p', name, phone: null, pay_basis: 'daily', rate_paise: 50000, joining_date: '2026-09-01', status: 'active',
  left_date: null, attendance_mode: null, shift_hours: null, weekly_off_override: false, weekly_off: null, monthly_divisor: null,
  created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: ts,
});

function fakeRemote(data: Partial<Record<SyncedTable, Record<string, unknown>[]>>, calls: string[] = []): RemoteReader {
  return {
    async fetchSince(table, cursor: Cursor | null, limit) {
      calls.push(`${table}:${cursor ? `${cursor.ts}|${cursor.id}` : '-'}`);
      const rows = (data[table] ?? [])
        .filter((r) => !cursor || (cursor.id === ''
          ? (r.server_updated_at as string) >= cursor.ts
          : (r.server_updated_at as string) > cursor.ts
            || ((r.server_updated_at as string) === cursor.ts && (r.id as string) > cursor.id)))
        .sort((a, b) => `${a.server_updated_at}|${a.id}`.localeCompare(`${b.server_updated_at}|${b.id}`))
        .slice(0, limit);
      return { rows, error: null };
    },
  };
}

test('pages through rows with equal timestamps using (ts, id) cursor', async () => {
  const db = openTestDb();
  await migrate(db);
  const rows = ['a', 'b', 'c'].map((id) => worker(id, '2026-09-30T10:00:00Z'));
  const counts = await pullAll(db, fakeRemote({ workers: rows }), 2);
  expect(counts.workers).toBe(3);
  const cur = await db.getFirstAsync<{ cursor: string }>("select cursor from sync_cursor where table_name = 'workers'");
  expect(JSON.parse(cur!.cursor)).toEqual({ ts: '2026-09-30T10:00:00Z', id: 'c' });
});

test('second pull resumes from cursor', async () => {
  const db = openTestDb();
  await migrate(db);
  const calls: string[] = [];
  const remote = fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z')] }, calls);
  await pullAll(db, remote);
  await pullAll(db, remote);
  expect(calls.filter((c) => c.startsWith('workers')).at(-1)).toBe('workers:2026-09-30T09:59:00.000Z|');
});

test('rows with pending local changes are not overwritten', async () => {
  const db = openTestDb();
  await migrate(db);
  await db.runAsync("insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at) values ('a','p','Local','daily',1,'2026-09-01','u','owner','t')");
  await db.runAsync("insert into sync_queue (table_name, row_id, payload, created_at) values ('workers','a','{}','t')");
  await pullAll(db, fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z', 'Server')] }));
  const w = await db.getFirstAsync<{ name: string }>("select name from workers where id = 'a'");
  expect(w?.name).toBe('Local');
});

test('booleans from the server are stored as 0/1', async () => {
  const db = openTestDb();
  await migrate(db);
  await pullAll(db, fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z')] }));
  const w = await db.getFirstAsync<{ weekly_off_override: number }>("select weekly_off_override from workers where id = 'a'");
  expect(w?.weekly_off_override).toBe(0);
});

test('overlap re-read picks up a late-committed row', async () => {
  const db = openTestDb();
  await migrate(db);
  const data: Partial<Record<SyncedTable, Record<string, unknown>[]>> = { workers: [worker('a', '2026-09-30T10:00:00Z')] };
  await pullAll(db, fakeRemote(data));
  // A row that committed late, stamped with an earlier timestamp than 'a', now appears server-side.
  data.workers!.push(worker('b', '2026-09-30T09:59:30Z'));
  await pullAll(db, fakeRemote(data));
  const w = await db.getFirstAsync<{ id: string }>("select id from workers where id = 'b'");
  expect(w?.id).toBe('b');
});

test('an unparseable stored cursor triggers a full re-pull instead of throwing', async () => {
  const db = openTestDb();
  await migrate(db);
  await db.runAsync("insert or replace into sync_cursor (table_name, cursor) values ('workers', ?)", [JSON.stringify({ ts: 'garbage', id: 'x' })]);
  const calls: string[] = [];
  await pullAll(db, fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z')] }, calls));
  expect(calls.find((c) => c.startsWith('workers'))).toBe('workers:-');
  const w = await db.getFirstAsync<{ id: string }>("select id from workers where id = 'a'");
  expect(w?.id).toBe('a');
});

test('cursorFilter never emits an empty id comparison', () => {
  expect(cursorFilter({ ts: '2026-09-30T09:59:00.000Z', id: '' })).toEqual({ kind: 'gte', ts: '2026-09-30T09:59:00.000Z' });
  const f = cursorFilter({ ts: '2026-09-30T10:00:00+00:00', id: 'a1' });
  expect(f).toEqual({ kind: 'after', or: 'server_updated_at.gt.2026-09-30T10:00:00+00:00,and(server_updated_at.eq.2026-09-30T10:00:00+00:00,id.gt.a1)' });
});
