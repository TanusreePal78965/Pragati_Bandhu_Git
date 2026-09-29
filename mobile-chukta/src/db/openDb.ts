import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';
import type { SqlDb } from './sqlDb';

/** One database file per login identity (owner shop or staff member), so identities never mix data. */
export async function openChuktaDb(identityKey: string): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(`chukta_${identityKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`);
  await db.execAsync('pragma journal_mode = WAL; pragma foreign_keys = OFF;');
  await migrate(db as unknown as SqlDb);
  return db as unknown as SqlDb;
}
