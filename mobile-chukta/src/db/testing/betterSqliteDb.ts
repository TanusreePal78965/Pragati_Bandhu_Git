import Database from 'better-sqlite3';
import type { SqlDb, SqlParam } from '../sqlDb';

/** Test-only SqlDb backed by in-memory better-sqlite3 (never imported by app code). */
export function openTestDb(): SqlDb {
  const raw = new Database(':memory:');
  return {
    async execAsync(sql) { raw.exec(sql); },
    async runAsync(sql, params: SqlParam[] = []) { return raw.prepare(sql).run(...params); },
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      const stmt = raw.prepare(sql);
      return (stmt.reader ? stmt.all(...params) : []) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      const stmt = raw.prepare(sql);
      return ((stmt.reader ? stmt.get(...params) : undefined) ?? null) as T | null;
    },
    async withTransactionAsync(fn) {
      raw.exec('begin');
      try { await fn(); raw.exec('commit'); } catch (e) { raw.exec('rollback'); throw e; }
    },
    async closeAsync() { raw.close(); },
  };
}
