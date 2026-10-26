import { createTestDb, mockSqliteModule, TestDb } from './helpers/testDb';

const MAX_ROWS = 1000;

function makeFakeSupabase(tables: Record<string, any[]>) {
  const from = (table: string) => {
    const state: { filters: [string, any][]; inCol?: string; inVals?: any[]; range?: [number, number]; ordered: boolean } =
      { filters: [], ordered: false };
    const run = () => {
      let rows = (tables[table] ?? []).filter(r => state.filters.every(([c, v]) => r[c] === v));
      if (state.inCol) rows = rows.filter(r => state.inVals!.includes(r[state.inCol!]));
      if (state.ordered) rows = [...rows].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1);
      return rows.slice(0, MAX_ROWS); // simulate PostgREST max_rows
    };
    const b: any = {
      select: () => b,
      eq: (c: string, v: any) => { state.filters.push([c, v]); return b; },
      in: (c: string, vals: any[]) => { state.inCol = c; state.inVals = vals; return b; },
      order: () => { state.ordered = true; return b; },
      range: (f: number, t: number) => { state.range = [f, t]; return b; },
      single: () => Promise.resolve({ data: (tables[table] ?? [])[0] ?? null, error: null }),
      then: (res: any, rej: any) => Promise.resolve({ data: run(), error: null }).then(res, rej),
    };
    return b;
  };
  return { from };
}

describe('restoreFromCloud pagination', () => {
  let testDb: TestDb;

  beforeEach(() => {
    jest.resetModules();
    testDb = createTestDb();
    mockSqliteModule(testDb);
  });
  afterEach(() => testDb.closeSync());

  it('imports every row past the 1000-row cap, including bill_items in a chunk', async () => {
    const pad = (n: number) => String(n).padStart(5, '0');
    const bills = Array.from({ length: 2500 }, (_, i) => ({
      id: `b${pad(i)}`, shop_id: 'shop1', bill_date: '2024-01-01T00:00:00Z',
    }));
    // 1500 items all belonging to the first 100 bills (one chunk > 1000 rows)
    const bill_items = Array.from({ length: 1500 }, (_, i) => ({
      id: `i${pad(i)}`, bill_id: `b${pad(i % 100)}`,
    }));
    jest.doMock('../lib/supabase', () => ({
      supabase: makeFakeSupabase({
        shops: [{ id: 'shop1', shop_name: 'S', owner_name: 'O', phone: '1' }],
        bills, bill_items,
      }),
    }));
    jest.doMock('../utils/storage', () => ({
      getStoredShopId: jest.fn().mockResolvedValue('shop1'),
    }));
    const importFromJson = jest.fn().mockReturnValue({});
    jest.doMock('../db/backup', () => ({ importFromJson }));

    const { restoreFromCloud } = require('../services/restoreService');
    const result = await restoreFromCloud();

    expect(result.success).toBe(true);
    expect(result.tableErrors).toBeUndefined();
    const data = importFromJson.mock.calls[0][0];
    expect(data.bills).toHaveLength(2500);
    expect(new Set(data.bills.map((b: any) => b.id)).size).toBe(2500);
    expect(data.billItems).toHaveLength(1500);
    expect(new Set(data.billItems.map((b: any) => b.id)).size).toBe(1500);
  });
});
