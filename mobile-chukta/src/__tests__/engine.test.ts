import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { backoffDelay, createSyncEngine } from '../sync/engine';
import type { RemoteReader } from '../sync/pull';
import type { RemoteError, RemoteWriter } from '../sync/push';

async function dbWithQueue(n: number) {
  const db = openTestDb();
  await migrate(db);
  for (let i = 1; i <= n; i++) {
    await db.runAsync('insert into sync_queue (table_name, row_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
      ['workers', `w${i}`, 'insert', JSON.stringify({ id: `w${i}` }), 't']);
  }
  return db;
}

function fakeRemote(writeResult: () => Promise<RemoteError | null> | RemoteError | null) {
  const calls = { write: 0, fetch: 0 };
  const remote: RemoteWriter & RemoteReader = {
    async write() { calls.write++; return writeResult(); },
    async fetchSince() { calls.fetch++; return { rows: [], error: null }; },
  };
  return { remote, calls };
}

function fakeTimers() {
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  return {
    timers,
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn: () => { t.cleared = true; fn(); }, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h: unknown) => { (h as { cleared: boolean }).cleared = true; },
    live: () => timers.filter((t) => !t.cleared),
  };
}

const NOW = new Date('2026-09-07T10:00:00Z');

/** Resolves when the pass that a fired timer started has finished (calling run() here would add an extra pass). */
const idle = (engine: ReturnType<typeof createSyncEngine>) => new Promise<void>((resolve) => {
  const off = engine.subscribe((s) => { if (!s.running) { off(); resolve(); } });
});

test('a clean pass pushes, pulls every table, and records lastSyncedAt', async () => {
  const db = await dbWithQueue(1);
  const { remote, calls } = fakeRemote(() => null);
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  await engine.run();
  expect(calls).toEqual({ write: 1, fetch: 6 });
  expect(engine.getStatus()).toMatchObject({ running: false, pending: 0, dead: 0, lastError: null, lastSyncedAt: NOW.toISOString() });
  expect(t.live()).toEqual([]);
});

test('single flight: runs requested mid-pass collapse into one extra pass', async () => {
  const db = await dbWithQueue(1);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { remote, calls } = fakeRemote(async () => { await gate; return null; });
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW });
  const a = engine.run();
  const b = engine.run();
  const c = engine.run();
  release();
  await Promise.all([a, b, c]);
  expect(calls.write).toBe(1); // second pass finds the queue empty
  expect(calls.fetch).toBe(12); // two passes × 6 tables
});

test('retryable push failure backs off 5s, 10s, 20s and resets after success', async () => {
  const db = await dbWithQueue(1);
  let fail = true;
  const { remote } = fakeRemote(() => (fail ? { status: 503, code: null, message: 'down' } : null));
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  await engine.run();
  expect(t.live().map((x) => x.ms)).toEqual([5000]);
  expect(engine.getStatus()).toMatchObject({ pending: 1, lastError: 'down', lastSyncedAt: null });
  t.live()[0].fn();
  await idle(engine);
  expect(t.live().map((x) => x.ms)).toEqual([10000]);
  fail = false;
  t.live()[0].fn();
  await idle(engine);
  expect(t.live()).toEqual([]);
  expect(engine.getStatus()).toMatchObject({ pending: 0, lastError: null, lastSyncedAt: NOW.toISOString() });
});

test('no session: nothing is sent or pulled; counts are still reported', async () => {
  const db = await dbWithQueue(2);
  const { remote, calls } = fakeRemote(() => null);
  const engine = createSyncEngine({ db, remote, hasSession: async () => false, now: () => NOW });
  await engine.run();
  expect(calls).toEqual({ write: 0, fetch: 0 });
  expect(engine.getStatus().pending).toBe(2);
});

test('runSoon debounces to 2s when healthy and leaves an active backoff alone', async () => {
  const db = await dbWithQueue(1);
  const { remote } = fakeRemote(() => ({ status: 503, code: null, message: 'down' }));
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  engine.runSoon();
  engine.runSoon();
  expect(t.live().map((x) => x.ms)).toEqual([2000]);
  t.live()[0].fn();
  await idle(engine);
  expect(t.live().map((x) => x.ms)).toEqual([5000]);
  engine.runSoon();
  expect(t.live().map((x) => x.ms)).toEqual([5000]);
});

test('subscribers see running flip and the final status; dispose stops timers', async () => {
  const db = await dbWithQueue(0);
  const { remote } = fakeRemote(() => null);
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  const seen: boolean[] = [];
  const unsubscribe = engine.subscribe((s) => seen.push(s.running));
  await engine.run();
  expect(seen[0]).toBe(true);
  expect(seen.at(-1)).toBe(false);
  unsubscribe();
  engine.runSoon();
  engine.dispose();
  expect(t.live()).toEqual([]);
});

test('backoffDelay doubles from 5s and caps at 5 minutes', () => {
  expect([1, 2, 3, 4].map(backoffDelay)).toEqual([5000, 10000, 20000, 40000]);
  expect(backoffDelay(20)).toBe(300000);
});
