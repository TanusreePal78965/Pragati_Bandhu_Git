import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('pull protects pending edits and reconciles deletes', () => {
  let testDb: TestDb;
  let importFromJson: (data: any, opts?: any) => any;
  let getPendingIds: () => Record<string, Set<string>>;

  const queue = (table: string, op: string, id: string, attempts = 0) =>
    testDb.runSync(
      'INSERT INTO sync_queue (table_name, operation, data_id, payload, attempts) VALUES (?, ?, ?, ?, ?)',
      [table, op, id, '{}', attempts],
    );
  const addProduct = (id: string, name: string) =>
    testDb.runSync(
      'INSERT INTO products (id, name, purchase_price, selling_price, stock_quantity) VALUES (?, ?, 1, 2, 3)',
      [id, name],
    );
  const names = (table: string) =>
    (testDb.getAllSync(`SELECT id FROM ${table} ORDER BY id`) as any[]).map(r => r.id);

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
    importFromJson = require('../db/backup').importFromJson;
    getPendingIds = require('../db/syncQueue').getPendingIds;
  });

  afterEach(() => testDb.closeSync());

  const cloudP = { products: [{ id: 'P', name: 'Cloud name' }] };

  it('a) keeps a locally edited product with a queued UPDATE', () => {
    addProduct('P', 'Local edit');
    queue('products', 'UPDATE', 'P');
    importFromJson(cloudP, { pending: getPendingIds() });
    expect(testDb.getFirstSync('SELECT name FROM products WHERE id = ?', ['P']).name).toBe('Local edit');
  });

  it('b) keeps it even when the queue entry is exhausted (attempts=5)', () => {
    addProduct('P', 'Local edit');
    queue('products', 'UPDATE', 'P', 5);
    importFromJson(cloudP, { pending: getPendingIds() });
    expect(testDb.getFirstSync('SELECT name FROM products WHERE id = ?', ['P']).name).toBe('Local edit');
  });

  it('c) reconcile deletes local rows absent from cloud and not queued', () => {
    addProduct('Q', 'Gone in cloud');
    importFromJson(cloudP, { pending: getPendingIds(), reconcile: true });
    expect(names('products')).toEqual(['P']);
  });

  it('d) reconcile keeps a locally created row with a queued INSERT', () => {
    addProduct('Q', 'New local');
    queue('products', 'INSERT', 'Q');
    importFromJson(cloudP, { pending: getPendingIds(), reconcile: true });
    expect(names('products')).toEqual(['P', 'Q']);
  });

  it('e) no deletes without reconcile', () => {
    addProduct('Q', 'Local only');
    importFromJson(cloudP, { pending: getPendingIds(), reconcile: false });
    expect(names('products')).toEqual(['P', 'Q']);
    importFromJson(cloudP);
    expect(names('products')).toEqual(['P', 'Q']);
  });

  it('reconciles categories, brands and customers too', () => {
    testDb.runSync("INSERT INTO categories (id, name) VALUES ('c1', 'x')");
    testDb.runSync("INSERT INTO brands (id, name) VALUES ('b1', 'x')");
    testDb.runSync("INSERT INTO customers (id, name) VALUES ('u1', 'x')");
    importFromJson({}, { reconcile: true });
    expect(names('categories')).toEqual([]);
    expect(names('brands')).toEqual([]);
    expect(names('customers')).toEqual([]);
  });

  it('f) bills and logs are never reconciled; pending bill and its items are skipped', () => {
    testDb.runSync("INSERT INTO bills (id, total_amount, total_items) VALUES ('B1', 10, 1)");
    testDb.runSync("INSERT INTO bills (id, total_amount, total_items) VALUES ('B2', 20, 1)");
    testDb.runSync("INSERT INTO sales_log (id, product_id, product_name, qty_sold, sale_amount) VALUES ('s1','p','n',1,1)");
    queue('bills', 'INSERT', 'B2');
    importFromJson(
      {
        bills: [{ id: 'B2', total_amount: 999, total_items: 1 }],
        billItems: [{ id: 'i1', bill_id: 'B2', product_id: 'p', product_name: 'n', qty: 1, unit_price: 1, line_total: 1 }],
      },
      { pending: getPendingIds(), reconcile: true },
    );
    expect(names('bills')).toEqual(['B1', 'B2']);
    expect(testDb.getFirstSync('SELECT total_amount FROM bills WHERE id = ?', ['B2']).total_amount).toBe(20);
    expect(names('bill_items')).toEqual([]);
    expect(names('sales_log')).toEqual(['s1']);
  });
});
