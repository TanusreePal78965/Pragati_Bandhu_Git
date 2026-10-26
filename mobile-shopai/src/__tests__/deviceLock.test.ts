import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('hard device lock', () => {
  let testDb: TestDb;
  let lock: typeof import('../services/deviceLock');
  let q: typeof import('../db/syncQueue');
  let upsert: jest.Mock;
  let update: jest.Mock;
  let from: jest.Mock;
  let shopRow: { data: any; error: any };
  let selectCalls: number;

  const add = (table: string, id: string, payload: any = { id }) =>
    testDb.runSync(
      'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
      [table, 'UPDATE', id, JSON.stringify(payload)],
    );
  const writeCalls = () => from.mock.calls.filter(([t]) => t !== 'shops').length + upsert.mock.calls.length + update.mock.calls.length;

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    upsert = jest.fn().mockResolvedValue({ error: null });
    update = jest.fn(() => ({ eq: jest.fn().mockResolvedValue({ error: null }) }));
    shopRow = { data: { active_device_id: 'dev-1', ai_consent: true }, error: null };
    selectCalls = 0;
    from = jest.fn((table: string) => ({
      upsert,
      update,
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            selectCalls++;
            return shopRow;
          },
        }),
      }),
    }));
    jest.doMock('../lib/supabase', () => ({
      supabase: {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} } }) },
        from,
      },
    }));
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
    }));
    jest.doMock('../utils/storage', () => ({
      getOrCreateDeviceId: jest.fn().mockResolvedValue('dev-1'),
      getStoredShopId: jest.fn().mockResolvedValue('shop-uuid'),
      getHasConsent: jest.fn().mockResolvedValue(false),
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    lock = require('../services/deviceLock');
    q = require('../db/syncQueue');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    testDb.closeSync();
  });

  it('flush makes zero writes while the conflict flag is set', async () => {
    add('products', 'A');
    lock.setDeviceConflict(true);
    await q.flushSyncQueue();
    expect(writeCalls()).toBe(0);
    expect(selectCalls).toBe(0);
  });

  it('flush with a mismatching active_device_id makes zero writes and sets the flag', async () => {
    shopRow = { data: { active_device_id: 'other', ai_consent: true }, error: null };
    add('products', 'A');
    await q.flushSyncQueue();
    expect(writeCalls()).toBe(0);
    expect(lock.isDeviceConflict()).toBe(true);
  });

  it('flush aborts without writes when the check is unknown, and retries next time', async () => {
    shopRow = { data: null, error: { message: 'Network request failed' } };
    add('products', 'A');
    await q.flushSyncQueue();
    expect(writeCalls()).toBe(0);
    shopRow = { data: { active_device_id: 'dev-1', ai_consent: true }, error: null };
    await q.flushSyncQueue();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it('flush proceeds when this device holds the session', async () => {
    add('products', 'A');
    await q.flushSyncQueue();
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("'shop' upsert payload has no active_device_id", async () => {
    add('shop', 'S', { shopName: 'X' });
    await q.flushSyncQueue();
    expect(update).toHaveBeenCalledTimes(1);
    const payload = update.mock.calls[0][0];
    expect(payload).toEqual({ shop_name: 'X' });
    expect('active_device_id' in payload).toBe(false);
  });

  it('verifyActiveDevice returns the cached value inside maxAgeMs; maxAgeMs 0 forces a read', async () => {
    expect(await lock.verifyActiveDevice()).toBe('ok');
    expect(await lock.verifyActiveDevice()).toBe('ok');
    expect(selectCalls).toBe(1);
    await lock.verifyActiveDevice({ maxAgeMs: 0 });
    expect(selectCalls).toBe(2);
  });

  it('no conflict without ai_consent or with a null id; flag clears on ok', async () => {
    shopRow = { data: { active_device_id: 'other', ai_consent: false }, error: null };
    expect(await lock.verifyActiveDevice({ maxAgeMs: 0 })).toBe('ok');
    shopRow = { data: { active_device_id: null, ai_consent: true }, error: null };
    expect(await lock.verifyActiveDevice({ maxAgeMs: 0 })).toBe('ok');
    shopRow = { data: { active_device_id: 'other', ai_consent: true }, error: null };
    expect(await lock.verifyActiveDevice({ maxAgeMs: 0 })).toBe('conflict');
    expect(lock.isDeviceConflict()).toBe(true);
    shopRow = { data: { active_device_id: 'dev-1', ai_consent: true }, error: null };
    expect(await lock.verifyActiveDevice({ maxAgeMs: 0 })).toBe('ok');
    expect(lock.isDeviceConflict()).toBe(false);
  });

  it('unknown results are not cached', async () => {
    shopRow = { data: null, error: { message: 'x' } };
    expect(await lock.verifyActiveDevice()).toBe('unknown');
    expect(await lock.verifyActiveDevice()).toBe('unknown');
    expect(selectCalls).toBe(2);
  });
});
