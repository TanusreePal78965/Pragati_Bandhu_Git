import Database from 'better-sqlite3';
import type { SqlDb, SqlParam } from '../sqlDb';

/**
 * better-sqlite3 is a native addon: Node caches it per process, so its SqliteError extends the Error of whichever
 * Jest sandbox loaded it first. In any other test file that error fails `instanceof Error`, and `rejects.toThrow()`
 * then reports "did not throw". Re-throw as an Error of the calling sandbox so tests behave the same in every run.
 */
function sameRealm(e: unknown): unknown {
  if (e instanceof Error || e === null || typeof e !== 'object') return e;
  const src = e as { message?: unknown; code?: unknown };
  return Object.assign(new Error(String(src.message)), { code: src.code });
}
async function guard<T>(fn: () => T | Promise<T>): Promise<T> {
  try { return await fn(); } catch (e) { throw sameRealm(e); }
}

/** Test-only SqlDb backed by in-memory better-sqlite3 (never imported by app code). */
export function openTestDb(): SqlDb {
  const raw = new Database(':memory:');
  return {
    execAsync: (sql) => guard(() => { raw.exec(sql); }),
    runAsync: (sql, params: SqlParam[] = []) => guard(() => raw.prepare(sql).run(...params)),
    getAllAsync: <T>(sql: string, params: SqlParam[] = []) => guard(() => {
      const stmt = raw.prepare(sql);
      return (stmt.reader ? stmt.all(...params) : []) as T[];
    }),
    getFirstAsync: <T>(sql: string, params: SqlParam[] = []) => guard(() => {
      const stmt = raw.prepare(sql);
      return ((stmt.reader ? stmt.get(...params) : undefined) ?? null) as T | null;
    }),
    async withTransactionAsync(fn) {
      raw.exec('begin');
      try { await fn(); raw.exec('commit'); } catch (e) { raw.exec('rollback'); throw sameRealm(e); }
    },
    async closeAsync() { raw.close(); },
  };
}
