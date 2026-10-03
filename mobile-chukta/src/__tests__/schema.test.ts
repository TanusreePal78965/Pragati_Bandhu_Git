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
  expect(v?.user_version).toBe(3);
});

test('migrate is idempotent from an existing v1 database (upgrade path)', async () => {
  const db = openTestDb();
  await db.execAsync(`
    create table if not exists properties (
      id text primary key, shop_id text not null, name text not null, address text, is_active integer not null default 1,
      default_pay_basis text not null default 'daily', default_attendance_mode text not null default 'day',
      shift_hours real not null default 8, weekly_off integer, monthly_divisor text not null default 'calendar',
      created_at text not null, server_updated_at text
    );
    create table if not exists workers (
      id text primary key, property_id text not null, name text not null, phone text, pay_basis text not null,
      rate_paise integer not null, joining_date text not null, status text not null default 'active', left_date text,
      attendance_mode text, shift_hours real, weekly_off_override integer not null default 0, weekly_off integer,
      monthly_divisor text, created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
    );
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
  expect(v?.user_version).toBe(3);
});

test('each table has exactly the declared columns', async () => {
  const db = openTestDb();
  await migrate(db);
  for (const t of SYNCED_TABLES) {
    const cols = await db.getAllAsync<{ name: string }>(`pragma table_info(${t})`);
    expect(cols.map((c) => c.name).sort()).toEqual([...TABLE_COLUMNS[t]].sort());
  }
});

test('v2 → v3 upgrade adds the Phase 2A tables and columns without touching existing rows', async () => {
  const db = openTestDb();
  await migrate(db); // fresh install runs v1..v3
  await db.runAsync(`insert into properties (id, shop_id, name, created_at) values ('p1', 's', 'Main', 't')`);
  const prop = await db.getFirstAsync<{ offday_multiplier: number; ot_mode: string; ot_multiplier: number; ot_rate_paise: number | null }>(
    'select offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise from properties');
  expect(prop).toEqual({ offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null });
  for (const t of ['days_off', 'overtime_entries', 'earning_adjustments']) {
    expect(await db.getFirstAsync("select name from sqlite_master where type = 'table' and name = ?", [t])).toEqual({ name: t });
  }
});
