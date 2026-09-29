import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { countsTowardCap, flushPush, isPermanent, listDead, MAX_SERVER_ATTEMPTS, type PushItem, type RemoteError, type RemoteWriter } from '../sync/push';

async function dbWith(items: [string, string, ('insert' | 'update')?][]) {
  const db = openTestDb();
  await migrate(db);
  for (const [t, id, op = 'insert'] of items) {
    await db.runAsync(
      'insert into sync_queue (table_name, row_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
      [t, id, op, JSON.stringify({ id }), 't'],
    );
  }
  return db;
}
const remote = (fn: (t: string, id: string) => RemoteError | null, seen: string[] = []): RemoteWriter => ({
  async write(item: PushItem) { seen.push(`${item.table}:${item.op}:${item.rowId}`); return fn(item.table, item.rowId); },
});
const pending = async (db: Awaited<ReturnType<typeof dbWith>>) =>
  (await db.getAllAsync<{ row_id: string }>("select row_id from sync_queue where status = 'pending' order by seq")).map((r) => r.row_id);

test('pushes in queue order and removes successes', async () => {
  const db = await dbWith([['properties', 'p1'], ['workers', 'w1']]);
  const seen: string[] = [];
  const r = await flushPush(db, remote(() => null, seen), async () => true);
  expect(seen).toEqual(['properties:insert:p1', 'workers:insert:w1']);
  expect(r).toEqual({ pushed: 2, dead: 0, stopped: false });
  expect(await pending(db)).toEqual([]);
});

test('retryable error stops the flush and keeps order', async () => {
  const db = await dbWith([['workers', 'w1'], ['workers', 'w2']]);
  const r = await flushPush(db, remote((_, id) => (id === 'w1' ? { status: 503, code: null, message: 'down' } : null)), async () => true);
  expect(r.stopped).toBe(true);
  expect(await pending(db)).toEqual(['w1', 'w2']);
  const row = await db.getFirstAsync<{ attempts: number }>("select attempts from sync_queue where row_id = 'w1'");
  expect(row?.attempts).toBe(1);
});

test('permanent error marks the row dead and continues', async () => {
  const db = await dbWith([['workers', 'w1'], ['workers', 'w2']]);
  const r = await flushPush(db, remote((_, id) => (id === 'w1' ? { status: 403, code: '42501', message: 'rls' } : null)), async () => true);
  expect(r).toEqual({ pushed: 1, dead: 1, stopped: false });
  expect((await listDead(db)).map((d) => [d.row_id, d.last_error])).toEqual([['w1', 'rls']]);
});

test('no session: nothing attempted, attempts unchanged', async () => {
  const db = await dbWith([['workers', 'w1']]);
  const seen: string[] = [];
  const r = await flushPush(db, remote(() => null, seen), async () => false);
  expect(seen).toEqual([]);
  expect(r.stopped).toBe(true);
  const row = await db.getFirstAsync<{ attempts: number }>("select attempts from sync_queue where row_id = 'w1'");
  expect(row?.attempts).toBe(0);
});

test('update item is passed through with op and payload intact', async () => {
  const db = openTestDb();
  await migrate(db);
  await db.runAsync(
    'insert into sync_queue (table_name, row_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
    ['workers', 'w1', 'update', JSON.stringify({ id: 'w1', name: 'New Name' }), 't'],
  );
  const seenItems: PushItem[] = [];
  const r = await flushPush(db, {
    async write(item) { seenItems.push(item); return null; },
  }, async () => true);
  expect(r).toEqual({ pushed: 1, dead: 0, stopped: false });
  expect(seenItems).toEqual([{ table: 'workers', op: 'update', rowId: 'w1', payload: { id: 'w1', name: 'New Name' } }]);
});

test('isPermanent classification', () => {
  expect(isPermanent({ status: 400, code: '23514', message: '' })).toBe(true);
  expect(isPermanent({ status: 401, code: null, message: '' })).toBe(false);
  expect(isPermanent({ status: 409, code: '23505', message: '' })).toBe(true);
  expect(isPermanent({ status: 429, code: null, message: '' })).toBe(false);
  expect(isPermanent({ status: null, code: null, message: 'Network request failed' })).toBe(false);
  expect(isPermanent({ status: 401, code: '42501', message: '' })).toBe(false);
  expect(isPermanent({ status: 0, code: '', message: 'fetch failed' })).toBe(false);
  expect(isPermanent({ status: 406, code: 'PGRST106', message: '' })).toBe(false);
  expect(isPermanent({ status: 404, code: 'PGRST205', message: '' })).toBe(false);
});

test('dead-lettered update clears the table cursor so the next pull restores it; a dead insert does not', async () => {
  const db = await dbWith([['workers', 'w1', 'update'], ['properties', 'p1', 'insert']]);
  await db.runAsync("insert or replace into sync_cursor (table_name, cursor) values ('workers', ?)", [JSON.stringify({ ts: 't', id: 'x' })]);
  await db.runAsync("insert or replace into sync_cursor (table_name, cursor) values ('properties', ?)", [JSON.stringify({ ts: 't', id: 'y' })]);
  const r = await flushPush(db, {
    async write() { return { status: 404, code: null, message: 'x' }; },
  }, async () => true);
  expect(r).toEqual({ pushed: 0, dead: 2, stopped: false });
  expect(await db.getFirstAsync("select 1 from sync_cursor where table_name = 'workers'")).toBeNull();
  expect(await db.getFirstAsync("select 1 from sync_cursor where table_name = 'properties'")).not.toBeNull();
});

test('R3: only PGRST106 and PGRST200-205 (not 204) and PGRST0xx are retryable; other PGRST codes are permanent', () => {
  expect(isPermanent({ status: 406, code: 'PGRST106', message: '' })).toBe(false);
  for (const code of ['PGRST200', 'PGRST201', 'PGRST202', 'PGRST203', 'PGRST205']) {
    expect(isPermanent({ status: 400, code, message: '' })).toBe(false);
  }
  expect(isPermanent({ status: 503, code: 'PGRST000', message: '' })).toBe(false);
  expect(isPermanent({ status: 400, code: 'PGRST204', message: '' })).toBe(true);
  expect(isPermanent({ status: 400, code: 'PGRST100', message: '' })).toBe(true);
  expect(isPermanent({ status: 500, code: null, message: '' })).toBe(false);
});

test('countsTowardCap: server-side transient errors count, network and 401 never do', () => {
  expect(countsTowardCap({ status: 503, code: null, message: '' })).toBe(true);
  expect(countsTowardCap({ status: 429, code: null, message: '' })).toBe(true);
  expect(countsTowardCap({ status: 406, code: 'PGRST106', message: '' })).toBe(true);
  expect(countsTowardCap({ status: null, code: null, message: 'Network request failed' })).toBe(false);
  expect(countsTowardCap({ status: 0, code: null, message: '' })).toBe(false);
  expect(countsTowardCap({ status: 401, code: null, message: '' })).toBe(false);
  expect(countsTowardCap({ status: 400, code: '23514', message: '' })).toBe(false); // permanent, not "capped"
});

test('a server error on the last allowed attempt dead-letters the row and the flush continues', async () => {
  const db = await dbWith([['workers', 'w1', 'update'], ['workers', 'w2']]);
  await db.runAsync("update sync_queue set attempts = ? where row_id = 'w1'", [MAX_SERVER_ATTEMPTS - 1]);
  await db.runAsync("insert or replace into sync_cursor (table_name, cursor) values ('workers', ?)", [JSON.stringify({ ts: 't', id: 'x' })]);
  const r = await flushPush(db, remote((_, id) => (id === 'w1' ? { status: 503, code: null, message: 'down' } : null)), async () => true);
  expect(r).toEqual({ pushed: 1, dead: 1, stopped: false });
  expect((await listDead(db)).map((d) => d.row_id)).toEqual(['w1']);
  expect(await db.getFirstAsync("select 1 from sync_cursor where table_name = 'workers'")).toBeNull();
});

test('network errors never dead-letter, however many attempts', async () => {
  const db = await dbWith([['workers', 'w1']]);
  await db.runAsync("update sync_queue set attempts = 500 where row_id = 'w1'");
  const r = await flushPush(db, remote(() => ({ status: null, code: null, message: 'Network request failed' })), async () => true);
  expect(r.stopped).toBe(true);
  expect(await pending(db)).toEqual(['w1']);
});
