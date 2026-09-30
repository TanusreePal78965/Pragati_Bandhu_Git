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
  expect(v?.user_version).toBe(2);
});

test('migrate is idempotent from an existing v1 database (upgrade path)', async () => {
  const db = openTestDb();
  await db.execAsync(`
    create table if not exists attendance_entries (
      id text primary key, property_id text not null, worker_id text not null, date text not null, status text not null,
      hours real, note text, created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
    );
    create index if not exists idx_attendance_worker_date on attendance_entries(worker_id, date);
    pragma user_version = 1;
  `);
  await migrate(db);
  const idx = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'index' and tbl_name = 'attendance_entries'");
  expect(idx.map((r) => r.name)).toContain('idx_attendance_property_date');
  const v = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  expect(v?.user_version).toBe(2);
});

test('each table has exactly the declared columns', async () => {
  const db = openTestDb();
  await migrate(db);
  for (const t of SYNCED_TABLES) {
    const cols = await db.getAllAsync<{ name: string }>(`pragma table_info(${t})`);
    expect(cols.map((c) => c.name).sort()).toEqual([...TABLE_COLUMNS[t]].sort());
  }
});
