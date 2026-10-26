import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('sync queue: DELTA ops, promotion, stripped upserts', () => {
  let testDb: TestDb;
  let q: typeof import('../db/syncQueue');
  let upsert: jest.Mock;
  let rpc: jest.Mock;
  let from: jest.Mock;

  const rows = () =>
    testDb.getAllSync('SELECT * FROM sync_queue ORDER BY id ASC') as any[];

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    upsert = jest.fn().mockResolvedValue({ error: null, status: 201 });
    rpc = jest.fn().mockResolvedValue({ error: null, status: 204 });
    from = jest.fn(() => ({ upsert }));
    jest.doMock('../lib/supabase', () => ({
      supabase: {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} } }) },
        from,
        rpc,
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

  it('(c) DELTA rows are never deduped', () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -2 });
    const r = rows();
    expect(r.map((x) => x.operation)).toEqual(['DELTA', 'DELTA']);
    expect(r.map((x) => JSON.parse(x.payload).delta)).toEqual([-3, -2]);
  });

  it('a later UPDATE dedupe never removes a queued DELTA', () => {
    q.addToSyncQueue('products', 'UPDATE', 'P', { id: 'P', name: 'a' });
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('products', 'UPDATE', 'P', { id: 'P', name: 'b' });
    const r = rows();
    expect(r.map((x) => x.operation)).toEqual(['DELTA', 'UPDATE']);
    expect(JSON.parse(r[1].payload).name).toBe('b');
  });

  it('UPDATE after a queued INSERT is promoted to INSERT, whose snapshot subsumes the DELTA', () => {
    q.addToSyncQueue('products', 'INSERT', 'P', { id: 'P', name: 'a', stock_quantity: 10 });
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('products', 'UPDATE', 'P', { id: 'P', name: 'b', stock_quantity: 7 });
    const r = rows();
    expect(r.map((x) => x.operation)).toEqual(['INSERT']);
    expect(JSON.parse(r[0].payload)).toEqual({ id: 'P', name: 'b', stock_quantity: 7 });
  });

  it('a fresh INSERT removes earlier queued DELTAs for the same row only', () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('products', 'DELTA', 'Q', { delta: -1 });
    q.addToSyncQueue('products', 'INSERT', 'P', { id: 'P', stock_quantity: 7 });
    expect(rows().map((x) => [x.operation, x.data_id])).toEqual([['DELTA', 'Q'], ['INSERT', 'P']]);
  });

  it('a backed-off DELTA is not replayed after a later INSERT snapshot (no double count)', async () => {
    // Cloud stock 10; local sale of 3 queued as a DELTA, which fails permanently
    // (e.g. RPC not deployed yet -> PGRST202/404) and backs off.
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    rpc.mockResolvedValueOnce({ error: { message: 'Could not find the function', code: 'PGRST202' }, status: 404 });
    await q.flushSyncQueue();
    expect(rows()[0].attempts).toBe(1);
    // Enable-cloud re-queue: absolute snapshot with local stock 7 (already includes -3).
    q.addToSyncQueue('products', 'INSERT', 'P', { id: 'P', name: 'Soap', stock_quantity: 7 });
    q.retryStuckSyncItems();
    testDb.runSync('UPDATE sync_queue SET next_attempt_at = 0');
    await q.flushSyncQueue();
    expect(rpc).toHaveBeenCalledTimes(1); // only the original failed attempt
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toEqual({ id: 'P', name: 'Soap', stock_quantity: 7, shop_id: 'shop-uuid' });
    expect(rows()).toHaveLength(0);
  });

  it('UPDATE with no queued INSERT stays UPDATE', () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: 1 });
    q.addToSyncQueue('products', 'UPDATE', 'P', { id: 'P', name: 'b' });
    expect(rows().map((x) => x.operation)).toEqual(['DELTA', 'UPDATE']);
  });

  it('shop payload merge is unchanged', () => {
    q.addToSyncQueue('shop', 'UPDATE', 'S', { shopName: 'X' });
    q.addToSyncQueue('shop', 'UPDATE', 'S', { whatsappNumber: '1' });
    const r = rows();
    expect(r).toHaveLength(1);
    expect(r[0].operation).toBe('UPDATE');
    expect(JSON.parse(r[0].payload)).toEqual({ shopName: 'X', whatsappNumber: '1' });
  });

  it('(e) UPDATE upserts strip stock_quantity / udhar_balance; INSERT keeps them', async () => {
    q.addToSyncQueue('products', 'UPDATE', 'P', { id: 'P', name: 'n', stock_quantity: 7 });
    q.addToSyncQueue('customers', 'UPDATE', 'C', { id: 'C', name: 'c', udhar_balance: 50 });
    q.addToSyncQueue('products', 'INSERT', 'P2', { id: 'P2', name: 'm', stock_quantity: 4 });
    q.addToSyncQueue('customers', 'INSERT', 'C2', { id: 'C2', name: 'd', udhar_balance: 9 });
    await q.flushSyncQueue();
    expect(upsert.mock.calls.map((c) => c[0])).toEqual([
      { id: 'P', name: 'n', shop_id: 'shop-uuid' },
      { id: 'C', name: 'c', shop_id: 'shop-uuid' },
      { id: 'P2', name: 'm', stock_quantity: 4, shop_id: 'shop-uuid' },
      { id: 'C2', name: 'd', udhar_balance: 9, shop_id: 'shop-uuid' },
    ]);
    expect(rows()).toHaveLength(0);
  });

  it('(f) flush executes DELTAs via rpc with the right params', async () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('customers', 'DELTA', 'C', { delta: 120.5 });
    const [opP, opC] = rows().map((x) => JSON.parse(x.payload).op_id);
    expect([typeof opP, typeof opC]).toEqual(['string', 'string']);
    await q.flushSyncQueue();
    expect(rpc).toHaveBeenNthCalledWith(1, 'shopai_adjust_stock', { p_product_id: 'P', p_delta: -3, p_op_id: opP });
    expect(rpc).toHaveBeenNthCalledWith(2, 'shopai_adjust_udhar', { p_customer_id: 'C', p_delta: 120.5, p_op_id: opC });
    expect(upsert).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
  });

  it('every DELTA gets its own uuid-shaped op_id', () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    const ids = rows().map((x) => JSON.parse(x.payload).op_id);
    expect(ids[0]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('a retry after a lost response re-sends the same op_id (server dedupes it)', async () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    rpc.mockRejectedValueOnce(new TypeError('Network request failed'));
    await q.flushSyncQueue();
    await q.flushSyncQueue();
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_op_id).toBe(rpc.mock.calls[1][1].p_op_id);
    expect(rows()).toHaveLength(0);
  });

  it('a DELTA without op_id is rejected permanently, not sent', async () => {
    testDb.runSync(
      "INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES ('products', 'DELTA', 'P', ?)",
      [JSON.stringify({ delta: -1 })],
    );
    await q.flushSyncQueue();
    expect(rpc).not.toHaveBeenCalled();
    expect(rows()[0].attempts).toBe(1);
  });

  it('a transient rpc failure leaves the DELTA untouched', async () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    rpc.mockResolvedValueOnce({ error: { message: 'down' }, status: 503 });
    await q.flushSyncQueue();
    const [r] = rows();
    expect(r.attempts).toBe(0);
    expect(r.next_attempt_at).toBe(0);
  });

  it('a permanent rpc failure burns an attempt and backs off', async () => {
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    rpc.mockResolvedValueOnce({ error: { message: 'bad', code: '22P02' }, status: 400 });
    await q.flushSyncQueue();
    const [r] = rows();
    expect(r.attempts).toBe(1);
    expect(r.next_attempt_at).toBeGreaterThan(0);
    expect(r.last_error).toContain('bad');
  });

  it('a DELTA waits while an earlier INSERT for the same row is still queued', async () => {
    q.addToSyncQueue('products', 'INSERT', 'P', { id: 'P', name: 'a', stock_quantity: 10 });
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    upsert.mockResolvedValueOnce({ error: { message: 'bad', code: '23502' }, status: 400 });
    await q.flushSyncQueue();
    expect(rpc).not.toHaveBeenCalled();
    const r = rows();
    expect(r.map((x) => [x.operation, x.attempts])).toEqual([['INSERT', 1], ['DELTA', 0]]);
  });
});

describe('pull tracking', () => {
  let testDb: TestDb;
  let q: typeof import('../db/syncQueue');

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    jest.doMock('../lib/supabase', () => ({
      supabase: {
        auth: { getSession: jest.fn().mockResolvedValue({ data: { session: {} } }) },
        from: jest.fn(() => ({ upsert: jest.fn().mockResolvedValue({ error: null }) })),
        rpc: jest.fn().mockResolvedValue({ error: null }),
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
    jest.doMock('../services/deviceLock', () => ({
      isDeviceConflict: () => false,
      verifyActiveDevice: jest.fn().mockResolvedValue('ok'),
    }));
    q = require('../db/syncQueue');
  });
  afterEach(() => testDb.closeSync());

  it('records flushed rows per active tracker; nested trackers finish independently', async () => {
    const stopOuter = q.beginPullTracking();
    q.addToSyncQueue('products', 'UPDATE', 'A', { id: 'A' });
    await q.flushSyncQueue();
    const stopInner = q.beginPullTracking();
    q.addToSyncQueue('customers', 'UPDATE', 'B', { id: 'B' });
    await q.flushSyncQueue();
    const inner = stopInner();
    q.addToSyncQueue('products', 'DELTA', 'C', { delta: 1 });
    await q.flushSyncQueue();
    const outer = stopOuter();
    expect(Object.keys(inner)).toEqual(['customers']);
    expect([...inner.customers]).toEqual(['B']);
    expect([...outer.products].sort()).toEqual(['A', 'C']);
    expect([...outer.customers]).toEqual(['B']);
    expect(q.activePullTrackerCount()).toBe(0);
    stopOuter(); // idempotent
    q.addToSyncQueue('products', 'UPDATE', 'D', { id: 'D' });
    await q.flushSyncQueue();
    expect(outer.products.has('D')).toBe(false);
  });
});
