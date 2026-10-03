-- Chukta Phase 2D: pay cycles, settlements, period lock (spec docs/superpowers/specs/2026-10-03-chukta-phase2d-settlement-payslips-design.md §4).

-- 1. Pay-cycle settings (owner-only; workers are guarded by the trigger below).
alter table chukta.properties
  add column pay_cycle text not null default 'by_basis' check (pay_cycle in ('by_basis','weekly','monthly')),
  add column cycle_end_weekday smallint not null default 6 check (cycle_end_weekday between 0 and 6);
alter table chukta.workers
  add column pay_cycle text check (pay_cycle in ('by_basis','weekly','monthly')),
  add column cycle_end_weekday smallint check (cycle_end_weekday between 0 and 6);
grant update (pay_cycle, cycle_end_weekday) on chukta.properties to authenticated;
grant update (pay_cycle, cycle_end_weekday) on chukta.workers to authenticated;

create or replace function chukta.guard_worker_pay_settings() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if chukta.jwt_role() = 'staff' and (
         new.offday_multiplier is not null or new.ot_mode is not null
      or new.ot_multiplier is not null or new.ot_rate_paise is not null
      or new.pay_cycle is not null or new.cycle_end_weekday is not null) then
      raise exception 'only the owner can set pay settings' using errcode = '42501';
    end if;
    return new;
  end if;
  if chukta.jwt_role() = 'staff' and (
       new.offday_multiplier is distinct from old.offday_multiplier
    or new.ot_mode is distinct from old.ot_mode
    or new.ot_multiplier is distinct from old.ot_multiplier
    or new.ot_rate_paise is distinct from old.ot_rate_paise
    or new.pay_cycle is distinct from old.pay_cycle
    or new.cycle_end_weekday is distinct from old.cycle_end_weekday) then
    raise exception 'only the owner can change pay settings' using errcode = '42501';
  end if;
  return new;
end $$;

-- 2. Settlements: frozen per-period snapshots. Unlock = void row.
create table chukta.settlements (
  id                       uuid primary key,
  property_id              uuid not null references chukta.properties(id) on delete cascade,
  worker_id                uuid not null references chukta.workers(id) on delete cascade,
  period_start             date not null,
  period_end               date not null,
  settled_on               date not null,
  pay_basis                text not null check (pay_basis in ('hourly','daily','weekly','monthly')),
  rate_paise               bigint not null check (rate_paise >= 0),
  opening_balance_paise    bigint not null,
  base_paise               bigint not null,
  offday_extra_paise       bigint not null,
  overtime_paise           bigint not null,
  bonus_paise              bigint not null,
  deduction_paise          bigint not null,
  earned_paise             bigint not null,
  paid_in_period_paise     bigint not null,
  paid_now_paise           bigint not null check (paid_now_paise >= 0),
  advance_recovered_paise  bigint not null check (advance_recovered_paise >= 0),
  advance_after_paise      bigint not null,
  closing_balance_paise    bigint not null,
  summary                  jsonb not null default '{}'::jsonb,
  note                     text,
  voids_id                 uuid references chukta.settlements(id),
  created_by               uuid not null default auth.uid(),
  created_by_role          text not null check (created_by_role in ('owner','staff')),
  created_at               timestamptz not null default now(),
  server_updated_at        timestamptz not null default clock_timestamp(),
  check (period_end >= period_start)
);
create index idx_chukta_settlements_worker on chukta.settlements(worker_id, period_start);
create index if not exists idx_chukta_settlements_sync on chukta.settlements(server_updated_at, id);

-- 3. Links from money rows (set only by the settle action).
alter table chukta.wage_payments add column settlement_id uuid references chukta.settlements(id);
alter table chukta.advance_entries add column settlement_id uuid references chukta.settlements(id),
  add constraint advance_settlement_repayment check (settlement_id is null or type = 'repayment');

-- 4. Consistency: settlements join the void tables.
create or replace function chukta.check_entry_consistency() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_prop   uuid;
  v_worker uuid;
  v_void   uuid;
  v_same_date boolean;
begin
  select w.property_id into v_prop from chukta.workers w where w.id = new.worker_id;
  if v_prop is distinct from new.property_id then
    raise exception 'worker % does not belong to property %', new.worker_id, new.property_id using errcode = '23514';
  end if;
  if tg_table_name in ('advance_entries', 'wage_payments', 'earning_adjustments', 'settlements') then
    if new.voids_id is not null then
      if tg_table_name = 'settlements' then
        -- A settlement void copies its period; check_settlement_order enforces that.
        execute format('select property_id, worker_id, voids_id from chukta.%I where id = $1', tg_table_name)
          into v_prop, v_worker, v_void using new.voids_id;
        v_same_date := true;
      else
        -- A void must carry its target's date, otherwise it could slip past the period lock.
        execute format('select property_id, worker_id, voids_id, date = $2 from chukta.%I where id = $1', tg_table_name)
          into v_prop, v_worker, v_void, v_same_date using new.voids_id, (to_jsonb(new) ->> 'date')::date;
      end if;
      if v_prop is distinct from new.property_id or v_worker is distinct from new.worker_id or v_void is not null
         or v_same_date is distinct from true then
        raise exception 'invalid void target %', new.voids_id using errcode = '23514';
      end if;
    end if;
  end if;
  return new;
end $$;

create trigger trg_touch before insert or update on chukta.settlements
  for each row execute function chukta.touch_server_updated_at();
create trigger trg_consistency before insert or update on chukta.settlements
  for each row execute function chukta.check_entry_consistency();

-- 5. The active settlement covering a worker's date (null if none). Active = not a void and not voided.
create or replace function chukta.settled_period_id(p_worker uuid, p_date date) returns uuid
language sql stable set search_path = '' as $$
  select s.id from chukta.settlements s
  where s.worker_id = p_worker and s.voids_id is null
    and p_date between s.period_start and s.period_end
    and not exists (select 1 from chukta.settlements v where v.voids_id = s.id)
  limit 1
$$;
grant execute on function chukta.settled_period_id(uuid, date) to authenticated;

-- 6. Order: settlements are contiguous and in order; only the latest active one can be unlocked.
create or replace function chukta.check_settlement_order() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_last date;
  v_join date;
begin
  -- Replayed push (upsert ignoreDuplicates): the row already exists, so ON CONFLICT will ignore it. Do not judge it against later state.
  if exists (select 1 from chukta.settlements where id = new.id) then
    return new;
  end if;
  -- Serialise settles/unlocks per worker so two concurrent inserts cannot both pass the contiguity check.
  perform pg_advisory_xact_lock(hashtextextended('chukta.settlement:' || new.worker_id::text, 0));
  if new.voids_id is not null then
    if not exists (select 1 from chukta.settlements t where t.id = new.voids_id
                   and t.period_start = new.period_start and t.period_end = new.period_end) then
      raise exception 'a void must copy its settlement period' using errcode = '23514';
    end if;
    if exists (select 1 from chukta.settlements v where v.voids_id = new.voids_id) then
      raise exception 'settlement already unlocked' using errcode = '23514';
    end if;
    if exists (select 1 from chukta.settlements s
               where s.worker_id = new.worker_id and s.voids_id is null and s.period_start > new.period_start
                 and not exists (select 1 from chukta.settlements v where v.voids_id = s.id)) then
      raise exception 'unlock newer settlements first' using errcode = '23514';
    end if;
    return new;
  end if;
  select max(s.period_end) into v_last from chukta.settlements s
  where s.worker_id = new.worker_id and s.voids_id is null
    and not exists (select 1 from chukta.settlements v where v.voids_id = s.id);
  if v_last is null then
    select w.joining_date into v_join from chukta.workers w where w.id = new.worker_id;
    if new.period_start is distinct from v_join then
      raise exception 'first settlement must start on the joining date' using errcode = '23514';
    end if;
  elsif new.period_start <> v_last + 1 then
    raise exception 'settlement must start the day after the last one' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_settlement_order before insert on chukta.settlements
  for each row execute function chukta.check_settlement_order();

-- 7. Lock: nothing new dated inside an active settlement (spec §4.4).
create or replace function chukta.check_not_settled() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_id   uuid;
  v_link uuid;
  v_exists boolean;
begin
  -- Replayed push (upsert ignoreDuplicates): the row already exists, so ON CONFLICT will ignore it. Do not judge it against later state.
  execute format('select exists(select 1 from chukta.%I where id = $1)', tg_table_name) into v_exists using new.id;
  if v_exists then
    return new;
  end if;
  if tg_table_name = 'days_off' then
    -- Shared lock per worker: waits for an in-flight settle, and blocks a settle until this insert commits.
    -- Locks are taken in id order so concurrent inserts cannot deadlock on each other.
    perform pg_advisory_xact_lock_shared(hashtextextended('chukta.settlement:' || x.id::text, 0))
      from (select w.id from chukta.workers w where w.property_id = new.property_id order by w.id) x;
    if exists (select 1 from chukta.workers w
               where w.property_id = new.property_id and chukta.settled_period_id(w.id, new.date) is not null) then
      raise exception 'period is settled' using errcode = '23514';
    end if;
    return new;
  end if;
  -- Shared lock: waits for an in-flight settle of this worker, and blocks a settle until this insert commits.
  perform pg_advisory_xact_lock_shared(hashtextextended('chukta.settlement:' || new.worker_id::text, 0));
  v_id := chukta.settled_period_id(new.worker_id, new.date);
  if v_id is null then
    return new;
  end if;
  if tg_table_name in ('wage_payments', 'advance_entries') then
    v_link := (to_jsonb(new) ->> 'settlement_id')::uuid;
    if v_link = v_id and (to_jsonb(new) ->> 'voids_id') is null then
      return new;
    end if;
  end if;
  raise exception 'period is settled' using errcode = '23514';
end $$;

do $$
declare t text;
begin
  foreach t in array array['attendance_entries','overtime_entries','earning_adjustments','advance_entries','wage_payments','days_off'] loop
    execute format('create trigger trg_not_settled before insert on chukta.%I for each row execute function chukta.check_not_settled()', t);
  end loop;
end $$;

create or replace function chukta.guard_settled_day_off_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (new.is_active is distinct from old.is_active or new.portion is distinct from old.portion
      or new.pay_rule is distinct from old.pay_rule)
     and exists (select 1 from chukta.workers w
                 where w.property_id = new.property_id and chukta.settled_period_id(w.id, new.date) is not null) then
    raise exception 'period is settled' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_day_off_settled before update on chukta.days_off
  for each row execute function chukta.guard_settled_day_off_update();

-- 8. Only the owner may link a money row to a settlement.
create or replace function chukta.guard_settlement_link() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_exists boolean;
begin
  -- Replayed push (upsert ignoreDuplicates): the row already exists, so ON CONFLICT will ignore it. Do not judge it against later state.
  execute format('select exists(select 1 from chukta.%I where id = $1)', tg_table_name) into v_exists using new.id;
  if v_exists then
    return new;
  end if;
  if new.settlement_id is not null and chukta.jwt_role() = 'staff' then
    raise exception 'only the owner can settle' using errcode = '42501';
  end if;
  -- The link must point at an active settlement of the same worker and property.
  if new.settlement_id is not null and not exists (
       select 1 from chukta.settlements s
       where s.id = new.settlement_id and s.worker_id = new.worker_id and s.property_id = new.property_id
         and s.voids_id is null
         and not exists (select 1 from chukta.settlements v where v.voids_id = s.id)) then
    raise exception 'invalid settlement link' using errcode = '23514';
  end if;
  return new;
end $$;
create trigger trg_settlement_link before insert on chukta.wage_payments
  for each row execute function chukta.guard_settlement_link();
create trigger trg_settlement_link before insert on chukta.advance_entries
  for each row execute function chukta.guard_settlement_link();

-- 9. RLS for settlements: members read, owner inserts; no update, no delete.
grant select, insert on chukta.settlements to authenticated;
grant all on chukta.settlements to service_role;
alter table chukta.settlements enable row level security;
create policy member_select on chukta.settlements for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.settlements for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
