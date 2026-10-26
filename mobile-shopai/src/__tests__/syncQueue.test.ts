import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('sync queue robustness', () => {
  let testDb: TestDb;
  let q: typeof import('../db/syncQueue');
  let upsert: jest.Mock;

  const add = (id: string) =>
    testDb.runSync(
      'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
      ['products', 'UPDATE', id, JSON.stringify({ id })],
    );
  const row = (id: string) =>
    testDb.getFirstSync('SELECT * FROM sync_queue WHERE data_id = ?', [id]);

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    upsert = jest.fn();
    jest.doMock('../lib/supabase', () => ({
      supabase: {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} } }) },
        from: jest.fn(() => ({ upsert })),
      },
    }));
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
    }));
    jest.doMock('../utils/storage', () => ({
      getOrCreateDeviceId: jest.fn(),
      getStoredShopId: jest.fn().mockResolvedValue('shop-uuid'),
      getHasConsent: jest.fn().mockResolvedValue(false),
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    q = require('../db/syncQueue');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    testDb.closeSync();
  });

  it('classifies errors', () => {
    expect(q.classifySyncError(new TypeError('Network request failed'))).toBe('transient');
    expect(q.classifySyncError(new TypeError('Failed to fetch'))).toBe('transient');
    expect(q.classifySyncError(new TypeError("Cannot destructure property 'x' of undefined"))).toBe('permanent');
    expect(q.classifySyncError({ message: 'Network request failed' })).toBe('transient');
    for (const status of [401, 408, 429, 500, 503]) {
      expect(q.classifySyncError({ status })).toBe('transient');
    }
    expect(q.classifySyncError({ code: 'PGRST002', message: 'x' })).toBe('transient');
    expect(q.classifySyncError({ code: 'PGRST301', message: 'x' })).toBe('transient');
    expect(q.classifySyncError({ message: 'JWT expired' })).toBe('transient');
    expect(q.classifySyncError({ status: 400, message: 'bad' })).toBe('permanent');
    expect(q.classifySyncError({ code: '23505', message: 'dup' })).toBe('permanent');
    expect(q.classifySyncError(new Error('Unknown table: x'))).toBe('permanent');
  });

  it.each([503, 429, 408, 401])('HTTP %i (status on response, as postgrest-js returns it) is transient end to end', async (status) => {
    add('A');
    add('B');
    upsert.mockResolvedValue({ error: { message: 'x' }, status });
    await q.flushSyncQueue();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(row('A').attempts).toBe(0);
    expect(row('A').next_attempt_at).toBe(0);
    expect(row('B').attempts).toBe(0);
  });

  it('a thrown network TypeError is transient; a programming TypeError backs off', async () => {
    add('A');
    upsert.mockRejectedValueOnce(new TypeError('Network request failed'));
    await q.flushSyncQueue();
    expect(row('A').attempts).toBe(0);
    upsert.mockRejectedValueOnce(new TypeError("Cannot destructure property 'x' of undefined"));
    await q.flushSyncQueue();
    expect(row('A').attempts).toBe(1);
  });

  it('HTTP 400 with real response shape is permanent', async () => {
    add('A');
    upsert.mockResolvedValue({ error: { message: 'bad', code: '23505' }, status: 400 });
    await q.flushSyncQueue();
    expect(row('A').attempts).toBe(1);
    expect(row('A').next_attempt_at).toBeGreaterThan(0);
  });

  it('excludes exhausted rows from flush while getPendingIds still lists stuck and backed-off rows', async () => {
    add('A');
    add('B');
    testDb.runSync("UPDATE sync_queue SET attempts = 5 WHERE data_id = 'A'");
    testDb.runSync("UPDATE sync_queue SET next_attempt_at = ? WHERE data_id = 'B'", [Date.now() + 1e9]);
    upsert.mockResolvedValue({ error: null });
    await q.flushSyncQueue();
    expect(upsert).not.toHaveBeenCalled();
    expect([...q.getPendingIds().products].sort()).toEqual(['A', 'B']);
  });

  it('permanent failure increments, backs off, and continues with the next row', async () => {
    add('A');
    add('B');
    const now = 1_000_000;
    jest.spyOn(Date, 'now').mockReturnValue(now);
    upsert
      .mockResolvedValueOnce({ error: { code: '23505', message: 'dup' } })
      .mockResolvedValueOnce({ error: null });
    await q.flushSyncQueue();
    expect(upsert).toHaveBeenCalledTimes(2);
    const a = row('A');
    expect(a.attempts).toBe(1);
    expect(a.next_attempt_at).toBe(now + 60000);
    expect(a.last_error).toContain('dup');
    expect(row('B')).toBeNull();
  });

  it('skips rows whose next_attempt_at is in the future', async () => {
    add('A');
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    testDb.runSync('UPDATE sync_queue SET next_attempt_at = 5000');
    upsert.mockResolvedValue({ error: null });
    await q.flushSyncQueue();
    expect(upsert).not.toHaveBeenCalled();
    expect(q.getPendingSyncCount()).toBe(1);
  });

  it('counts and retries stuck rows', () => {
    add('A');
    add('B');
    testDb.runSync("UPDATE sync_queue SET attempts = 5, next_attempt_at = 99 WHERE data_id = 'A'");
    expect(q.getStuckSyncCount()).toBe(1);
    q.retryStuckSyncItems();
    expect(q.getStuckSyncCount()).toBe(0);
    expect(row('A').attempts).toBe(0);
    expect(row('A').next_attempt_at).toBe(0);
  });

  it('merges successive shop payloads into one queued entry', () => {
    q.addToSyncQueue('shop', 'UPDATE', 'S', { shopName: 'X' });
    q.addToSyncQueue('shop', 'UPDATE', 'S', { whatsappNumber: '123' });
    const rows = testDb.getAllSync("SELECT * FROM sync_queue WHERE table_name = 'shop'");
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].payload)).toEqual({ shopName: 'X', whatsappNumber: '123' });
  });
});
