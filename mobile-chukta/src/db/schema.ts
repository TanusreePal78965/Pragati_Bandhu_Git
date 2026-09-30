import type { SqlDb } from './sqlDb';

export const SYNCED_TABLES = ['properties', 'staff_users', 'workers', 'attendance_entries', 'advance_entries', 'wage_payments'] as const;
export type SyncedTable = (typeof SYNCED_TABLES)[number];

const ENTRY_AUDIT = ['created_by', 'created_by_role', 'created_at', 'server_updated_at'] as const;

export const TABLE_COLUMNS: Record<SyncedTable, readonly string[]> = {
  properties: ['id', 'shop_id', 'name', 'address', 'is_active', 'default_pay_basis', 'default_attendance_mode', 'shift_hours',
    'weekly_off', 'monthly_divisor', 'created_at', 'server_updated_at'],
  staff_users: ['id', 'property_id', 'name', 'auth_user_id', 'is_active', 'created_at', 'server_updated_at'],
  workers: ['id', 'property_id', 'name', 'phone', 'pay_basis', 'rate_paise', 'joining_date', 'status', 'left_date',
    'attendance_mode', 'shift_hours', 'weekly_off_override', 'weekly_off', 'monthly_divisor', ...ENTRY_AUDIT],
  attendance_entries: ['id', 'property_id', 'worker_id', 'date', 'status', 'hours', 'note', ...ENTRY_AUDIT],
  advance_entries: ['id', 'property_id', 'worker_id', 'type', 'amount_paise', 'date', 'mode', 'note', 'voids_id', ...ENTRY_AUDIT],
  wage_payments: ['id', 'property_id', 'worker_id', 'amount_paise', 'date', 'mode', 'note', 'voids_id', ...ENTRY_AUDIT],
};

const SCHEMA_V1 = `
create table if not exists properties (
  id text primary key, shop_id text not null, name text not null, address text, is_active integer not null default 1,
  default_pay_basis text not null default 'daily', default_attendance_mode text not null default 'day',
  shift_hours real not null default 8, weekly_off integer, monthly_divisor text not null default 'calendar',
  created_at text not null, server_updated_at text
);
create table if not exists staff_users (
  id text primary key, property_id text not null, name text not null, auth_user_id text not null,
  is_active integer not null default 1, created_at text not null, server_updated_at text
);
create table if not exists workers (
  id text primary key, property_id text not null, name text not null, phone text, pay_basis text not null,
  rate_paise integer not null, joining_date text not null, status text not null default 'active', left_date text,
  attendance_mode text, shift_hours real, weekly_off_override integer not null default 0, weekly_off integer,
  monthly_divisor text, created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
);
create index if not exists idx_workers_property on workers(property_id);
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
create index if not exists idx_advance_worker on advance_entries(worker_id);
create table if not exists wage_payments (
  id text primary key, property_id text not null, worker_id text not null, amount_paise integer not null, date text not null,
  mode text, note text, voids_id text, created_by text not null, created_by_role text not null, created_at text not null,
  server_updated_at text
);
create index if not exists idx_payments_worker on wage_payments(worker_id);
create table if not exists sync_queue (
  seq integer primary key autoincrement, table_name text not null, row_id text not null, op text not null default 'insert', payload text not null,
  status text not null default 'pending', attempts integer not null default 0, last_error text, created_at text not null
);
create index if not exists idx_sync_queue_status on sync_queue(status, seq);
create table if not exists sync_cursor (table_name text primary key, cursor text not null);
`;

// listAttendanceForDate (Today screen) filters attendance_entries by (property_id, date); the only
// index at v1 was (worker_id, date), so that query did a full table scan.
const SCHEMA_V2 = `
create index if not exists idx_attendance_property_date on attendance_entries(property_id, date);
`;

export async function migrate(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(SCHEMA_V1);
    await db.execAsync('pragma user_version = 1');
  }
  if (version < 2) {
    await db.execAsync(SCHEMA_V2);
    await db.execAsync('pragma user_version = 2');
  }
}
