import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

describe('lossless restore and bulk upload columns', () => {
  let testDb: TestDb;
  let importFromJson: (data: any) => any;
  let queueAllLocalData: () => void;

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
    queueAllLocalData = require('../db/db').queueAllLocalData;
  });

  afterEach(() => testDb.closeSync());

  it('restores product pack columns and track_stock', () => {
    importFromJson({
      products: [
        { id: 'p1', name: 'Soap', purchase_uom: 'Box', units_per_pack: 12, track_stock: 0 },
      ],
    });
    const row = testDb.getFirstSync('SELECT * FROM products WHERE id = ?', ['p1']);
    expect(row.purchase_uom).toBe('Box');
    expect(row.units_per_pack).toBe(12);
    expect(row.track_stock).toBe(0);
  });

  it('restores bill discount columns', () => {
    importFromJson({
      bills: [
        {
          id: 'b1', total_amount: 450, total_items: 1,
          discount_percent: 10, discount_amount: 50, discount_type: 'percent',
        },
      ],
    });
    const row = testDb.getFirstSync('SELECT * FROM bills WHERE id = ?', ['b1']);
    expect(row.discount_percent).toBe(10);
    expect(row.discount_amount).toBe(50);
    expect(row.discount_type).toBe('percent');
  });

  it('restores bill_items display_qty', () => {
    importFromJson({
      billItems: [
        {
          id: 'i1', bill_id: 'b1', product_id: 'p1', product_name: 'Soap',
          qty: 24, unit_price: 10, line_total: 240, display_qty: '2 Box',
        },
      ],
    });
    const row = testDb.getFirstSync('SELECT * FROM bill_items WHERE id = ?', ['i1']);
    expect(row.display_qty).toBe('2 Box');
  });

  it('queueAllLocalData uploads pack columns and track_stock for products', () => {
    testDb.runSync(
      "INSERT INTO products (id, name, purchase_uom, units_per_pack, track_stock) VALUES ('p2', 'Oil', 'Box', 6, 0)"
    );
    queueAllLocalData();
    const q = testDb.getFirstSync(
      "SELECT payload FROM sync_queue WHERE table_name = 'products' AND data_id = 'p2'"
    );
    const payload = JSON.parse(q.payload);
    expect(payload).toHaveProperty('purchase_uom', 'Box');
    expect(payload).toHaveProperty('units_per_pack', 6);
    expect(payload).toHaveProperty('track_stock', 0);
  });
});
