import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

/**
 * Pull vs flush race: the cloud copy is fetched before a local edit flushes, and a row is
 * created locally while the fetch is in flight. Neither may be clobbered by the import.
 */
describe('restoreFromCloud vs a flush during the fetch', () => {
  let testDb: TestDb;
  let duringFetch: () => Promise<void>;
  let upsert: jest.Mock;

  const fakeSupabase = (tables: Record<string, any[]>) => {
    let hook: Promise<void> | null = null;
    const runHookOnce = () => (hook ??= duringFetch());
    const from = (table: string) => {
      const b: any = {
        select: () => b, eq: () => b, in: () => b, order: () => b, range: () => b,
        upsert,
        single: () => runHookOnce().then(() => ({ data: (tables[table] ?? [])[0] ?? null, error: null })),
        then: (res: any, rej: any) =>
          runHookOnce().then(() => ({ data: tables[table] ?? [], error: null })).then(res, rej),
      };
      return b;
    };
    return {
      from,
      rpc: jest.fn().mockResolvedValue({ error: null }),
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} } }) },
    };
  };

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    upsert = jest.fn().mockResolvedValue({ error: null, status: 201 });
    jest.doMock('../lib/supabase', () => ({
      supabase: fakeSupabase({
        shops: [{ id: 'shop1', shop_name: 'S', owner_name: 'O', phone: '1' }],
        // Cloud copy fetched BEFORE the local edit flushed: stale name.
        products: [{ id: 'P', shop_id: 'shop1', name: 'Old name', stock_quantity: 10 }],
      }),
    }));
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { fetch: jest.fn().mockResolvedValue({ isConnected: true }) },
    }));
    jest.doMock('../utils/storage', () => ({
      getOrCreateDeviceId: jest.fn(),
      getStoredShopId: jest.fn().mockResolvedValue('shop1'),
      getHasConsent: jest.fn().mockResolvedValue(false),
    }));
    jest.doMock('../services/deviceLock', () => ({
      isDeviceConflict: () => false,
      verifyActiveDevice: jest.fn().mockResolvedValue('ok'),
    }));
    testDb.runSync("INSERT INTO products (id, name, stock_quantity) VALUES ('P', 'Old name', 10)");
  });
  afterEach(() => testDb.closeSync());

  it('keeps an edit flushed during the fetch and a row created during it', async () => {
    const q = require('../db/syncQueue');
    const d = require('../db/db');
    duringFetch = async () => {
      d.updateProduct('P', { name: 'New name' });
      await q.flushSyncQueue(); // queued AND flushed inside the fetch window
      testDb.runSync("INSERT INTO products (id, name, stock_quantity) VALUES ('NEW', 'Brand new', 1)");
    };
    const { restoreFromCloud } = require('../services/restoreService');
    const result = await restoreFromCloud();

    expect(result.success).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(testDb.getAllSync('SELECT * FROM sync_queue')).toHaveLength(0);
    expect(testDb.getFirstSync("SELECT name FROM products WHERE id = 'P'").name).toBe('New name');
    expect(testDb.getFirstSync("SELECT id FROM products WHERE id = 'NEW'")).not.toBeNull();
    expect(q.activePullTrackerCount()).toBe(0);
  });

  it('still reconciles away a pre-existing row the cloud no longer has', async () => {
    testDb.runSync("INSERT INTO products (id, name) VALUES ('GONE', 'Deleted in cloud')");
    duringFetch = async () => {};
    const { restoreFromCloud } = require('../services/restoreService');
    await restoreFromCloud();
    expect(testDb.getFirstSync("SELECT id FROM products WHERE id = 'GONE'")).toBeNull();
  });

  it('stops its tracker when the restore fails', async () => {
    const q = require('../db/syncQueue');
    duringFetch = async () => { throw new Error('boom'); };
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const { restoreFromCloud } = require('../services/restoreService');
    await restoreFromCloud();
    expect(q.activePullTrackerCount()).toBe(0);
  });
});
