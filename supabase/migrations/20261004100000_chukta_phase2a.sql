-- supabase/migrations/20261004100000_chukta_phase2a.sql
-- Chukta Phase 2A: days off, overtime, bonus/deduction, extra-pay settings (spec §4).

-- 1. New columns.
alter table chukta.properties
  add column offday_multiplier numeric(3,2) not null default 1 check (offday_multiplier between 1 and 3),
  add column ot_mode text not null default 'multiplier' check (ot_mode in ('multiplier','fixed')),
  add column ot_multiplier numeric(3,2) not null default 1 check (ot_multiplier between 1 and 3),
  add column ot_rate_paise bigint check (ot_rate_paise > 0),
  add constraint properties_ot_fixed_needs_rate check (ot_mode <> 'fixed' or ot_rate_paise is not null);

alter table chukta.workers
  add column offday_multiplier numeric(3,2) check (offday_multiplier between 1 and 3),
  add column ot_mode text check (ot_mode in ('multiplier','fixed')),
  add column ot_multiplier numeric(3,2) check (ot_multiplier between 1 and 3),
  add column ot_rate_paise bigint check (ot_rate_paise > 0);

alter table chukta.attendance_entries
  add column custom_amount_paise bigint check (custom_amount_paise >= 0);

-- 2. New tables.
create table chukta.days_off (
  id                uuid primary key,
  property_id       uuid not null references chukta.properties(id) on delete cascade,
  date              date not null,
  name              text not null check (length(trim(name)) > 0),
  kind              text not null check (kind in ('holiday','closure')),
  portion           text not null default 'full' check (portion in ('full','half')),
  pay_rule          text not null default 'by_basis' check (pay_rule in ('by_basis','all_paid','all_unpaid')),
  is_active         boolean not null default true,
  created_by        uuid not null default auth.uid(),
  created_by_role   text not null check (created_by_role in ('owner','staff')),
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp()
);
create index idx_chukta_days_off_property_date on chukta.days_off(property_id, date);

create table chukta.overtime_entries (
  id                  uuid primary key,
  property_id         uuid not null references chukta.properties(id) on delete cascade,
  worker_id           uuid not null references chukta.workers(id) on delete cascade,
  date                date not null,
  hours               numeric(4,2) not null check (hours >= 0 and hours <= 16),
  custom_amount_paise bigint check (custom_amount_paise >= 0),
  note                text,
  created_by          uuid not null default auth.uid(),
  created_by_role     text not null check (created_by_role in ('owner','staff')),
  created_at          timestamptz not null default now(),
  server_updated_at   timestamptz not null default clock_timestamp()
);
create index idx_chukta_overtime_worker_date on chukta.overtime_entries(worker_id, date);

create table chukta.earning_adjustments (
  id                uuid primary key,
  property_id       uuid not null references chukta.properties(id) on delete cascade,
  worker_id         uuid not null references chukta.workers(id) on delete cascade,
  type              text not null check (type in ('bonus','deduction')),
  amount_paise      bigint not null check (amount_paise > 0),
  date              date not null,
  note              text,
  voids_id          uuid references chukta.earning_adjustments(id),
  created_by        uuid not null default auth.uid(),
  created_by_role   text not null check (created_by_role in ('owner','staff')),
  created_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default clock_timestamp(),
  check (type <> 'deduction' or voids_id is not null or length(trim(coalesce(note, ''))) > 0)
);
create index idx_chukta_adjustments_worker on chukta.earning_adjustments(worker_id);

-- 3. Triggers: sync cursor stamp, and worker/void consistency (now also for adjustments).
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
  if tg_table_name in ('advance_entries', 'wage_payments', 'earning_adjustments') then
    if new.voids_id is not null then
      execute format('select property_id, worker_id, voids_id from chukta.%I where id = $1', tg_table_name)
        into v_prop, v_worker, v_void using new.voids_id;
      if v_prop is distinct from new.property_id or v_worker is distinct from new.worker_id or v_void is not null then
        raise exception 'invalid void target %', new.voids_id using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['days_off','overtime_entries','earning_adjustments'] loop
    execute format('create trigger trg_touch before insert or update on chukta.%I for each row execute function chukta.touch_server_updated_at()', t);
  end loop;
  foreach t in array array['overtime_entries','earning_adjustments'] loop
    execute format('create trigger trg_consistency before insert or update on chukta.%I for each row execute function chukta.check_entry_consistency()', t);
  end loop;
end $$;

-- Pay settings on workers are owner-only (the Phase 1 member_insert and member_update policies also cover staff).
create or replace function chukta.guard_worker_pay_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if chukta.jwt_role() = 'staff' and (
         new.offday_multiplier is not null or new.ot_mode is not null
      or new.ot_multiplier is not null or new.ot_rate_paise is not null) then
      raise exception 'only the owner can set pay settings' using errcode = '42501';
    end if;
    return new;
  end if;
  if chukta.jwt_role() = 'staff' and (
       new.offday_multiplier is distinct from old.offday_multiplier
    or new.ot_mode is distinct from old.ot_mode
    or new.ot_multiplier is distinct from old.ot_multiplier
    or new.ot_rate_paise is distinct from old.ot_rate_paise) then
    raise exception 'only the owner can change pay settings' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_guard_pay_settings before insert or update on chukta.workers
  for each row execute function chukta.guard_worker_pay_settings();

-- 4. Grants.
grant select, insert on chukta.days_off, chukta.overtime_entries, chukta.earning_adjustments to authenticated;
grant update (name, kind, portion, pay_rule, is_active) on chukta.days_off to authenticated;
grant update (offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise) on chukta.properties to authenticated;
grant update (offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise) on chukta.workers to authenticated;
grant all on chukta.days_off, chukta.overtime_entries, chukta.earning_adjustments to service_role;

-- 5. RLS.
alter table chukta.days_off enable row level security;
alter table chukta.overtime_entries enable row level security;
alter table chukta.earning_adjustments enable row level security;

create policy member_select on chukta.days_off for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.days_off for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.days_off for insert to authenticated
  with check (chukta.is_staff_of(property_id) and kind = 'closure' and pay_rule = 'by_basis' and chukta.is_own_write(created_by, created_by_role));
create policy owner_update on chukta.days_off for update to authenticated
  using (chukta.is_owner_of(property_id)) with check (chukta.is_owner_of(property_id));

create policy member_select on chukta.overtime_entries for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.overtime_entries for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.overtime_entries for insert to authenticated
  with check (chukta.is_staff_of(property_id) and custom_amount_paise is null and chukta.is_own_write(created_by, created_by_role));

create policy member_select on chukta.earning_adjustments for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.earning_adjustments for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));

-- Attendance: staff may no longer write a custom day-off amount.
drop policy member_insert on chukta.attendance_entries;
create policy owner_insert on chukta.attendance_entries for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.attendance_entries for insert to authenticated
  with check (chukta.is_staff_of(property_id) and custom_amount_paise is null and chukta.is_own_write(created_by, created_by_role));

-- 6. Pull-sync cursor indexes.
create index if not exists idx_chukta_days_off_sync on chukta.days_off(server_updated_at, id);
create index if not exists idx_chukta_overtime_sync on chukta.overtime_entries(server_updated_at, id);
create index if not exists idx_chukta_adjustments_sync on chukta.earning_adjustments(server_updated_at, id);
