import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate, SYNCED_TABLES, TABLE_COLUMNS } from '../db/schema';
import { insertManyAndEnqueue } from '../repos/write';
import type { RepoContext } from '../repos/context';

test('migrate creates all synced tables plus sync tables and is idempotent', async () => {
  const db = openTestDb();
  await migrate(db);
  await migrate(db);
  const rows = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'table'");
  const names = rows.map((r) => r.name);
  for (const t of [...SYNCED_TABLES, 'sync_queue', 'sync_cursor']) expect(names).toContain(t);
  const v = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  expect(v?.user_version).toBe(4);
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
    create table if not exists advance_entries (
      id text primary key, property_id text not null, worker_id text not null, type text not null, amount_paise integer not null,
      date text not null, mode text, note text, voids_id text, created_by text not null, created_by_role text not null,
      created_at text not null, server_updated_at text
    );
    create table if not exists wage_payments (
      id text primary key, property_id text not null, worker_id text not null, amount_paise integer not null, date text not null,
      mode text, note text, voids_id text, created_by text not null, created_by_role text not null, created_at text not null,
      server_updated_at text
    );
    create table if not exists sync_cursor (table_name text primary key, cursor text not null);
    pragma user_version = 1;
  `);
  await migrate(db);
  const idx = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'index' and tbl_name = 'attendance_entries'");
  expect(idx.map((r) => r.name)).toContain('idx_attendance_property_date');
  const v = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  expect(v?.user_version).toBe(4);
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
  await db.execAsync(`
    create table properties (
      id text primary key, shop_id text not null, name text not null, address text, is_active integer not null default 1,
      default_pay_basis text not null default 'daily', default_attendance_mode text not null default 'day',
      shift_hours real not null default 8, weekly_off integer, monthly_divisor text not null default 'calendar',
      created_at text not null, server_updated_at text
    );
    create table workers (
      id text primary key, property_id text not null, name text not null, phone text, pay_basis text not null,
      rate_paise integer not null, joining_date text not null, status text not null default 'active', left_date text,
      attendance_mode text, shift_hours real, weekly_off_override integer not null default 0, weekly_off integer,
      monthly_divisor text, created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
    );
    create table attendance_entries (
      id text primary key, property_id text not null, worker_id text not null, date text not null, status text not null,
      hours real, note text, created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
    );
    create index idx_attendance_worker_date on attendance_entries(worker_id, date);
    create index idx_attendance_property_date on attendance_entries(property_id, date);
    create table advance_entries (
      id text primary key, property_id text not null, worker_id text not null, type text not null, amount_paise integer not null,
      date text not null, mode text, note text, voids_id text, created_by text not null, created_by_role text not null,
      created_at text not null, server_updated_at text
    );
    create table wage_payments (
      id text primary key, property_id text not null, worker_id text not null, amount_paise integer not null, date text not null,
      mode text, note text, voids_id text, created_by text not null, created_by_role text not null, created_at text not null,
      server_updated_at text
    );
    create table sync_cursor (table_name text primary key, cursor text not null);
    pragma user_version = 2;
  `);
  for (const t of ['properties', 'workers', 'attendance_entries', 'advance_entries']) {
    await db.runAsync('insert into sync_cursor (table_name, cursor) values (?, ?)', [t, '{}']);
  }
  await db.runAsync(`insert into properties (id, shop_id, name, created_at) values ('p1', 's', 'Main', 't')`);
  await db.runAsync(`insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at)
    values ('w1', 'p1', 'Ravi', 'daily', 50000, '2026-01-01', 'u', 'owner', 't')`);
  await db.runAsync(`insert into attendance_entries (id, property_id, worker_id, date, status, created_by, created_by_role, created_at)
    values ('a1', 'p1', 'w1', '2026-10-01', 'present', 'u', 'owner', 't')`);

  await migrate(db);

  expect((await db.getFirstAsync<{ user_version: number }>('pragma user_version'))?.user_version).toBe(4);
  expect(await db.getFirstAsync('select id, name, shift_hours, default_pay_basis from properties')).toEqual(
    { id: 'p1', name: 'Main', shift_hours: 8, default_pay_basis: 'daily' });
  expect(await db.getFirstAsync('select offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise from properties')).toEqual(
    { offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null });
  expect(await db.getFirstAsync('select id, name, rate_paise, joining_date from workers')).toEqual(
    { id: 'w1', name: 'Ravi', rate_paise: 50000, joining_date: '2026-01-01' });
  expect(await db.getFirstAsync('select offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise from workers')).toEqual(
    { offday_multiplier: null, ot_mode: null, ot_multiplier: null, ot_rate_paise: null });
  expect(await db.getFirstAsync('select id, worker_id, date, status, custom_amount_paise from attendance_entries')).toEqual(
    { id: 'a1', worker_id: 'w1', date: '2026-10-01', status: 'present', custom_amount_paise: null });
  expect((await db.getAllAsync<{ table_name: string }>('select table_name from sync_cursor')).map((r) => r.table_name)).toEqual([]);
  for (const t of ['days_off', 'overtime_entries', 'earning_adjustments']) {
    expect(await db.getFirstAsync("select name from sqlite_master where type = 'table' and name = ?", [t])).toEqual({ name: t });
  }
});

const V3_DDL = `
  create table properties (
    id text primary key, shop_id text not null, name text not null, address text, is_active integer not null default 1,
    default_pay_basis text not null default 'daily', default_attendance_mode text not null default 'day',
    shift_hours real not null default 8, weekly_off integer, monthly_divisor text not null default 'calendar',
    offday_multiplier real not null default 1, ot_mode text not null default 'multiplier', ot_multiplier real not null default 1,
    ot_rate_paise integer, created_at text not null, server_updated_at text
  );
  create table workers (
    id text primary key, property_id text not null, name text not null, phone text, pay_basis text not null,
    rate_paise integer not null, joining_date text not null, status text not null default 'active', left_date text,
    attendance_mode text, shift_hours real, weekly_off_override integer not null default 0, weekly_off integer,
    monthly_divisor text, offday_multiplier real, ot_mode text, ot_multiplier real, ot_rate_paise integer,
    created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
  );
  create table advance_entries (
    id text primary key, property_id text not null, worker_id text not null, type text not null, amount_paise integer not null,
    date text not null, mode text, note text, voids_id text, created_by text not null, created_by_role text not null,
    created_at text not null, server_updated_at text
  );
  create table wage_payments (
    id text primary key, property_id text not null, worker_id text not null, amount_paise integer not null, date text not null,
    mode text, note text, voids_id text, created_by text not null, created_by_role text not null, created_at text not null,
    server_updated_at text
  );
  create table sync_cursor (table_name text primary key, cursor text not null);
  pragma user_version = 3;
`;

test('v3 → v4 upgrade adds pay cycles, settlements and settlement_id, keeping rows and clearing four cursors', async () => {
  const db = openTestDb();
  await db.execAsync(V3_DDL);
  await db.runAsync(`insert into properties (id, shop_id, name, created_at) values ('p1', 's', 'Main', 't')`);
  await db.runAsync(`insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at)
    values ('w1', 'p1', 'Ravi', 'daily', 50000, '2026-01-01', 'u', 'owner', 't')`);
  await db.runAsync(`insert into wage_payments (id, property_id, worker_id, amount_paise, date, created_by, created_by_role, created_at)
    values ('pay1', 'p1', 'w1', 1000, '2026-09-05', 'u', 'owner', 't')`);
  for (const t of ['properties', 'workers', 'wage_payments', 'advance_entries', 'earning_adjustments']) {
    await db.runAsync('insert into sync_cursor (table_name, cursor) values (?, ?)', [t, '{}']);
  }

  await migrate(db);

  expect((await db.getFirstAsync<{ user_version: number }>('pragma user_version'))?.user_version).toBe(4);
  expect(await db.getFirstAsync('select id, name from properties')).toEqual({ id: 'p1', name: 'Main' });
  expect(await db.getFirstAsync('select id, name from workers')).toEqual({ id: 'w1', name: 'Ravi' });
  expect(await db.getFirstAsync('select pay_cycle, cycle_end_weekday from properties')).toEqual({ pay_cycle: 'by_basis', cycle_end_weekday: 6 });
  expect(await db.getFirstAsync('select pay_cycle, cycle_end_weekday from workers')).toEqual({ pay_cycle: null, cycle_end_weekday: null });
  expect(await db.getFirstAsync('select id, amount_paise, settlement_id from wage_payments')).toEqual({ id: 'pay1', amount_paise: 1000, settlement_id: null });
  expect(await db.getFirstAsync("select name from sqlite_master where type = 'table' and name = 'settlements'")).toEqual({ name: 'settlements' });
  expect((await db.getAllAsync<{ table_name: string }>('select table_name from sync_cursor order by table_name')).map((r) => r.table_name))
    .toEqual(['earning_adjustments']);
});

const settlementRow = {
  id: 's1', property_id: 'p1', worker_id: 'w1', period_start: '2026-09-01', period_end: '2026-09-05', settled_on: '2026-09-06',
  pay_basis: 'daily', rate_paise: 50000, opening_balance_paise: 0, base_paise: 250000, offday_extra_paise: 0, overtime_paise: 0,
  bonus_paise: 0, deduction_paise: 0, earned_paise: 250000, paid_in_period_paise: 0, paid_now_paise: 250000, advance_recovered_paise: 0,
  advance_after_paise: 0, closing_balance_paise: 0, summary: {}, note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: 't', server_updated_at: null,
};
const payRow = (id: string, over: Record<string, unknown> = {}) => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: 100, date: '2026-09-05', mode: 'cash', note: null, voids_id: null,
  settlement_id: null, created_by: 'u1', created_by_role: 'owner', created_at: 't', server_updated_at: null, ...over,
});

test('insertManyAndEnqueue writes and queues every row in order, atomically', async () => {
  const db = openTestDb();
  await migrate(db);
  const c: RepoContext = { db, userId: 'u1', role: 'owner', now: () => new Date('2026-09-06T10:00:00Z'), newId: () => 'x' };
  await insertManyAndEnqueue(c, [
    { table: 'settlements', row: settlementRow },
    { table: 'wage_payments', row: payRow('p1', { settlement_id: 's1' }) },
  ]);
  const q = await db.getAllAsync<{ table_name: string; payload: string }>('select table_name, payload from sync_queue order by seq');
  expect(q.map((r) => r.table_name)).toEqual(['settlements', 'wage_payments']);
  expect(JSON.parse(q[0].payload).summary).toEqual({});
  expect(await db.getFirstAsync('select summary from settlements')).toEqual({ summary: '{}' });

  // The second row violates NOT NULL (property_id), so the first row must roll back too.
  await expect(insertManyAndEnqueue(c, [
    { table: 'wage_payments', row: payRow('p2') },
    { table: 'wage_payments', row: payRow('p3', { property_id: null }) },
  ])).rejects.toThrow();
  expect(await db.getFirstAsync("select id from wage_payments where id = 'p2'")).toBeNull();
  expect(await db.getFirstAsync('select count(*) as n from sync_queue')).toEqual({ n: 2 });
});
