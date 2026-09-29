import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate, SYNCED_TABLES, TABLE_COLUMNS } from '../db/schema';

test('migrate creates all synced tables plus sync tables and is idempotent', async () => {
  const db = openTestDb();
  await migrate(db);
  await migrate(db);
  const rows = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'table'");
  const names = rows.map((r) => r.name);
  for (const t of [...SYNCED_TABLES, 'sync_queue', 'sync_cursor']) expect(names).toContain(t);
  const v = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  expect(v?.user_version).toBe(1);
});

test('each table has exactly the declared columns', async () => {
  const db = openTestDb();
  await migrate(db);
  for (const t of SYNCED_TABLES) {
    const cols = await db.getAllAsync<{ name: string }>(`pragma table_info(${t})`);
    expect(cols.map((c) => c.name).sort()).toEqual([...TABLE_COLUMNS[t]].sort());
  }
});
