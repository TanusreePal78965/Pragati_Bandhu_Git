import { createTestDb } from './helpers/testDb';

describe('test harness', () => {
  it('creates the schema', () => {
    const db = createTestDb();
    expect(db.getFirstSync("SELECT name FROM sqlite_master WHERE name='products'")).not.toBeNull();
    expect(db.getFirstSync("SELECT name FROM sqlite_master WHERE name='sync_queue'")).not.toBeNull();
    expect(db.getFirstSync('SELECT * FROM products')).toBeNull();
  });

  it('inserts and counts', () => {
    const db = createTestDb();
    db.runSync("INSERT INTO products (id, name) VALUES (?, ?)", ['p1', 'Rice']);
    expect(db.getFirstSync('SELECT COUNT(*) c FROM products')).toEqual({ c: 1 });
  });

  it('withTransactionSync rolls back on throw', () => {
    const db = createTestDb();
    expect(() =>
      db.withTransactionSync(() => {
        db.runSync("INSERT INTO products (id, name) VALUES (?, ?)", ['p1', 'Rice']);
        throw new Error('boom');
      }),
    ).toThrow('boom');
    expect(db.getFirstSync('SELECT COUNT(*) c FROM products')).toEqual({ c: 0 });
  });
});
