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

  it('UPDATE after a queued INSERT is promoted to INSERT with the new payload (DELTA rows ignored)', () => {
    q.addToSyncQueue('products', 'INSERT', 'P', { id: 'P', name: 'a', stock_quantity: 10 });
    q.addToSyncQueue('products', 'DELTA', 'P', { delta: -3 });
    q.addToSyncQueue('products', 'UPDATE', 'P', { id: 'P', name: 'b', stock_quantity: 7 });
    const r = rows();
    expect(r.map((x) => x.operation)).toEqual(['DELTA', 'INSERT']);
    expect(JSON.parse(r[1].payload)).toEqual({ id: 'P', name: 'b', stock_quantity: 7 });
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
    await q.flushSyncQueue();
    expect(rpc).toHaveBeenNthCalledWith(1, 'shopai_adjust_stock', { p_product_id: 'P', p_delta: -3 });
    expect(rpc).toHaveBeenNthCalledWith(2, 'shopai_adjust_udhar', { p_customer_id: 'C', p_delta: 120.5 });
    expect(upsert).not.toHaveBeenCalled();
    expect(rows()).toHaveLength(0);
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
