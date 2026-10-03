# Chukta Phase 2D — Settlement & Payslips — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every worker regular pay periods. The owner settles a finished period: records what is paid now and how much advance is recovered, locks the period, and gets a payslip that can be shared as an image. Whatever is left carries forward.

**Architecture:**
- A new synced table `settlements` holds frozen per-period snapshots on top of the existing running ledger.
- `calculateWorkerLedger` gains an optional date window. That lets the same maths produce one period's figures and its opening balance.
- Settling writes the settlement row first, then the linked payment and repayment rows.
- A server trigger and a matching phone check refuse any new dated entry inside an active settlement. Unlocking means voiding the settlement row.

**Tech Stack:**
- Supabase Postgres 17 + pgTAP.
- Expo SDK 54 / React Native 0.81 / TypeScript; `expo-sqlite`, `@react-navigation` v7, `i18next`.
- New: `react-native-view-shot` and `expo-sharing`.
- Jest (`jest-expo` 54) with the `better-sqlite3` test adapter and `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-03-chukta-phase2d-settlement-payslips-design.md`. Earlier specs: Phase 2A `docs/superpowers/specs/2026-10-03-chukta-phase2a-calendar-extra-pay-design.md`, Phase 1 `docs/superpowers/specs/2026-09-29-chukta-phase1-design.md`.

## Global Constraints

- **Supabase**
  - Project ref: `mhtqufyaxpunhenqropn`.
  - New migration file: `supabase/migrations/20261005100000_chukta_phase2d.sql`.
  - `supabase test db` needs Docker, which this machine doesn't have. Run pgTAP on the live database with the wrapper method from the 2A memory note: rewrite each TAP `select` as `insert into _tap(l) select …`, keep `begin;`, and replace `rollback;` with a DO block that raises the collected output. Then run `supabase db query --linked -f <file>`.
  - `supabase db push` runs only with the user's explicit go-ahead (Task 13).
- **No hard deletes**, and no UPDATE or DELETE grants on `settlements`. Unlocking means inserting a void row (`voids_id`). Money rows linked to a settlement are never deleted.
- **Money**
  - Integer paise everywhere.
  - A period's figures come from `calculateWorkerLedger`, never from separate maths.
  - `closing_balance = opening + earned − paid_in_period − advance_recovered − paid_now`.
- **Phase 1 and 2A results must not change.** With no settlements, every existing ledger number stays the same: the all-time ledger, called with no `window`, behaves exactly as before. The one deliberate change: a repayment that has a `settlement_id` also counts as a wage payment (spec §5.3).
- **Permissions**
  - Only the owner settles, unlocks, sets the pay cycle, or writes a non-null `settlement_id`.
  - Staff can read settlements and share payslips.
  - Server error codes: permission denied is `42501`. A rule rejection (a settled period, an overlapping or out-of-order settlement) is `23514`, message `period is settled` for the lock.
- **Strings**
  - Every new string goes in `en.json`, `bn.json` and `hi.json`, and the parity test must pass.
  - Bengali text uses Bengali digits. No hardcoded English in screens.
- **Test output must be clean**: no act() warnings, no console noise.

## File Map

| File | Change |
|---|---|
| `supabase/migrations/20261005100000_chukta_phase2d.sql` | new: pay-cycle columns, `settlements`, `settlement_id` links, triggers, RLS |
| `supabase/tests/database/chukta_phase2d.test.sql` | new pgTAP |
| `mobile-chukta/src/domain/types.ts` | `PayCycle`, `Settlement`, `SettlementSummary`, new settings fields, `settlement_id` |
| `mobile-chukta/src/domain/settings.ts` | resolve `payCycle` and `cycleEndWeekday` |
| `mobile-chukta/src/domain/cycles.ts` | new: period maths |
| `mobile-chukta/src/domain/ledger.ts` | optional `window`; settlement repayments count as paid |
| `mobile-chukta/src/domain/settlement.ts` | new: draft figures, attendance summary, closing balance |
| `mobile-chukta/src/domain/lock.ts` | new: active settlements, `isSettled` |
| `mobile-chukta/src/db/schema.ts` | schema v4 |
| `mobile-chukta/src/repos/write.ts` | `insertManyAndEnqueue`; updatable columns |
| `mobile-chukta/src/repos/settlements.ts` | new: settle, unlock, list, due |
| `mobile-chukta/src/repos/{attendance,overtime,money,daysOff,workers,properties}.ts` | lock checks; pay-cycle columns |
| `mobile-chukta/src/i18n/{en,bn,hi}.json` | strings |
| `mobile-chukta/src/view/{forms,today,monthGrid,dueList,payslip}.ts` | view models |
| `mobile-chukta/src/screens/{SettleScreen,PayslipScreen}.tsx` | new screens |
| `mobile-chukta/src/screens/{Workers,WorkerDetail,Today,PropertyForm,WorkerForm,MoneyEntry,HolidayForm}Screen.tsx`, `src/ui/MonthCalendar.tsx` | wiring |
| `docs/superpowers/notes/2026-10-05-chukta-phase2d-deploy.md` | new deploy note |

---

### Task 1: Database migration and pgTAP

**Files:**
- Create: `supabase/migrations/20261005100000_chukta_phase2d.sql`
- Create: `supabase/tests/database/chukta_phase2d.test.sql`

**Interfaces:**
- Produces:
  - Server tables and columns that Task 6 mirrors locally:
    - `properties.pay_cycle text not null default 'by_basis'`, `properties.cycle_end_weekday smallint not null default 6`
    - `workers.pay_cycle text null`, `workers.cycle_end_weekday smallint null`
    - the `settlements` table (spec §4.2)
    - `wage_payments.settlement_id uuid null`, `advance_entries.settlement_id uuid null`
  - Functions: `chukta.settled_period_id(uuid, date) returns uuid`, `chukta.check_not_settled()`, `chukta.check_settlement_order()`, `chukta.guard_settlement_link()`, `chukta.guard_settled_day_off_update()`, and an updated `chukta.guard_worker_pay_settings()`.

- [ ] **Step 1: Write the migration**

```sql
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
begin
  select w.property_id into v_prop from chukta.workers w where w.id = new.worker_id;
  if v_prop is distinct from new.property_id then
    raise exception 'worker % does not belong to property %', new.worker_id, new.property_id using errcode = '23514';
  end if;
  if tg_table_name in ('advance_entries', 'wage_payments', 'earning_adjustments', 'settlements') then
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
begin
  if tg_table_name = 'days_off' then
    if exists (select 1 from chukta.workers w
               where w.property_id = new.property_id and chukta.settled_period_id(w.id, new.date) is not null) then
      raise exception 'period is settled' using errcode = '23514';
    end if;
    return new;
  end if;
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
begin
  if new.settlement_id is not null and chukta.jwt_role() = 'staff' then
    raise exception 'only the owner can settle' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger trg_settlement_link before insert on chukta.wage_payments
  for each row execute function chukta.guard_settlement_link();
create trigger trg_settlement_link before insert on chukta.advance_entries
  for each row execute function chukta.guard_settlement_link();

-- 9. RLS for settlements: members read, owner inserts; no update, no delete.
grant select, insert on chukta.settlements to authenticated;
alter table chukta.settlements enable row level security;
create policy member_select on chukta.settlements for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.settlements for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
```


- [ ] **Step 2: Write the pgTAP test**

Copy the whole fixture header of `supabase/tests/database/chukta_phase2a.test.sql` from line 1 up to the first assertion. That covers auth users, shops, properties, workers, and the staff user and its `staff_users` row. Then make these replacements:
- Every UUID prefix `e0`/`e1`/`e2`/`e4`/`e5` becomes `f0`/`f1`/`f2`/`f4`/`f5`.
- Phones `+919800000931/932` become `+919800000941/942`.
- The email prefix `p2a-` becomes `p2d-`.
- Drop the `earning_adjustments` fixture row.

That leaves worker WA (daily, joined 2026-09-01) in property PA and worker WB in PB.

Then add these assertions, in this order:

```sql
select plan(24);

-- as postgres: order + overlap
select lives_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by, created_by_role)
  values ('f7000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-01', '2026-09-05', '2026-09-06', 'daily', 50000, 0, 250000, 0, 0, 0, 0, 250000, 0, 250000, 0, 0, 0,
    'f0000000-0000-0000-0000-00000000000a', 'owner') $$, 'first settlement starts on the joining date');
select throws_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-03', '2026-09-12', '2026-09-13', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    'f0000000-0000-0000-0000-00000000000a', 'owner') $$, '23514', null, 'overlapping settlement rejected');
select throws_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-08', '2026-09-12', '2026-09-13', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    'f0000000-0000-0000-0000-00000000000a', 'owner') $$, '23514', null, 'gap after the last settlement rejected');
select is(chukta.settled_period_id('f4000000-0000-0000-0000-00000000000a', '2026-09-03'),
  'f7000000-0000-0000-0000-000000000001'::uuid, 'settled_period_id finds the covering settlement');
select is(chukta.settled_period_id('f4000000-0000-0000-0000-00000000000a', '2026-09-06'), null::uuid, 'no settlement after the period');

-- owner A
-- (set local role authenticated + owner A claims, copied from the 2A test with f-prefixes)
select throws_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-03', 'absent', 'owner') $$,
  '23514', null, 'attendance in a settled period is locked');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-07', 'absent', 'owner') $$,
  'attendance after the period is allowed');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-03', 1, 'owner') $$,
  '23514', null, 'overtime in a settled period is locked');
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', 'bonus', 100, '2026-09-03', 'owner') $$,
  '23514', null, 'bonus in a settled period is locked');
select throws_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', 'advance', 100, '2026-09-03', 'owner') $$,
  '23514', null, 'advance in a settled period is locked');
select throws_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', 100, '2026-09-03', 'owner') $$,
  '23514', null, 'unlinked payment in a settled period is locked');
select lives_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, mode, settlement_id, created_by_role)
  values ('f8000000-0000-0000-0000-000000000001', 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    250000, '2026-09-05', 'cash', 'f7000000-0000-0000-0000-000000000001', 'owner') $$, 'payment linked to its settlement is allowed');
select throws_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, settlement_id, voids_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    250000, '2026-09-05', 'f7000000-0000-0000-0000-000000000001', 'f8000000-0000-0000-0000-000000000001', 'owner') $$,
  '23514', null, 'a void inside a settled period is locked even when linked');
select throws_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, settlement_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    'advance', 100, '2026-09-05', 'f7000000-0000-0000-0000-000000000001', 'owner') $$,
  '23514', null, 'only repayments may link to a settlement');
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, pay_rule, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', '2026-09-04', 'H', 'holiday', 'full', 'by_basis', 'owner') $$,
  '23514', null, 'holiday on a settled date is locked');
select lives_ok($$ update chukta.properties set pay_cycle = 'monthly', cycle_end_weekday = 3 where id = 'f2000000-0000-0000-0000-00000000000a' $$,
  'owner sets the pay cycle');

-- staff of property A
-- (staff claims copied from the 2A test with f-prefixes)
select throws_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-06', '2026-09-12', '2026-09-13', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 'staff') $$,
  '42501', null, 'staff cannot settle');
select throws_ok($$ insert into chukta.wage_payments (id, property_id, worker_id, amount_paise, date, settlement_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    100, '2026-09-08', 'f7000000-0000-0000-0000-000000000001', 'staff') $$, '42501', null, 'staff cannot link a payment to a settlement');
select throws_ok($$ update chukta.workers set pay_cycle = 'monthly' where id = 'f4000000-0000-0000-0000-00000000000a' $$,
  '42501', null, 'staff cannot change the pay cycle');
select is((select count(*)::int from chukta.settlements where worker_id = 'f4000000-0000-0000-0000-00000000000a'), 1, 'staff can read settlements');

-- owner A again: unlock
-- (owner A claims again)
select lives_ok($$ insert into chukta.settlements (id, property_id, worker_id, period_start, period_end, settled_on, pay_basis, rate_paise,
    opening_balance_paise, base_paise, offday_extra_paise, overtime_paise, bonus_paise, deduction_paise, earned_paise,
    paid_in_period_paise, paid_now_paise, advance_recovered_paise, advance_after_paise, closing_balance_paise, voids_id, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a',
    '2026-09-01', '2026-09-05', '2026-09-08', 'daily', 50000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    'f7000000-0000-0000-0000-000000000001', 'owner') $$, 'owner unlocks by voiding');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'f2000000-0000-0000-0000-00000000000a', 'f4000000-0000-0000-0000-00000000000a', '2026-09-03', 'absent', 'owner') $$,
  'unlocked period accepts entries again');
select throws_ok($$ update chukta.settlements set note = 'x' $$, '42501', null, 'nobody updates settlements');
select throws_ok($$ delete from chukta.settlements $$, '42501', null, 'nobody deletes settlements');

select * from finish();
rollback;
```

The setup header copied from the 2A file also contains its own `select plan(33);`. Remove that line, because `select plan(24);` above replaces it. Insert the three claim blocks marked by comments as real `set local role authenticated;` and `select set_config('request.jwt.claims', …, true);` lines, copied from the 2A test with the `f` UUIDs. The first owner block needs `set local role authenticated;` before it.

Count the TAP assertions (`lives_ok`, `throws_ok`, `is`), excluding `plan` and `finish`. There must be exactly 24. If your count differs, set `plan(N)` to the real number.

- [ ] **Step 3: Self-check the SQL locally (there is no live database in this step)**

Run: `grep -c "create trigger" supabase/migrations/20261005100000_chukta_phase2d.sql`
Expected: 6 literal `create trigger` statements. The DO loop adds 6 more at runtime.

Read the migration once against `supabase/migrations/20261004100000_chukta_phase2a.sql` and `20260930100100_chukta_access.sql`. Check that every helper name used exists: `chukta.jwt_role`, `chukta.is_member_of`, `chukta.is_owner_of`, `chukta.is_own_write`, `chukta.touch_server_updated_at`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261005100000_chukta_phase2d.sql supabase/tests/database/chukta_phase2d.test.sql
git commit -m "feat(db): chukta settlements, pay cycles and period lock"
```

---

### Task 2: Domain types and settings

**Files:**
- Modify: `mobile-chukta/src/domain/types.ts`, `mobile-chukta/src/domain/settings.ts`, `mobile-chukta/src/__tests__/helpers/fixtures.ts`, `mobile-chukta/src/repos/properties.ts` (`createProperty` defaults)
- Test: `mobile-chukta/src/__tests__/resolveSettings.test.tsx` (append)

**Interfaces:**
- Produces:

```ts
export type PayCycle = 'by_basis' | 'weekly' | 'monthly';
export type SettlementSummary = {
  present: number; half: number; absent: number; hoursTotal: number;
  daysOffPaid: number; daysOffUnpaid: number; offdayWorked: number; otHours: number;
  explanation: ExplanationLine[];
};
export type Settlement = Audit & {
  id: string; property_id: string; worker_id: string; period_start: string; period_end: string; settled_on: string;
  pay_basis: PayBasis; rate_paise: number; opening_balance_paise: number;
  base_paise: number; offday_extra_paise: number; overtime_paise: number; bonus_paise: number; deduction_paise: number;
  earned_paise: number; paid_in_period_paise: number; paid_now_paise: number; advance_recovered_paise: number;
  advance_after_paise: number; closing_balance_paise: number; summary: SettlementSummary | Record<string, never>;
  note: string | null; voids_id: string | null;
};
```

- `Property` gains `pay_cycle: PayCycle; cycle_end_weekday: number`.
- `Worker` gains `pay_cycle?: PayCycle | null; cycle_end_weekday?: number | null`.
- `AdvanceEntry` and `WagePayment` gain `settlement_id?: string | null`.
- `ResolvedSettings` gains `payCycle: 'weekly' | 'monthly'; cycleEndWeekday: number`. This is the **effective** cycle: `by_basis` is already resolved.

- [ ] **Step 1: Write the failing test**

Append to `resolveSettings.test.tsx`:

```ts
test('pay cycle: monthly-paid is always monthly; by_basis means weekly otherwise; worker overrides property', () => {
  expect(resolveSettings(worker({ pay_basis: 'monthly', pay_cycle: 'weekly' }), property()).payCycle).toBe('monthly');
  expect(resolveSettings(worker({ pay_basis: 'daily' }), property()).payCycle).toBe('weekly');
  expect(resolveSettings(worker({ pay_basis: 'daily' }), property({ pay_cycle: 'monthly' })).payCycle).toBe('monthly');
  expect(resolveSettings(worker({ pay_basis: 'hourly', pay_cycle: 'monthly' }), property({ pay_cycle: 'weekly' })).payCycle).toBe('monthly');
  expect(resolveSettings(worker(), property()).cycleEndWeekday).toBe(6);
  expect(resolveSettings(worker({ cycle_end_weekday: 3 }), property({ cycle_end_weekday: 1 })).cycleEndWeekday).toBe(3);
  expect(resolveSettings(worker(), property({ cycle_end_weekday: 1 })).cycleEndWeekday).toBe(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/resolveSettings.test.tsx`
Expected: FAIL (`payCycle` is undefined).

- [ ] **Step 3: Implement**

- Add the types above to `types.ts`.
- In `settings.ts`, add these to the returned object:

```ts
    payCycle: payBasis === 'monthly' ? 'monthly'
      : (worker.pay_cycle ?? property.pay_cycle ?? 'by_basis') === 'monthly' ? 'monthly' : 'weekly',
    cycleEndWeekday: worker.cycle_end_weekday ?? property.cycle_end_weekday ?? 6,
```

- In `fixtures.ts`, `property()` gains `pay_cycle: 'by_basis', cycle_end_weekday: 6`.
- In `repos/properties.ts`, `createProperty` writes `pay_cycle: 'by_basis', cycle_end_weekday: 6` into the new row, the same way it writes the 2A extra-pay defaults.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS. If tsc complains about other `Property` literals in tests, add the two fields there.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): pay-cycle settings and settlement types"
```

---

### Task 3: Period maths (`cycles.ts`)

**Files:**
- Create: `mobile-chukta/src/domain/cycles.ts`
- Test: `mobile-chukta/src/__tests__/cycles.test.ts`

**Interfaces:**
- Consumes: `ResolvedSettings.payCycle/cycleEndWeekday` (Task 2); `addDays`, `compareDates`, `daysInMonth`, `weekday` from `src/utils/dates.ts`.
- Produces:

```ts
export type Period = { start: string; end: string };
/** The period that starts on `start` for this cycle (end is the month end or the next cycle-end weekday ≥ start). */
export function periodFrom(start: string, s: Pick<ResolvedSettings, 'payCycle' | 'cycleEndWeekday'>): Period;
/** The next period to settle: starts the day after `lastSettledEnd` (or on joining), end cut to leftDate. */
export function nextPeriod(input: { joiningDate: string; leftDate: string | null; lastSettledEnd: string | null;
  settings: Pick<ResolvedSettings, 'payCycle' | 'cycleEndWeekday'> }): Period | null;
/** True when the period can be settled on `today`: it has ended, or the worker has left and today ≥ its end. */
export function isDue(period: Period, today: string): boolean;
```

`nextPeriod` returns null when the worker has left and `lastSettledEnd >= leftDate`. Nothing more is ever due for them.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/cycles.test.ts
import { isDue, nextPeriod, periodFrom } from '../domain/cycles';

const W = { payCycle: 'weekly' as const, cycleEndWeekday: 6 };   // weeks end Saturday
const M = { payCycle: 'monthly' as const, cycleEndWeekday: 6 };

test('periodFrom: weekly ends on the next cycle-end weekday (2026-09-05 is a Saturday)', () => {
  expect(periodFrom('2026-09-01', W)).toEqual({ start: '2026-09-01', end: '2026-09-05' });
  expect(periodFrom('2026-09-05', W)).toEqual({ start: '2026-09-05', end: '2026-09-05' });
  expect(periodFrom('2026-09-06', W)).toEqual({ start: '2026-09-06', end: '2026-09-12' });
  expect(periodFrom('2026-09-03', { payCycle: 'weekly', cycleEndWeekday: 3 })).toEqual({ start: '2026-09-03', end: '2026-09-09' });
});

test('periodFrom: monthly ends on the last day of the start month, crossing a weekly-span month boundary is fine', () => {
  expect(periodFrom('2026-09-01', M)).toEqual({ start: '2026-09-01', end: '2026-09-30' });
  expect(periodFrom('2026-09-15', M)).toEqual({ start: '2026-09-15', end: '2026-09-30' });
  expect(periodFrom('2026-02-01', M)).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  expect(periodFrom('2026-09-27', W)).toEqual({ start: '2026-09-27', end: '2026-10-03' });
});

test('nextPeriod: starts on joining, then the day after the last settlement; cut to the leaving date', () => {
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: null, lastSettledEnd: null, settings: W }))
    .toEqual({ start: '2026-09-02', end: '2026-09-05' });
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: null, lastSettledEnd: '2026-09-05', settings: W }))
    .toEqual({ start: '2026-09-06', end: '2026-09-12' });
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: '2026-09-09', lastSettledEnd: '2026-09-05', settings: W }))
    .toEqual({ start: '2026-09-06', end: '2026-09-09' });
  expect(nextPeriod({ joiningDate: '2026-09-02', leftDate: '2026-09-09', lastSettledEnd: '2026-09-09', settings: W })).toBeNull();
});

test('nextPeriod: a cycle change applies from the next start (weekly → monthly on the 10th)', () => {
  expect(nextPeriod({ joiningDate: '2026-09-01', leftDate: null, lastSettledEnd: '2026-09-09', settings: M }))
    .toEqual({ start: '2026-09-10', end: '2026-09-30' });
});

test('isDue: only after the period ends (or on/after the leaving-date end)', () => {
  const p = { start: '2026-09-06', end: '2026-09-12' };
  expect(isDue(p, '2026-09-12')).toBe(false);
  expect(isDue(p, '2026-09-13')).toBe(true);
  expect(isDue({ start: '2026-09-06', end: '2026-09-09' }, '2026-09-09')).toBe(false);
});
```

`isDue` is simply `today > end`. For a worker who has left, the cut period's `end` is the leaving date. "Due from `left_date` onward" in the spec therefore means due from the day after, which matches the strict check. The last line of the test pins that rule.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/cycles.test.ts`
Expected: FAIL, "Cannot find module '../domain/cycles'".

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/domain/cycles.ts
import { addDays, compareDates, daysInMonth, weekday } from '../utils/dates';
import type { ResolvedSettings } from './types';

export type Period = { start: string; end: string };
type CycleSettings = Pick<ResolvedSettings, 'payCycle' | 'cycleEndWeekday'>;

export function periodFrom(start: string, s: CycleSettings): Period {
  if (s.payCycle === 'monthly') {
    const [y, m] = start.split('-').map(Number);
    return { start, end: `${start.slice(0, 8)}${String(daysInMonth(y, m)).padStart(2, '0')}` };
  }
  const ahead = (s.cycleEndWeekday - weekday(start) + 7) % 7;
  return { start, end: addDays(start, ahead) };
}

export function nextPeriod(input: { joiningDate: string; leftDate: string | null; lastSettledEnd: string | null; settings: CycleSettings }): Period | null {
  const start = input.lastSettledEnd ? addDays(input.lastSettledEnd, 1) : input.joiningDate;
  if (input.leftDate && compareDates(start, input.leftDate) > 0) return null;
  const p = periodFrom(start, input.settings);
  if (input.leftDate && compareDates(p.end, input.leftDate) > 0) return { start, end: input.leftDate };
  return p;
}

export function isDue(period: Period, today: string): boolean {
  return compareDates(today, period.end) > 0;
}
```

- [ ] **Step 4: Run the tests**

Run: `cd mobile-chukta && npx jest src/__tests__/cycles.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/domain/cycles.ts mobile-chukta/src/__tests__/cycles.test.ts
git commit -m "feat(chukta): pay-period maths"
```

---

### Task 4: Ledger date window, and settlement repayments counted as paid

**Files:**
- Modify: `mobile-chukta/src/domain/ledger.ts`
- Test: `mobile-chukta/src/__tests__/ledgerWindow.test.ts` (new)

**Interfaces:**
- Consumes: `AdvanceEntry.settlement_id`, `WagePayment.settlement_id` (Task 2).
- Produces: the `calculateWorkerLedger` input gains `window?: { from: string; to: string }`.
  - **Without `window`:** the behaviour is exactly as before. There is one addition: active repayments with a non-null `settlement_id` are added to `paidPaise`. They still reduce `advanceOutstandingPaise` as before.
  - **With `window`:** the dates run from `max(from, joiningDate)` to `min(to, leftDate ?? to)`, and `today` is ignored. Payments, advances (for `advanceOutstandingPaise`) and adjustments only count when their **target row's** date is ≤ `window.to`. Payments and adjustments must also have that date ≥ `window.from`. Advances use only the `≤ to` bound, because the outstanding advance is cumulative.
    - Voiding still works across the window: filter the rows **after** `activeMoneyRows`, by date.
    - The settlement-repayment rule above also applies inside the window, with the same date bounds as payments.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/ledgerWindow.test.ts
import { calculateWorkerLedger } from '../domain/ledger';
import { resolveSettings } from '../domain/settings';
import type { AdvanceEntry, EarningAdjustment, WagePayment } from '../domain/types';
import { property, worker } from './helpers/fixtures';

const pay = (id: string, date: string, amount: number, over: Partial<WagePayment> = {}): WagePayment => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: amount, date, mode: 'cash', note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});
const adv = (id: string, type: AdvanceEntry['type'], date: string, amount: number, over: Partial<AdvanceEntry> = {}): AdvanceEntry => ({
  id, property_id: 'p1', worker_id: 'w1', type, amount_paise: amount, date, mode: null, note: type === 'writeoff' ? 'x' : null,
  voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});
const bonus = (id: string, date: string, amount: number): EarningAdjustment => ({
  id, property_id: 'p1', worker_id: 'w1', type: 'bonus', amount_paise: amount, date, note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});

// Daily ₹500, joined 2026-09-01, weekly off Sunday (fixture default). 2026-09-06 and -13 are Sundays.
const W = worker();
const base = {
  settings: resolveSettings(W, property()), ratePaise: 50000, joiningDate: '2026-09-01', leftDate: null, today: '2026-09-20',
  attendance: [], daysOff: [], overtime: [],
};

test('no window: unchanged except settlement repayments also count as paid', () => {
  const l = calculateWorkerLedger({ ...base, advances: [adv('a1', 'advance', '2026-09-02', 30000),
    adv('r1', 'repayment', '2026-09-05', 20000, { settlement_id: 's1' }), adv('r2', 'repayment', '2026-09-08', 5000)],
    payments: [pay('p1', '2026-09-05', 100000)], adjustments: [] });
  expect(l.paidPaise).toBe(120000);             // 100000 cash + 20000 settlement repayment; r2 is an ordinary repayment
  expect(l.advanceOutstandingPaise).toBe(5000); // 30000 − 20000 − 5000
});

test('window: one week (Sun 6 – Sat 12) earns 6 days; money and bonuses outside the window are ignored', () => {
  const l = calculateWorkerLedger({ ...base, window: { from: '2026-09-06', to: '2026-09-12' },
    advances: [adv('a1', 'advance', '2026-09-02', 30000), adv('a2', 'advance', '2026-09-15', 1000)],
    payments: [pay('p1', '2026-09-05', 100000), pay('p2', '2026-09-10', 40000), pay('p3', '2026-09-14', 9000)],
    adjustments: [bonus('b1', '2026-09-04', 700), bonus('b2', '2026-09-11', 1100)] });
  expect(l.basePaise).toBe(300000);   // 7–12 Sep = 6 working days × 50000 (Sun 6th unpaid)
  expect(l.bonusPaise).toBe(1100);
  expect(l.paidPaise).toBe(40000);
  expect(l.advanceOutstandingPaise).toBe(30000); // advances dated ≤ to only
});

test('window to the day before a period = the opening balance', () => {
  const l = calculateWorkerLedger({ ...base, window: { from: '2026-09-01', to: '2026-09-05' },
    advances: [], payments: [pay('p1', '2026-09-05', 100000), pay('p2', '2026-09-10', 40000)], adjustments: [] });
  expect(l.earnedPaise).toBe(250000); // 1–5 Sep
  expect(l.wageDuePaise).toBe(150000);
});

test('window: a void dated outside the window still cancels its target inside it', () => {
  const l = calculateWorkerLedger({ ...base, window: { from: '2026-09-06', to: '2026-09-12' }, advances: [], adjustments: [],
    payments: [pay('p2', '2026-09-10', 40000), pay('v2', '2026-09-10', 40000, { voids_id: 'p2', created_at: '2026-09-16T10:00:00Z' })] });
  expect(l.paidPaise).toBe(0);
});

test('window is clipped to joining and leaving dates', () => {
  const l = calculateWorkerLedger({ ...base, joiningDate: '2026-09-09', leftDate: '2026-09-11',
    window: { from: '2026-09-06', to: '2026-09-12' }, advances: [], payments: [], adjustments: [] });
  expect(l.basePaise).toBe(150000); // 9, 10, 11
});

test('monthly: a full calendar-month window equals the month in the all-time ledger', () => {
  const s = resolveSettings(worker({ pay_basis: 'monthly', rate_paise: 3000000 }), property());
  const common = { ...base, settings: s, ratePaise: 3000000, advances: [], payments: [], adjustments: [] };
  const month = calculateWorkerLedger({ ...common, window: { from: '2026-09-01', to: '2026-09-30' } });
  expect(month.basePaise).toBe(3000000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/ledgerWindow.test.ts`
Expected: FAIL. The window is ignored (base 950000 instead of 300000), and paid is 100000 instead of 120000.

- [ ] **Step 3: Implement in `ledger.ts`**

1. Add `window?: { from: string; to: string };` to `Input`.

2. Replace the `end` and `dates` lines at the top of `calculateWorkerLedger` with:

```ts
  const w = input.window;
  const stop = w ? w.to : input.today;
  const end = input.leftDate && compareDates(input.leftDate, stop) < 0 ? input.leftDate : stop;
  const first = w && compareDates(w.from, input.joiningDate) > 0 ? w.from : input.joiningDate;
  const dates = compareDates(first, end) <= 0 ? eachDate(first, end) : [];
  const inWindow = (date: string) => !w || (compareDates(date, w.from) >= 0 && compareDates(date, w.to) <= 0);
  const upToWindowEnd = (date: string) => !w || compareDates(date, w.to) <= 0;
```

3. Monthly partial months. A window that starts mid-month (a first period starting on joining) must use the partial-month rule. The existing `whole = monthDates.length === dim` check already handles that, because `monthDates` only holds dates in the window. Make no change here.

4. Adjustments become:

```ts
  const adjustments = activeMoneyRows(input.adjustments ?? []).filter((a) => inWindow(a.date));
```

5. Paid and advances become:

```ts
  const activePayments = activeMoneyRows(input.payments).filter((p) => inWindow(p.date));
  const activeAdvances = activeMoneyRows(input.advances);
  // A repayment made at settlement is recovered out of wages: it is paid to the worker as well (spec 2D §5.3).
  const settlementRepaid = activeAdvances
    .filter((a) => a.type === 'repayment' && a.settlement_id && inWindow(a.date))
    .reduce((sum, a) => sum + a.amount_paise, 0);
  const paidPaise = activePayments.reduce((sum, p) => sum + p.amount_paise, 0) + settlementRepaid;
  const advanceOutstandingPaise = activeAdvances.filter((a) => upToWindowEnd(a.date)).reduce(
    (sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0);
```

`activeMoneyRows` runs before the date filter. That way a void row dated outside the window still cancels its target inside the window: the void and its target are both dropped by `activeMoneyRows`, whatever the dates.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS. All existing ledger tests stay green, because no existing data has a `settlement_id`.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/domain/ledger.ts mobile-chukta/src/__tests__/ledgerWindow.test.ts
git commit -m "feat(chukta): ledger date window; settlement repayments count as paid"
```

---

### Task 5: Settlement draft and lock (`settlement.ts`, `lock.ts`)

**Files:**
- Create: `mobile-chukta/src/domain/settlement.ts`, `mobile-chukta/src/domain/lock.ts`
- Test: `mobile-chukta/src/__tests__/settlementDraft.test.ts`

**Interfaces:**
- Consumes: `calculateWorkerLedger` with `window` (Task 4); `Period` (Task 3); `classifyDay`, `dayCredit` (dayClass.ts); `effectiveAttendance` (attendance.ts); `effectiveDaysOff`, `latestByDate` (latest.ts).
- Produces:

```ts
// lock.ts
export function activeSettlements(rows: Settlement[]): Settlement[];           // not voids, not voided
export function lastSettledEnd(rows: Settlement[], workerId: string): string | null;
export function isSettled(rows: Settlement[], workerId: string, date: string): boolean;

// settlement.ts
export type LedgerData = { attendance: AttendanceEntry[]; advances: AdvanceEntry[]; payments: WagePayment[];
  daysOff: DayOff[]; overtime: OvertimeEntry[]; adjustments: EarningAdjustment[] };
export type SettlementDraft = {
  period: Period; payBasis: PayBasis; ratePaise: number; openingBalancePaise: number;
  basePaise: number; offdayExtraPaise: number; overtimePaise: number; bonusPaise: number; deductionPaise: number;
  earnedPaise: number; paidInPeriodPaise: number; wageDuePaise: number; advanceOutstandingPaise: number;
  suggestedRecoveryPaise: number; suggestedPaidNowPaise: number; summary: SettlementSummary;
};
export function buildSettlementDraft(input: { worker: Worker; settings: ResolvedSettings; period: Period; data: LedgerData }): SettlementDraft;
export function closingBalance(d: SettlementDraft, paidNowPaise: number, recoveredPaise: number): number;
```

Figures, per spec §5.2–5.3. `ledger(window)` means `calculateWorkerLedger({ settings, ratePaise: worker.rate_paise, joiningDate, leftDate, today: period.end, window, ...data })`.

| Figure | How it's worked out |
|---|---|
| `openingBalancePaise` | `period.start === worker.joining_date ? 0 : ledger({ from: joining, to: addDays(start, −1) }).wageDuePaise` |
| period figures | `p = ledger({ from: start, to: end })`. `basePaise`…`deductionPaise` and `earnedPaise` are copied from `p` |
| `paidInPeriodPaise` | `p.paidPaise` (this already includes settlement repayments in range) |
| `wageDuePaise` | `opening + earned − paidInPeriod` |
| `advanceOutstandingPaise` | `p.advanceOutstandingPaise` |
| `suggestedRecoveryPaise` | `min(advanceOutstanding, max(wageDue, 0))`, and never below 0 |
| `suggestedPaidNowPaise` | `max(wageDue − suggestedRecovery, 0)` |

`summary` is worked out over the period's dates, clipped to joining and leaving:
- `present`, `half`, `absent` count effective attendance statuses on dates **not** classified as a full day off.
- `hoursTotal` sums the hours of `hours` entries.
- `daysOffPaid` and `daysOffUnpaid` count `classifyDay` off days that carry a `dayOff` record (holidays and closures, not plain weekly offs): +1 for a full day and +0.5 for a half day, by `paid`.
- `offdayWorked` sums `dayCredit` on full-off dates that have a non-absent entry.
- `otHours` is the same figure the ledger uses: the explicit entry, or the hours above the shift.
- `explanation` is `p.explanation`.

`closingBalance(d, paidNow, recovered) = d.wageDuePaise − recovered − paidNow`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/settlementDraft.test.ts
import { activeSettlements, isSettled, lastSettledEnd } from '../domain/lock';
import { buildSettlementDraft, closingBalance } from '../domain/settlement';
import { resolveSettings } from '../domain/settings';
import type { AdvanceEntry, Settlement, WagePayment } from '../domain/types';
import { att, property, worker } from './helpers/fixtures';

const W = worker(); // daily ₹500, joined 2026-09-01, weekly off Sunday
const S = resolveSettings(W, property());
const pay = (id: string, date: string, amount: number): WagePayment => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: amount, date, mode: 'cash', note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const advance = (id: string, date: string, amount: number): AdvanceEntry => ({
  id, property_id: 'p1', worker_id: 'w1', type: 'advance', amount_paise: amount, date, mode: 'cash', note: null, voids_id: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const empty = { attendance: [], advances: [], payments: [], daysOff: [], overtime: [], adjustments: [] };

test('first week: opening 0, 5 days earned, full advance recovered by default', () => {
  const d = buildSettlementDraft({ worker: W, settings: S, period: { start: '2026-09-01', end: '2026-09-05' },
    data: { ...empty, attendance: [att('2026-09-03', 'absent')], advances: [advance('a1', '2026-09-02', 30000)] } });
  expect(d.openingBalancePaise).toBe(0);
  expect(d.earnedPaise).toBe(200000);           // 1, 2, 4, 5 Sep
  expect(d.wageDuePaise).toBe(200000);
  expect(d.advanceOutstandingPaise).toBe(30000);
  expect(d.suggestedRecoveryPaise).toBe(30000);
  expect(d.suggestedPaidNowPaise).toBe(170000);
  expect(d.summary).toMatchObject({ present: 4, half: 0, absent: 1 }); // 1, 2, 4, 5 Sep; no entry on a working day = present
  expect(closingBalance(d, 170000, 30000)).toBe(0);
  expect(closingBalance(d, 100000, 30000)).toBe(70000);   // carried forward, owed
});

test('second week carries the first week\'s unpaid remainder as opening balance', () => {
  // Week 1 earned 250000; 100000 was paid on the 5th → opening 150000. Week 2 (6–12) earns 300000; 40000 paid on the 10th.
  const d = buildSettlementDraft({ worker: W, settings: S, period: { start: '2026-09-06', end: '2026-09-12' },
    data: { ...empty, payments: [pay('p1', '2026-09-05', 100000), pay('p2', '2026-09-10', 40000)] } });
  expect(d.openingBalancePaise).toBe(150000);
  expect(d.paidInPeriodPaise).toBe(40000);
  expect(d.wageDuePaise).toBe(410000);   // 150000 + 300000 − 40000
});

test('overpaid opening: paid now suggested 0, recovery capped at 0', () => {
  const d = buildSettlementDraft({ worker: W, settings: S, period: { start: '2026-09-06', end: '2026-09-12' },
    data: { ...empty, payments: [pay('p1', '2026-09-05', 700000)], advances: [advance('a1', '2026-09-02', 30000)] } });
  expect(d.openingBalancePaise).toBe(-450000);
  expect(d.wageDuePaise).toBe(-150000);
  expect(d.suggestedRecoveryPaise).toBe(0);
  expect(d.suggestedPaidNowPaise).toBe(0);
});

test('lock helpers ignore voided settlements and voids', () => {
  const st = (id: string, start: string, end: string, voids: string | null = null): Settlement => ({
    id, property_id: 'p1', worker_id: 'w1', period_start: start, period_end: end, settled_on: end, pay_basis: 'daily', rate_paise: 50000,
    opening_balance_paise: 0, base_paise: 0, offday_extra_paise: 0, overtime_paise: 0, bonus_paise: 0, deduction_paise: 0, earned_paise: 0,
    paid_in_period_paise: 0, paid_now_paise: 0, advance_recovered_paise: 0, advance_after_paise: 0, closing_balance_paise: 0,
    summary: {}, note: null, voids_id: voids, created_by: 'u1', created_by_role: 'owner', created_at: `${end}T10:00:00Z`, server_updated_at: null,
  });
  const rows = [st('s1', '2026-09-01', '2026-09-05'), st('s2', '2026-09-06', '2026-09-12'), st('v2', '2026-09-06', '2026-09-12', 's2')];
  expect(activeSettlements(rows).map((r) => r.id)).toEqual(['s1']);
  expect(lastSettledEnd(rows, 'w1')).toBe('2026-09-05');
  expect(isSettled(rows, 'w1', '2026-09-03')).toBe(true);
  expect(isSettled(rows, 'w1', '2026-09-08')).toBe(false);
  expect(isSettled(rows, 'w2', '2026-09-03')).toBe(false);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/settlementDraft.test.ts`
Expected: FAIL, "Cannot find module '../domain/lock'".

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/domain/lock.ts
import { compareDates } from '../utils/dates';
import type { Settlement } from './types';

export function activeSettlements(rows: Settlement[]): Settlement[] {
  const voided = new Set(rows.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  return rows.filter((r) => !r.voids_id && !voided.has(r.id));
}

export function lastSettledEnd(rows: Settlement[], workerId: string): string | null {
  let last: string | null = null;
  for (const r of activeSettlements(rows)) {
    if (r.worker_id === workerId && (!last || compareDates(r.period_end, last) > 0)) last = r.period_end;
  }
  return last;
}

export function isSettled(rows: Settlement[], workerId: string, date: string): boolean {
  return activeSettlements(rows).some((r) => r.worker_id === workerId
    && compareDates(date, r.period_start) >= 0 && compareDates(date, r.period_end) <= 0);
}
```

```ts
// mobile-chukta/src/domain/settlement.ts
import { addDays, compareDates } from '../utils/dates';
import { effectiveAttendance } from './attendance';
import type { Period } from './cycles';
import { classifyDay, dayCredit } from './dayClass';
import { calculateWorkerLedger } from './ledger';
import { effectiveDaysOff, latestByDate } from './latest';
import type {
  AdvanceEntry, AttendanceEntry, DayOff, EarningAdjustment, OvertimeEntry, PayBasis, ResolvedSettings, SettlementSummary, WagePayment, Worker,
} from './types';

export type LedgerData = { attendance: AttendanceEntry[]; advances: AdvanceEntry[]; payments: WagePayment[];
  daysOff: DayOff[]; overtime: OvertimeEntry[]; adjustments: EarningAdjustment[] };

export type SettlementDraft = {
  period: Period; payBasis: PayBasis; ratePaise: number; openingBalancePaise: number;
  basePaise: number; offdayExtraPaise: number; overtimePaise: number; bonusPaise: number; deductionPaise: number;
  earnedPaise: number; paidInPeriodPaise: number; wageDuePaise: number; advanceOutstandingPaise: number;
  suggestedRecoveryPaise: number; suggestedPaidNowPaise: number; summary: SettlementSummary;
};

const r2 = (x: number) => Math.round(x * 100) / 100;

export function buildSettlementDraft(input: { worker: Worker; settings: ResolvedSettings; period: Period; data: LedgerData }): SettlementDraft {
  const { worker, settings: s, period, data } = input;
  const ledger = (from: string, to: string) => calculateWorkerLedger({
    settings: s, ratePaise: worker.rate_paise, joiningDate: worker.joining_date, leftDate: worker.left_date,
    today: to, window: { from, to }, ...data,
  });
  const opening = period.start === worker.joining_date ? 0 : ledger(worker.joining_date, addDays(period.start, -1)).wageDuePaise;
  const p = ledger(period.start, period.end);
  const wageDue = opening + p.earnedPaise - p.paidPaise;
  const recovery = Math.max(0, Math.min(p.advanceOutstandingPaise, Math.max(wageDue, 0)));
  return {
    period, payBasis: s.payBasis, ratePaise: worker.rate_paise, openingBalancePaise: opening,
    basePaise: p.basePaise, offdayExtraPaise: p.offdayExtraPaise, overtimePaise: p.overtimePaise,
    bonusPaise: p.bonusPaise, deductionPaise: p.deductionPaise, earnedPaise: p.earnedPaise,
    paidInPeriodPaise: p.paidPaise, wageDuePaise: wageDue, advanceOutstandingPaise: p.advanceOutstandingPaise,
    suggestedRecoveryPaise: recovery, suggestedPaidNowPaise: Math.max(wageDue - recovery, 0),
    summary: { ...summarise(worker, s, period, data), explanation: p.explanation },
  };
}

function summarise(worker: Worker, s: ResolvedSettings, period: Period, data: LedgerData): Omit<SettlementSummary, 'explanation'> {
  const shift = s.shiftHours > 0 ? s.shiftHours : 8;
  const byDate = effectiveAttendance(data.attendance);
  const offByDate = effectiveDaysOff(data.daysOff);
  const otByDate = latestByDate(data.overtime);
  const out = { present: 0, half: 0, absent: 0, hoursTotal: 0, daysOffPaid: 0, daysOffUnpaid: 0, offdayWorked: 0, otHours: 0 };
  const from = compareDates(period.start, worker.joining_date) > 0 ? period.start : worker.joining_date;
  const to = worker.left_date && compareDates(worker.left_date, period.end) < 0 ? worker.left_date : period.end;
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) {
    const cls = classifyDay(d, s, offByDate.get(d));
    const entry = byDate.get(d);
    const fullOff = cls.kind === 'off' && cls.portion === 'full';
    if (cls.kind === 'off' && cls.dayOff) {
      const size = cls.portion === 'half' ? 0.5 : 1;
      if (cls.paid) out.daysOffPaid += size; else out.daysOffUnpaid += size;
    }
    if (fullOff) {
      if (entry && entry.status !== 'absent') out.offdayWorked += dayCredit(entry, shift);
    } else if (entry?.status === 'absent') out.absent += 1;
    else if (entry?.status === 'half_day') out.half += 1;
    else if (entry?.status === 'hours') out.hoursTotal += entry.hours ?? 0;
    else out.present += 1;
    const explicit = otByDate.get(d);
    const auto = entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0;
    out.otHours += explicit ? explicit.hours : auto;
  }
  return { ...out, hoursTotal: r2(out.hoursTotal), offdayWorked: r2(out.offdayWorked), otHours: r2(out.otHours) };
}

export function closingBalance(d: SettlementDraft, paidNowPaise: number, recoveredPaise: number): number {
  return d.wageDuePaise - recoveredPaise - paidNowPaise;
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/domain/settlement.ts mobile-chukta/src/domain/lock.ts mobile-chukta/src/__tests__/settlementDraft.test.ts
git commit -m "feat(chukta): settlement draft figures and period lock helpers"
```

---
### Task 6: Local schema v4, sync, multi-row writes

**Files:**
- Modify: `mobile-chukta/src/db/schema.ts`, `mobile-chukta/src/repos/write.ts`
- Test: `mobile-chukta/src/__tests__/schema.test.ts` (update + append), `mobile-chukta/src/__tests__/pull.test.ts` (append)

**Interfaces:**
- Consumes: the server columns from Task 1 and the `Settlement` type from Task 2.
- Produces:
  - `SYNCED_TABLES`, in this order: `'properties','staff_users','workers','days_off','attendance_entries','overtime_entries','settlements','advance_entries','wage_payments','earning_adjustments'`.
  - `TABLE_COLUMNS.settlements` lists every column in spec §4.2.
  - `properties` and `workers` gain `pay_cycle` and `cycle_end_weekday`.
  - `wage_payments` and `advance_entries` gain `settlement_id`.
  - `UPDATABLE_COLUMNS.properties` and `.workers` gain `'pay_cycle', 'cycle_end_weekday'`.
  - `upsertLocal` stores any plain-object or array value as JSON text, so the pulled `summary` jsonb fits in SQLite.
  - New in `write.ts`: `insertManyAndEnqueue(ctx: RepoContext, items: { table: SyncedTable; row: Record<string, unknown> }[]): Promise<void>`. It inserts and enqueues every item, in the given order, inside **one** transaction.
  - Local `user_version` becomes 4. The v4 migration clears the pull cursors of `properties`, `workers`, `wage_payments` and `advance_entries`.

- [ ] **Step 1: Write the failing tests**

In `schema.test.ts`, change every `toBe(3)` user_version assertion to `toBe(4)`. Then extend the v2→v3 upgrade test, or add a new v3→v4 test, using the same pattern:
1. Build a v3 database by running the real `migrate()` on a fresh db.
2. Set `pragma user_version = 3` and drop the v4 objects. Simpler alternative: use a fresh db, run SCHEMA_V1, V2 and V3 by calling `migrate` with a test-only cap if one exists. Otherwise copy the v3 DDL the test already builds.
3. Insert a property, a worker and a wage payment.
4. Add cursor rows for `properties`, `workers`, `wage_payments`, `advance_entries` and `earning_adjustments`.
5. Call `migrate()`.

```ts
// expectations of the v3 → v4 upgrade test
expect((await db.getFirstAsync<{ user_version: number }>('pragma user_version'))?.user_version).toBe(4);
expect(await db.getFirstAsync('select pay_cycle, cycle_end_weekday from properties')).toEqual({ pay_cycle: 'by_basis', cycle_end_weekday: 6 });
expect(await db.getFirstAsync('select pay_cycle, cycle_end_weekday from workers')).toEqual({ pay_cycle: null, cycle_end_weekday: null });
expect(await db.getFirstAsync('select settlement_id from wage_payments')).toEqual({ settlement_id: null });
expect(await db.getFirstAsync("select name from sqlite_master where type = 'table' and name = 'settlements'")).toEqual({ name: 'settlements' });
expect((await db.getAllAsync<{ table_name: string }>('select table_name from sync_cursor order by table_name')).map((r) => r.table_name))
  .toEqual(['earning_adjustments']);
```

Append to `pull.test.ts`:

```ts
test('pull stores a settlement with its jsonb summary as text', async () => {
  const db = openTestDb();
  await migrate(db);
  const row = { id: 's1', property_id: 'p', worker_id: 'w', period_start: '2026-09-01', period_end: '2026-09-05', settled_on: '2026-09-06',
    pay_basis: 'daily', rate_paise: 50000, opening_balance_paise: 0, base_paise: 250000, offday_extra_paise: 0, overtime_paise: 0,
    bonus_paise: 0, deduction_paise: 0, earned_paise: 250000, paid_in_period_paise: 0, paid_now_paise: 250000, advance_recovered_paise: 0,
    advance_after_paise: 0, closing_balance_paise: 0, summary: { present: 5, explanation: [] }, note: null, voids_id: null,
    created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: '2026-09-06T00:00:00Z' };
  await pullAll(db, fakeRemote({ settlements: [row] }));
  const got = await db.getFirstAsync<{ summary: string }>('select summary from settlements');
  expect(JSON.parse(got!.summary)).toEqual({ present: 5, explanation: [] });
});
```

Add a write test in `schema.test.ts`, or in `repos.test.ts` if that's where the `insertAndEnqueue` tests live:

```ts
test('insertManyAndEnqueue writes and queues every row in order, atomically', async () => {
  const c = await ctx(); // the file's existing RepoContext helper
  await insertManyAndEnqueue(c, [
    { table: 'settlements', row: { /* minimal settlement row with id 's1' and summary {} */ } },
    { table: 'wage_payments', row: { id: 'p1', property_id: 'p1', worker_id: 'w1', amount_paise: 100, date: '2026-09-05', mode: 'cash',
      note: null, voids_id: null, settlement_id: 's1', created_by: 'u1', created_by_role: 'owner', created_at: 't', server_updated_at: null } },
  ]);
  expect((await c.db.getAllAsync<{ table_name: string }>('select table_name from sync_queue order by seq')).map((r) => r.table_name))
    .toEqual(['settlements', 'wage_payments']);
  await expect(insertManyAndEnqueue(c, [
    { table: 'wage_payments', row: { id: 'p2', property_id: 'p1', worker_id: 'w1', amount_paise: 100, date: '2026-09-05', mode: 'cash',
      note: null, voids_id: null, settlement_id: null, created_by: 'u1', created_by_role: 'owner', created_at: 't', server_updated_at: null } },
    { table: 'wage_payments', row: { id: null } as unknown as Record<string, unknown> }, // fails: id not null
  ])).rejects.toThrow();
  expect(await c.db.getFirstAsync("select id from wage_payments where id = 'p2'")).toBeNull();
});
```

Write the minimal settlement row in full. Copy the field list from the pull test above, with `summary: {}`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/schema.test.ts src/__tests__/pull.test.ts`
Expected: FAIL, because `user_version` is 3 and there is no `settlements` table.

- [ ] **Step 3: Implement**

In `schema.ts`, set `SYNCED_TABLES` to the order above. Then make these `TABLE_COLUMNS` changes:
- `properties`: insert `'pay_cycle', 'cycle_end_weekday',` before `'created_at'`.
- `workers`: insert `'pay_cycle', 'cycle_end_weekday',` before `...ENTRY_AUDIT`.
- `advance_entries` and `wage_payments`: insert `'settlement_id',` before `...ENTRY_AUDIT`.
- Add:

```ts
  settlements: ['id', 'property_id', 'worker_id', 'period_start', 'period_end', 'settled_on', 'pay_basis', 'rate_paise',
    'opening_balance_paise', 'base_paise', 'offday_extra_paise', 'overtime_paise', 'bonus_paise', 'deduction_paise', 'earned_paise',
    'paid_in_period_paise', 'paid_now_paise', 'advance_recovered_paise', 'advance_after_paise', 'closing_balance_paise',
    'summary', 'note', 'voids_id', ...ENTRY_AUDIT],
```

```ts
// Phase 2D: pay cycles, settlements, money rows linked to a settlement (spec §4.6).
const SCHEMA_V4 = `
alter table properties add column pay_cycle text not null default 'by_basis';
alter table properties add column cycle_end_weekday integer not null default 6;
alter table workers add column pay_cycle text;
alter table workers add column cycle_end_weekday integer;
alter table wage_payments add column settlement_id text;
alter table advance_entries add column settlement_id text;
create table if not exists settlements (
  id text primary key, property_id text not null, worker_id text not null, period_start text not null, period_end text not null,
  settled_on text not null, pay_basis text not null, rate_paise integer not null, opening_balance_paise integer not null,
  base_paise integer not null, offday_extra_paise integer not null, overtime_paise integer not null, bonus_paise integer not null,
  deduction_paise integer not null, earned_paise integer not null, paid_in_period_paise integer not null, paid_now_paise integer not null,
  advance_recovered_paise integer not null, advance_after_paise integer not null, closing_balance_paise integer not null,
  summary text not null default '{}', note text, voids_id text,
  created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
);
create index if not exists idx_settlements_worker on settlements(worker_id, period_start);
create index if not exists idx_settlements_property on settlements(property_id);
`;
```

In `migrate()`, after the v3 block:

```ts
  if (version < 4) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V4);
      // Rows pulled by an older build lack the new columns; re-pull the tables that gained them, once.
      await db.execAsync("delete from sync_cursor where table_name in ('properties', 'workers', 'wage_payments', 'advance_entries')");
      await db.execAsync('pragma user_version = 4');
    });
  }
```

In `write.ts`:

```ts
const toParam = (v: unknown): SqlParam =>
  v === undefined ? null
    : typeof v === 'boolean' ? (v ? 1 : 0)
      : v !== null && typeof v === 'object' ? JSON.stringify(v)
        : (v as SqlParam);
```

Add `'pay_cycle', 'cycle_end_weekday'` to `UPDATABLE_COLUMNS.properties` and `.workers`.

Refactor `insertAndEnqueue` so its body runs a shared inner helper `insertOne(ctx, table, row)` without opening a transaction. Then:

```ts
export async function insertAndEnqueue(ctx: RepoContext, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  await ctx.db.withTransactionAsync(() => insertOne(ctx, table, row));
}

/** Several inserts as one unit: all rows land and are queued in this order, or none do. */
export async function insertManyAndEnqueue(ctx: RepoContext, items: { table: SyncedTable; row: Record<string, unknown> }[]): Promise<void> {
  await ctx.db.withTransactionAsync(async () => {
    for (const it of items) await insertOne(ctx, it.table, it.row);
  });
}
```

The enqueued payload sends `summary` as an object. The JSON stringify happens only in `upsertLocal`'s `toParam`, so the server receives jsonb.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/db/schema.ts mobile-chukta/src/repos/write.ts mobile-chukta/src/__tests__
git commit -m "feat(chukta): local schema v4 with settlements; atomic multi-row writes"
```

---

### Task 7: Settlement repository and the lock in every repo

**Files:**
- Create: `mobile-chukta/src/repos/settlements.ts`, `mobile-chukta/src/repos/lockGuard.ts`
- Modify: `mobile-chukta/src/repos/{attendance,overtime,money,daysOff,workers}.ts`
- Test: `mobile-chukta/src/__tests__/settlementsRepo.test.ts` (new)

**Interfaces:**
- Consumes:
  - `nextPeriod`, `isDue` (Task 3);
  - `buildSettlementDraft`, `closingBalance`, `LedgerData`, `SettlementDraft` (Task 5);
  - `activeSettlements`, `lastSettledEnd`, `isSettled` (Task 5);
  - `insertManyAndEnqueue` (Task 6);
  - `listAttendance`, `listAdvances`, `listPayments`, `listAdjustments`, `listOvertime`, `listDaysOff`.
- Produces:

```ts
// lockGuard.ts
export class SettledError extends Error { constructor() { super('period is settled'); } }
export async function assertWorkerDateOpen(db: SqlDb, workerId: string, date: string): Promise<void>;
export async function assertPropertyDateOpen(db: SqlDb, propertyId: string, date: string): Promise<void>;

// settlements.ts
export function parseSettlement(row: Record<string, unknown>): Settlement;                  // summary JSON text → object
export async function listSettlements(db: SqlDb, workerId: string): Promise<Settlement[]>;  // all rows incl. voids, newest period first
export async function listPropertySettlements(db: SqlDb, propertyId: string): Promise<Settlement[]>;
export async function loadLedgerData(db: SqlDb, worker: Worker, property: Property, upTo: string): Promise<LedgerData>;
export type DueSettlement = { period: Period; draft: SettlementDraft };
export async function getDueSettlement(db: SqlDb, worker: Worker, property: Property, today: string): Promise<DueSettlement | null>;
export async function settleWorker(ctx: RepoContext, input: {
  worker: Worker; property: Property; today: string; paidNowPaise: number; recoveredPaise: number;
  mode: PaymentMode | null; note?: string;
}): Promise<Settlement>;
export async function unlockSettlement(ctx: RepoContext, settlementId: string, today: string): Promise<Settlement>;
```

Rules:
- `settleWorker` **recomputes** the due draft itself with `getDueSettlement`. It never trusts figures passed in from the screen.
- It throws:
  - `'only the owner can settle'` for a non-owner;
  - `'nothing is due'` when `getDueSettlement` returns null;
  - for invalid amounts: `paidNow` must be an integer ≥ 0; `recovered` must be an integer, ≥ 0 and ≤ `draft.advanceOutstandingPaise`; `mode` is required when `paidNow > 0`.
- It writes with `insertManyAndEnqueue`, in this order:
  1. the settlement row: `settled_on: today`, snapshot figures from the draft, `paid_now_paise`, `advance_recovered_paise`, `advance_after_paise = draft.advanceOutstandingPaise − recovered`, `closing_balance_paise = closingBalance(draft, paidNow, recovered)`, `summary: draft.summary`, `note`;
  2. if `paidNow > 0`: a `wage_payments` row with `date: period.end`, `mode`, `settlement_id`, `note: null`;
  3. if `recovered > 0`: an `advance_entries` repayment with `date: period.end`, `mode: null`, `settlement_id`.
- `unlockSettlement`:
  - owner only;
  - the target must exist, not be a void, and not already be voided;
  - it must be the worker's **latest** active settlement (`period_end === lastSettledEnd`);
  - it inserts a void row that copies `property_id`, `worker_id`, `period_start`, `period_end`, `pay_basis` and `rate_paise`. All paise are 0, `summary` is `{}`, `settled_on: today`, `voids_id: target.id`.
- The lock in the existing repos:
  - `markAttendance`, `addOvertime`, `addAdjustment`, `addAdvance` and `addPayment` call `assertWorkerDateOpen(ctx.db, workerId, date)` first.
  - `voidRow` calls it with the **target's** date. The void row must also set `settlement_id: null` explicitly, so it never copies the link.
  - `addDayOff` calls `assertPropertyDateOpen`.
  - `updateDayOff` calls it with the day off's date when the patch touches `is_active`, `portion` or `pay_rule`.
- `createWorker` and `updateWorker` treat `pay_cycle` and `cycle_end_weekday` exactly like the 2A extra-pay keys: a non-owner may not set them, and on update may not even include them in the patch. `NewWorker` gains `payCycle?: PayCycle; cycleEndWeekday?: number`, and `WorkerPatch` gains the two snake_case columns. `PropertySettingsPatch` gains `pay_cycle` and `cycle_end_weekday`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/settlementsRepo.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { RepoContext } from '../repos/context';
import { markAttendance } from '../repos/attendance';
import { addDayOff } from '../repos/daysOff';
import { addAdvance, addPayment, listPayments, voidPayment } from '../repos/money';
import { getDueSettlement, listSettlements, settleWorker, unlockSettlement } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { property, worker } from './helpers/fixtures';

async function ctx(role: RepoContext['role'] = 'owner'): Promise<RepoContext> {
  const db = openTestDb();
  await migrate(db);
  await upsertLocal(db, 'properties', property());
  await upsertLocal(db, 'workers', worker()); // w1: daily ₹500 from 2026-09-01, weekly off Sunday, weeks end Saturday
  let i = 0;
  return { db, userId: 'u1', role, now: () => new Date('2026-09-14T10:00:00Z'), newId: () => `id-${++i}` };
}
const P = property();
const W = worker();
const queue = (c: RepoContext) => c.db.getAllAsync<{ table_name: string }>('select table_name from sync_queue order by seq');

test('the due period is the first week (1–5 Sep) with its draft', async () => {
  const c = await ctx();
  const due = await getDueSettlement(c.db, W, P, '2026-09-14');
  expect(due?.period).toEqual({ start: '2026-09-01', end: '2026-09-05' });
  expect(due?.draft.earnedPaise).toBe(250000);
});

test('settle writes settlement, payment and repayment in order, linked; the next week becomes due', async () => {
  const c = await ctx();
  await addAdvance(c, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-02', mode: 'cash' });
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 200000, recoveredPaise: 30000, mode: 'cash' });
  expect(s).toMatchObject({ period_start: '2026-09-01', period_end: '2026-09-05', paid_now_paise: 200000, advance_recovered_paise: 30000,
    advance_after_paise: 0, closing_balance_paise: 20000, earned_paise: 250000 });
  expect((await queue(c)).map((q) => q.table_name)).toEqual(['advance_entries', 'settlements', 'wage_payments', 'advance_entries']);
  const payments = await listPayments(c.db, 'w1');
  expect(payments).toEqual([expect.objectContaining({ amount_paise: 200000, date: '2026-09-05', settlement_id: s.id })]);
  expect((await getDueSettlement(c.db, W, P, '2026-09-14'))?.period).toEqual({ start: '2026-09-06', end: '2026-09-12' });
  expect((await getDueSettlement(c.db, W, P, '2026-09-14'))?.draft.openingBalancePaise).toBe(20000);
});

test('zero parts write no money rows; staff cannot settle; bad amounts are refused', async () => {
  const staff = await ctx('staff');
  await expect(settleWorker(staff, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null }))
    .rejects.toThrow('only the owner can settle');
  const c = await ctx();
  await expect(settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 100, recoveredPaise: 0, mode: null }))
    .rejects.toThrow();
  await expect(settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 1, mode: null }))
    .rejects.toThrow();
  await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  expect((await queue(c)).map((q) => q.table_name)).toEqual(['settlements']);
});

test('nothing is due before the week ends', async () => {
  const c = await ctx();
  expect(await getDueSettlement(c.db, W, P, '2026-09-05')).toBeNull();
  await expect(settleWorker(c, { worker: W, property: P, today: '2026-09-05', paidNowPaise: 0, recoveredPaise: 0, mode: null }))
    .rejects.toThrow('nothing is due');
});

test('a settled period is locked in every repo; unlocking frees it', async () => {
  const c = await ctx();
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  await expect(markAttendance(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', status: 'absent' })).rejects.toThrow('period is settled');
  await expect(addPayment(c, { propertyId: 'p1', workerId: 'w1', amountPaise: 100, date: '2026-09-04', mode: 'cash' })).rejects.toThrow('period is settled');
  await expect(addDayOff(c, { propertyId: 'p1', date: '2026-09-04', name: 'H', kind: 'holiday', portion: 'full', payRule: 'by_basis' }))
    .rejects.toThrow('period is settled');
  const [linked] = await listPayments(c.db, 'w1');
  await expect(voidPayment(c, linked.id)).rejects.toThrow('period is settled');
  await markAttendance(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-07', status: 'absent' }); // after the period: fine
  await unlockSettlement(c, s.id, '2026-09-14');
  await markAttendance(c, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', status: 'absent' });
  const rows = await listSettlements(c.db, 'w1');
  expect(rows).toHaveLength(2);
  expect(rows.filter((r) => r.voids_id === s.id)).toHaveLength(1);
});

test('only the latest settlement can be unlocked; staff cannot unlock', async () => {
  const c = await ctx();
  const first = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  await expect(unlockSettlement(c, first.id, '2026-09-14')).rejects.toThrow();
  const staff = { ...c, role: 'staff' as const };
  await expect(unlockSettlement(staff, first.id, '2026-09-14')).rejects.toThrow();
});

test('re-settling after unlock counts the earlier linked payment as paid in the period', async () => {
  const c = await ctx();
  const s = await settleWorker(c, { worker: W, property: P, today: '2026-09-14', paidNowPaise: 100000, recoveredPaise: 0, mode: 'cash' });
  await unlockSettlement(c, s.id, '2026-09-14');
  const due = await getDueSettlement(c.db, W, P, '2026-09-14');
  expect(due?.draft.paidInPeriodPaise).toBe(100000);
  expect(due?.draft.wageDuePaise).toBe(150000);
});
```

`listSettlements` orders by `period_start desc, created_at desc, id desc`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/settlementsRepo.test.ts`
Expected: FAIL, "Cannot find module '../repos/settlements'".

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/repos/lockGuard.ts
import type { SqlDb } from '../db/sqlDb';

export class SettledError extends Error {
  constructor() { super('period is settled'); }
}

const ACTIVE_COVERING = `
  select s.id from settlements s
  where s.voids_id is null and ? between s.period_start and s.period_end
    and not exists (select 1 from settlements v where v.voids_id = s.id)`;

export async function assertWorkerDateOpen(db: SqlDb, workerId: string, date: string): Promise<void> {
  const hit = await db.getFirstAsync(`${ACTIVE_COVERING} and s.worker_id = ? limit 1`, [date, workerId]);
  if (hit) throw new SettledError();
}

export async function assertPropertyDateOpen(db: SqlDb, propertyId: string, date: string): Promise<void> {
  const hit = await db.getFirstAsync(`${ACTIVE_COVERING} and s.property_id = ? limit 1`, [date, propertyId]);
  if (hit) throw new SettledError();
}
```

```ts
// mobile-chukta/src/repos/settlements.ts
import type { SqlDb } from '../db/sqlDb';
import { isDue, nextPeriod, type Period } from '../domain/cycles';
import { activeSettlements, lastSettledEnd } from '../domain/lock';
import { buildSettlementDraft, closingBalance, type LedgerData, type SettlementDraft } from '../domain/settlement';
import { resolveSettings } from '../domain/settings';
import type { PaymentMode, Property, Settlement, Worker } from '../domain/types';
import { listAttendance } from './attendance';
import type { RepoContext } from './context';
import { listDaysOff } from './daysOff';
import { listAdjustments, listAdvances, listPayments } from './money';
import { listOvertime } from './overtime';
import { insertManyAndEnqueue } from './write';

export type DueSettlement = { period: Period; draft: SettlementDraft };

export function parseSettlement(row: Record<string, unknown>): Settlement {
  const raw = row.summary;
  return { ...(row as unknown as Settlement), summary: typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw as Settlement['summary']) ?? {} };
}

export async function listSettlements(db: SqlDb, workerId: string): Promise<Settlement[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>(
    'select * from settlements where worker_id = ? order by period_start desc, created_at desc, id desc', [workerId]);
  return rows.map(parseSettlement);
}

export async function listPropertySettlements(db: SqlDb, propertyId: string): Promise<Settlement[]> {
  const rows = await db.getAllAsync<Record<string, unknown>>('select * from settlements where property_id = ?', [propertyId]);
  return rows.map(parseSettlement);
}

export async function loadLedgerData(db: SqlDb, worker: Worker, property: Property, upTo: string): Promise<LedgerData> {
  const [attendance, advances, payments, daysOff, overtime, adjustments] = await Promise.all([
    listAttendance(db, worker.id, worker.joining_date, upTo), listAdvances(db, worker.id), listPayments(db, worker.id),
    listDaysOff(db, property.id), listOvertime(db, worker.id), listAdjustments(db, worker.id),
  ]);
  return { attendance, advances, payments, daysOff, overtime, adjustments };
}

export async function getDueSettlement(db: SqlDb, worker: Worker, property: Property, today: string): Promise<DueSettlement | null> {
  const settings = resolveSettings(worker, property);
  const period = nextPeriod({ joiningDate: worker.joining_date, leftDate: worker.left_date,
    lastSettledEnd: lastSettledEnd(await listSettlements(db, worker.id), worker.id), settings });
  if (!period || !isDue(period, today)) return null;
  const draft = buildSettlementDraft({ worker, settings, period, data: await loadLedgerData(db, worker, property, period.end) });
  return { period, draft };
}

function audit(ctx: RepoContext) {
  return { created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null };
}

const whole = (n: number) => Number.isInteger(n) && n >= 0;

export async function settleWorker(ctx: RepoContext, input: {
  worker: Worker; property: Property; today: string; paidNowPaise: number; recoveredPaise: number; mode: PaymentMode | null; note?: string;
}): Promise<Settlement> {
  if (ctx.role !== 'owner') throw new Error('only the owner can settle');
  const due = await getDueSettlement(ctx.db, input.worker, input.property, input.today);
  if (!due) throw new Error('nothing is due');
  const { draft, period } = due;
  if (!whole(input.paidNowPaise)) throw new Error('paid now must be whole paise ≥ 0');
  if (!whole(input.recoveredPaise) || input.recoveredPaise > draft.advanceOutstandingPaise) {
    throw new Error('recovery must be between 0 and the advance outstanding');
  }
  if (input.paidNowPaise > 0 && !input.mode) throw new Error('a payment mode is required');
  const id = ctx.newId();
  const settlement: Settlement = {
    id, property_id: input.worker.property_id, worker_id: input.worker.id, period_start: period.start, period_end: period.end,
    settled_on: input.today, pay_basis: draft.payBasis, rate_paise: draft.ratePaise, opening_balance_paise: draft.openingBalancePaise,
    base_paise: draft.basePaise, offday_extra_paise: draft.offdayExtraPaise, overtime_paise: draft.overtimePaise,
    bonus_paise: draft.bonusPaise, deduction_paise: draft.deductionPaise, earned_paise: draft.earnedPaise,
    paid_in_period_paise: draft.paidInPeriodPaise, paid_now_paise: input.paidNowPaise, advance_recovered_paise: input.recoveredPaise,
    advance_after_paise: draft.advanceOutstandingPaise - input.recoveredPaise,
    closing_balance_paise: closingBalance(draft, input.paidNowPaise, input.recoveredPaise),
    summary: draft.summary, note: input.note?.trim() || null, voids_id: null, ...audit(ctx),
  };
  const items: { table: 'settlements' | 'wage_payments' | 'advance_entries'; row: Record<string, unknown> }[] = [
    { table: 'settlements', row: settlement as unknown as Record<string, unknown> },
  ];
  if (input.paidNowPaise > 0) {
    items.push({ table: 'wage_payments', row: { id: ctx.newId(), property_id: settlement.property_id, worker_id: settlement.worker_id,
      amount_paise: input.paidNowPaise, date: period.end, mode: input.mode, note: null, voids_id: null, settlement_id: id, ...audit(ctx) } });
  }
  if (input.recoveredPaise > 0) {
    items.push({ table: 'advance_entries', row: { id: ctx.newId(), property_id: settlement.property_id, worker_id: settlement.worker_id,
      type: 'repayment', amount_paise: input.recoveredPaise, date: period.end, mode: null, note: null, voids_id: null,
      settlement_id: id, ...audit(ctx) } });
  }
  await insertManyAndEnqueue(ctx, items);
  return settlement;
}

export async function unlockSettlement(ctx: RepoContext, settlementId: string, today: string): Promise<Settlement> {
  if (ctx.role !== 'owner') throw new Error('only the owner can unlock');
  const row = await ctx.db.getFirstAsync<Record<string, unknown>>('select * from settlements where id = ?', [settlementId]);
  if (!row) throw new Error('settlement not found');
  const target = parseSettlement(row);
  const all = await listSettlements(ctx.db, target.worker_id);
  if (target.voids_id || !activeSettlements(all).some((s) => s.id === target.id)) throw new Error('settlement is not active');
  if (lastSettledEnd(all, target.worker_id) !== target.period_end) throw new Error('unlock newer settlements first');
  const zero = { opening_balance_paise: 0, base_paise: 0, offday_extra_paise: 0, overtime_paise: 0, bonus_paise: 0, deduction_paise: 0,
    earned_paise: 0, paid_in_period_paise: 0, paid_now_paise: 0, advance_recovered_paise: 0, advance_after_paise: 0, closing_balance_paise: 0 };
  const voidRow: Settlement = {
    ...target, ...zero, id: ctx.newId(), settled_on: today, summary: {}, note: null, voids_id: target.id, ...audit(ctx),
  };
  await insertManyAndEnqueue(ctx, [{ table: 'settlements', row: voidRow as unknown as Record<string, unknown> }]);
  return voidRow;
}
```

Wire the lock into the other repos:
- `attendance.ts` `markAttendance`: first line after validation, `await assertWorkerDateOpen(ctx.db, input.workerId, input.date);`.
- `overtime.ts` `addOvertime`: the same.
- `money.ts`:
  - In `addAdvance`, `addPayment` and `addAdjustment`, call `await assertWorkerDateOpen(ctx.db, input.workerId, input.date);` after the permission check.
  - In `voidRow`, after loading `target`, call `await assertWorkerDateOpen(ctx.db, target.worker_id, target.date);`.
  - Build the void as `{ ...target, id: ctx.newId(), voids_id: target.id, note: null, ...('settlement_id' in target ? { settlement_id: null } : {}), ...audit(ctx) }`.
- `daysOff.ts`:
  - `addDayOff`: `await assertPropertyDateOpen(ctx.db, input.propertyId, input.date);`.
  - `updateDayOff`: if any of `is_active`, `portion` or `pay_rule` is in the patch, load the row with `getDayOff` and call `assertPropertyDateOpen(ctx.db, row.property_id, row.date)`.
- `workers.ts`: extend the 2A owner-only key list (wherever `offday_multiplier` and the other extra-pay keys are listed) with `pay_cycle` and `cycle_end_weekday`. Extend the `createWorker` row with `pay_cycle: input.payCycle ?? null, cycle_end_weekday: input.cycleEndWeekday ?? null`.
- `properties.ts`: `PropertySettingsPatch` gains the two columns.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS. The existing repo tests have no settlements, so the lock never fires for them.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/repos mobile-chukta/src/__tests__/settlementsRepo.test.ts
git commit -m "feat(chukta): settle and unlock; settled periods are locked in every repo"
```

---

### Task 8: Strings (en/bn/hi)

**Files:**
- Modify: `mobile-chukta/src/i18n/en.json`, `bn.json`, `hi.json`
- Test: `mobile-chukta/src/__tests__/i18n.test.ts` (parity; must stay green). Append one format check to `format.test.ts`.

**Interfaces:**
- Produces the keys Tasks 9–12 use, listed below.
- `{{amount}}` parameters are passed already formatted with `formatRupees`.

- [ ] **Step 1: Write the failing test**

Append to `format.test.ts`:

```ts
test('Phase 2D strings exist', () => {
  expect(t('settle.title')).toBe('Settle pay');
  expect(t('payslip.carryOwed', { amount: '₹200' })).toBe('Carried forward: ₹200 still to pay');
  expect(t('settle.locked')).toBe('This period is settled. Unlock it first to change entries.');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/format.test.ts`
Expected: FAIL (missing key).

- [ ] **Step 3: Merge the keys**

Merge these into each language file. Add new objects; add keys inside existing `workers`, `worker`, `today` and `extraPay`-style objects only where they belong. Never remove keys.

**en.json**

```json
{
  "settle": {
    "title": "Settle pay", "button": "Settle {{period}}", "period": "Period", "opening": "Carried in",
    "openingOverpaid": "Carried in: overpaid {{amount}}", "earned": "Earned this period", "paidInPeriod": "Paid during the period",
    "wageDue": "Wage due", "advanceOutstanding": "Advance outstanding", "recover": "Take back from advance (₹)",
    "paidNow": "Pay now (₹)", "mode": "Paid by", "note": "Note (optional)", "previewOwed": "Will carry forward: {{amount}} still to pay",
    "previewOverpaid": "Will carry forward: overpaid {{amount}}", "previewClear": "Settled in full",
    "confirmTitle": "Settle this period?", "confirmBody": "Entries in this period will be locked.", "confirm": "Settle",
    "recoverTooMuch": "Cannot take back more than the advance.", "invalidAmount": "Enter a valid amount.", "modeRequired": "Choose how it was paid.",
    "nothingDue": "Nothing to settle yet.", "locked": "This period is settled. Unlock it first to change entries.",
    "settledChip": "Settled", "dueTitle": "Due for settlement", "dueRow": "{{period}} · {{amount}} due"
  },
  "payslip": {
    "title": "Payslip", "list": "Payslips", "none": "No payslips yet.", "worker": "Worker", "period": "Period",
    "rate": "Rate", "attendance": "Attendance", "present": "Present: {{n}}", "half": "Half days: {{n}}", "absent": "Absent: {{n}}",
    "hours": "Hours: {{n}}", "daysOff": "Days off: {{paid}} paid, {{unpaid}} unpaid", "offdayWorked": "Worked on days off: {{n}}",
    "otHours": "Overtime hours: {{n}}", "earnings": "Earnings", "base": "Basic pay", "offdayExtra": "Day-off work",
    "overtime": "Overtime", "bonus": "Bonus", "deductions": "Deductions", "deduction": "Deduction", "advanceRecovered": "Advance taken back",
    "opening": "Carried in", "paidInPeriod": "Paid during the period", "paidNow": "Paid at settlement",
    "carryOwed": "Carried forward: {{amount}} still to pay", "carryOverpaid": "Carried forward: overpaid {{amount}}",
    "carryClear": "Settled in full", "advanceLeft": "Advance left: {{amount}}", "settledOn": "Settled on {{date}}",
    "share": "Share as image", "unlock": "Unlock", "unlocked": "Unlocked",
    "unlockTitle": "Unlock this period?", "unlockBody": "Entries in this period can be changed again. Settle again to make a new payslip.",
    "unlockNewerFirst": "Unlock the newer payslip first."
  },
  "payCycle": {
    "title": "Pay cycle", "cycle": "Settle pay", "byBasis": "As per pay type", "weekly": "Every week", "monthly": "Every month",
    "weekEnds": "Week ends on", "monthlyAlways": "Monthly-paid workers are always settled by month."
  }
}
```

**bn.json** (same keys)

```json
{
  "settle": {
    "title": "বেতন মেটান", "button": "{{period}} মেটান", "period": "সময়কাল", "opening": "আগের বাকি",
    "openingOverpaid": "আগের: বেশি দেওয়া {{amount}}", "earned": "এই সময়ে আয়", "paidInPeriod": "এই সময়ে দেওয়া হয়েছে",
    "wageDue": "পাওনা বেতন", "advanceOutstanding": "বাকি অগ্রিম", "recover": "অগ্রিম থেকে কাটা (₹)",
    "paidNow": "এখন দিন (₹)", "mode": "কীভাবে দেওয়া", "note": "নোট (ঐচ্ছিক)", "previewOwed": "পরের বার যাবে: {{amount}} বাকি",
    "previewOverpaid": "পরের বার যাবে: বেশি দেওয়া {{amount}}", "previewClear": "পুরো মেটানো হয়েছে",
    "confirmTitle": "এই সময়কাল মেটাবেন?", "confirmBody": "এই সময়ের এন্ট্রি লক হয়ে যাবে।", "confirm": "মেটান",
    "recoverTooMuch": "অগ্রিমের বেশি কাটা যাবে না।", "invalidAmount": "সঠিক টাকার পরিমাণ লিখুন।", "modeRequired": "কীভাবে দেওয়া হল বেছে নিন।",
    "nothingDue": "এখনও মেটানোর কিছু নেই।", "locked": "এই সময়কাল মেটানো হয়ে গেছে। বদলাতে আগে আনলক করুন।",
    "settledChip": "মেটানো", "dueTitle": "মেটানো বাকি", "dueRow": "{{period}} · {{amount}} পাওনা"
  },
  "payslip": {
    "title": "বেতন স্লিপ", "list": "বেতন স্লিপ", "none": "এখনও কোনো বেতন স্লিপ নেই।", "worker": "কর্মী", "period": "সময়কাল",
    "rate": "হার", "attendance": "হাজিরা", "present": "উপস্থিত: {{n}}", "half": "অর্ধেক দিন: {{n}}", "absent": "অনুপস্থিত: {{n}}",
    "hours": "ঘণ্টা: {{n}}", "daysOff": "ছুটি: {{paid}} বেতনসহ, {{unpaid}} বেতন ছাড়া", "offdayWorked": "ছুটির দিনে কাজ: {{n}}",
    "otHours": "ওভারটাইম ঘণ্টা: {{n}}", "earnings": "আয়", "base": "মূল বেতন", "offdayExtra": "ছুটির দিনের কাজ",
    "overtime": "ওভারটাইম", "bonus": "বোনাস", "deductions": "কাটা", "deduction": "কাটা", "advanceRecovered": "অগ্রিম থেকে কাটা",
    "opening": "আগের বাকি", "paidInPeriod": "এই সময়ে দেওয়া", "paidNow": "মেটানোর সময় দেওয়া",
    "carryOwed": "পরের বার যাবে: {{amount}} বাকি", "carryOverpaid": "পরের বার যাবে: বেশি দেওয়া {{amount}}",
    "carryClear": "পুরো মেটানো হয়েছে", "advanceLeft": "বাকি অগ্রিম: {{amount}}", "settledOn": "{{date}} তারিখে মেটানো",
    "share": "ছবি হিসেবে শেয়ার করুন", "unlock": "আনলক", "unlocked": "আনলক করা",
    "unlockTitle": "এই সময়কাল আনলক করবেন?", "unlockBody": "এই সময়ের এন্ট্রি আবার বদলানো যাবে। নতুন স্লিপের জন্য আবার মেটান।",
    "unlockNewerFirst": "আগে নতুন স্লিপটি আনলক করুন।"
  },
  "payCycle": {
    "title": "বেতনের চক্র", "cycle": "বেতন মেটানো", "byBasis": "বেতনের ধরন অনুযায়ী", "weekly": "প্রতি সপ্তাহে", "monthly": "প্রতি মাসে",
    "weekEnds": "সপ্তাহ শেষ হয়", "monthlyAlways": "মাসিক বেতনের কর্মীদের সবসময় মাস ধরে মেটানো হয়।"
  }
}
```

**hi.json** (same keys)

```json
{
  "settle": {
    "title": "वेतन चुकाएँ", "button": "{{period}} चुकाएँ", "period": "अवधि", "opening": "पिछला बकाया",
    "openingOverpaid": "पिछला: ज़्यादा दिया {{amount}}", "earned": "इस अवधि की कमाई", "paidInPeriod": "इस अवधि में दिया गया",
    "wageDue": "बकाया वेतन", "advanceOutstanding": "बकाया एडवांस", "recover": "एडवांस से काटें (₹)",
    "paidNow": "अभी दें (₹)", "mode": "कैसे दिया", "note": "नोट (वैकल्पिक)", "previewOwed": "आगे जाएगा: {{amount}} देना बाकी",
    "previewOverpaid": "आगे जाएगा: ज़्यादा दिया {{amount}}", "previewClear": "पूरा चुकता",
    "confirmTitle": "यह अवधि चुकाएँ?", "confirmBody": "इस अवधि की एंट्री लॉक हो जाएँगी।", "confirm": "चुकाएँ",
    "recoverTooMuch": "एडवांस से ज़्यादा नहीं काट सकते।", "invalidAmount": "सही रकम लिखें।", "modeRequired": "चुनें कि कैसे दिया।",
    "nothingDue": "अभी चुकाने को कुछ नहीं है।", "locked": "यह अवधि चुकता हो चुकी है। बदलने के लिए पहले अनलॉक करें।",
    "settledChip": "चुकता", "dueTitle": "चुकाना बाकी", "dueRow": "{{period}} · {{amount}} बकाया"
  },
  "payslip": {
    "title": "वेतन पर्ची", "list": "वेतन पर्चियाँ", "none": "अभी कोई वेतन पर्ची नहीं।", "worker": "कर्मचारी", "period": "अवधि",
    "rate": "दर", "attendance": "हाज़िरी", "present": "हाज़िर: {{n}}", "half": "आधे दिन: {{n}}", "absent": "ग़ैरहाज़िर: {{n}}",
    "hours": "घंटे: {{n}}", "daysOff": "छुट्टियाँ: {{paid}} वेतन सहित, {{unpaid}} बिना वेतन", "offdayWorked": "छुट्टी के दिन काम: {{n}}",
    "otHours": "ओवरटाइम घंटे: {{n}}", "earnings": "कमाई", "base": "मूल वेतन", "offdayExtra": "छुट्टी के दिन का काम",
    "overtime": "ओवरटाइम", "bonus": "बोनस", "deductions": "कटौती", "deduction": "कटौती", "advanceRecovered": "एडवांस से काटा",
    "opening": "पिछला बकाया", "paidInPeriod": "इस अवधि में दिया", "paidNow": "चुकाते समय दिया",
    "carryOwed": "आगे जाएगा: {{amount}} देना बाकी", "carryOverpaid": "आगे जाएगा: ज़्यादा दिया {{amount}}",
    "carryClear": "पूरा चुकता", "advanceLeft": "बाकी एडवांस: {{amount}}", "settledOn": "{{date}} को चुकाया",
    "share": "तस्वीर के रूप में भेजें", "unlock": "अनलॉक", "unlocked": "अनलॉक किया",
    "unlockTitle": "यह अवधि अनलॉक करें?", "unlockBody": "इस अवधि की एंट्री फिर से बदली जा सकेंगी। नई पर्ची के लिए फिर से चुकाएँ।",
    "unlockNewerFirst": "पहले नई पर्ची अनलॉक करें।"
  },
  "payCycle": {
    "title": "वेतन चक्र", "cycle": "वेतन चुकाना", "byBasis": "वेतन के प्रकार के अनुसार", "weekly": "हर हफ़्ते", "monthly": "हर महीने",
    "weekEnds": "हफ़्ता खत्म होता है", "monthlyAlways": "मासिक वेतन वाले कर्मचारियों को हमेशा महीने से चुकाया जाता है।"
  }
}
```

If any of these top-level objects (`settle`, `payslip`, `payCycle`) already exists, merge into it. Run the parity test.

- [ ] **Step 4: Run the tests**

Run: `cd mobile-chukta && npx jest src/__tests__/format.test.ts src/__tests__/i18n.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/i18n mobile-chukta/src/__tests__/format.test.ts
git commit -m "feat(chukta): strings for settlement, payslips and pay cycle"
```

---

### Task 9: View models and forms

**Files:**
- Create: `mobile-chukta/src/view/dueList.ts`, `mobile-chukta/src/view/payslip.ts`
- Modify: `mobile-chukta/src/view/forms.ts`, `mobile-chukta/src/view/today.ts`, `mobile-chukta/src/view/monthGrid.ts`
- Test: `mobile-chukta/src/__tests__/view2d.test.ts` (new); `forms.test.ts` (update fixtures + append)

**Interfaces:**
- Consumes: `getDueSettlement`, `listPropertySettlements` (Task 7); `isSettled` (Task 5); `Settlement` (Task 2).
- Produces:

```ts
// dueList.ts
export type DueRow = { worker: Worker; period: Period; wageDuePaise: number };
export async function listDueSettlements(db: SqlDb, property: Property, today: string): Promise<DueRow[]>; // oldest period.end first, then name
export function formatPeriod(p: Period): string; // "1–5 Sep" or "28 Sep–4 Oct" (en month abbreviations; numbers only otherwise)

// payslip.ts
export type PayslipLine = { key: string; params?: Record<string, string | number>; amountPaise?: number; negative?: boolean };
export type PayslipView = { header: { period: string; settledOn: string; rateKey: string; ratePaise: number };
  attendance: PayslipLine[]; earnings: PayslipLine[]; deductions: PayslipLine[]; balance: PayslipLine[]; carry: PayslipLine;
  advanceLeft: PayslipLine; voided: boolean };
export function buildPayslipView(s: Settlement, voided: boolean): PayslipView;
```

- `TodayRow` gains `settled: boolean`. `buildTodayRows` gains a 7th parameter, `settlements: Settlement[] = []`, and sets `settled = isSettled(settlements, worker.id, date)`.
- `DayCell` gains `settled: boolean`. The `buildMonthGrid` input gains `settlements?: Settlement[]`, and `settled` is computed for the worker's own id. `buildMonthGrid` therefore also needs `workerId`, added as an optional input field.
- Forms:
  - `PropertyFormValues` gains `payCycle: PayCycle; cycleEndWeekday: number`, and its validated value gains `pay_cycle` and `cycle_end_weekday`.
  - `WorkerFormValues` gains `payCycle: PayCycle | null; cycleEndWeekday: number | null`, and so does the result.
  - `toNewWorker` and `toWorkerPatch` include the two only when `isOwner` is true, like the 2A extra-pay keys.

Rules:
- `formatPeriod` uses `Intl`-free formatting, so tests are deterministic. The month abbreviations come from a fixed array `['Jan',…,'Dec']`.
  - Same month: `1–5 Sep`.
  - Different months: `28 Sep–4 Oct`.
  - Different years: `28 Dec 2026–3 Jan 2027`.
- `buildPayslipView`:
  - `attendance` lists `payslip.present`, `half`, `absent`, `hours` (only if `hoursTotal > 0`), `daysOff` (only if either count > 0), `offdayWorked` (only if > 0) and `otHours` (only if > 0). Counts come from `summary`; an empty summary gives an empty list.
  - `earnings` lists `base`, `offdayExtra`, `overtime` and `bonus`, each only when non-zero, except `base`, which is always shown.
  - `deductions` lists `deduction` (if > 0) and `advanceRecovered` (if > 0).
  - `balance` lists `opening`, `paidInPeriod` and `paidNow`.
  - `carry` is `carryOwed` (when the closing balance is > 0, amount = closing), `carryOverpaid` (when < 0, amount = −closing) or `carryClear`.
  - `advanceLeft` is shown always.

- [ ] **Step 1: Write the failing tests**

```ts
// mobile-chukta/src/__tests__/view2d.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { Settlement } from '../domain/types';
import { settleWorker } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { formatPeriod, listDueSettlements } from '../view/dueList';
import { buildPayslipView } from '../view/payslip';
import { buildTodayRows } from '../view/today';
import { property, worker } from './helpers/fixtures';

test('formatPeriod', () => {
  expect(formatPeriod({ start: '2026-09-01', end: '2026-09-05' })).toBe('1–5 Sep');
  expect(formatPeriod({ start: '2026-09-27', end: '2026-10-03' })).toBe('27 Sep–3 Oct');
  expect(formatPeriod({ start: '2026-12-27', end: '2027-01-02' })).toBe('27 Dec 2026–2 Jan 2027');
});

test('due list: one row per worker with an ended, unsettled period, oldest first', async () => {
  const db = openTestDb();
  await migrate(db);
  await upsertLocal(db, 'properties', property());
  await upsertLocal(db, 'workers', worker({ id: 'w1', name: 'Ram', joining_date: '2026-09-06' }));
  await upsertLocal(db, 'workers', worker({ id: 'w2', name: 'Sita', joining_date: '2026-09-01' }));
  await upsertLocal(db, 'workers', worker({ id: 'w3', name: 'New', joining_date: '2026-09-13' }));
  const rows = await listDueSettlements(db, property(), '2026-09-14');
  expect(rows.map((r) => [r.worker.name, r.period.start, r.period.end, r.wageDuePaise])).toEqual([
    ['Sita', '2026-09-01', '2026-09-05', 250000],
    ['Ram', '2026-09-06', '2026-09-12', 300000],
  ]);
  const c = { db, userId: 'u1', role: 'owner' as const, now: () => new Date('2026-09-14T10:00:00Z'), newId: (() => { let i = 0; return () => `id-${++i}`; })() };
  await settleWorker(c, { worker: worker({ id: 'w2', name: 'Sita', joining_date: '2026-09-01' }), property: property(), today: '2026-09-14',
    paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  expect((await listDueSettlements(db, property(), '2026-09-14')).map((r) => [r.worker.name, r.period.start]))
    .toEqual([['Ram', '2026-09-06'], ['Sita', '2026-09-06']]); // same end date → by name
});

const settlement = (over: Partial<Settlement> = {}): Settlement => ({
  id: 's1', property_id: 'p1', worker_id: 'w1', period_start: '2026-09-01', period_end: '2026-09-05', settled_on: '2026-09-06',
  pay_basis: 'daily', rate_paise: 50000, opening_balance_paise: 0, base_paise: 200000, offday_extra_paise: 0, overtime_paise: 12500,
  bonus_paise: 0, deduction_paise: 5000, earned_paise: 207500, paid_in_period_paise: 0, paid_now_paise: 177500, advance_recovered_paise: 30000,
  advance_after_paise: 0, closing_balance_paise: 0, note: null, voids_id: null, created_by: 'u1', created_by_role: 'owner',
  created_at: '2026-09-06T10:00:00Z', server_updated_at: null,
  summary: { present: 4, half: 0, absent: 1, hoursTotal: 0, daysOffPaid: 0, daysOffUnpaid: 0, offdayWorked: 0, otHours: 2, explanation: [] },
  ...over,
});

test('payslip view: only non-zero lines, carry forward wording', () => {
  const v = buildPayslipView(settlement(), false);
  expect(v.header.period).toBe('1–5 Sep');
  expect(v.attendance.map((l) => l.key)).toEqual(['payslip.present', 'payslip.half', 'payslip.absent', 'payslip.otHours']);
  expect(v.earnings.map((l) => [l.key, l.amountPaise])).toEqual([['payslip.base', 200000], ['payslip.overtime', 12500]]);
  expect(v.deductions.map((l) => [l.key, l.amountPaise])).toEqual([['payslip.deduction', 5000], ['payslip.advanceRecovered', 30000]]);
  expect(v.carry.key).toBe('payslip.carryClear');
  expect(buildPayslipView(settlement({ closing_balance_paise: 2000 }), false).carry).toEqual({ key: 'payslip.carryOwed', amountPaise: 2000 });
  expect(buildPayslipView(settlement({ closing_balance_paise: -700 }), false).carry).toEqual({ key: 'payslip.carryOverpaid', amountPaise: 700 });
  expect(buildPayslipView(settlement({ summary: {} }), true).attendance).toEqual([]);
});

test('today rows are flagged settled', () => {
  const rows = buildTodayRows([worker()], property(), [], '2026-09-03', [], [], [settlement()]);
  expect(rows[0].settled).toBe(true);
  expect(buildTodayRows([worker()], property(), [], '2026-09-08', [], [], [settlement()])[0].settled).toBe(false);
});
```

In `forms.test.ts`:
- Add `payCycle: null, cycleEndWeekday: null` to the worker form fixture `W`.
- Add `payCycle: null, cycleEndWeekday: null` (or `pay_cycle: null, cycle_end_weekday: null` where the expectation is snake_case) to the expected worker results.
- Add `pay_cycle: 'by_basis', cycle_end_weekday: 6` to the expected `validatePropertyForm` value.

Append:

```ts
test('pay cycle reaches the patch only for owners', () => {
  const r = validateWorkerForm({ ...W, payCycle: 'monthly', cycleEndWeekday: 3 });
  if (!r.ok) throw new Error('invalid');
  expect(toWorkerPatch(r.value, true)).toMatchObject({ pay_cycle: 'monthly', cycle_end_weekday: 3 });
  const staff = toWorkerPatch(r.value, false);
  expect('pay_cycle' in staff || 'cycle_end_weekday' in staff).toBe(false);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/view2d.test.ts src/__tests__/forms.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/view/dueList.ts
import type { SqlDb } from '../db/sqlDb';
import type { Period } from '../domain/cycles';
import type { Property, Worker } from '../domain/types';
import { getDueSettlement } from '../repos/settlements';
import { listWorkers } from '../repos/workers';
import { compareDates } from '../utils/dates';

export type DueRow = { worker: Worker; period: Period; wageDuePaise: number };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatPeriod(p: Period): string {
  const [ys, ms, ds] = p.start.split('-').map(Number);
  const [ye, me, de] = p.end.split('-').map(Number);
  if (ys !== ye) return `${ds} ${MONTHS[ms - 1]} ${ys}–${de} ${MONTHS[me - 1]} ${ye}`;
  if (ms !== me) return `${ds} ${MONTHS[ms - 1]}–${de} ${MONTHS[me - 1]}`;
  return `${ds}–${de} ${MONTHS[ms - 1]}`;
}

/** Workers (incl. those who left) with an ended, unsettled period — the oldest due period each. */
export async function listDueSettlements(db: SqlDb, property: Property, today: string): Promise<DueRow[]> {
  const workers = await listWorkers(db, property.id, true);
  const rows: DueRow[] = [];
  for (const worker of workers) {
    const due = await getDueSettlement(db, worker, property, today);
    if (due) rows.push({ worker, period: due.period, wageDuePaise: due.draft.wageDuePaise });
  }
  return rows.sort((a, b) => compareDates(a.period.end, b.period.end) || a.worker.name.localeCompare(b.worker.name));
}
```

`listDueSettlements` runs one draft per worker. That's fine for shop-sized teams of under about 50 workers. Leave a one-line comment saying so.

```ts
// mobile-chukta/src/view/payslip.ts
import type { Settlement, SettlementSummary } from '../domain/types';
import { formatPeriod } from './dueList';

export type PayslipLine = { key: string; params?: Record<string, string | number>; amountPaise?: number; negative?: boolean };
export type PayslipView = { header: { period: string; settledOn: string; rateKey: string; ratePaise: number };
  attendance: PayslipLine[]; earnings: PayslipLine[]; deductions: PayslipLine[]; balance: PayslipLine[]; carry: PayslipLine;
  advanceLeft: PayslipLine; voided: boolean };

export function buildPayslipView(s: Settlement, voided: boolean): PayslipView {
  const sum = (s.summary && 'present' in s.summary ? s.summary : null) as SettlementSummary | null;
  const attendance: PayslipLine[] = [];
  if (sum) {
    attendance.push({ key: 'payslip.present', params: { n: sum.present } }, { key: 'payslip.half', params: { n: sum.half } },
      { key: 'payslip.absent', params: { n: sum.absent } });
    if (sum.hoursTotal > 0) attendance.push({ key: 'payslip.hours', params: { n: sum.hoursTotal } });
    if (sum.daysOffPaid > 0 || sum.daysOffUnpaid > 0) {
      attendance.push({ key: 'payslip.daysOff', params: { paid: sum.daysOffPaid, unpaid: sum.daysOffUnpaid } });
    }
    if (sum.offdayWorked > 0) attendance.push({ key: 'payslip.offdayWorked', params: { n: sum.offdayWorked } });
    if (sum.otHours > 0) attendance.push({ key: 'payslip.otHours', params: { n: sum.otHours } });
  }
  const earnings: PayslipLine[] = [{ key: 'payslip.base', amountPaise: s.base_paise }];
  if (s.offday_extra_paise) earnings.push({ key: 'payslip.offdayExtra', amountPaise: s.offday_extra_paise });
  if (s.overtime_paise) earnings.push({ key: 'payslip.overtime', amountPaise: s.overtime_paise });
  if (s.bonus_paise) earnings.push({ key: 'payslip.bonus', amountPaise: s.bonus_paise });
  const deductions: PayslipLine[] = [];
  if (s.deduction_paise) deductions.push({ key: 'payslip.deduction', amountPaise: s.deduction_paise, negative: true });
  if (s.advance_recovered_paise) deductions.push({ key: 'payslip.advanceRecovered', amountPaise: s.advance_recovered_paise, negative: true });
  const carry: PayslipLine = s.closing_balance_paise > 0 ? { key: 'payslip.carryOwed', amountPaise: s.closing_balance_paise }
    : s.closing_balance_paise < 0 ? { key: 'payslip.carryOverpaid', amountPaise: -s.closing_balance_paise }
      : { key: 'payslip.carryClear' };
  return {
    header: { period: formatPeriod({ start: s.period_start, end: s.period_end }), settledOn: s.settled_on,
      rateKey: `payBasis.${s.pay_basis}`, ratePaise: s.rate_paise },
    attendance, earnings, deductions,
    balance: [
      { key: 'payslip.opening', amountPaise: s.opening_balance_paise },
      { key: 'payslip.paidInPeriod', amountPaise: s.paid_in_period_paise },
      { key: 'payslip.paidNow', amountPaise: s.paid_now_paise },
    ],
    carry, advanceLeft: { key: 'payslip.advanceLeft', amountPaise: s.advance_after_paise }, voided,
  };
}
```

Check that `payBasis.<basis>` labels exist in the i18n files, for example from the worker form's pay-type picker (grep `"daily"` in `en.json`). If the label path is different, use that real path for `rateKey` and record the change in the report.

- `today.ts`: add `settlements: Settlement[] = []` as the last parameter of `buildTodayRows`, and `settled: isSettled(settlements, worker.id, date)` in each row.
- `monthGrid.ts`: add `workerId?: string; settlements?: Settlement[]` to the input, and `settled: !!i.workerId && isSettled(i.settlements ?? [], i.workerId, date)` to each cell (false for `outside` and `future`).
- `forms.ts`:
  - Add the pay-cycle fields described in Interfaces.
  - `propertyToFormValues` reads `pay_cycle` and `cycle_end_weekday`, defaulting to `'by_basis'` and `6`.
  - `workerToFormValues` reads them with `?? null`.
  - `hasOverrides` (if it lives in forms.ts; otherwise in WorkerFormScreen) also counts them.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS. If `PropertyFormScreen` or `WorkerFormScreen` fail tsc on initial-value literals, add the new fields there with their defaults.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/view mobile-chukta/src/screens mobile-chukta/src/__tests__
git commit -m "feat(chukta): due list, payslip view, settled flags and pay-cycle form fields"
```

---
### Task 10: Settle screen

**Files:**
- Create: `mobile-chukta/src/screens/SettleScreen.tsx`
- Modify: `src/app/routes.ts`, `src/app/navigation.tsx`, `src/__tests__/helpers/session.tsx` (`ALL_ROUTES`)
- Test: `mobile-chukta/src/__tests__/settle.test.tsx` (new)

**Interfaces:**
- Consumes:
  - `getDueSettlement`, `settleWorker` (Task 7);
  - `closingBalance` (Task 5);
  - `formatPeriod` (Task 9);
  - `rupeesToPaise`, `formatRupees`, `paiseToInput` (existing utils / forms);
  - the UI components in `src/ui/components.tsx` (`Screen`, `ScreenHeader`, `Section`, `Card`, `Row`, `Field`, `Segmented`, `Button`, `ErrorText`, `Muted`, `Loading`, `EmptyState`).
- Produces:
  - route `Settle: { workerId: string }`;
  - testIDs `settle-recover`, `settle-paid`, `settle-mode-<cash|upi|bank>`, `settle-note`, `settle-preview`, `settle-save`.

Behaviour (spec §6):
- **Owner only.** A non-owner sees `EmptyState` with `money.ownerOnly`, which exists from 2D's predecessor, 2A Task 12.
- **Loads** the worker, property and `getDueSettlement(db, worker, property, today)`. With no due period it shows `EmptyState` with `settle.nothingDue`.
- **Header:** `settle.title`, with the subtitle `<worker name> · <formatPeriod>`.
- **Body:**
  - a Card with the explanation lines (via the existing `explanationText`);
  - rows for `settle.opening` (or `settle.openingOverpaid` when negative), `settle.earned`, `settle.paidInPeriod`, `settle.wageDue` and `settle.advanceOutstanding`.
- **Fields:**
  - Recover: shown only when advance outstanding > 0. Pre-filled from `suggestedRecoveryPaise` via `paiseToInput`.
  - Paid now: pre-filled from `suggestedPaidNowPaise`.
  - Mode: Segmented cash/UPI/bank, default cash. Hidden when paid now parses to 0.
  - Note.
- **Preview (`settle-preview`):** `closingBalance(draft, paidNow, recover)`, shown as `settle.previewOwed` / `previewOverpaid` / `previewClear`. When an input is invalid, the preview shows nothing.
- **Validation:**
  - Each amount must parse; an empty field counts as 0. Otherwise show `settle.invalidAmount` under that field.
  - Recover above advance outstanding → `settle.recoverTooMuch`.
  - Paid now > 0 with no mode → `settle.modeRequired`. This can't happen while mode defaults to cash, so it's a defensive check.
- **Save:**
  1. `Alert.alert(settle.confirmTitle, settle.confirmBody, [cancel, { text: settle.confirm, onPress }])`.
  2. Then `settleWorker(...)` under a ref latch and `busy` state.
  3. On success: `session.afterWrite()`, then `navigation.replace('Payslip', { settlementId: s.id })`. `Payslip` is added in Task 11. For this task, if the route isn't registered yet, call `navigation.goBack()` and leave a one-line comment that Task 11 switches it to `replace('Payslip', …)`.
  4. On failure: show `common.saveFailed` and re-enable the button.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/settle.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { addAdvance } from '../repos/money';
import { upsertLocal } from '../repos/write';
import { SettleScreen } from '../screens/SettleScreen';
import { property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

// The session's today is 2026-09-07 (Monday). Worker joined 2026-08-30 (Sunday): week 30 Aug–5 Sep is due.
async function seeded(identity = OWNER) {
  const s = await makeSession(identity);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ joining_date: '2026-08-30' }));
  return s;
}

test('owner sees the due week with defaults and a clear preview', async () => {
  const s = await seeded();
  await addAdvance(s.repo, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-01', mode: 'cash' });
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('Ram · 30 Aug–5 Sep')).toBeTruthy();
  expect(screen.getByTestId('settle-recover').props.value).toBe('300');
  expect(screen.getByTestId('settle-paid').props.value).toBe('2,700');   // 6 days × ₹500 − ₹300
  expect(screen.getByText('Settled in full')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('settle-paid'), '2500');
  expect(screen.getByText('Will carry forward: ₹200 still to pay')).toBeTruthy();
});

test('settling writes the rows after confirming', async () => {
  const s = await seeded();
  const alert = jest.spyOn(Alert, 'alert');
  try {
    renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
    fireEvent.press(await screen.findByTestId('settle-save'));
    const buttons = alert.mock.calls[0][2]!;
    buttons[buttons.length - 1].onPress!();
    await waitFor(async () => expect(await s.db.getAllAsync('select period_start, period_end, paid_now_paise from settlements'))
      .toEqual([{ period_start: '2026-08-30', period_end: '2026-09-05', paid_now_paise: 300000 }]));
    expect(s.afterWrite).toHaveBeenCalled();
  } finally {
    alert.mockRestore();
  }
});

test('recovering more than the advance is refused', async () => {
  const s = await seeded();
  await addAdvance(s.repo, { propertyId: 'p1', workerId: 'w1', type: 'advance', amountPaise: 30000, date: '2026-09-01', mode: 'cash' });
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  fireEvent.changeText(await screen.findByTestId('settle-recover'), '500');
  fireEvent.press(screen.getByTestId('settle-save'));
  expect(await screen.findByText('Cannot take back more than the advance.')).toBeTruthy();
});

test('staff cannot settle', async () => {
  const s = await seeded(STAFF);
  renderScreen('Settle', SettleScreen, s, { workerId: 'w1' });
  expect(await screen.findByText('Only the owner can do this.')).toBeTruthy();
  expect(screen.queryByTestId('settle-save')).toBeNull();
});
```

Check the date arithmetic with the fixture:
- The weekly off is Sunday (`weekly_off: 0`), and weeks end on Saturday.
- 30 Aug is a Sunday (unpaid); 31 Aug to 5 Sep is 6 days × 50000 = 300000.
- With a ₹300 advance, the defaults are recover 30000 and paid now 270000.

If `paiseToInput` formats without the thousands separator, change the `'2,700'` expectation to whatever `paiseToInput(270000)` returns and record that in the report. Do not change the money values.

If `money.ownerOnly` has different text in `en.json`, use that text.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/settle.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

- `routes.ts`: add `Settle: { workerId: string };` to `RootStackParamList`.
- `navigation.tsx`: add `<Stack.Screen name="Settle" component={SettleScreen} />`.
- `ALL_ROUTES`: add `'Settle'`.

Write `SettleScreen.tsx` following the structure of `MoneyEntryScreen.tsx`:
- `useRoute` params;
- `useSession` and `sessionToday`;
- `useLocalData` loading `{ worker, property, due }`, where the worker comes from `getWorker(db, id)` (or whatever the existing worker-detail screen uses) and the property from `useCurrentProperty()`;
- a `values` state;
- an `errors` record;
- a `busy` state plus a `saving` ref latch.

Parse amounts with `parseOptionalAmount` from `forms.ts`. An empty field gives null, which counts as 0; `undefined` means invalid. Use only components that exist in `src/ui/components.tsx`. Every string goes through `t()`.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS, with clean output.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): settle screen"
```

---

### Task 11: Payslip screen, image sharing, unlock

**Files:**
- Create: `mobile-chukta/src/screens/PayslipScreen.tsx`
- Modify:
  - `mobile-chukta/package.json` (dependencies);
  - `mobile-chukta/jest.setup.ts` (mocks);
  - `src/app/routes.ts`, `src/app/navigation.tsx`, `src/__tests__/helpers/session.tsx`;
  - `src/screens/SettleScreen.tsx`: on success, `navigation.replace('Payslip', { settlementId })`.
- Test: `mobile-chukta/src/__tests__/payslip.test.tsx` (new)

**Interfaces:**
- Consumes: `buildPayslipView` (Task 9); `listSettlements`, `parseSettlement`, `unlockSettlement` (Task 7); `activeSettlements`, `lastSettledEnd` (Task 5).
- Produces:
  - route `Payslip: { settlementId: string }`;
  - testIDs `payslip-card` (the captured view), `payslip-share`, `payslip-unlock`.

- [ ] **Step 1: Add the libraries**

Run: `cd mobile-chukta && npx expo install react-native-view-shot expo-sharing`

This picks versions that work with SDK 54. Commit only `package.json` and the lockfile. Never commit `android/` or `ios/`.

In `jest.setup.ts`, add:

```ts
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(async () => 'file:///tmp/payslip.png') }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(async () => true), shareAsync: jest.fn(async () => undefined) }));
```

- [ ] **Step 2: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/payslip.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { initI18n } from '../i18n';
import { settleWorker } from '../repos/settlements';
import { upsertLocal } from '../repos/write';
import { PayslipScreen } from '../screens/PayslipScreen';
import { property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

async function settled(identity = OWNER) {
  const owner = await makeSession(OWNER);
  await upsertLocal(owner.db, 'properties', property());
  await upsertLocal(owner.db, 'workers', worker({ joining_date: '2026-08-30' }));
  const st = await settleWorker(owner.repo, { worker: worker({ joining_date: '2026-08-30' }), property: property(), today: '2026-09-07',
    paidNowPaise: 250000, recoveredPaise: 0, mode: 'cash' });
  if (identity === OWNER) return { s: owner, st };
  const staff = await makeSession(STAFF, { db: owner.db });
  return { s: staff, st };
}

test('payslip shows the frozen figures and shares as an image', async () => {
  const { s, st } = await settled();
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByText('30 Aug–5 Sep')).toBeTruthy();
  expect(screen.getByText('Present: 6')).toBeTruthy();
  expect(screen.getByText('Carried forward: ₹500 still to pay')).toBeTruthy();
  fireEvent.press(screen.getByTestId('payslip-share'));
  await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///tmp/payslip.png', expect.anything()));
  expect(captureRef).toHaveBeenCalled();
});

test('owner unlocks after confirming; the slip then shows Unlocked', async () => {
  const { s, st } = await settled();
  const alert = jest.spyOn(Alert, 'alert');
  try {
    renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
    fireEvent.press(await screen.findByTestId('payslip-unlock'));
    const buttons = alert.mock.calls[0][2]!;
    buttons[buttons.length - 1].onPress!();
    expect(await screen.findByText('Unlocked')).toBeTruthy();
    expect(screen.queryByTestId('payslip-unlock')).toBeNull();
  } finally {
    alert.mockRestore();
  }
});

test('staff can view and share but not unlock', async () => {
  const { s, st } = await settled(STAFF);
  renderScreen('Payslip', PayslipScreen, s, { settlementId: st.id });
  expect(await screen.findByTestId('payslip-share')).toBeTruthy();
  expect(screen.queryByTestId('payslip-unlock')).toBeNull();
});
```

Worked figures: the earnings are ₹3,000 (6 days) and ₹2,500 is paid now, so ₹500 carries forward. `Present: 6` holds because 31 Aug–5 Sep are working days with no entries.

If `makeSession` doesn't accept a `{ db }` override, give it one. The parameter is `over: Partial<Session>`, so `{ db: owner.db }` should already work. That lets the staff session read the same database.

- [ ] **Step 3: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/payslip.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 4: Implement**

- Routes: add `Payslip: { settlementId: string };`, register the screen, and add it to `ALL_ROUTES`.
- `PayslipScreen`:
  - Load the row by id with `parseSettlement`, plus all of the worker's settlements, so you can tell whether it is voided (`!activeSettlements(all).some(x => x.id === row.id)`). Also load the worker (for the name) and the property (for the name).
  - Render a `View` with `ref={cardRef}` and `testID="payslip-card"` and a white background, so the captured picture isn't transparent. Inside it:
    - shop/property name;
    - `payslip.worker` + name;
    - `payslip.period` + `view.header.period`;
    - `payslip.rate` + `t(view.header.rateKey)` + `formatRupees(ratePaise)`;
    - Sections: Attendance, Earnings, Deductions and the balance rows. Each line is `t(line.key, line.params)`, with `formatRupees(amountPaise)` on the right when an amount exists, and a leading "−" when `negative`;
    - the carry line and the advance-left line;
    - `payslip.settledOn` with the date formatted by the existing `formatDate(date, t)`;
    - when voided, a `StatusChip` reading `payslip.unlocked`, tone `danger`.
  - Share button (`payslip-share`): `const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' }); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('payslip.title') });`. Wrap it in try/catch and show an `Alert` with `common.saveFailed` on error. Guard it with a ref latch.
  - Unlock button (`payslip-unlock`):
    - only shown when the user is the owner, the slip isn't voided, and `row.period_end === lastSettledEnd(all, row.worker_id)`;
    - for an owner viewing an older active slip, show `Muted` with `payslip.unlockNewerFirst` instead;
    - on press: `Alert.alert(payslip.unlockTitle, payslip.unlockBody, [cancel, { text: payslip.unlock, style: 'destructive', onPress }])`, then `unlockSettlement(session.repo, id, today)`, then `session.afterWrite()`, then reload.
- `SettleScreen`: on success, `navigation.replace('Payslip', { settlementId: s.id })`. Update the settle test so it also checks that the current route is `Payslip` (the `current-route` test stub).

- [ ] **Step 5: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS, with clean output.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/package.json mobile-chukta/package-lock.json mobile-chukta/jest.setup.ts mobile-chukta/src
git commit -m "feat(chukta): payslip screen with image sharing and unlock"
```

---

### Task 12: Wire settlement into Workers, Worker detail, Today, calendar and settings

**Files:**
- Modify:
  - `mobile-chukta/src/screens/WorkersScreen.tsx`, `WorkerDetailScreen.tsx`, `TodayScreen.tsx`;
  - `PropertyFormScreen.tsx`, `WorkerFormScreen.tsx`, `MoneyEntryScreen.tsx`, `HolidayFormScreen.tsx`;
  - `src/ui/MonthCalendar.tsx`, `src/ui/Icon.tsx`.
- Create: `mobile-chukta/src/ui/PayCycleFields.tsx`
- Test: append to `workers.test.tsx`, `money.test.tsx`, `today.test.tsx`, `properties.test.tsx`, `holidays.test.tsx`

**Interfaces:**
- Consumes: `listDueSettlements`, `formatPeriod` (Task 9); `getDueSettlement`, `listSettlements`, `listPropertySettlements`, `SettledError` (Task 7); `buildTodayRows(..., settlements)` and `buildMonthGrid({ workerId, settlements })` (Task 9); the `PayCycle` form fields (Task 9).
- Produces:
  - `IconName` gains `'lock-closed-outline'` and `'document-text-outline'`;
  - `PayCycleFields` props: `{ value: { payCycle: PayCycle | null; cycleEndWeekday: number | null }; onChange; allowInherit: boolean; testIDPrefix: string }`.

Behaviour (spec §6):

- **WorkersScreen**
  - Owner only: when `listDueSettlements` returns rows, show a `Section` titled `settle.dueTitle` above the list.
  - Each row: the worker's name, subtitle `t('settle.dueRow', { period: formatPeriod(p), amount: formatRupees(wageDue) })`, testID `due-<workerId>`, and pressing it calls `navigation.navigate('Settle', { workerId })`.
  - Staff never see the section.
- **WorkerDetailScreen**
  - Owner: when `getDueSettlement` is not null, a primary `Button` reading `t('settle.button', { period: formatPeriod(...) })` with testID `settle-open` navigates to `Settle`.
  - Everyone: a `Section` titled `payslip.list` listing `listSettlements` rows that are **not voids**:
    - title: the period;
    - subtitle: `formatRupees(paid_now + advance_recovered)`;
    - right: a `StatusChip` reading `payslip.unlocked` when voided;
    - testID `payslip-<id>`;
    - pressing it navigates to `Payslip`.
  - With no rows, show `Muted` with `payslip.none`.
  - Pass `workerId` and `settlements` to `buildMonthGrid`.
- **MonthCalendar:** cells with `settled` show a small `lock-closed-outline` icon (size 10) in the bottom-left corner, and `t('settle.settledChip')` is appended to the cell's accessibilityLabel.
- **TodayScreen**
  - Load `listPropertySettlements` along with the other data, and pass it to `buildTodayRows`.
  - A row with `settled` shows a `StatusChip` reading `settle.settledChip` (tone `info`), and none of its controls are rendered: no status segmented, hours, overtime or custom amount.
  - Long-press selection is disabled for it, and bulk marking skips it (add `row.settled` to the bulk skip condition).
  - The closure card's save catches `SettledError` and shows `Alert.alert(t('settle.locked'))`.
  - When **any** row on the date is settled, the "Shop closed today" button is hidden, so the user can't make a closure the server will refuse.
- **MoneyEntryScreen** and **HolidayFormScreen**: when the save throws `SettledError`, show `t('settle.locked')` as the save error instead of `common.saveFailed`.
- **PayCycleFields:**
  - Segmented `payCycle`: `by_basis` / `weekly` / `monthly`, with labels `payCycle.byBasis` / `weekly` / `monthly`. With `allowInherit`, a first option `extraPay.useProperty` maps to null.
  - A weekday picker (the existing `WeekdayPicker` component) for `cycleEndWeekday`, shown only when the cycle in effect could be weekly (anything except `monthly`). With `allowInherit`, it includes an inherit option. If `WeekdayPicker` can't express null, add a small "Property setting" toggle.
  - Section title: `payCycle.title`.
- **PropertyFormScreen:** add `<PayCycleFields allowInherit={false} testIDPrefix="prop-cycle" …/>` below Extra pay.
- **WorkerFormScreen** (owner only, inside "Customize for this worker"):
  - add `<PayCycleFields allowInherit testIDPrefix="worker-cycle" …/>`;
  - when the worker's pay type is `monthly`, show `Muted` with `payCycle.monthlyAlways` instead of the fields;
  - switching overrides off resets both to null.

- [ ] **Step 1: Write the failing tests**

Append to `workers.test.tsx`. The session's today is 2026-09-07. The fixture worker joined 2026-09-01, so the week 1–5 Sep is due.

```tsx
test('owner sees the due list and opens Settle from it; staff do not see it', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  renderScreen('Tabs', WorkersScreen, s);
  expect(await screen.findByText('Due for settlement')).toBeTruthy();
  expect(screen.getByText('1–5 Sep · ₹2,500 due')).toBeTruthy();
  fireEvent.press(screen.getByTestId('due-w1'));
  expect(await screen.findByTestId('current-route')).toHaveTextContent('Settle');

  const st = await makeSession(STAFF);
  await upsertLocal(st.db, 'properties', property());
  await upsertLocal(st.db, 'workers', worker());
  renderScreen('Tabs', WorkersScreen, st);
  await screen.findAllByText('Ram');
  expect(screen.queryByText('Due for settlement')).toBeNull();
});
```

Use the real way `current-route` is asserted in the existing tests: grep for `current-route` in `holidays.test.tsx` and use the same pattern. Split the staff half into its own test if two renders in one test clash.

Append to `money.test.tsx`:

```tsx
test('worker detail lists payslips and offers Settle when due', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('settle-open')).toBeTruthy();
  expect(screen.getByText('No payslips yet.')).toBeTruthy();
});

test('saving money inside a settled period shows the locked message', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker());
  await settleWorker(s.repo, { worker: worker(), property: property(), today: '2026-09-07', paidNowPaise: 0, recoveredPaise: 0, mode: null });
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'advance' });
  fireEvent.changeText(await screen.findByTestId('amount'), '100');
  // Set the date field to 2026-09-03 the same way the existing money tests change dates (grep "date" in money.test.tsx);
  // if they never do, add a testID to the DateField on MoneyEntryScreen and drive it like today.test.tsx drives 'today-date'.
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('This period is settled. Unlock it first to change entries.')).toBeTruthy();
});
```

Append to `today.test.tsx`:

```tsx
test('a settled worker row shows Settled and has no controls', async () => {
  const s = await seeded();
  await settleWorker(s.repo, { worker: worker({ id: 'w1', name: 'Ram' }), property: property(), today: '2026-09-14',
    paidNowPaise: 0, recoveredPaise: 0, mode: null }); // settles 1–5 Sep
  renderScreen('Tabs', TodayScreen, s);
  fireEvent(await screen.findByTestId('today-date'), 'change', '2026-09-03'); // use however the existing midnight/date tests pick a date
  expect(await screen.findByText('Settled')).toBeTruthy();
  expect(screen.queryByTestId('status-w1-absent')).toBeNull();
  expect(screen.queryByTestId('closure-open')).toBeNull();
});
```

`seeded()` in `today.test.tsx` uses a STAFF session. `settleWorker` needs an owner, so call it with `{ ...s.repo, role: 'owner' }`. Pick the date the way the existing Today tests do. If no test changes `today-date`, render with a session whose `repo.now` is 2026-09-03 and settle with `today: '2026-09-14'`.

Append to `properties.test.tsx`:

```tsx
test('owner sets a monthly pay cycle', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('PropertyForm', PropertyFormScreen, s, { propertyId: 'p1' });
  fireEvent.press(await screen.findByTestId('prop-cycle-monthly'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select pay_cycle from properties')).toEqual({ pay_cycle: 'monthly' }));
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/workers.test.tsx src/__tests__/money.test.tsx src/__tests__/today.test.tsx src/__tests__/properties.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

Implement the behaviour above. Constraints:
- **Data loading:** extend each screen's existing `useLocalData` loader. Don't add a second data hook per screen.
- **Owner checks:** use `session.identity.kind === 'owner'`, as the existing screens do.
- **Strings:** everything goes through `t()`. Reuse `extraPay.useProperty` for "Property setting".
- **Today:** keep the existing protections: the `writing` ref, the fresh-SQLite dedupe, the date that follows today, and the double-tap latches. Clean up the act() warnings in any new test before committing.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS, with clean output.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): due list, payslips on worker detail, settled days on Today and calendar, pay-cycle settings"
```

---

### Task 13: Deploy note, live database checks, end-to-end

**Files:**
- Create: `docs/superpowers/notes/2026-10-05-chukta-phase2d-deploy.md`

- [ ] **Step 1: Write the deploy note**

```markdown
# Chukta Phase 2D — deploy

## What changes for people using the app
- Each worker now has pay periods: monthly-paid by calendar month; others weekly (week ends Saturday unless changed in Settings → Pay cycle).
- The owner settles a finished period from Workers → "Due for settlement" or the worker's page. Settling records the payment and any
  advance taken back, locks the period, and makes a payslip that can be shared as a picture.
- Nothing can be added or changed inside a settled period (attendance, overtime, money, holidays) until the owner unlocks it.
- Advance taken back at settlement also counts as wages paid (it is paid out of wages).
- Staff can view and share payslips but cannot settle or unlock.

## Steps
1. `supabase db push` (applies `20261005100000_chukta_phase2d.sql`). Claude may run it only when you say so.
2. Run the database checks on the live database (no Docker needed; uses the rollback wrapper):
   - `chukta_phase2d.test.sql` (expect 24/24) and re-run `chukta_phase2a`, `chukta_schema`, `chukta_access`, `chukta_admin_counts`.
3. Rebuild the app (new native libraries: view-shot, sharing): `cd mobile-chukta && npx expo run:android` (local `.env` needed) or an EAS build.
4. Update every phone. On first sync each phone re-downloads properties, workers, payments and advances once.

## Two-phone check
- Owner: Workers shows "Due for settlement" for last week. Open it, take back part of an advance, pay the rest, Settle → payslip opens.
- Share the payslip on WhatsApp; the picture shows the figures in the app's language (try বাংলা and हिन्दी).
- Staff phone: after sync, Today shows "Settled" for those dates; trying to add an advance dated in that week shows the locked message.
- Staff phone offline: mark attendance for a date the owner then settles; reconnect → the entry appears on "entries that didn't sync".
- Owner: Unlock the payslip → it shows "Unlocked"; edit an entry in that week; settle again → new payslip includes the earlier payment.
- Owner: Settings → Pay cycle → Every month; the next period after the last settlement runs to the month end.
```

- [ ] **Step 2: Verify locally**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: every suite passes, with clean output.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/notes/2026-10-05-chukta-phase2d-deploy.md
git commit -m "docs: Chukta Phase 2D deploy and check steps"
```

- [ ] **Step 4: Hand over to the user.** Ask whether to run `supabase db push` and the live checks (note steps 1–2). Run them only after an explicit yes. Then do the two-phone check together.
