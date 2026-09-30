export type SqlParam = string | number | null;

/** Minimal surface shared by expo-sqlite's SQLiteDatabase and the better-sqlite3 test adapter. */
export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  /** Releases the underlying connection/file handle. Optional: expo-sqlite provides it; not every adapter needs one. */
  closeAsync?(): Promise<void>;
}
