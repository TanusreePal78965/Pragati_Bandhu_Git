import { createTestDb, TestDb } from './helpers/testDb';
import { migrateLegacySyncQueue } from '../db/sqlite';

describe('legacy sync_queue migration', () => {
  let testDb: TestDb;
  const version = () => testDb.getFirstSync('PRAGMA user_version').user_version;
  const ops = () =>
    testDb.getAllSync('SELECT table_name, operation, data_id FROM sync_queue ORDER BY id ASC')
      .map((r: any) => [r.table_name, r.operation, r.data_id]);
  const queue = (table: string, op: string, id: string) =>
    testDb.runSync(
      'INSERT INTO sync_queue (table_name, operation, data_id, payload) VALUES (?, ?, ?, ?)',
      [table, op, id, JSON.stringify({ id, stock_quantity: 7 })],
    );

  beforeEach(() => {
    testDb = createTestDb();
  });
  afterEach(() => testDb.closeSync());

  it('initTables leaves a fresh database at user_version 1', () => {
    expect(version()).toBe(1);
  });

  it('turns legacy products/customers UPDATEs into INSERTs once, then is a no-op', () => {
    testDb.execSync('PRAGMA user_version = 0');
    queue('products', 'UPDATE', 'P');
    queue('customers', 'UPDATE', 'C');
    queue('categories', 'UPDATE', 'K');
    queue('products', 'DELETE', 'D');
    migrateLegacySyncQueue(testDb as any);
    expect(version()).toBe(1);
    expect(ops()).toEqual([
      ['products', 'INSERT', 'P'],
      ['customers', 'INSERT', 'C'],
      ['categories', 'UPDATE', 'K'],
      ['products', 'DELETE', 'D'],
    ]);

    // A new-format UPDATE (e.g. a customer name edit) queued after the migration is untouched.
    queue('customers', 'UPDATE', 'C2');
    migrateLegacySyncQueue(testDb as any);
    expect(ops()[4]).toEqual(['customers', 'UPDATE', 'C2']);
    expect(version()).toBe(1);
  });
});
