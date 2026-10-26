import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('local stock/udhar writes queue DELTA ops', () => {
  let testDb: TestDb;
  let d: typeof import('../db/db');

  const queue = (table?: string) =>
    (table
      ? testDb.getAllSync('SELECT * FROM sync_queue WHERE table_name = ? ORDER BY id ASC', [table])
      : testDb.getAllSync('SELECT * FROM sync_queue ORDER BY id ASC')
    ).map((r: any) => ({ ...r, payload: JSON.parse(r.payload) }));
  const deltas = (table: string, id: string) =>
    queue(table).filter((r) => r.operation === 'DELTA' && r.data_id === id).map((r) => r.payload.delta);
  const stock = (id: string) =>
    testDb.getFirstSync('SELECT stock_quantity FROM products WHERE id = ?', [id]).stock_quantity;
  const balance = (id: string) =>
    testDb.getFirstSync('SELECT udhar_balance FROM customers WHERE id = ?', [id]).udhar_balance;

  const item = (qty: number, product_id = 'P') => ({
    product_id, product_name: 'Soap', qty, unit_price: 10, line_total: qty * 10,
  });
  const sell = (qty: number, extra: Partial<{ customer_id: string; payment_mode: string }> = {}) =>
    d.insertBill(
      {
        customer_id: extra.customer_id ?? null,
        customer_name: null,
        payment_mode: extra.payment_mode ?? 'cash',
        total_amount: qty * 10,
        total_items: 1,
      } as any,
      [item(qty)] as any,
    );

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
    jest.doMock('../lib/supabase', () => ({ supabase: {} }));
    jest.doMock('@react-native-community/netinfo', () => ({
      __esModule: true,
      default: { fetch: jest.fn() },
    }));
    jest.doMock('../utils/storage', () => ({
      getOrCreateDeviceId: jest.fn(),
      getStoredShopId: jest.fn(),
      getHasConsent: jest.fn().mockResolvedValue(false),
    }));
    d = require('../db/db');
    testDb.runSync("INSERT INTO products (id, name, stock_quantity) VALUES ('P', 'Soap', 10)");
    testDb.runSync("INSERT INTO customers (id, name, udhar_balance) VALUES ('C', 'Ravi', 30)");
  });

  afterEach(() => testDb.closeSync());

  it('(a) a sale of 3 on stock 10 queues DELTA -3', () => {
    sell(3);
    expect(stock('P')).toBe(7);
    expect(deltas('products', 'P')).toEqual([-3]);
  });

  it('(b) a sale of 15 on stock 10 queues the clamped DELTA -10', () => {
    sell(15);
    expect(stock('P')).toBe(0);
    expect(deltas('products', 'P')).toEqual([-10]);
  });

  it('(c) two sales queue two DELTA rows', () => {
    sell(3);
    sell(2);
    expect(deltas('products', 'P')).toEqual([-3, -2]);
  });

  it('(d) INSERT then a name change leaves one INSERT with the new name and current stock', () => {
    const id = d.insertProduct({
      name: 'Tea', category_id: null, brand_id: null, purchase_price: 5, selling_price: 8,
      stock_quantity: 10, min_stock_threshold: 2, uom: 'Pcs',
    } as any);
    d.insertBill(
      { customer_id: null, customer_name: null, payment_mode: 'cash', total_amount: 24, total_items: 1 } as any,
      [item(3, id)] as any,
    );
    d.updateProduct(id, { name: 'Green Tea' });
    const ops = queue('products').filter((r) => r.data_id === id);
    const nonDelta = ops.filter((r) => r.operation !== 'DELTA');
    expect(nonDelta).toHaveLength(1);
    expect(nonDelta[0].operation).toBe('INSERT');
    expect(nonDelta[0].payload.name).toBe('Green Tea');
    expect(nonDelta[0].payload.stock_quantity).toBe(7);
    // The promoted INSERT's absolute stock already includes the sale, so its DELTA is dropped.
    expect(ops.map((r) => r.operation)).toEqual(['INSERT']);
  });

  it('the same product twice in one bill queues per-item DELTAs summing to the real (clamped) change', () => {
    d.insertBill(
      { customer_id: null, customer_name: null, payment_mode: 'cash', total_amount: 120, total_items: 2 } as any,
      [item(4), item(8)] as any,
    );
    expect(stock('P')).toBe(0);
    const ds = deltas('products', 'P');
    expect(ds).toEqual([-4, -6]);
    expect(ds.reduce((a: number, b: number) => a + b, 0)).toBe(-10);
  });

  it('(g) a udhar sale queues a customers DELTA equal to the bill total and no customers UPDATE', () => {
    sell(4, { customer_id: 'C', payment_mode: 'udhar' });
    expect(balance('C')).toBe(70);
    expect(deltas('customers', 'C')).toEqual([40]);
    expect(queue('customers').filter((r) => r.operation !== 'DELTA')).toHaveLength(0);
  });

  it('finalizeDraft clamps stock at 0 and queues actual deltas', () => {
    const draftId = d.createDraft();
    d.finalizeDraft(draftId, { id: 'C', name: 'Ravi' }, 'udhar', [item(15)] as any);
    expect(stock('P')).toBe(0);
    expect(deltas('products', 'P')).toEqual([-10]);
    expect(deltas('customers', 'C')).toEqual([150]);
    expect(queue('customers').filter((r) => r.operation !== 'DELTA')).toHaveLength(0);
  });

  it('updateProductStock queues the actual change; no change queues nothing', () => {
    d.updateProductStock('P', 25);
    d.updateProductStock('P', 25);
    expect(deltas('products', 'P')).toEqual([15]);
  });

  it('updateProduct with stock_quantity queues a DELTA before its UPDATE; without it, none', () => {
    d.updateProduct('P', { stock_quantity: 4, selling_price: 12 });
    d.updateProduct('P', { name: 'Soap 2' });
    const ops = queue('products');
    expect(ops.map((r) => r.operation)).toEqual(['DELTA', 'UPDATE']);
    expect(ops[0].payload.delta).toBe(-6);
    expect(ops[1].payload.name).toBe('Soap 2');
  });

  it('recordUdharPayment queues the clamped (actual) negative delta', () => {
    d.recordUdharPayment('C', 50);
    expect(balance('C')).toBe(0);
    expect(deltas('customers', 'C')).toEqual([-30]);
    expect(queue('customers').filter((r) => r.operation !== 'DELTA')).toHaveLength(0);
  });

  it('updateCustomerUdhar queues a delta rounded to 4 decimals', () => {
    testDb.runSync("UPDATE customers SET udhar_balance = 0.1 WHERE id = 'C'");
    d.updateCustomerUdhar('C', 0.2);
    expect(deltas('customers', 'C')).toEqual([0.2]);
  });
});
