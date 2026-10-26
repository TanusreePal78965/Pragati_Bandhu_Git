import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('flush aborts when the session changes mid-flight', () => {
  let testDb: TestDb;
  let q: typeof import('../db/syncQueue');
  let upsert: jest.Mock;
  let storedShop: string | null;

  const add = (id: string) =>
    testDb.runSync(
      'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
      ['categories', 'UPDATE', id, JSON.stringify({ id })],
    );
  const queued = () => testDb.getAllSync('SELECT data_id, attempts FROM sync_queue ORDER BY id');

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    storedShop = 'shopA';
    upsert = jest.fn().mockResolvedValue({ error: null });
    jest.doMock('../lib/supabase', () => ({
      supabase: {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} } }) },
        from: jest.fn(() => ({ upsert })),
        rpc: jest.fn(),
      },
    }));
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
    }));
    jest.doMock('../utils/storage', () => ({
      getOrCreateDeviceId: jest.fn(),
      getStoredShopId: jest.fn(async () => storedShop),
      getHasConsent: jest.fn().mockResolvedValue(false),
    }));
    jest.doMock('../services/deviceLock', () => ({
      isDeviceConflict: () => false,
      verifyActiveDevice: jest.fn().mockResolvedValue('ok'),
    }));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    q = require('../db/syncQueue');
  });
  afterEach(() => {
    jest.restoreAllMocks();
    testDb.closeSync();
  });

  it('a generation bump during an upsert stops the loop without touching the queue', async () => {
    add('A');
    add('B');
    upsert.mockImplementationOnce(async () => {
      q.bumpSyncGeneration(); // logout while the request is in flight
      return { error: null };
    });
    await q.flushSyncQueue();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(queued()).toEqual([{ data_id: 'A', attempts: 0 }, { data_id: 'B', attempts: 0 }]);
  });

  it('a failed upsert after a bump does not record an attempt', async () => {
    add('A');
    upsert.mockImplementationOnce(async () => {
      q.bumpSyncGeneration();
      return { error: { message: 'bad' }, status: 400 };
    });
    await q.flushSyncQueue();
    expect(queued()).toEqual([{ data_id: 'A', attempts: 0 }]);
  });

  it('a different stored shop id mid-flush stops the loop (login to another shop)', async () => {
    add('A');
    add('B');
    upsert.mockImplementationOnce(async () => {
      storedShop = 'shopB';
      return { error: null };
    });
    await q.flushSyncQueue();
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(queued()).toHaveLength(2);
  });

  it('a new generation can flush while the old flush is still in flight', async () => {
    add('A');
    let release!: () => void;
    upsert.mockImplementationOnce(() => new Promise((r) => { release = () => r({ error: null }); }));
    const first = q.flushSyncQueue();
    await new Promise((r) => setTimeout(r, 0));
    q.bumpSyncGeneration();
    await q.flushSyncQueue(); // not blocked by the stale isFlushing of the old generation
    expect(upsert).toHaveBeenCalledTimes(2);
    release();
    await first;
    expect(queued()).toHaveLength(0);
  });

  it('never rejects when the database is closed', async () => {
    add('A');
    testDb.closeSync();
    await expect(q.flushSyncQueue()).resolves.toBeUndefined();
    testDb = createTestDb(); // for afterEach
  });
});
