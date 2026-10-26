// expo-sqlite pulls in native-only deps (expo-asset); only initTables is needed here.
jest.mock('expo-sqlite', () => ({ openDatabaseSync: jest.fn() }));

import BetterSqlite3 from 'better-sqlite3';
import { initTables } from '../../db/sqlite';

export interface TestDb {
  runSync(sql: string, params?: unknown[]): unknown;
  getAllSync(sql: string, params?: unknown[]): any[];
  getFirstSync(sql: string, params?: unknown[]): any | null;
  execSync(sql: string): void;
  withTransactionSync(fn: () => void): void;
  closeSync(): void;
}

export function createTestDb(): TestDb {
  const raw = new BetterSqlite3(':memory:');
  const testDb: TestDb = {
    runSync: (sql, params = []) => raw.prepare(sql).run(...(params as any[])),
    getAllSync: (sql, params = []) => raw.prepare(sql).all(...(params as any[])),
    getFirstSync: (sql, params = []) => raw.prepare(sql).get(...(params as any[])) ?? null,
    execSync: (sql) => {
      raw.exec(sql);
    },
    withTransactionSync: (fn) => {
      raw.exec('BEGIN');
      try {
        fn();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
    closeSync: () => {
      raw.close();
    },
  };
  initTables(testDb as any);
  return testDb;
}

/** Call BEFORE requiring the module under test. */
export function mockSqliteModule(testDb: TestDb): void {
  jest.doMock('../../db/sqlite', () => ({
    __esModule: true,
    default: testDb,
    openUserDatabase: jest.fn(),
    closeUserDatabase: jest.fn(),
  }));
}
