-- supabase/migrations/20260930100000_chukta_schema.sql
-- Chukta Phase 1 schema (spec §4).

create schema if not exists chukta;

create or replace function chukta.touch_server_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.server_updated_at := clock_timestamp();
  return new;
end $$;

create table chukta.properties (
  id                      uuid primary key default gen_random_uuid(),
  shop_id                 uuid not null references public.shops(id) on delete cascade,
  name                    text not null check (length(trim(name)) > 0),
  address                 text,
  is_active               boolean not null default true,
  default_pay_basis       text not null default 'daily' check (default_pay_basis in ('hourly','daily','weekly','monthly')),
  default_attendance_mode text not null default 'day' check (default_attendance_mode in ('day','hours')),
  shift_hours             numeric(4,2) not null default 8 check (shift_hours > 0 and shift_hours <= 24),
  weekly_off              smallint default 0 check (weekly_off between 0 and 6),
  monthly_divisor         text not null default 'calendar' check (monthly_divisor in ('calendar','26','30')),
  created_at              timestamptz not null default now(),
  server_updated_at       timestamptz not null default clock_timestamp()
);
create index idx_chukta_properties_shop on chukta.properties(shop_id);

create table chukta.staff_users (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references chukta.properties(id) on delete cascade,
  name              text not null check (length(trim(name)) > 0),
  auth_user_id      uuid not null unique references auth.users(id) on delete cascade,
  pin_hash          text not null,
  pin_salt          text not null,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp()
);
create index idx_chukta_staff_property on chukta.staff_users(property_id);

create table chukta.workers (
  id                  uuid primary key,
  property_id         uuid not null references chukta.properties(id) on delete cascade,
  name                text not null check (length(trim(name)) > 0),
  phone               text,
  pay_basis           text not null check (pay_basis in ('hourly','daily','weekly','monthly')),
  rate_paise          bigint not null check (rate_paise > 0),
  joining_date        date not null,
  status              text not null default 'active' check (status in ('active','left')),
  left_date           date,
  attendance_mode     text check (attendance_mode in ('day','hours')),
  shift_hours         numeric(4,2) check (shift_hours > 0 and shift_hours <= 24),
  weekly_off_override boolean not null default false,
  weekly_off          smallint check (weekly_off between 0 and 6),
  monthly_divisor     text check (monthly_divisor in ('calendar','26','30')),
  created_by          uuid not null default auth.uid(),
  created_by_role     text not null check (created_by_role in ('owner','staff')),
  created_at          timestamptz not null default now(),
  server_updated_at   timestamptz not null default clock_timestamp(),
  check (pay_basis <> 'hourly' or coalesce(attendance_mode, 'hours') = 'hours'),
  check (status = 'active' or left_date is not null)
);
create index idx_chukta_workers_property on chukta.workers(property_id);

create table chukta.attendance_entries (
  id                uuid primary key,
  property_id       uuid not null references chukta.properties(id) on delete cascade,
  worker_id         uuid not null references chukta.workers(id) on delete cascade,
  date              date not null,
  status            text not null check (status in ('absent','half_day','present','hours')),
  hours             numeric(4,2),
  note              text,
  created_by        uuid not null default auth.uid(),
  created_by_role   text not null check (created_by_role in ('owner','staff')),
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  check ((status = 'hours') = (hours is not null)),
  check (hours is null or (hours >= 0 and hours <= 24))
);
create index idx_chukta_attendance_worker_date on chukta.attendance_entries(worker_id, date);

create table chukta.advance_entries (
  id                uuid primary key,
  property_id       uuid not null references chukta.properties(id) on delete cascade,
  worker_id         uuid not null references chukta.workers(id) on delete cascade,
  type              text not null check (type in ('advance','repayment','writeoff')),
  amount_paise      bigint not null check (amount_paise > 0),
  date              date not null,
  mode              text check (mode in ('cash','upi','bank')),
  note              text,
  voids_id          uuid references chukta.advance_entries(id),
  created_by        uuid not null default auth.uid(),
  created_by_role   text not null check (created_by_role in ('owner','staff')),
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  check (type <> 'writeoff' or voids_id is not null or length(trim(coalesce(note, ''))) > 0)
);
create index idx_chukta_advance_worker on chukta.advance_entries(worker_id);

create table chukta.wage_payments (
  id                uuid primary key,
  property_id       uuid not null references chukta.properties(id) on delete cascade,
  worker_id         uuid not null references chukta.workers(id) on delete cascade,
  amount_paise      bigint not null check (amount_paise > 0),
  date              date not null,
  mode              text check (mode in ('cash','upi','bank')),
  note              text,
  voids_id          uuid references chukta.wage_payments(id),
  created_by        uuid not null default auth.uid(),
  created_by_role   text not null check (created_by_role in ('owner','staff')),
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp()
);
create index idx_chukta_payments_worker on chukta.wage_payments(worker_id);

-- Entries must belong to their worker's property; voids must target a non-void row of the same worker.
create or replace function chukta.check_entry_consistency() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_prop   uuid;
  v_worker uuid;
  v_void   uuid;
begin
  select w.property_id into v_prop from chukta.workers w where w.id = new.worker_id;
  if v_prop is distinct from new.property_id then
    raise exception 'worker % does not belong to property %', new.worker_id, new.property_id using errcode = '23514';
  end if;
  if tg_table_name in ('advance_entries', 'wage_payments') and new.voids_id is not null then
    execute format('select property_id, worker_id, voids_id from chukta.%I where id = $1', tg_table_name)
      into v_prop, v_worker, v_void using new.voids_id;
    if v_prop is distinct from new.property_id or v_worker is distinct from new.worker_id or v_void is not null then
      raise exception 'invalid void target %', new.voids_id using errcode = '23514';
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['properties','staff_users','workers','attendance_entries','advance_entries','wage_payments'] loop
    execute format('create trigger trg_touch before insert or update on chukta.%I for each row execute function chukta.touch_server_updated_at()', t);
  end loop;
  foreach t in array array['attendance_entries','advance_entries','wage_payments'] loop
    execute format('create trigger trg_consistency before insert or update on chukta.%I for each row execute function chukta.check_entry_consistency()', t);
  end loop;
end $$;
