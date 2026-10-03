# Chukta Phase 2A — Calendar & Extra Pay — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add holidays and closures (full or half day, paid or unpaid by pay basis), pay for work on a day off, overtime, and bonus/deduction entries to Chukta. That covers the wage calculation, local storage and sync, server permissions, and screens.

**Architecture:**
- Three new synced tables: `days_off`, `overtime_entries` and `earning_adjustments`. Plus new pay-setting columns on `properties` and `workers`, and a `custom_amount_paise` column on `attendance_entries`.
- The wage calculation is restructured around one per-day classification (`classifyDay`), so the existing per-basis maths becomes "credit × rate" for every basis.
- Extras (work on a day off, overtime, bonus and deduction) are separate lines that sum into `earnedPaise`.
- Permissions are enforced by RLS on the server, as in Phase 1.

**Tech Stack:**
- Supabase Postgres 17 + pgTAP.
- Expo SDK 54 / React Native 0.81 / TypeScript; `expo-sqlite`, `@react-navigation` v7, `i18next`.
- Jest (`jest-expo` 54) with the `better-sqlite3` test adapter and `@testing-library/react-native`.

**Spec:** `docs/superpowers/specs/2026-10-03-chukta-phase2a-calendar-extra-pay-design.md` (Phase 1: `docs/superpowers/specs/2026-09-29-chukta-phase1-design.md`).

## Global Constraints

- **Precondition:** the working tree is clean before Task 1. The in-progress UI redesign (indigo theme, `ScreenHeader`, `StatusChip`, `Avatar`, `EmptyState`, `HeroCard`, `src/ui/Icon.tsx`) must already be committed on `main`. All screen tasks build on those redesigned components, so read the current screen file before editing it.
- **Supabase:**
  - project ref `mhtqufyaxpunhenqropn`;
  - the new migration file is `supabase/migrations/20261004100000_chukta_phase2a.sql`;
  - Claude Code cannot run `supabase db push`; the user runs it (Task 13);
  - pgTAP runs against the live DB through the scratch `tapwrap.py` wrapper. A bare void `select fn()` line must be un-wrapped by hand.
- **No hard deletes** anywhere, and no DELETE grants. A day off is removed by setting `is_active = false`. Bonuses and deductions are corrected by a void row (`voids_id`), the same as advances.
- **Money:** integer paise everywhere. Each output component is rounded half-up once (`Math.round(x + 1e-6)`), and `earnedPaise` = base + offdayExtra + overtime + bonus − deduction, using the rounded components.
- **Phase 1 results must not change** when a worker has no days off, overtime or adjustments. Every existing ledger test must keep passing unchanged. A full month with no absences, no unpaid days off and no extras still equals exactly the monthly salary.
- **Values:**
  - `days_off.kind` ∈ `holiday|closure`;
  - `portion` ∈ `full|half`;
  - `pay_rule` ∈ `by_basis|all_paid|all_unpaid`;
  - `ot_mode` ∈ `multiplier|fixed`;
  - multipliers are 1–3 (the UI offers 1, 1.5 and 2);
  - overtime `hours` 0–16;
  - `earning_adjustments.type` ∈ `bonus|deduction`.
- **"Paid by basis":** monthly and weekly are paid; daily and hourly are unpaid.
- **Effective row:**
  - for a date: the active `days_off` row, and per worker and date the `overtime_entries` row, with the greatest `(Date.parse(created_at), id)`;
  - attendance keeps its Phase 1 rule.
- **Permissions:**
  - staff may insert `days_off` only with `kind='closure'`;
  - staff may insert overtime and attendance only with `custom_amount_paise` null;
  - `earning_adjustments` are owner-insert only;
  - property pay settings are owner-only (Phase 1 RLS already restricts property updates to owners).
  - Ruling: the per-worker extra-pay override columns follow the existing `workers` update rule (members may update). They're hidden from staff in the UI, the same as `rate_paise` today.
- **Mobile:**
  - no imports from `mobile-shopai/`;
  - every visible string goes through `t()`, with every key in `en.json`, `bn.json` and `hi.json` (the parity test enforces this);
  - dates are `YYYY-MM-DD` built from local parts (`todayLocal`, `addDays`, `compareDates`);
  - new icons must be added to the `IconName` union in `src/ui/Icon.tsx`.
- **Tests:**
  - `cd mobile-chukta && npx jest <path>`, then the full `npx jest` and `npx tsc --noEmit` before each commit;
  - never commit `.env*`, `node_modules`, `deno.lock`, `android/` or `ios/`;
  - never use the shared `git stash`.

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/20261004100000_chukta_phase2a.sql` | New tables, columns, triggers, grants, RLS, sync indexes |
| `supabase/tests/database/chukta_phase2a.test.sql` | pgTAP: constraints and the RLS matrix |
| `mobile-chukta/src/domain/types.ts` | `DayOff`, `OvertimeEntry`, `EarningAdjustment`, extended `Property`/`Worker`/`AttendanceEntry`/`ResolvedSettings`/`LedgerResult` |
| `mobile-chukta/src/domain/settings.ts` | Resolve the extra-pay settings |
| `mobile-chukta/src/domain/latest.ts` (new) | `latestByDate`, `effectiveDaysOff` |
| `mobile-chukta/src/domain/dayClass.ts` (new) | `classifyDay`, `dayRatePaise`, `isPaidByBasis` |
| `mobile-chukta/src/domain/ledger.ts` | Per-day credit, extras, new outputs and explanation lines |
| `mobile-chukta/src/db/schema.ts` | Local schema v3, the new synced tables and column lists |
| `mobile-chukta/src/repos/write.ts`, `src/sync/remote.ts` | Updatable columns and boolean columns |
| `mobile-chukta/src/repos/{daysOff,overtime,adjustments}.ts` (new); `attendance.ts`, `properties.ts`, `workers.ts` | Local write + enqueue, reads |
| `mobile-chukta/src/view/{ledgerQueries,today,monthGrid,moneyHistory,forms}.ts` | Wire the new data into views and forms |
| `mobile-chukta/src/utils/format.ts` | The `amount` money param in explanations |
| `mobile-chukta/src/i18n/{en,bn,hi}.json` | New strings |
| `mobile-chukta/src/screens/HolidaysScreen.tsx`, `HolidayFormScreen.tsx` (new); `TodayScreen.tsx`, `PropertyFormScreen.tsx`, `WorkerFormScreen.tsx`, `WorkerDetailScreen.tsx`, `MoneyEntryScreen.tsx`, `settings/PropertySection.tsx`; `src/app/{routes.ts,navigation.tsx}`; `src/ui/{Icon.tsx,MonthCalendar.tsx}` | Screens |

---

### Task 1: Database migration and pgTAP

**Files:**
- Create: `supabase/migrations/20261004100000_chukta_phase2a.sql`
- Create: `supabase/tests/database/chukta_phase2a.test.sql`

**Interfaces:**
- Produces: the tables `chukta.days_off`, `chukta.overtime_entries` and `chukta.earning_adjustments`; the new columns on `properties`, `workers` and `attendance_entries`. Exact columns are below; the app's column lists in Task 5 must match them exactly.

- [ ] **Step 1: Write the pgTAP test (it fails until the migration is pushed in Task 13)**

```sql
-- supabase/tests/database/chukta_phase2a.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-00000000000a', 'p2a-owner-a@test.internal'),
  ('e0000000-0000-0000-0000-00000000000b', 'p2a-owner-b@test.internal'),
  ('e0000000-0000-0000-0000-000000000051', 'p2a-staff@test.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id) values
  ('e1000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000931', 'e0000000-0000-0000-0000-00000000000a'),
  ('e1000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000932', 'e0000000-0000-0000-0000-00000000000b');
insert into chukta.properties (id, shop_id, name) values
  ('e2000000-0000-0000-0000-00000000000a', 'e1000000-0000-0000-0000-00000000000a', 'PA'),
  ('e2000000-0000-0000-0000-00000000000b', 'e1000000-0000-0000-0000-00000000000b', 'PB');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('e4000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-00000000000a', 'WA', 'daily', 50000, '2026-09-01', 'e0000000-0000-0000-0000-00000000000a', 'owner');
insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, note, created_by, created_by_role) values
  ('e5000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 50000, '2026-09-05', null, 'e0000000-0000-0000-0000-00000000000a', 'owner');

-- constraints (as postgres)
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-10', 'X', 'party', 'full', 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'days_off kind is checked');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-10', 17, 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'overtime hours capped at 16');
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'deduction', 100, '2026-09-10', 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'deduction needs a reason');
select throws_ok($$ update chukta.properties set ot_mode = 'fixed', ot_rate_paise = null where id = 'e2000000-0000-0000-0000-00000000000a' $$,
  '23514', null, 'fixed overtime needs a rate');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, created_by, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000b', 'e4000000-0000-0000-0000-00000000000a', '2026-09-10', 2, 'e0000000-0000-0000-0000-00000000000a', 'owner') $$,
  '23514', null, 'overtime worker must belong to the property');

-- owner A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'e1000000-0000-0000-0000-00000000000a')::text, true);
select lives_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, pay_rule, created_by_role)
  values ('e6000000-0000-0000-0000-00000000000a', 'e2000000-0000-0000-0000-00000000000a', '2026-10-20', 'Durga Puja', 'holiday', 'full', 'by_basis', 'owner') $$,
  'owner adds a holiday');
select lives_ok($$ update chukta.days_off set is_active = false where id = 'e6000000-0000-0000-0000-00000000000a' $$, 'owner deactivates a day off');
select lives_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-10', 2, 30000, 'owner') $$,
  'owner sets a custom overtime amount');
select lives_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 50000, '2026-09-05', 'e5000000-0000-0000-0000-00000000000a', 'owner') $$,
  'owner voids a bonus');
select lives_ok($$ update chukta.properties set offday_multiplier = 1.5, ot_mode = 'fixed', ot_rate_paise = 6000 where id = 'e2000000-0000-0000-0000-00000000000a' $$,
  'owner updates extra-pay settings');
select throws_ok($$ delete from chukta.days_off $$, '42501', null, 'nobody deletes days off');

-- staff of property A
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-000000000051', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'e1000000-0000-0000-0000-00000000000a', 'app_role', 'staff',
  'property_id', 'e2000000-0000-0000-0000-00000000000a')::text, true);
select lives_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-11', 'Bandh', 'closure', 'full', 'staff') $$, 'staff adds a closure');
select throws_ok($$ insert into chukta.days_off (id, property_id, date, name, kind, portion, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', '2026-09-12', 'Holi', 'holiday', 'full', 'staff') $$,
  '42501', null, 'staff cannot add a holiday');
select is((select count(*)::int from (update chukta.days_off set name = 'x' returning 1) u), 0, 'staff cannot edit days off');
select throws_ok($$ insert into chukta.overtime_entries (id, property_id, worker_id, date, hours, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-12', 1, 100, 'staff') $$,
  '42501', null, 'staff cannot set a custom overtime amount');
select throws_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, custom_amount_paise, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', '2026-09-13', 'present', 100, 'staff') $$,
  '42501', null, 'staff cannot set a custom day-off amount');
select throws_ok($$ insert into chukta.earning_adjustments (id, property_id, worker_id, type, amount_paise, date, created_by_role)
  values (gen_random_uuid(), 'e2000000-0000-0000-0000-00000000000a', 'e4000000-0000-0000-0000-00000000000a', 'bonus', 100, '2026-09-13', 'staff') $$,
  '42501', null, 'staff cannot add a bonus');

-- ShopAI token sees nothing
select set_config('request.jwt.claims', json_build_object('sub', 'e0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'shopai', 'shop_id', 'e1000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.days_off), 0, 'shopai token sees no days off');

select * from finish();
rollback;
```

- [ ] **Step 2: Write the migration**

```sql
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
  with check (chukta.is_staff_of(property_id) and kind = 'closure' and chukta.is_own_write(created_by, created_by_role));
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
```

- [ ] **Step 3: Self-check the SQL locally (no live DB)**

Run: `grep -c "create policy" supabase/migrations/20261004100000_chukta_phase2a.sql`
Expected: `10`.

Re-read the migration against spec §4: every column, check and policy is present, and there is no `delete` grant. The live pgTAP run happens in Task 13 after the user's `db push`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20261004100000_chukta_phase2a.sql supabase/tests/database/chukta_phase2a.test.sql
git commit -m "feat(db): chukta days off, overtime, bonus/deduction, extra-pay settings"
```

---

### Task 2: Domain types, settings resolution, fixtures

**Files:**
- Modify: `mobile-chukta/src/domain/types.ts`, `mobile-chukta/src/domain/settings.ts`, `mobile-chukta/src/repos/properties.ts` (`createProperty` defaults), `mobile-chukta/src/__tests__/helpers/fixtures.ts`, `mobile-chukta/src/__tests__/ledger.test.ts` (the `S()` helper only)
- Create: `mobile-chukta/src/domain/latest.ts`
- Test: `mobile-chukta/src/__tests__/resolveSettings.test.ts` (new)

**Interfaces:**
- Produces (exact names later tasks use):
  - `OtMode = 'multiplier' | 'fixed'`;
  - `DayOffKind = 'holiday' | 'closure'`;
  - `DayOffPortion = 'full' | 'half'`;
  - `DayOffPayRule = 'by_basis' | 'all_paid' | 'all_unpaid'`;
  - `DayOff` (Audit plus `id, property_id, date, name, kind, portion, pay_rule, is_active: 0|1`);
  - `OvertimeEntry` (Audit plus `id, property_id, worker_id, date, hours: number, custom_amount_paise: number|null, note: string|null`);
  - `AdjustmentType = 'bonus' | 'deduction'`;
  - `EarningAdjustment` (Audit plus `id, property_id, worker_id, type, amount_paise, date, note, voids_id`);
  - `AttendanceEntry.custom_amount_paise?: number | null` (optional, so existing literals stay valid);
  - `Property` gains `offday_multiplier: number, ot_mode: OtMode, ot_multiplier: number, ot_rate_paise: number | null`;
  - `Worker` gains `offday_multiplier?: number | null, ot_mode?: OtMode | null, ot_multiplier?: number | null, ot_rate_paise?: number | null`;
  - `ResolvedSettings` gains `offdayMultiplier: number, otMode: OtMode, otMultiplier: number, otRatePaise: number | null`;
  - `LedgerResult` gains `basePaise, offdayExtraPaise, overtimePaise, bonusPaise, deductionPaise: number`;
  - `latestByDate<T extends { date: string; created_at: string; id: string }>(rows: T[]): Map<string, T>`;
  - `effectiveDaysOff(rows: DayOff[]): Map<string, DayOff>` (active rows only).

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/resolveSettings.test.ts
import { effectiveDaysOff, latestByDate } from '../domain/latest';
import { resolveSettings } from '../domain/settings';
import type { DayOff } from '../domain/types';
import { property, worker } from './helpers/fixtures';

const dayOff = (id: string, date: string, over: Partial<DayOff> = {}): DayOff => ({
  id, property_id: 'p1', date, name: 'H', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', is_active: 1,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});

test('extra-pay settings come from the property unless the worker overrides them', () => {
  const p = property({ offday_multiplier: 1.5, ot_mode: 'fixed', ot_multiplier: 1, ot_rate_paise: 6000 });
  expect(resolveSettings(worker(), p)).toMatchObject({ offdayMultiplier: 1.5, otMode: 'fixed', otMultiplier: 1, otRatePaise: 6000 });
  const w = worker({ offday_multiplier: 2, ot_mode: 'multiplier', ot_multiplier: 1.5, ot_rate_paise: null });
  expect(resolveSettings(w, p)).toMatchObject({ offdayMultiplier: 2, otMode: 'multiplier', otMultiplier: 1.5, otRatePaise: 6000 });
});

test('defaults when nothing is set', () => {
  expect(resolveSettings(worker(), property())).toMatchObject({ offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null });
});

test('latestByDate keeps the newest row per date (created_at, then id)', () => {
  const rows = [
    dayOff('b', '2026-09-10', { created_at: '2026-09-10T09:00:00Z' }),
    dayOff('a', '2026-09-10', { created_at: '2026-09-10T11:00:00Z' }),
    dayOff('c', '2026-09-11', { created_at: '2026-09-11T10:00:00Z' }),
    dayOff('d', '2026-09-11', { created_at: '2026-09-11T10:00:00Z' }),
  ];
  const m = latestByDate(rows);
  expect([m.get('2026-09-10')?.id, m.get('2026-09-11')?.id]).toEqual(['a', 'd']);
});

test('effectiveDaysOff ignores deactivated rows, so an older active row can apply', () => {
  const rows = [
    dayOff('old', '2026-09-10', { name: 'Closure', kind: 'closure', created_at: '2026-09-10T08:00:00Z' }),
    dayOff('new', '2026-09-10', { is_active: 0, created_at: '2026-09-10T12:00:00Z' }),
  ];
  expect(effectiveDaysOff(rows).get('2026-09-10')?.id).toBe('old');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/resolveSettings.test.ts`
Expected: FAIL, "Cannot find module '../domain/latest'".

- [ ] **Step 3: Implement the types**

Append to `mobile-chukta/src/domain/types.ts`, and extend the existing types as listed in Interfaces:

```ts
export type OtMode = 'multiplier' | 'fixed';
export type DayOffKind = 'holiday' | 'closure';
export type DayOffPortion = 'full' | 'half';
export type DayOffPayRule = 'by_basis' | 'all_paid' | 'all_unpaid';

export type DayOff = Audit & {
  id: string; property_id: string; date: string; name: string; kind: DayOffKind; portion: DayOffPortion;
  pay_rule: DayOffPayRule; is_active: 0 | 1;
};

export type OvertimeEntry = Audit & {
  id: string; property_id: string; worker_id: string; date: string; hours: number;
  custom_amount_paise: number | null; note: string | null;
};

export type AdjustmentType = 'bonus' | 'deduction';
export type EarningAdjustment = Audit & {
  id: string; property_id: string; worker_id: string; type: AdjustmentType; amount_paise: number; date: string;
  note: string | null; voids_id: string | null;
};
```

The edits to the existing types are:
- `Property`: add `offday_multiplier: number; ot_mode: OtMode; ot_multiplier: number; ot_rate_paise: number | null;`.
- `Worker`: add `offday_multiplier?: number | null; ot_mode?: OtMode | null; ot_multiplier?: number | null; ot_rate_paise?: number | null;`.
- `AttendanceEntry`: add `custom_amount_paise?: number | null;`.
- `ResolvedSettings`: add `offdayMultiplier: number; otMode: OtMode; otMultiplier: number; otRatePaise: number | null;`.
- `LedgerResult`: add `basePaise: number; offdayExtraPaise: number; overtimePaise: number; bonusPaise: number; deductionPaise: number;`.

- [ ] **Step 4: Implement `latest.ts` and the settings**

```ts
// mobile-chukta/src/domain/latest.ts
import type { DayOff } from './types';

const ts = (s: string) => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? Number.NEGATIVE_INFINITY : t;
};

/** Newest row per date: greatest (created_at instant, id). Rows are append-only; corrections are newer rows. */
export function latestByDate<T extends { date: string; created_at: string; id: string }>(rows: T[]): Map<string, T> {
  const out = new Map<string, T>();
  for (const r of rows) {
    const cur = out.get(r.date);
    if (!cur) { out.set(r.date, r); continue; }
    const d = ts(r.created_at) - ts(cur.created_at);
    if (d > 0 || (d === 0 && r.id > cur.id)) out.set(r.date, r);
  }
  return out;
}

/** The property's effective day off per date: the newest *active* row (a deactivated row never applies). */
export function effectiveDaysOff(rows: DayOff[]): Map<string, DayOff> {
  return latestByDate(rows.filter((r) => r.is_active === 1));
}
```

In `mobile-chukta/src/domain/settings.ts`, add these fields to the returned object:

```ts
    offdayMultiplier: worker.offday_multiplier ?? property.offday_multiplier ?? 1,
    otMode: worker.ot_mode ?? property.ot_mode ?? 'multiplier',
    otMultiplier: worker.ot_multiplier ?? property.ot_multiplier ?? 1,
    otRatePaise: worker.ot_rate_paise ?? property.ot_rate_paise ?? null,
```

`createProperty` in `src/repos/properties.ts`: add `offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null,` to the row literal.

Fixtures (`src/__tests__/helpers/fixtures.ts`): add `offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null,` to `property()`.

`ledger.test.ts`: change the `S` helper to:

```ts
const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar',
  offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null, ...over,
});
```

`calculateWorkerLedger` must also return the five new `LedgerResult` fields, or `tsc` fails. Add this temporary return in `ledger.ts`; Task 3 replaces it:

```ts
  return {
    earnedPaise, paidPaise, wageDuePaise: earnedPaise - paidPaise, advanceOutstandingPaise, explanation,
    basePaise: earnedPaise, offdayExtraPaise: 0, overtimePaise: 0, bonusPaise: 0, deductionPaise: 0,
  };
```

- [ ] **Step 5: Run the tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: all suites PASS. Fix any remaining `tsc` error where a test literal builds a `Property` without the new fields; add the same four defaults there.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/domain mobile-chukta/src/repos/properties.ts mobile-chukta/src/__tests__
git commit -m "feat(chukta): domain types and settings for days off, overtime, adjustments"
```

---

### Task 3: Day classification and base pay with days off

**Files:**
- Create: `mobile-chukta/src/domain/dayClass.ts`
- Modify: `mobile-chukta/src/domain/ledger.ts`
- Test: `mobile-chukta/src/__tests__/ledgerDaysOff.test.ts` (new); the existing `ledger.test.ts` must pass unchanged

**Interfaces:**
- Consumes: `effectiveDaysOff` and `latestByDate` (Task 2); `dayCredit` (existing).
- Produces:
  - `isPaidByBasis(basis: PayBasis): boolean`;
  - `DayClass = { kind: 'working' } | { kind: 'off'; portion: DayOffPortion; paid: boolean; dayOff: DayOff | null; weekly: boolean }`;
  - `classifyDay(date: string, s: ResolvedSettings, dayOff: DayOff | undefined): DayClass`;
  - `baseCredit(cls: DayClass, entry: AttendanceEntry | undefined, shiftHours: number): number`;
  - `dayRatePaise(s: ResolvedSettings, ratePaise: number, date: string): number`;
  - `calculateWorkerLedger` input gains an optional `daysOff?: DayOff[]`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/ledgerDaysOff.test.ts
import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, DayOff, ResolvedSettings } from '../domain/types';

// 2026-09-01 is a Tuesday; Sundays are 6, 13, 20, 27. The default weekly off is Sunday (0).
const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar',
  offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null, ...over,
});
let n = 0;
const att = (date: string, status: AttendanceEntry['status'], hours: number | null = null): AttendanceEntry => ({
  id: `a${n++}`, property_id: 'p', worker_id: 'w', date, status, hours, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const off = (date: string, over: Partial<DayOff> = {}): DayOff => ({
  id: `d${n++}`, property_id: 'p', date, name: 'H', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', is_active: 1,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T09:00:00Z`, server_updated_at: null, ...over,
});
const week = { joiningDate: '2026-09-01', today: '2026-09-07', leftDate: null, advances: [], payments: [] };
const run = (s: ResolvedSettings, rate: number, daysOff: DayOff[], attendance: AttendanceEntry[] = [], extra = {}) =>
  calculateWorkerLedger({ ...week, settings: s, ratePaise: rate, attendance, daysOff, ...extra });

test('daily: a by-basis holiday is unpaid; all_paid pays it', () => {
  expect(run(S(), 50000, [off('2026-09-02')]).earnedPaise).toBe(250000);
  expect(run(S(), 50000, [off('2026-09-02', { pay_rule: 'all_paid' })]).earnedPaise).toBe(300000);
});

test('weekly: a by-basis holiday is paid; all_unpaid deducts a day', () => {
  expect(run(S({ payBasis: 'weekly' }), 70000, [off('2026-09-02')]).earnedPaise).toBe(70000);
  expect(run(S({ payBasis: 'weekly' }), 70000, [off('2026-09-02', { pay_rule: 'all_unpaid' })]).earnedPaise).toBe(60000);
});

test('monthly: a by-basis holiday keeps the full salary; all_unpaid deducts salary/30', () => {
  const month = { joiningDate: '2026-09-01', today: '2026-09-30' };
  const s = S({ payBasis: 'monthly' });
  expect(run(s, 3000000, [off('2026-09-10')], [], month).earnedPaise).toBe(3000000);
  expect(run(s, 3000000, [off('2026-09-10', { pay_rule: 'all_unpaid' })], [], month).earnedPaise).toBe(2900000);
});

test('hourly: an all_paid holiday pays a full shift', () => {
  expect(run(S({ payBasis: 'hourly', attendanceMode: 'hours' }), 6000, [off('2026-09-02', { pay_rule: 'all_paid' })]).earnedPaise)
    .toBe(6 * 8 * 6000);
});

test('a holiday on the weekly off counts once and is paid if either rule pays', () => {
  // daily: weekly off is unpaid, the holiday says all_paid → paid once.
  expect(run(S(), 50000, [off('2026-09-06', { pay_rule: 'all_paid' })]).earnedPaise).toBe(350000);
  // monthly: weekly off is paid, the holiday says all_unpaid → still paid (either pays).
  const month = { joiningDate: '2026-09-01', today: '2026-09-30' };
  expect(run(S({ payBasis: 'monthly' }), 3000000, [off('2026-09-06', { pay_rule: 'all_unpaid' })], [], month).earnedPaise).toBe(3000000);
});

test('half-day closure (daily, unpaid off half) with each attendance status', () => {
  const half = off('2026-09-03', { kind: 'closure', portion: 'half' });
  expect(run(S(), 50000, [half]).earnedPaise).toBe(275000); // no entry → works the open half
  expect(run(S(), 50000, [half], [att('2026-09-03', 'absent')]).earnedPaise).toBe(250000);
  expect(run(S(), 50000, [half], [att('2026-09-03', 'half_day')]).earnedPaise).toBe(275000);
  expect(run(S(), 50000, [half], [att('2026-09-03', 'hours', 2)]).earnedPaise).toBe(262500); // 2h / 8h = 0.25
  expect(run(S(), 50000, [{ ...half, pay_rule: 'all_paid' }]).earnedPaise).toBe(300000); // paid off half + worked half
});

test('a deactivated holiday has no effect', () => {
  expect(run(S(), 50000, [off('2026-09-02', { is_active: 0 })]).earnedPaise).toBe(300000);
});

test('days off before joining are ignored', () => {
  expect(run(S(), 50000, [off('2026-08-30', { pay_rule: 'all_paid' })]).earnedPaise).toBe(300000);
});

test('the explanation counts paid and unpaid days off', () => {
  const r = run(S(), 50000, [off('2026-09-02'), off('2026-09-03', { pay_rule: 'all_paid' })]);
  expect(r.explanation).toEqual(expect.arrayContaining([
    { key: 'ledger.explain.daysOffPaid', params: { days: 1 } },
    { key: 'ledger.explain.daysOffUnpaid', params: { days: 1 } },
  ]));
  expect(r.basePaise).toBe(r.earnedPaise);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/ledgerDaysOff.test.ts`
Expected: FAIL. The holiday cases return 300000 because `daysOff` is ignored.

- [ ] **Step 3: Implement `dayClass.ts`**

```ts
// mobile-chukta/src/domain/dayClass.ts
import { daysInMonth, weekday } from '../utils/dates';
import type { AttendanceEntry, DayOff, DayOffPortion, PayBasis, ResolvedSettings } from './types';

/** Day credit for a working day: no entry → 1; absent 0; half 0.5; hours → min(h / shift, 1). Moved here from ledger.ts. */
export function dayCredit(entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (!entry || entry.status === 'present') return 1;
  if (entry.status === 'absent') return 0;
  if (entry.status === 'half_day') return 0.5;
  return Math.min((entry.hours ?? 0) / shiftHours, 1);
}

export type DayClass =
  | { kind: 'working' }
  | { kind: 'off'; portion: DayOffPortion; paid: boolean; dayOff: DayOff | null; weekly: boolean };

/** Weekly offs and by-basis holidays: monthly and weekly workers are paid; daily and hourly are not. */
export const isPaidByBasis = (basis: PayBasis) => basis === 'monthly' || basis === 'weekly';

export function classifyDay(date: string, s: ResolvedSettings, dayOff: DayOff | undefined): DayClass {
  const weekly = s.weeklyOff !== null && weekday(date) === s.weeklyOff;
  if (!weekly && !dayOff) return { kind: 'working' };
  const byBasis = isPaidByBasis(s.payBasis);
  const weeklyPaid = weekly && byBasis;
  const dayOffPaid = dayOff
    ? dayOff.pay_rule === 'all_paid' ? true : dayOff.pay_rule === 'all_unpaid' ? false : byBasis
    : false;
  // A holiday on the weekly off counts once, as a full day, paid if either rule pays (spec §5.3).
  return {
    kind: 'off', paid: weeklyPaid || dayOffPaid, portion: weekly ? 'full' : (dayOff as DayOff).portion,
    dayOff: dayOff ?? null, weekly,
  };
}

/** Work credit for the open half of a half day off: 0.5 unless absent; hours count up to half a shift. */
function workHalf(entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (!entry || entry.status === 'present' || entry.status === 'half_day') return 0.5;
  if (entry.status === 'absent') return 0;
  return Math.min((entry.hours ?? 0) / shiftHours, 0.5);
}

/** Fraction of a normally paid day this date earns as base pay (0..1). */
export function baseCredit(cls: DayClass, entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (cls.kind === 'working') return dayCredit(entry, shiftHours);
  if (cls.portion === 'full') return cls.paid ? 1 : 0;
  return (cls.paid ? 0.5 : 0) + workHalf(entry, shiftHours);
}

/** One day's pay in paise for the worker's basis (monthly uses that month's divisor). Not rounded. */
export function dayRatePaise(s: ResolvedSettings, ratePaise: number, date: string): number {
  const shift = s.shiftHours > 0 ? s.shiftHours : 8;
  if (s.payBasis === 'daily') return ratePaise;
  if (s.payBasis === 'weekly') return ratePaise / 7;
  if (s.payBasis === 'hourly') return ratePaise * shift;
  const [y, m] = date.split('-').map(Number);
  const divisor = s.monthlyDivisor === 'calendar' ? daysInMonth(y, m) : Number(s.monthlyDivisor);
  return ratePaise / divisor;
}
```

`dayCredit` moves from `ledger.ts` into `dayClass.ts`; this avoids an import cycle, because `ledger.ts` imports `classifyDay`. Delete it from `ledger.ts` and re-export it there with `export { dayCredit } from './dayClass';`, so existing imports keep working.

- [ ] **Step 4: Rewrite the base pay in `ledger.ts`**

Replace `ledger.ts` with the following. The Phase 1 behaviour is identical when `daysOff` is empty: weekly offs classify as `off` with paid-by-basis, which reproduces the old "skip for hourly/daily, credit 1 for weekly/monthly".

```ts
import { addDays, compareDates, daysInMonth } from '../utils/dates';
import { activeMoneyRows, effectiveAttendance } from './attendance';
import { baseCredit, classifyDay } from './dayClass';
import { effectiveDaysOff } from './latest';
import type {
  AdvanceEntry, AttendanceEntry, DayOff, ExplanationLine, LedgerResult, ResolvedSettings, WagePayment,
} from './types';

export { dayCredit } from './dayClass';

type Input = {
  settings: ResolvedSettings;
  ratePaise: number;
  joiningDate: string;
  leftDate: string | null;
  today: string;
  attendance: AttendanceEntry[];
  advances: AdvanceEntry[];
  payments: WagePayment[];
  daysOff?: DayOff[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;
const toPaise = (x: number) => Math.round(x + 1e-6);

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export function calculateWorkerLedger(input: Input): LedgerResult {
  const { settings: s, ratePaise: rate } = input;
  const shift = s.shiftHours > 0 ? s.shiftHours : 8;
  const end = input.leftDate && compareDates(input.leftDate, input.today) < 0 ? input.leftDate : input.today;
  const dates = compareDates(input.joiningDate, end) <= 0 ? eachDate(input.joiningDate, end) : [];
  const byDate = effectiveAttendance(input.attendance);
  const offByDate = effectiveDaysOff(input.daysOff ?? []);

  const explanation: ExplanationLine[] = [];
  let paidOff = 0;
  let unpaidOff = 0;
  const credits = new Map<string, number>();
  const weeklyOffDates = new Set<string>();
  for (const d of dates) {
    const cls = classifyDay(d, s, offByDate.get(d));
    credits.set(d, baseCredit(cls, byDate.get(d), shift));
    if (cls.kind === 'off' && cls.weekly) weeklyOffDates.add(d);
    if (cls.kind === 'off' && cls.dayOff) {
      const size = cls.portion === 'half' ? 0.5 : 1;
      if (cls.paid) paidOff += size; else unpaidOff += size;
    }
  }

  let base = 0;
  if (s.payBasis === 'hourly') {
    let hours = 0;
    for (const d of dates) hours += (credits.get(d) ?? 0) * shift;
    base = hours * rate;
    explanation.push({ key: 'ledger.explain.hourly', params: { hours: round2(hours), rate } });
  } else if (s.payBasis === 'daily') {
    let days = 0;
    for (const d of dates) days += credits.get(d) ?? 0;
    base = days * rate;
    explanation.push({ key: 'ledger.explain.daily', params: { days: round2(days), rate } });
  } else if (s.payBasis === 'weekly') {
    let days = 0;
    for (const d of dates) days += credits.get(d) ?? 0;
    base = (days * rate) / 7;
    explanation.push({ key: 'ledger.explain.weekly', params: { days: round2(days), rate } });
  } else {
    const months = new Map<string, string[]>();
    for (const d of dates) {
      const key = d.slice(0, 7);
      const list = months.get(key) ?? [];
      list.push(d);
      months.set(key, list);
    }
    for (const [month, monthDates] of months) {
      const [y, m] = month.split('-').map(Number);
      const dim = daysInMonth(y, m);
      const divisor = s.monthlyDivisor === 'calendar' ? dim : Number(s.monthlyDivisor);
      const perDay = rate / divisor;
      const whole = monthDates.length === dim;
      // Divisor 26 counts working days only: weekly offs excluded, as in Phase 1 (holidays still count).
      const eligible = s.monthlyDivisor === '26' ? monthDates.filter((d) => !weeklyOffDates.has(d)).length : monthDates.length;
      const baseAmount = whole ? rate : Math.min(rate, (eligible * rate) / divisor);
      let deductionDays = 0;
      for (const d of monthDates) deductionDays += 1 - (credits.get(d) ?? 0);
      base += Math.max(0, baseAmount - (deductionDays * rate) / divisor);
      explanation.push({
        key: whole ? 'ledger.explain.monthly' : 'ledger.explain.monthlyPartial',
        params: { month, base: Math.round(baseAmount), deductionDays: round2(deductionDays), perDay: Math.round(perDay), divisor, eligibleDays: eligible },
      });
    }
  }
  if (paidOff > 0) explanation.push({ key: 'ledger.explain.daysOffPaid', params: { days: round2(paidOff) } });
  if (unpaidOff > 0) explanation.push({ key: 'ledger.explain.daysOffUnpaid', params: { days: round2(unpaidOff) } });

  const basePaise = toPaise(base);
  const earnedPaise = basePaise;
  const paidPaise = activeMoneyRows(input.payments).reduce((sum, p) => sum + p.amount_paise, 0);
  const advanceOutstandingPaise = activeMoneyRows(input.advances).reduce(
    (sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0);

  return {
    earnedPaise, paidPaise, wageDuePaise: earnedPaise - paidPaise, advanceOutstandingPaise, explanation,
    basePaise, offdayExtraPaise: 0, overtimePaise: 0, bonusPaise: 0, deductionPaise: 0,
  };
}
```

Note on the monthly path: in Phase 1 the deduction loop ran over non-weekly-off dates only. The new loop runs over every date, but a paid weekly off now has credit 1 (deduction 0), so the result is identical.

- [ ] **Step 5: Run the tests**

Run: `cd mobile-chukta && npx jest src/__tests__/ledgerDaysOff.test.ts src/__tests__/ledger.test.ts src/__tests__/view.test.ts`
Expected: PASS. All Phase 1 ledger tests are unchanged.

If a Phase 1 test fails, the rewrite changed Phase 1 maths. Fix the ledger, not the test.

- [ ] **Step 6: Full suite, type check, commit**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

```bash
git add mobile-chukta/src/domain mobile-chukta/src/__tests__/ledgerDaysOff.test.ts
git commit -m "feat(chukta): classify days off and pay them by basis in the wage calculation"
```

---

### Task 4: Extras: work on a day off, overtime, bonus and deduction

**Files:**
- Modify: `mobile-chukta/src/domain/ledger.ts`
- Test: `mobile-chukta/src/__tests__/ledgerExtras.test.ts` (new)

**Interfaces:**
- Consumes: `classifyDay`, `dayRatePaise`, `dayCredit` (Task 3); `latestByDate` (Task 2); `activeMoneyRows` (existing).
- Produces: the `calculateWorkerLedger` input gains optional `overtime?: OvertimeEntry[]` and `adjustments?: EarningAdjustment[]`. The output fills `offdayExtraPaise`, `overtimePaise`, `bonusPaise` and `deductionPaise`, with `earnedPaise = base + offdayExtra + overtime + bonus − deduction`. New explanation keys: `ledger.explain.offdayWork {days, amount}`, `ledger.explain.overtime {hours, amount}`, `ledger.explain.bonus {amount}`, `ledger.explain.deduction {amount}` (amounts in paise).

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/ledgerExtras.test.ts
import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, EarningAdjustment, OvertimeEntry, ResolvedSettings } from '../domain/types';

// 2026-09-01 is a Tuesday; Sunday 2026-09-06 is the weekly off.
const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar',
  offdayMultiplier: 1, otMode: 'multiplier', otMultiplier: 1, otRatePaise: null, ...over,
});
let n = 0;
const att = (date: string, status: AttendanceEntry['status'], over: Partial<AttendanceEntry> = {}): AttendanceEntry => ({
  id: `a${n++}`, property_id: 'p', worker_id: 'w', date, status, hours: null, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});
const ot = (date: string, hours: number, over: Partial<OvertimeEntry> = {}): OvertimeEntry => ({
  id: `o${n++}`, property_id: 'p', worker_id: 'w', date, hours, custom_amount_paise: null, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T18:00:00Z`, server_updated_at: null, ...over,
});
const adj = (id: string, type: EarningAdjustment['type'], amount: number, over: Partial<EarningAdjustment> = {}): EarningAdjustment => ({
  id, property_id: 'p', worker_id: 'w', type, amount_paise: amount, date: '2026-09-05', note: type === 'deduction' ? 'damage' : null,
  voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null, ...over,
});
const week = { joiningDate: '2026-09-01', today: '2026-09-07', leftDate: null, advances: [], payments: [] };
const run = (s: ResolvedSettings, rate: number, extra: Partial<Parameters<typeof calculateWorkerLedger>[0]> = {}) =>
  calculateWorkerLedger({ ...week, settings: s, ratePaise: rate, attendance: [], ...extra });

test('work on the weekly off pays an extra day at the multiplier', () => {
  const r = run(S(), 50000, { attendance: [att('2026-09-06', 'present')] });
  expect([r.basePaise, r.offdayExtraPaise, r.earnedPaise]).toEqual([300000, 50000, 350000]);
  expect(run(S({ offdayMultiplier: 1.5 }), 50000, { attendance: [att('2026-09-06', 'present')] }).offdayExtraPaise).toBe(75000);
  expect(run(S(), 50000, { attendance: [att('2026-09-06', 'half_day')] }).offdayExtraPaise).toBe(25000);
  expect(run(S(), 50000, { attendance: [att('2026-09-06', 'absent')] }).offdayExtraPaise).toBe(0);
});

test('an owner custom amount replaces the computed day-off pay', () => {
  const r = run(S({ offdayMultiplier: 2 }), 50000, { attendance: [att('2026-09-06', 'present', { custom_amount_paise: 40000 })] });
  expect(r.offdayExtraPaise).toBe(40000);
});

test('monthly: work on a day off uses that month\'s per-day rate and keeps the salary whole', () => {
  const r = run(S({ payBasis: 'monthly' }), 3000000, { today: '2026-09-30', attendance: [att('2026-09-06', 'present')] });
  expect([r.basePaise, r.offdayExtraPaise]).toEqual([3000000, 100000]);
});

test('explicit overtime: multiplier, fixed rate, custom amount', () => {
  expect(run(S({ otMultiplier: 1.5 }), 50000, { overtime: [ot('2026-09-03', 2)] }).overtimePaise).toBe(18750); // 2h × ₹62.50 × 1.5
  expect(run(S({ otMode: 'fixed', otRatePaise: 6000 }), 50000, { overtime: [ot('2026-09-03', 2)] }).overtimePaise).toBe(12000);
  expect(run(S(), 50000, { overtime: [ot('2026-09-03', 2, { custom_amount_paise: 10000 })] }).overtimePaise).toBe(10000);
});

test('fixed mode with no rate falls back to 1× the hourly base', () => {
  expect(run(S({ otMode: 'fixed', otRatePaise: null }), 50000, { overtime: [ot('2026-09-03', 2)] }).overtimePaise).toBe(12500);
});

test('hours above the shift become overtime automatically; an explicit entry replaces that', () => {
  const s = S({ payBasis: 'hourly', attendanceMode: 'hours' });
  const auto = run(s, 6000, { attendance: [att('2026-09-03', 'hours', { hours: 10 })] });
  expect([auto.basePaise, auto.overtimePaise]).toEqual([6 * 8 * 6000, 2 * 6000]);
  const explicit = run(s, 6000, { attendance: [att('2026-09-03', 'hours', { hours: 10 })], overtime: [ot('2026-09-03', 1)] });
  expect(explicit.overtimePaise).toBe(6000);
});

test('the latest overtime entry for a date wins; 0 hours clears it', () => {
  const r = run(S(), 50000, { overtime: [ot('2026-09-03', 2, { created_at: '2026-09-03T18:00:00Z' }), ot('2026-09-03', 0, { created_at: '2026-09-03T19:00:00Z' })] });
  expect(r.overtimePaise).toBe(0);
});

test('monthly overtime uses that month\'s hourly base', () => {
  const r = run(S({ payBasis: 'monthly' }), 3000000, { today: '2026-09-30', overtime: [ot('2026-09-10', 2)] });
  expect(r.overtimePaise).toBe(25000); // (₹30,000 / 30) / 8 × 2
});

test('bonus adds, deduction subtracts, voided rows are ignored', () => {
  const r = run(S(), 50000, { adjustments: [adj('b1', 'bonus', 50000), adj('d1', 'deduction', 20000), adj('b2', 'bonus', 99999), adj('v', 'bonus', 99999, { voids_id: 'b2' })] });
  expect([r.bonusPaise, r.deductionPaise, r.earnedPaise]).toEqual([50000, 20000, 300000 + 50000 - 20000]);
});

test('earned is the sum of the rounded components, and explanation lines appear only when non-zero', () => {
  const r = run(S({ otMultiplier: 1.5 }), 50000, {
    attendance: [att('2026-09-06', 'present')], overtime: [ot('2026-09-03', 2)], adjustments: [adj('b1', 'bonus', 50000)],
  });
  expect(r.earnedPaise).toBe(r.basePaise + r.offdayExtraPaise + r.overtimePaise + r.bonusPaise - r.deductionPaise);
  expect(r.explanation.map((e) => e.key)).toEqual(
    ['ledger.explain.daily', 'ledger.explain.offdayWork', 'ledger.explain.overtime', 'ledger.explain.bonus']);
  expect(r.explanation[2].params).toEqual({ hours: 2, amount: 18750 });
});

test('a deduction larger than earned makes wage due negative', () => {
  const r = run(S(), 50000, { adjustments: [adj('d1', 'deduction', 500000)] });
  expect(r.wageDuePaise).toBe(300000 - 500000);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/ledgerExtras.test.ts`
Expected: FAIL. The extras are 0.

- [ ] **Step 3: Implement the extras in `ledger.ts`**

1. Add to the imports: `dayCredit, dayRatePaise` from `./dayClass`, `latestByDate` from `./latest`, and the types `EarningAdjustment`, `OvertimeEntry`.
2. Add to `Input`: `overtime?: OvertimeEntry[]; adjustments?: EarningAdjustment[];`.
3. After the existing day loop, before computing `basePaise`, insert:

```ts
  const otByDate = latestByDate(input.overtime ?? []);
  let offdayExtra = 0;
  let offdayDays = 0;
  let otPay = 0;
  let otHoursTotal = 0;
  for (const d of dates) {
    const cls = classifyDay(d, s, offByDate.get(d));
    const entry = byDate.get(d);
    const dayRate = dayRatePaise(s, rate, d);

    // Work on a full day off: extra on top of any off-pay (spec §5.5). No entry or absent means no work.
    if (cls.kind === 'off' && cls.portion === 'full' && entry && entry.status !== 'absent') {
      const workCredit = dayCredit(entry, shift);
      if (entry.custom_amount_paise != null) offdayExtra += entry.custom_amount_paise;
      else offdayExtra += workCredit * dayRate * s.offdayMultiplier;
      offdayDays += workCredit;
    }

    // Overtime (spec §5.7): an explicit entry wins; otherwise hours above the shift.
    const explicit = otByDate.get(d);
    const autoHours = entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0;
    const otHours = explicit ? explicit.hours : autoHours;
    if (otHours > 0 || explicit?.custom_amount_paise != null) {
      if (explicit?.custom_amount_paise != null) otPay += explicit.custom_amount_paise;
      else if (s.otMode === 'fixed' && s.otRatePaise != null) otPay += otHours * s.otRatePaise;
      else otPay += otHours * (dayRate / shift) * (s.otMode === 'fixed' ? 1 : s.otMultiplier);
      otHoursTotal += otHours;
    }
  }
  const adjustments = activeMoneyRows(input.adjustments ?? []);
  const bonusPaise = adjustments.filter((a) => a.type === 'bonus').reduce((sum, a) => sum + a.amount_paise, 0);
  const deductionPaise = adjustments.filter((a) => a.type === 'deduction').reduce((sum, a) => sum + a.amount_paise, 0);
```

4. Replace the tail (from `const basePaise` to the return) with:

```ts
  const basePaise = toPaise(base);
  const offdayExtraPaise = toPaise(offdayExtra);
  const overtimePaise = toPaise(otPay);
  if (offdayExtraPaise > 0) explanation.push({ key: 'ledger.explain.offdayWork', params: { days: round2(offdayDays), amount: offdayExtraPaise } });
  if (overtimePaise > 0) explanation.push({ key: 'ledger.explain.overtime', params: { hours: round2(otHoursTotal), amount: overtimePaise } });
  if (bonusPaise > 0) explanation.push({ key: 'ledger.explain.bonus', params: { amount: bonusPaise } });
  if (deductionPaise > 0) explanation.push({ key: 'ledger.explain.deduction', params: { amount: deductionPaise } });

  const earnedPaise = basePaise + offdayExtraPaise + overtimePaise + bonusPaise - deductionPaise;
  const paidPaise = activeMoneyRows(input.payments).reduce((sum, p) => sum + p.amount_paise, 0);
  const advanceOutstandingPaise = activeMoneyRows(input.advances).reduce(
    (sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0);

  return {
    earnedPaise, paidPaise, wageDuePaise: earnedPaise - paidPaise, advanceOutstandingPaise, explanation,
    basePaise, offdayExtraPaise, overtimePaise, bonusPaise, deductionPaise,
  };
```

The ordering requirement in the explanation test (`daily, offdayWork, overtime, bonus`) means the days-off lines (Task 3) come before these. Keep that order: base lines, `daysOffPaid`/`daysOffUnpaid`, then `offdayWork`, `overtime`, `bonus`, `deduction`.

- [ ] **Step 4: Run the tests**

Run: `cd mobile-chukta && npx jest src/__tests__/ledgerExtras.test.ts src/__tests__/ledgerDaysOff.test.ts src/__tests__/ledger.test.ts`
Expected: PASS.

- [ ] **Step 5: Full suite, type check, commit**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

```bash
git add mobile-chukta/src/domain/ledger.ts mobile-chukta/src/__tests__/ledgerExtras.test.ts
git commit -m "feat(chukta): pay work on a day off, overtime, bonus and deduction in the wage calculation"
```

---
### Task 5: Local schema v3 and sync of the new tables

**Files:**
- Modify: `mobile-chukta/src/db/schema.ts`, `mobile-chukta/src/repos/write.ts`
- Test: `mobile-chukta/src/__tests__/schema.test.ts`, `mobile-chukta/src/__tests__/engine.test.ts` (fetch counts only), `mobile-chukta/src/__tests__/pull.test.ts` (append)

**Interfaces:**
- Produces:
  - `SYNCED_TABLES` = `['properties','staff_users','workers','days_off','attendance_entries','overtime_entries','advance_entries','wage_payments','earning_adjustments']`. Parents come before children, because push and pull walk this order;
  - `TABLE_COLUMNS` for the three new tables and the new columns;
  - `UPDATABLE_COLUMNS.days_off = ['name','kind','portion','pay_rule','is_active']`;
  - `properties` and `workers` gain `offday_multiplier`, `ot_mode`, `ot_multiplier`, `ot_rate_paise`;
  - the local `user_version` is 3.
- `remote.ts` needs no change: `is_active` is already a boolean column name, so `days_off.is_active` converts.

- [ ] **Step 1: Write the failing tests**

In `schema.test.ts`, change both `expect(v?.user_version).toBe(2)` to `toBe(3)`, then append:

```ts
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
```

The existing "each table has exactly the declared columns" test checks `TABLE_COLUMNS` against `pragma table_info` for every synced table, so it covers the new tables and columns automatically.

In `engine.test.ts`, import `SYNCED_TABLES` from `'../db/schema'` and replace the literal fetch counts:
- `{ write: 1, fetch: 6 }` becomes `{ write: 1, fetch: SYNCED_TABLES.length }`;
- `expect(calls.fetch).toBe(12)` becomes `expect(calls.fetch).toBe(2 * SYNCED_TABLES.length)`.

Append to `pull.test.ts`:

```ts
test('pull stores rows of the Phase 2A tables', async () => {
  const db = openTestDb();
  await migrate(db);
  const dayOff = { id: 'd1', property_id: 'p', date: '2026-10-20', name: 'Durga Puja', kind: 'holiday', portion: 'full',
    pay_rule: 'by_basis', is_active: true, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: '2026-10-01T00:00:00Z' };
  await pullAll(db, fakeRemote({ days_off: [dayOff] }));
  expect(await db.getFirstAsync('select name, is_active from days_off')).toEqual({ name: 'Durga Puja', is_active: 1 });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/schema.test.ts src/__tests__/pull.test.ts`
Expected: FAIL. The user version is 2, and the `days_off` table doesn't exist.

- [ ] **Step 3: Implement**

In `src/db/schema.ts`:

```ts
export const SYNCED_TABLES = [
  'properties', 'staff_users', 'workers', 'days_off', 'attendance_entries', 'overtime_entries',
  'advance_entries', 'wage_payments', 'earning_adjustments',
] as const;
```

`TABLE_COLUMNS` changes:
- `properties`: insert `'offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise',` before `'created_at'`;
- `workers`: insert `'offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise',` before `...ENTRY_AUDIT`;
- `attendance_entries`: insert `'custom_amount_paise',` before `...ENTRY_AUDIT`;
- add:

```ts
  days_off: ['id', 'property_id', 'date', 'name', 'kind', 'portion', 'pay_rule', 'is_active', ...ENTRY_AUDIT],
  overtime_entries: ['id', 'property_id', 'worker_id', 'date', 'hours', 'custom_amount_paise', 'note', ...ENTRY_AUDIT],
  earning_adjustments: ['id', 'property_id', 'worker_id', 'type', 'amount_paise', 'date', 'note', 'voids_id', ...ENTRY_AUDIT],
```

Add the v3 block and chain it in `migrate()`:

```ts
// Phase 2A: days off, overtime, bonus/deduction, extra-pay settings (spec §4.6).
const SCHEMA_V3 = `
alter table properties add column offday_multiplier real not null default 1;
alter table properties add column ot_mode text not null default 'multiplier';
alter table properties add column ot_multiplier real not null default 1;
alter table properties add column ot_rate_paise integer;
alter table workers add column offday_multiplier real;
alter table workers add column ot_mode text;
alter table workers add column ot_multiplier real;
alter table workers add column ot_rate_paise integer;
alter table attendance_entries add column custom_amount_paise integer;
create table if not exists days_off (
  id text primary key, property_id text not null, date text not null, name text not null, kind text not null,
  portion text not null default 'full', pay_rule text not null default 'by_basis', is_active integer not null default 1,
  created_by text not null, created_by_role text not null, created_at text not null, server_updated_at text
);
create index if not exists idx_days_off_property_date on days_off(property_id, date);
create table if not exists overtime_entries (
  id text primary key, property_id text not null, worker_id text not null, date text not null, hours real not null,
  custom_amount_paise integer, note text, created_by text not null, created_by_role text not null, created_at text not null,
  server_updated_at text
);
create index if not exists idx_overtime_worker_date on overtime_entries(worker_id, date);
create index if not exists idx_overtime_property_date on overtime_entries(property_id, date);
create table if not exists earning_adjustments (
  id text primary key, property_id text not null, worker_id text not null, type text not null, amount_paise integer not null,
  date text not null, note text, voids_id text, created_by text not null, created_by_role text not null, created_at text not null,
  server_updated_at text
);
create index if not exists idx_adjustments_worker on earning_adjustments(worker_id);
`;
```

In `migrate()`, after the v2 block:

```ts
  if (version < 3) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(SCHEMA_V3);
      await db.execAsync('pragma user_version = 3');
    });
  }
```

In `src/repos/write.ts`, `UPDATABLE_COLUMNS` becomes:

```ts
export const UPDATABLE_COLUMNS = {
  properties: ['name', 'address', 'is_active', 'default_pay_basis', 'default_attendance_mode', 'shift_hours', 'weekly_off', 'monthly_divisor',
    'offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise'],
  workers: ['name', 'phone', 'pay_basis', 'rate_paise', 'joining_date', 'status', 'left_date', 'attendance_mode', 'shift_hours',
    'weekly_off_override', 'weekly_off', 'monthly_divisor', 'offday_multiplier', 'ot_mode', 'ot_multiplier', 'ot_rate_paise'],
  days_off: ['name', 'kind', 'portion', 'pay_rule', 'is_active'],
} as const;
```

Widen `updateAndEnqueue`'s `table` parameter type from `'properties' | 'workers'` to `keyof typeof UPDATABLE_COLUMNS`.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/db/schema.ts mobile-chukta/src/repos/write.ts mobile-chukta/src/__tests__
git commit -m "feat(chukta): local schema v3 and sync for days off, overtime, adjustments"
```

---

### Task 6: Repositories and ledger wiring

**Files:**
- Create: `mobile-chukta/src/repos/daysOff.ts`, `mobile-chukta/src/repos/overtime.ts`
- Modify: `mobile-chukta/src/repos/money.ts` (adjustments live here so they share the void logic), `src/repos/attendance.ts`, `src/repos/workers.ts`, `src/repos/properties.ts`, `src/view/ledgerQueries.ts`
- Test: `mobile-chukta/src/__tests__/repos2a.test.ts` (new), `mobile-chukta/src/__tests__/view.test.ts` (append)

**Interfaces:**
- Consumes: `insertAndEnqueue`, `updateAndEnqueue`, `UPDATABLE_COLUMNS` (Task 5); the types from Task 2; `calculateWorkerLedger` with `daysOff`, `overtime` and `adjustments` (Tasks 3–4).
- Produces:
  - `addDayOff(ctx, input: { propertyId: string; date: string; name: string; kind: DayOffKind; portion: DayOffPortion; payRule: DayOffPayRule }): Promise<DayOff>` (staff only `kind='closure'`);
  - `updateDayOff(ctx, id: string, patch: Partial<Pick<DayOff,'name'|'kind'|'portion'|'pay_rule'|'is_active'>>): Promise<void>` (owner only);
  - `listDaysOff(db, propertyId: string): Promise<DayOff[]>` (all rows, date desc);
  - `getDayOff(db, id): Promise<DayOff | null>`;
  - `addOvertime(ctx, input: { propertyId: string; workerId: string; date: string; hours: number; customAmountPaise?: number | null; note?: string }): Promise<OvertimeEntry>` (staff cannot set a custom amount);
  - `listOvertime(db, workerId: string): Promise<OvertimeEntry[]>`;
  - `listOvertimeForDate(db, propertyId: string, date: string): Promise<OvertimeEntry[]>`;
  - `addAdjustment(ctx, input: { propertyId: string; workerId: string; type: AdjustmentType; amountPaise: number; date: string; note?: string }): Promise<EarningAdjustment>` (owner only; a deduction needs a note);
  - `voidAdjustment(ctx, targetId: string)`;
  - `listAdjustments(db, workerId: string): Promise<EarningAdjustment[]>`;
  - `markAttendance` input gains `customAmountPaise?: number | null` (owner only);
  - `NewWorker` gains `offdayMultiplier?: number; otMode?: OtMode; otMultiplier?: number; otRatePaise?: number`, and `WorkerPatch` gains the four snake_case columns;
  - `PropertySettingsPatch` gains `offday_multiplier`, `ot_mode`, `ot_multiplier`, `ot_rate_paise`;
  - `getWorkerLedger` and `listWorkerSummaries` pass days off, overtime and adjustments.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/repos2a.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { RepoContext } from '../repos/context';
import { addDayOff, listDaysOff, updateDayOff } from '../repos/daysOff';
import { addOvertime, listOvertime, listOvertimeForDate } from '../repos/overtime';
import { addAdjustment, listAdjustments, voidAdjustment } from '../repos/money';
import { markAttendance } from '../repos/attendance';

async function ctx(role: RepoContext['role'] = 'owner'): Promise<RepoContext> {
  const db = openTestDb();
  await migrate(db);
  let i = 0;
  return { db, userId: 'u1', role, now: () => new Date('2026-09-30T10:00:00Z'), newId: () => `id-${++i}` };
}
const queue = (c: RepoContext) => c.db.getAllAsync<{ table_name: string; op: string; payload: string }>('select * from sync_queue order by seq');
const D = { propertyId: 'p1', date: '2026-10-20', name: 'Durga Puja', kind: 'holiday' as const, portion: 'full' as const, payRule: 'by_basis' as const };

test('owner adds and deactivates a holiday; both are queued', async () => {
  const c = await ctx();
  const d = await addDayOff(c, D);
  await updateDayOff(c, d.id, { is_active: 0 });
  expect((await listDaysOff(c.db, 'p1')).map((x) => [x.name, x.is_active])).toEqual([['Durga Puja', 0]]);
  expect((await queue(c)).map((q) => `${q.table_name}:${q.op}`)).toEqual(['days_off:insert', 'days_off:update']);
});

test('staff may add a closure but not a holiday, and cannot edit days off', async () => {
  const c = await ctx('staff');
  await expect(addDayOff(c, D)).rejects.toThrow();
  const closure = await addDayOff(c, { ...D, kind: 'closure', name: 'Bandh' });
  await expect(updateDayOff(c, closure.id, { name: 'x' })).rejects.toThrow();
});

test('overtime: staff cannot set a custom amount; reads by worker and by date', async () => {
  const s = await ctx('staff');
  await expect(addOvertime(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 2, customAmountPaise: 100 })).rejects.toThrow();
  await addOvertime(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 2 });
  expect((await listOvertime(s.db, 'w1')).map((o) => o.hours)).toEqual([2]);
  expect((await listOvertimeForDate(s.db, 'p1', '2026-09-03')).length).toBe(1);
  await expect(addOvertime(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-03', hours: 17 })).rejects.toThrow();
});

test('adjustments: owner only, deduction needs a note, voidable once', async () => {
  const staff = await ctx('staff');
  await expect(addAdjustment(staff, { propertyId: 'p1', workerId: 'w1', type: 'bonus', amountPaise: 100, date: '2026-09-05' })).rejects.toThrow();
  const c = await ctx();
  await expect(addAdjustment(c, { propertyId: 'p1', workerId: 'w1', type: 'deduction', amountPaise: 100, date: '2026-09-05' })).rejects.toThrow();
  const b = await addAdjustment(c, { propertyId: 'p1', workerId: 'w1', type: 'bonus', amountPaise: 50000, date: '2026-09-05' });
  await voidAdjustment(c, b.id);
  await expect(voidAdjustment(c, b.id)).rejects.toThrow('entry already corrected');
  expect((await listAdjustments(c.db, 'w1')).map((a) => a.voids_id)).toEqual([null, b.id]);
});

test('attendance custom amount is owner only', async () => {
  const s = await ctx('staff');
  await expect(markAttendance(s, { propertyId: 'p1', workerId: 'w1', date: '2026-09-06', status: 'present', customAmountPaise: 100 })).rejects.toThrow();
  const o = await ctx();
  const row = await markAttendance(o, { propertyId: 'p1', workerId: 'w1', date: '2026-09-06', status: 'present', customAmountPaise: 40000 });
  expect(row.custom_amount_paise).toBe(40000);
});
```

Append to `view.test.ts` (it already has `seeded()`, `property`, `worker` and `upsertLocal` in scope):

```ts
test('worker ledger from SQLite includes days off, overtime and adjustments', async () => {
  const db = await seeded(); // Ram: daily ₹500 from 2026-09-01, absent 09-03, ₹500 paid, ₹1,000 advance
  await upsertLocal(db, 'days_off', { id: 'h1', property_id: 'p1', date: '2026-09-02', name: 'H', kind: 'holiday', portion: 'full',
    pay_rule: 'all_paid', is_active: 1, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-01T00:00:00Z', server_updated_at: null });
  await upsertLocal(db, 'overtime_entries', { id: 'o1', property_id: 'p1', worker_id: 'w1', date: '2026-09-04', hours: 2,
    custom_amount_paise: null, note: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-04T18:00:00Z', server_updated_at: null });
  await upsertLocal(db, 'earning_adjustments', { id: 'b1', property_id: 'p1', worker_id: 'w1', type: 'bonus', amount_paise: 10000,
    date: '2026-09-05', note: null, voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null });
  const l = await getWorkerLedger(db, worker(), property(), '2026-09-07');
  expect([l.basePaise, l.overtimePaise, l.bonusPaise]).toEqual([250000, 12500, 10000]); // holiday paid replaces nothing lost: 5 days
  const [summary] = await listWorkerSummaries(db, property(), '2026-09-07');
  expect(summary.ledger.earnedPaise).toBe(l.earnedPaise);
});
```

Base check for that test: 1, 2 (paid holiday), 4, 5 and 7 = 5 days, since the 3rd is absent and the 6th is the unpaid Sunday. That gives 250000. Overtime is 2h × ₹62.50 = 12500.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/repos2a.test.ts src/__tests__/view.test.ts`
Expected: FAIL, "Cannot find module '../repos/daysOff'".

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/repos/daysOff.ts
import type { SqlDb } from '../db/sqlDb';
import type { DayOff, DayOffKind, DayOffPayRule, DayOffPortion } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue, updateAndEnqueue } from './write';

export type DayOffPatch = Partial<Pick<DayOff, 'name' | 'kind' | 'portion' | 'pay_rule' | 'is_active'>>;

/** Owners add any day off; staff may only add a closure ("Shop closed today"). */
export async function addDayOff(
  ctx: RepoContext,
  input: { propertyId: string; date: string; name: string; kind: DayOffKind; portion: DayOffPortion; payRule: DayOffPayRule },
): Promise<DayOff> {
  if (ctx.role !== 'owner' && input.kind !== 'closure') throw new Error('only the owner can add holidays');
  if (!input.name.trim()) throw new Error('name is required');
  const row: DayOff = {
    id: ctx.newId(), property_id: input.propertyId, date: input.date, name: input.name.trim(), kind: input.kind,
    portion: input.portion, pay_rule: input.payRule, is_active: 1,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'days_off', row);
  return row;
}

export async function updateDayOff(ctx: RepoContext, id: string, patch: DayOffPatch): Promise<void> {
  if (ctx.role !== 'owner') throw new Error('only the owner can edit days off');
  await updateAndEnqueue(ctx, 'days_off', id, patch);
}

export async function listDaysOff(db: SqlDb, propertyId: string): Promise<DayOff[]> {
  return db.getAllAsync<DayOff>('select * from days_off where property_id = ? order by date desc, created_at desc', [propertyId]);
}

export async function getDayOff(db: SqlDb, id: string): Promise<DayOff | null> {
  return db.getFirstAsync<DayOff>('select * from days_off where id = ?', [id]);
}
```

```ts
// mobile-chukta/src/repos/overtime.ts
import type { SqlDb } from '../db/sqlDb';
import type { OvertimeEntry } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue } from './write';

/** Append-only; the newest entry per worker and date wins (0 hours clears overtime for that date). */
export async function addOvertime(
  ctx: RepoContext,
  input: { propertyId: string; workerId: string; date: string; hours: number; customAmountPaise?: number | null; note?: string },
): Promise<OvertimeEntry> {
  if (!(input.hours >= 0 && input.hours <= 16)) throw new Error('overtime hours must be between 0 and 16');
  const custom = input.customAmountPaise ?? null;
  if (custom !== null && ctx.role !== 'owner') throw new Error('only the owner can set a custom amount');
  if (custom !== null && !(Number.isInteger(custom) && custom >= 0)) throw new Error('custom amount must be whole paise');
  const row: OvertimeEntry = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, date: input.date, hours: input.hours,
    custom_amount_paise: custom, note: input.note ?? null,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'overtime_entries', row);
  return row;
}

export async function listOvertime(db: SqlDb, workerId: string): Promise<OvertimeEntry[]> {
  return db.getAllAsync<OvertimeEntry>('select * from overtime_entries where worker_id = ? order by date, created_at', [workerId]);
}

export async function listOvertimeForDate(db: SqlDb, propertyId: string, date: string): Promise<OvertimeEntry[]> {
  return db.getAllAsync<OvertimeEntry>(
    'select * from overtime_entries where property_id = ? and date = ? order by created_at, id', [propertyId, date]);
}
```

In `src/repos/money.ts`:
1. Widen `voidRow`: the type parameter becomes `T extends AdvanceEntry | WagePayment | EarningAdjustment` and the `table` parameter becomes `'advance_entries' | 'wage_payments' | 'earning_adjustments'`.
2. Append:

```ts
export async function addAdjustment(
  ctx: RepoContext,
  input: { propertyId: string; workerId: string; type: AdjustmentType; amountPaise: number; date: string; note?: string },
): Promise<EarningAdjustment> {
  if (ctx.role !== 'owner') throw new Error('only the owner can add a bonus or deduction');
  assertAmount(input.amountPaise);
  if (input.type === 'deduction' && !input.note?.trim()) throw new Error('a reason is required for a deduction');
  const row: EarningAdjustment = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, type: input.type, amount_paise: input.amountPaise,
    date: input.date, note: input.note?.trim() || null, voids_id: null, ...audit(ctx),
  };
  await insertAndEnqueue(ctx, 'earning_adjustments', row);
  return row;
}

export const voidAdjustment = (ctx: RepoContext, targetId: string) => voidRow<EarningAdjustment>(ctx, 'earning_adjustments', targetId);

export async function listAdjustments(db: SqlDb, workerId: string): Promise<EarningAdjustment[]> {
  return db.getAllAsync<EarningAdjustment>('select * from earning_adjustments where worker_id = ? order by date, created_at', [workerId]);
}
```

Add `AdjustmentType, EarningAdjustment` to its type import.

In `src/repos/attendance.ts`, `markAttendance`:
- the input type gains `customAmountPaise?: number | null`;
- before building the row, add `if ((input.customAmountPaise ?? null) !== null && ctx.role !== 'owner') throw new Error('only the owner can set a custom amount');`;
- the row gains `custom_amount_paise: input.customAmountPaise ?? null,`.

In `src/repos/workers.ts`:
- `NewWorker` gains `offdayMultiplier?: number; otMode?: OtMode; otMultiplier?: number; otRatePaise?: number;`;
- the `createWorker` row gains `offday_multiplier: input.offdayMultiplier ?? null, ot_mode: input.otMode ?? null, ot_multiplier: input.otMultiplier ?? null, ot_rate_paise: input.otRatePaise ?? null,`;
- `WorkerPatch` adds `'offday_multiplier' | 'ot_mode' | 'ot_multiplier' | 'ot_rate_paise'` to its `Pick`.

In `src/repos/properties.ts`, `PropertySettingsPatch` adds `'offday_multiplier' | 'ot_mode' | 'ot_multiplier' | 'ot_rate_paise'` to its `Pick`.

In `src/view/ledgerQueries.ts`:
- `ledgerFor` takes and forwards `daysOff: DayOff[]`, `overtime: OvertimeEntry[]` and `adjustments: EarningAdjustment[]` into `calculateWorkerLedger`.
- `getWorkerLedger` also loads `listDaysOff(db, property.id)`, `listOvertime(db, worker.id)` and `listAdjustments(db, worker.id)` in its `Promise.all`.
- `listWorkerSummaries` adds three batched queries to its `Promise.all`. It groups overtime and adjustments with the existing `groupByWorker`, and passes the same `daysOff` array to every worker:

```ts
    db.getAllAsync<DayOff>('select * from days_off where property_id = ?', [property.id]),
    db.getAllAsync<OvertimeEntry>('select * from overtime_entries where property_id = ? and date <= ?', [property.id, today]),
    db.getAllAsync<EarningAdjustment>('select * from earning_adjustments where property_id = ?', [property.id]),
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/repos mobile-chukta/src/view/ledgerQueries.ts mobile-chukta/src/__tests__
git commit -m "feat(chukta): repositories for days off, overtime and adjustments; ledger reads them"
```

---

### Task 7: Strings (en/bn/hi) and explanation formatting

**Files:**
- Modify: `mobile-chukta/src/i18n/en.json`, `bn.json`, `hi.json`, `mobile-chukta/src/utils/format.ts`
- Test: `mobile-chukta/src/__tests__/format.test.ts` (append); `i18n.test.ts` (parity) must stay green

**Interfaces:**
- Produces the i18n keys used by Tasks 8–12, which are listed below.
- `explanationText` formats the `amount` param as rupees.

- [ ] **Step 1: Write the failing test**

Append to `format.test.ts`:

```ts
test('Phase 2A explanation lines format amounts as rupees', () => {
  expect(explanationText({ key: 'ledger.explain.overtime', params: { hours: 2, amount: 18750 } }, t)).toBe('2 overtime hours: ₹187.50');
  expect(explanationText({ key: 'ledger.explain.deduction', params: { amount: 20000 } }, t)).toBe('Deduction: −₹200');
  expect(explanationText({ key: 'ledger.explain.daysOffPaid', params: { days: 1.5 } }, t)).toBe('1.5 days off (paid)');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/format.test.ts`
Expected: FAIL, "missing key ledger.explain.overtime".

- [ ] **Step 3: Add the keys**

In `src/utils/format.ts`: `const MONEY_PARAMS = new Set(['rate', 'base', 'perDay', 'amount']);`

Merge these keys into each language file. Keep everything that already exists; add new objects and add keys inside existing ones (`ledger.explain`, `entryType`, `money`, `today`, `settings`).

**en.json**

```json
{
  "ledger": { "explain": {
    "daysOffPaid": "{{days}} days off (paid)", "daysOffUnpaid": "{{days}} days off (unpaid)",
    "offdayWork": "{{days}} days worked on a day off: {{amount}}", "overtime": "{{hours}} overtime hours: {{amount}}",
    "bonus": "Bonus: {{amount}}", "deduction": "Deduction: −{{amount}}"
  } },
  "entryType": { "bonus": "Bonus", "deduction": "Deduction" },
  "money": { "noteRequiredDeduction": "A reason is required for a deduction." },
  "today": {
    "worked": "Worked", "workedHalf": "Worked half", "notWorked": "Not worked", "dayOffHalf": "{{name}} · half day",
    "overtime": "+ Overtime", "overtimeHours": "Overtime hours", "overtimeValue": "OT {{hours}} h",
    "inclOvertime": "incl. {{hours}} h OT", "overtimeInvalid": "Enter 0 to 16 hours.",
    "customAmount": "Custom amount (₹, optional)", "customAmountInvalid": "Enter a valid amount."
  },
  "settings": { "holidays": "Holidays" },
  "daysOff": {
    "title": "Holidays", "add": "Add holiday", "edit": "Edit holiday", "name": "Name", "nameRequired": "Enter a name.",
    "date": "Date", "portion": "Full or half day", "full": "Full day", "half": "Half day", "payRule": "Pay",
    "byBasis": "As per pay type", "allPaid": "Paid for all", "allUnpaid": "Unpaid for all", "active": "Active",
    "removed": "Removed", "empty": "No holidays added yet.", "holiday": "Holiday", "closure": "Shop closed",
    "upcoming": "Upcoming", "past": "Past", "suggestions": "Suggestions",
    "suggest": { "durgaPuja": "Durga Puja", "poilaBoishakh": "Poila Boishakh", "eid": "Eid", "diwali": "Diwali", "holi": "Holi",
      "republicDay": "Republic Day", "independenceDay": "Independence Day", "christmas": "Christmas" }
  },
  "closure": {
    "button": "Shop closed today", "title": "Mark shop closed", "reason": "Reason", "bandh": "Bandh", "rain": "Rain",
    "powerCut": "Power cut", "confirm": "Mark closed", "reasonRequired": "Enter a reason."
  },
  "extraPay": {
    "title": "Extra pay", "offdayMultiplier": "Work on a day off pays", "otMode": "Overtime pay",
    "multiplierMode": "× hourly pay", "fixedMode": "Fixed ₹ per hour", "otMultiplier": "Overtime rate",
    "otRate": "₹ per overtime hour", "otRateRequired": "Enter the ₹ per hour.", "useProperty": "Property setting"
  }
}
```

**bn.json** (same keys)

```json
{
  "ledger": { "explain": {
    "daysOffPaid": "{{days}} দিন ছুটি (বেতনসহ)", "daysOffUnpaid": "{{days}} দিন ছুটি (বেতন ছাড়া)",
    "offdayWork": "ছুটির দিনে {{days}} দিন কাজ: {{amount}}", "overtime": "{{hours}} ঘণ্টা ওভারটাইম: {{amount}}",
    "bonus": "বোনাস: {{amount}}", "deduction": "কাটা: −{{amount}}"
  } },
  "entryType": { "bonus": "বোনাস", "deduction": "কাটা" },
  "money": { "noteRequiredDeduction": "কাটার কারণ লিখতে হবে।" },
  "today": {
    "worked": "কাজ করেছে", "workedHalf": "অর্ধেক কাজ", "notWorked": "কাজ করেনি", "dayOffHalf": "{{name}} · অর্ধেক দিন",
    "overtime": "+ ওভারটাইম", "overtimeHours": "ওভারটাইম ঘণ্টা", "overtimeValue": "ওটি {{hours}} ঘণ্টা",
    "inclOvertime": "{{hours}} ঘণ্টা ওটি সহ", "overtimeInvalid": "০ থেকে ১৬ ঘণ্টা লিখুন।",
    "customAmount": "নিজের টাকার পরিমাণ (₹, ঐচ্ছিক)", "customAmountInvalid": "সঠিক টাকার পরিমাণ লিখুন।"
  },
  "settings": { "holidays": "ছুটির দিন" },
  "daysOff": {
    "title": "ছুটির দিন", "add": "ছুটি যোগ করুন", "edit": "ছুটি বদলান", "name": "নাম", "nameRequired": "নাম লিখুন।",
    "date": "তারিখ", "portion": "পুরো না অর্ধেক দিন", "full": "পুরো দিন", "half": "অর্ধেক দিন", "payRule": "বেতন",
    "byBasis": "বেতনের ধরন অনুযায়ী", "allPaid": "সবার জন্য বেতনসহ", "allUnpaid": "সবার জন্য বেতন ছাড়া", "active": "চালু",
    "removed": "বাদ দেওয়া", "empty": "এখনও কোনো ছুটি যোগ করা হয়নি।", "holiday": "ছুটি", "closure": "দোকান বন্ধ",
    "upcoming": "আসন্ন", "past": "আগের", "suggestions": "পরামর্শ",
    "suggest": { "durgaPuja": "দুর্গাপূজা", "poilaBoishakh": "পয়লা বৈশাখ", "eid": "ঈদ", "diwali": "দীপাবলি", "holi": "দোল",
      "republicDay": "প্রজাতন্ত্র দিবস", "independenceDay": "স্বাধীনতা দিবস", "christmas": "বড়দিন" }
  },
  "closure": {
    "button": "আজ দোকান বন্ধ", "title": "দোকান বন্ধ চিহ্নিত করুন", "reason": "কারণ", "bandh": "বনধ", "rain": "বৃষ্টি",
    "powerCut": "লোডশেডিং", "confirm": "বন্ধ চিহ্নিত করুন", "reasonRequired": "কারণ লিখুন।"
  },
  "extraPay": {
    "title": "অতিরিক্ত বেতন", "offdayMultiplier": "ছুটির দিনে কাজের বেতন", "otMode": "ওভারটাইমের বেতন",
    "multiplierMode": "× ঘণ্টার বেতন", "fixedMode": "ঘণ্টায় নির্দিষ্ট ₹", "otMultiplier": "ওভারটাইমের হার",
    "otRate": "ওভারটাইমের প্রতি ঘণ্টা ₹", "otRateRequired": "ঘণ্টায় কত ₹ লিখুন।", "useProperty": "প্রপার্টির সেটিং"
  }
}
```

**hi.json** (same keys)

```json
{
  "ledger": { "explain": {
    "daysOffPaid": "{{days}} दिन छुट्टी (वेतन सहित)", "daysOffUnpaid": "{{days}} दिन छुट्टी (बिना वेतन)",
    "offdayWork": "छुट्टी के दिन {{days}} दिन काम: {{amount}}", "overtime": "{{hours}} घंटे ओवरटाइम: {{amount}}",
    "bonus": "बोनस: {{amount}}", "deduction": "कटौती: −{{amount}}"
  } },
  "entryType": { "bonus": "बोनस", "deduction": "कटौती" },
  "money": { "noteRequiredDeduction": "कटौती का कारण ज़रूरी है।" },
  "today": {
    "worked": "काम किया", "workedHalf": "आधा काम", "notWorked": "काम नहीं किया", "dayOffHalf": "{{name}} · आधा दिन",
    "overtime": "+ ओवरटाइम", "overtimeHours": "ओवरटाइम घंटे", "overtimeValue": "ओटी {{hours}} घंटे",
    "inclOvertime": "{{hours}} घंटे ओटी सहित", "overtimeInvalid": "0 से 16 घंटे लिखें।",
    "customAmount": "अपनी रकम (₹, वैकल्पिक)", "customAmountInvalid": "सही रकम लिखें।"
  },
  "settings": { "holidays": "छुट्टियाँ" },
  "daysOff": {
    "title": "छुट्टियाँ", "add": "छुट्टी जोड़ें", "edit": "छुट्टी बदलें", "name": "नाम", "nameRequired": "नाम लिखें।",
    "date": "तारीख", "portion": "पूरा या आधा दिन", "full": "पूरा दिन", "half": "आधा दिन", "payRule": "वेतन",
    "byBasis": "वेतन के प्रकार के अनुसार", "allPaid": "सबके लिए वेतन सहित", "allUnpaid": "सबके लिए बिना वेतन", "active": "चालू",
    "removed": "हटाया गया", "empty": "अभी कोई छुट्टी नहीं जोड़ी गई।", "holiday": "छुट्टी", "closure": "दुकान बंद",
    "upcoming": "आने वाली", "past": "पिछली", "suggestions": "सुझाव",
    "suggest": { "durgaPuja": "दुर्गा पूजा", "poilaBoishakh": "पोइला बोइशाख", "eid": "ईद", "diwali": "दीवाली", "holi": "होली",
      "republicDay": "गणतंत्र दिवस", "independenceDay": "स्वतंत्रता दिवस", "christmas": "क्रिसमस" }
  },
  "closure": {
    "button": "आज दुकान बंद", "title": "दुकान बंद दर्ज करें", "reason": "कारण", "bandh": "बंद (हड़ताल)", "rain": "बारिश",
    "powerCut": "बिजली कटौती", "confirm": "बंद दर्ज करें", "reasonRequired": "कारण लिखें।"
  },
  "extraPay": {
    "title": "अतिरिक्त वेतन", "offdayMultiplier": "छुट्टी के दिन काम का वेतन", "otMode": "ओवरटाइम का वेतन",
    "multiplierMode": "× घंटे का वेतन", "fixedMode": "प्रति घंटा तय ₹", "otMultiplier": "ओवरटाइम दर",
    "otRate": "ओवरटाइम प्रति घंटा ₹", "otRateRequired": "प्रति घंटा ₹ लिखें।", "useProperty": "प्रॉपर्टी सेटिंग"
  }
}
```

Bengali text uses Bengali digits (`০`, `১৬`) only inside Bengali sentences. Never put Devanagari `०` in `bn.json`.

- [ ] **Step 4: Run the tests**

Run: `cd mobile-chukta && npx jest src/__tests__/format.test.ts src/__tests__/i18n.test.ts && npx tsc --noEmit`
Expected: PASS. Parity holds across en, bn and hi.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/i18n mobile-chukta/src/utils/format.ts mobile-chukta/src/__tests__/format.test.ts
git commit -m "feat(chukta): strings for holidays, closures, overtime, bonus and deduction"
```

---

### Task 8: View models and form validation

**Files:**
- Modify: `mobile-chukta/src/view/today.ts`, `src/view/monthGrid.ts`, `src/view/moneyHistory.ts`, `src/view/forms.ts`
- Test: `mobile-chukta/src/__tests__/view2a.test.ts` (new), `mobile-chukta/src/__tests__/forms.test.ts` (update expectations and append)

**Interfaces:**
- Consumes: `classifyDay`, `baseCredit` (Task 3); `effectiveDaysOff`, `latestByDate` (Task 2).
- Produces:
  - `TodayRow` gains `dayClass: DayClass; overtime: OvertimeEntry | null; autoOtHours: number`. `isOff` now means "full day off" (weekly off, holiday or closure);
  - `buildTodayRows(workers, property, entries, date, daysOff: DayOff[] = [], overtime: OvertimeEntry[] = [])`;
  - `effectiveDayOffFor(daysOff: DayOff[], date: string): DayOff | null`;
  - `DayCell` gains `dayOff: DayOff | null; halfOff: boolean; workedOnOff: boolean; otHours: number`, and `kind: 'off'` now covers any full day off;
  - `buildMonthGrid` input gains optional `daysOff?: DayOff[]; overtime?: OvertimeEntry[]`;
  - `MoneyKind` gains `'bonus' | 'deduction'`;
  - `HistoryItem.table` gains `'earning_adjustments'`;
  - `buildMoneyHistory(advances, payments, adjustments: EarningAdjustment[] = [])`;
  - forms:
    - `HolidayFormValues`, `validateHolidayForm`, `holidayToFormValues`;
    - `parseOvertimeHours(s: string): number | null`;
    - `parseOptionalAmount(s: string): number | null | undefined` (`''` gives null, invalid gives undefined);
    - `MULTIPLIERS = [1, 1.5, 2]`;
    - `PropertyFormValues` gains `offdayMultiplier: number; otMode: OtMode; otMultiplier: number; otRate: string`, with matching output fields;
    - `WorkerFormValues` gains `offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRate: string`, with result `offdayMultiplier, otMode, otMultiplier, otRatePaise`;
    - `validateMoneyForm` requires a note for `deduction` (`money.noteRequiredDeduction`).

- [ ] **Step 1: Write the failing tests**

```ts
// mobile-chukta/src/__tests__/view2a.test.ts
import type { DayOff, EarningAdjustment, OvertimeEntry } from '../domain/types';
import { resolveSettings } from '../domain/settings';
import { buildMoneyHistory } from '../view/moneyHistory';
import { buildMonthGrid } from '../view/monthGrid';
import { buildTodayRows, effectiveDayOffFor } from '../view/today';
import { adv, att, property, worker } from './helpers/fixtures';

const off = (date: string, over: Partial<DayOff> = {}): DayOff => ({
  id: `d-${date}`, property_id: 'p1', date, name: 'Holi', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', is_active: 1,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T09:00:00Z`, server_updated_at: null, ...over,
});
const ot = (date: string, hours: number): OvertimeEntry => ({
  id: `o-${date}`, property_id: 'p1', worker_id: 'w1', date, hours, custom_amount_paise: null, note: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T18:00:00Z`, server_updated_at: null,
});

test('today rows: a holiday makes the day a full day off; half closure is not "off"; overtime is attached', () => {
  const rows = buildTodayRows([worker()], property(), [], '2026-09-08', [off('2026-09-08')], [ot('2026-09-08', 2)]);
  expect(rows[0].isOff).toBe(true);
  expect(rows[0].overtime?.hours).toBe(2);
  const half = buildTodayRows([worker()], property(), [], '2026-09-08', [off('2026-09-08', { portion: 'half', kind: 'closure' })]);
  expect(half[0].isOff).toBe(false);
  expect(half[0].dayClass).toMatchObject({ kind: 'off', portion: 'half' });
  expect(effectiveDayOffFor([off('2026-09-08', { is_active: 0 })], '2026-09-08')).toBeNull();
});

test('today rows: by-hours entries above the shift report automatic overtime', () => {
  const rows = buildTodayRows([worker({ pay_basis: 'hourly' })], property(), [att('2026-09-08', 'hours', { hours: 10 })], '2026-09-08');
  expect(rows[0].autoOtHours).toBe(2);
});

test('month grid marks holidays, half closures, work on a day off and overtime', () => {
  const g = buildMonthGrid({
    year: 2026, month: 9, settings: resolveSettings(worker(), property()), joiningDate: '2026-09-01', leftDate: null, today: '2026-09-30',
    attendance: [att('2026-09-06', 'present')], daysOff: [off('2026-09-10'), off('2026-09-11', { kind: 'closure', portion: 'half' })],
    overtime: [ot('2026-09-12', 2)],
  });
  const cell = (d: number) => g.cells[d - 1];
  expect(cell(6)).toMatchObject({ kind: 'off', workedOnOff: true });
  expect(cell(10)).toMatchObject({ kind: 'off', dayOff: expect.objectContaining({ name: 'Holi' }) });
  expect(cell(11)).toMatchObject({ kind: 'working', halfOff: true, credit: 0.5 });
  expect(cell(12).otHours).toBe(2);
});

test('money history includes bonuses and deductions and their voids', () => {
  const adjustment = (id: string, type: EarningAdjustment['type'], voids: string | null = null): EarningAdjustment => ({
    id, property_id: 'p1', worker_id: 'w1', type, amount_paise: 10000, date: '2026-09-05', note: 'x', voids_id: voids,
    created_by: 'u1', created_by_role: 'owner', created_at: `2026-09-05T1${id.length}:00:00Z`, server_updated_at: null,
  });
  const items = buildMoneyHistory([adv('a1')], [], [adjustment('b1', 'bonus'), adjustment('dd1', 'deduction'), adjustment('vvv1', 'bonus', 'b1')]);
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  expect(byId.b1).toMatchObject({ kind: 'bonus', table: 'earning_adjustments', isVoided: true, canCorrect: false, mode: null });
  expect(byId.dd1).toMatchObject({ kind: 'deduction', canCorrect: true });
  expect(byId.vvv1).toMatchObject({ isVoid: true });
});
```

In `forms.test.ts`:
1. Add `offdayMultiplier: null, otMode: null, otMultiplier: null, otRate: ''` to the `W` fixture.
2. Add `offdayMultiplier: null, otMode: null, otMultiplier: null, otRatePaise: null` to the expected `validateWorkerForm` value.
3. Add `offday_multiplier: null, ot_mode: null, ot_multiplier: null, ot_rate_paise: null` to the expected `toWorkerPatch` object.
4. Add `offday_multiplier: 1, ot_mode: 'multiplier', ot_multiplier: 1, ot_rate_paise: null` to the expected `validatePropertyForm` value.
5. Append:

```ts
test('extra-pay validation: fixed overtime needs a rate (property and worker)', () => {
  const p = { ...propertyToFormValues(property()), otMode: 'fixed' as const, otRate: '' };
  expect(validatePropertyForm(p)).toEqual({ ok: false, errors: { otRate: 'extraPay.otRateRequired' } });
  expect(validatePropertyForm({ ...p, otRate: '60' })).toMatchObject({ ok: true, value: { ot_mode: 'fixed', ot_rate_paise: 6000 } });
  expect(validateWorkerForm({ ...W, otMode: 'fixed', otRate: '' })).toMatchObject({ ok: false, errors: { otRate: 'extraPay.otRateRequired' } });
  expect(validateWorkerForm({ ...W, offdayMultiplier: 1.5, otMode: 'fixed', otRate: '75' }))
    .toMatchObject({ ok: true, value: { offdayMultiplier: 1.5, otMode: 'fixed', otRatePaise: 7500 } });
});

test('a deduction needs a reason; a bonus does not', () => {
  expect(validateMoneyForm({ kind: 'deduction', amount: '100', date: '2026-09-07', mode: null, note: '' }))
    .toEqual({ ok: false, errors: { note: 'money.noteRequiredDeduction' } });
  expect(validateMoneyForm({ kind: 'bonus', amount: '100', date: '2026-09-07', mode: null, note: '' }).ok).toBe(true);
});

test('holiday form and helpers', () => {
  expect(validateHolidayForm({ name: ' ', date: '2026-10-20', kind: 'holiday', portion: 'full', payRule: 'by_basis', isActive: true }))
    .toEqual({ ok: false, errors: { name: 'daysOff.nameRequired' } });
  expect(parseOvertimeHours('2.5')).toBe(2.5);
  expect(parseOvertimeHours('17')).toBeNull();
  expect(parseOptionalAmount('')).toBeNull();
  expect(parseOptionalAmount('1,200')).toBe(120000);
  expect(parseOptionalAmount('abc')).toBeUndefined();
});
```

Add `validateHolidayForm, parseOvertimeHours, parseOptionalAmount` to that file's import from `'../view/forms'`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/view2a.test.ts src/__tests__/forms.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `today.ts`**

```ts
import { effectiveAttendance } from '../domain/attendance';
import { classifyDay, type DayClass } from '../domain/dayClass';
import { effectiveDaysOff, latestByDate } from '../domain/latest';
import { resolveSettings } from '../domain/settings';
import type { AttendanceEntry, DayOff, OvertimeEntry, Property, ResolvedSettings, Worker } from '../domain/types';
import { compareDates } from '../utils/dates';

export type TodayRow = {
  worker: Worker; settings: ResolvedSettings;
  /** Full day off (weekly off, holiday or closure): attendance here means work on a day off. */
  isOff: boolean;
  dayClass: DayClass; entry: AttendanceEntry | null; overtime: OvertimeEntry | null; autoOtHours: number;
};

export function effectiveDayOffFor(daysOff: DayOff[], date: string): DayOff | null {
  return effectiveDaysOff(daysOff.filter((d) => d.date === date)).get(date) ?? null;
}

/** One row per worker employed on `date`, with that day's effective attendance and overtime (latest wins). */
export function buildTodayRows(
  workers: Worker[], property: Property, entries: AttendanceEntry[], date: string,
  daysOff: DayOff[] = [], overtime: OvertimeEntry[] = [],
): TodayRow[] {
  const dayOff = effectiveDayOffFor(daysOff, date) ?? undefined;
  const byWorker = new Map<string, AttendanceEntry[]>();
  for (const e of entries) {
    if (e.date !== date) continue;
    const list = byWorker.get(e.worker_id) ?? [];
    list.push(e);
    byWorker.set(e.worker_id, list);
  }
  const otByWorker = new Map<string, OvertimeEntry[]>();
  for (const o of overtime) {
    if (o.date !== date) continue;
    const list = otByWorker.get(o.worker_id) ?? [];
    list.push(o);
    otByWorker.set(o.worker_id, list);
  }
  const rows: TodayRow[] = [];
  for (const worker of workers) {
    if (compareDates(date, worker.joining_date) < 0) continue;
    if (worker.left_date && compareDates(date, worker.left_date) > 0) continue;
    const settings = resolveSettings(worker, property);
    const dayClass = classifyDay(date, settings, dayOff);
    const list = byWorker.get(worker.id);
    const entry = list ? effectiveAttendance(list).get(date) ?? null : null;
    const shift = settings.shiftHours > 0 ? settings.shiftHours : 8;
    const ot = otByWorker.get(worker.id);
    rows.push({
      worker, settings, dayClass, entry,
      isOff: dayClass.kind === 'off' && dayClass.portion === 'full',
      overtime: ot ? latestByDate(ot).get(date) ?? null : null,
      autoOtHours: entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0,
    });
  }
  return rows;
}
```

- [ ] **Step 4: Implement `monthGrid.ts`, `moneyHistory.ts` and `forms.ts`**

**`monthGrid.ts`**
1. `DayCell` becomes `{ date; day; kind: DayKind; entry: AttendanceEntry | null; credit: number | null; dayOff: DayOff | null; halfOff: boolean; workedOnOff: boolean; otHours: number }`.
2. The `buildMonthGrid` input gains `daysOff?: DayOff[]; overtime?: OvertimeEntry[]`.
3. Before the loop, compute `const offByDate = effectiveDaysOff(i.daysOff ?? []); const otByDate = latestByDate(i.overtime ?? []);`.
4. In the loop, after the `outside`/`future` checks, replace the weekly-off branch with:

```ts
    const cls = classifyDay(date, i.settings, offByDate.get(date));
    else if (cls.kind === 'off' && cls.portion === 'full') kind = 'off';
    else kind = 'working';
```

   This is written as straight-line code: compute `cls` first, then assign `kind` with `if/else`.
5. Build the cell:

```ts
    const entry = byDate.get(date) ?? null;
    const isFullOff = kind === 'off';
    const autoOt = entry?.status === 'hours' && (entry.hours ?? 0) > shift ? (entry.hours ?? 0) - shift : 0;
    const explicitOt = otByDate.get(date);
    cells.push({
      date, day: d, kind,
      entry: kind === 'working' || isFullOff ? entry : null,
      credit: kind === 'working' ? baseCredit(cls, entry ?? undefined, shift) : null,
      dayOff: cls.kind === 'off' ? cls.dayOff : null,
      halfOff: cls.kind === 'off' && cls.portion === 'half',
      workedOnOff: isFullOff && !!entry && entry.status !== 'absent',
      otHours: kind === 'outside' || kind === 'future' ? 0 : explicitOt ? explicitOt.hours : autoOt,
    });
```

   Import `classifyDay, baseCredit` from `'../domain/dayClass'`, `effectiveDaysOff, latestByDate` from `'../domain/latest'`, and the `DayOff, OvertimeEntry` types. Remove the now-unused `dayCredit` import.

**`moneyHistory.ts`**
- `MoneyKind` becomes `'advance' | 'repayment' | 'writeoff' | 'payment' | 'bonus' | 'deduction'`;
- `HistoryItem.table` gains `'earning_adjustments'`;
- the signature is `buildMoneyHistory(advances, payments, adjustments: EarningAdjustment[] = [])`;
- `all` includes the adjustments, so the voided set covers them;
- `common` takes `AdvanceEntry | WagePayment | EarningAdjustment` and uses `mode: 'mode' in r ? r.mode : null`;
- append `...adjustments.map((a) => ({ ...common(a), table: 'earning_adjustments' as const, kind: a.type as MoneyKind }))` to `items`.

**`forms.ts`**
- `validateMoneyForm`: after the writeoff check add `if (v.kind === 'deduction' && !note) errors.note = 'money.noteRequiredDeduction';`.
- Add:

```ts
export const MULTIPLIERS = [1, 1.5, 2] as const;

/** Overtime hours: 0–16 with up to 2 decimals; anything else → null (invalid). */
export function parseOvertimeHours(s: string): number | null {
  const t = s.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return n >= 0 && n <= 16 ? n : null;
}

/** Optional rupee amount: '' → null (not set); valid → paise; invalid → undefined. */
export function parseOptionalAmount(s: string): number | null | undefined {
  if (!s.trim()) return null;
  const p = rupeesToPaise(s);
  return p === null ? undefined : p;
}

export type HolidayFormValues = { name: string; date: string; kind: DayOffKind; portion: DayOffPortion; payRule: DayOffPayRule; isActive: boolean };

export function holidayToFormValues(d: DayOff | null, today: string): HolidayFormValues {
  return d
    ? { name: d.name, date: d.date, kind: d.kind, portion: d.portion, payRule: d.pay_rule, isActive: d.is_active === 1 }
    : { name: '', date: today, kind: 'holiday', portion: 'full', payRule: 'by_basis', isActive: true };
}

export function validateHolidayForm(v: HolidayFormValues): Validation<HolidayFormValues> {
  const name = v.name.trim();
  return done(name ? {} : { name: 'daysOff.nameRequired' }, () => ({ ...v, name }));
}
```

- Property form:
  - `PropertyFormValues` gains `offdayMultiplier: number; otMode: OtMode; otMultiplier: number; otRate: string`;
  - `propertyToFormValues` fills them from the property, defaulting to `1, 'multiplier', 1, ''`. `otRate` is the rupee string of `ot_rate_paise` (use the existing `paiseToInput`) or `''`;
  - `validatePropertyForm` parses `const otRatePaise = v.otRate.trim() ? rupeesToPaise(v.otRate) : null;`, adds `if (v.otMode === 'fixed' && !(otRatePaise && otRatePaise > 0)) errors.otRate = 'extraPay.otRateRequired';`, and the value gains `offday_multiplier: v.offdayMultiplier, ot_mode: v.otMode, ot_multiplier: v.otMultiplier, ot_rate_paise: otRatePaise && otRatePaise > 0 ? otRatePaise : null`.
- Worker form:
  - `WorkerFormValues` gains `offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRate: string`;
  - `WorkerFormResult` gains `offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRatePaise: number | null`;
  - `validateWorkerForm` parses `otRate` the same way, errors with `extraPay.otRateRequired` when `v.otMode === 'fixed'` and there's no positive rate, and passes the four through;
  - `workerToFormValues` fills them from the worker (`?? null`, `otRate` from `ot_rate_paise`);
  - `toNewWorker` adds `offdayMultiplier: r.offdayMultiplier ?? undefined, otMode: r.otMode ?? undefined, otMultiplier: r.otMultiplier ?? undefined, otRatePaise: r.otRatePaise ?? undefined`;
  - `toWorkerPatch` adds `offday_multiplier: r.offdayMultiplier, ot_mode: r.otMode, ot_multiplier: r.otMultiplier, ot_rate_paise: r.otRatePaise`.
- Import `DayOff, DayOffKind, DayOffPortion, DayOffPayRule, OtMode` from the domain types.

- [ ] **Step 5: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS. If `WorkerFormScreen` or `PropertyFormScreen` now fail `tsc` because their initial-values literals lack the new fields, add `offdayMultiplier: null, otMode: null, otMultiplier: null, otRate: ''` (worker) to those literals. Task 11 builds the UI for them.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/view mobile-chukta/src/screens mobile-chukta/src/__tests__
git commit -m "feat(chukta): view models and forms for days off, overtime and adjustments"
```

---
### Task 9: Holidays list and holiday form

**Files:**
- Create: `mobile-chukta/src/screens/HolidaysScreen.tsx`, `mobile-chukta/src/screens/HolidayFormScreen.tsx`
- Modify: `src/app/routes.ts`, `src/app/navigation.tsx`, `src/screens/settings/PropertySection.tsx`, `src/ui/Icon.tsx`, `src/__tests__/helpers/session.tsx` (`ALL_ROUTES`)
- Test: `mobile-chukta/src/__tests__/holidays.test.tsx` (new)

**Interfaces:**
- Consumes:
  - from Task 6: `addDayOff`, `updateDayOff`, `listDaysOff`, `getDayOff`;
  - from Task 8: `HolidayFormValues`, `holidayToFormValues`, `validateHolidayForm`, `effectiveDayOffFor`.
- Produces:
  - routes `Holidays: undefined` and `HolidayForm: { dayOffId?: string } | undefined`;
  - `IconName` gains `'sunny-outline' | 'moon-outline' | 'add-outline' | 'gift-outline' | 'remove-circle-outline' | 'storefront-outline'` (all valid Ionicons names).

Behaviour (spec §6.1):
- The owner sees a "Holidays" row in Settings › Property. It opens a list split into **Upcoming** (date ≥ today) and **Past**, showing all of the property's days off: holidays and closures, active and removed.
- Each row shows the name, date, kind chip, "half day" if relevant, and a "Removed" chip when inactive.
- Tapping a row opens the form in edit mode.
- The form has name, a suggestion chip row (new holidays only; tapping one fills the name), date, a Full/Half segmented control, a pay-rule segmented control, and an Active switch (edit only).
- In edit mode the date is read-only. Moving a day off means removing it and adding a new one (spec A6).
- Staff never see the Holidays row.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/holidays.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { HolidayFormScreen } from '../screens/HolidayFormScreen';
import { HolidaysScreen } from '../screens/HolidaysScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { property } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

const rows = (s: Awaited<ReturnType<typeof makeSession>>) =>
  s.db.getAllAsync<{ name: string; date: string; portion: string; pay_rule: string; is_active: number }>(
    'select name, date, portion, pay_rule, is_active from days_off order by created_at');

test('owner adds a half-day unpaid holiday from a suggestion', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('HolidayForm', HolidayFormScreen, s);
  fireEvent.press(await screen.findByText('Durga Puja'));
  fireEvent.press(screen.getByTestId('portion-half'));
  fireEvent.press(screen.getByTestId('payRule-all_unpaid'));
  fireEvent.press(screen.getByTestId('holiday-save'));
  await waitFor(async () => expect(await rows(s)).toEqual([
    { name: 'Durga Puja', date: '2026-09-07', portion: 'half', pay_rule: 'all_unpaid', is_active: 1 },
  ]));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('empty name shows an error and writes nothing', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('HolidayForm', HolidayFormScreen, s);
  fireEvent.press(await screen.findByTestId('holiday-save'));
  expect(await screen.findByText('Enter a name.')).toBeTruthy();
  expect(await rows(s)).toEqual([]);
});

test('list splits upcoming and past and shows removed ones', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  const base = { property_id: 'p1', kind: 'holiday', portion: 'full', pay_rule: 'by_basis', created_by: 'u1', created_by_role: 'owner',
    created_at: '2026-09-01T00:00:00Z', server_updated_at: null };
  await upsertLocal(s.db, 'days_off', { ...base, id: 'd1', date: '2026-10-20', name: 'Durga Puja', is_active: 1 });
  await upsertLocal(s.db, 'days_off', { ...base, id: 'd2', date: '2026-09-01', name: 'Old', is_active: 0 });
  renderScreen('Holidays', HolidaysScreen, s);
  expect(await screen.findByText('Upcoming')).toBeTruthy();
  expect(screen.getByText('Durga Puja')).toBeTruthy();
  expect(screen.getByText('Past')).toBeTruthy();
  expect(screen.getByText('Removed')).toBeTruthy();
});

test('owner can remove a holiday from the edit form', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'days_off', { id: 'd1', property_id: 'p1', date: '2026-10-20', name: 'Durga Puja', kind: 'holiday', portion: 'full',
    pay_rule: 'by_basis', is_active: 1, created_by: 'u1', created_by_role: 'owner', created_at: 't', server_updated_at: null });
  renderScreen('HolidayForm', HolidayFormScreen, s, { dayOffId: 'd1' });
  fireEvent(await screen.findByTestId('holiday-active'), 'valueChange', false);
  fireEvent.press(screen.getByTestId('holiday-save'));
  await waitFor(async () => expect((await rows(s))[0].is_active).toBe(0));
});

test('staff do not see the Holidays row in Settings', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('Tabs', SettingsScreen, s);
  await screen.findByText('Main');
  expect(screen.queryByTestId('holidays')).toBeNull();
});
```

If `SwitchRow` doesn't forward `testID` to its `Switch`, add `testID?: string` to `SwitchRow` and pass it to the inner `<Switch testID={testID}>`. That's a one-line change in `src/ui/components.tsx`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/holidays.test.tsx`
Expected: FAIL, "Cannot find module '../screens/HolidayFormScreen'".

- [ ] **Step 3: Implement**

**Routes:**
- `routes.ts`: add `Holidays: undefined; HolidayForm: { dayOffId?: string } | undefined;` to `RootStackParamList`.
- `navigation.tsx`: add `<Stack.Screen name="Holidays" component={HolidaysScreen} />` and `<Stack.Screen name="HolidayForm" component={HolidayFormScreen} />` after `PropertyForm`.
- `helpers/session.tsx`: add `'Holidays', 'HolidayForm'` to `ALL_ROUTES`.

**Icons:** in `Icon.tsx`, extend `IconName` with `| 'sunny-outline' | 'moon-outline' | 'add-outline' | 'gift-outline' | 'remove-circle-outline' | 'storefront-outline'`.

**PropertySection:** in `PropertySection.tsx`, inside the owner fragment after the edit-property row:

```tsx
          {property ? (
            <Row
              title={t('settings.holidays')}
              left={<Icon name="sunny-outline" size={22} color={colors.primary} />}
              onPress={() => navigation.navigate('Holidays')}
              testID="holidays"
            />
          ) : null}
```

```tsx
// mobile-chukta/src/screens/HolidaysScreen.tsx
import { StyleSheet, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { DayOff, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listDaysOff } from '../repos/daysOff';
import { Button, EmptyState, Loading, Row, Screen, ScreenHeader, Section, StatusChip } from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { space } from '../ui/theme';
import { formatDate } from '../utils/format';

export function HolidaysScreen() {
  return <RequireProperty>{(p) => <HolidaysBody property={p} />}</RequireProperty>;
}

function HolidaysBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const today = sessionToday(session);
  const { data } = useLocalData((s) => listDaysOff(s.db, property.id), [property]);
  if (!data) return <Loading />;
  const upcoming = data.filter((d) => d.date >= today).reverse(); // soonest first
  const past = data.filter((d) => d.date < today);

  const item = (d: DayOff) => (
    <Row
      key={d.id}
      title={d.name}
      subtitle={[formatDate(d.date), d.portion === 'half' ? t('daysOff.half') : null].filter(Boolean).join(' · ')}
      right={
        <View style={styles.chips}>
          <StatusChip label={t(d.kind === 'closure' ? 'daysOff.closure' : 'daysOff.holiday')} tone={d.kind === 'closure' ? 'warning' : 'info'} />
          {d.is_active ? null : <StatusChip label={t('daysOff.removed')} tone="danger" />}
        </View>
      }
      onPress={() => navigation.navigate('HolidayForm', { dayOffId: d.id })}
      testID={`dayoff-${d.id}`}
    />
  );

  return (
    <Screen header={<ScreenHeader title={t('daysOff.title')} subtitle={property.name} showBack />}>
      <Button title={t('daysOff.add')} onPress={() => navigation.navigate('HolidayForm')} testID="add-holiday" />
      {data.length === 0 ? <EmptyState icon="sunny-outline" title={t('daysOff.title')} message={t('daysOff.empty')} /> : null}
      {upcoming.length ? <Section title={t('daysOff.upcoming')}>{upcoming.map(item)}</Section> : null}
      {past.length ? <Section title={t('daysOff.past')}>{past.map(item)}</Section> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { flexDirection: 'row', gap: space.xs } });
```

If `formatDate` doesn't exist in `src/utils/format.ts`, use the date formatter the Advances/WorkerDetail history rows already use (grep `formatDate\|displayDate` in `src/utils`). Don't add a second one.

```tsx
// mobile-chukta/src/screens/HolidayFormScreen.tsx
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useCurrentProperty, useSession } from '../app/session';
import type { DayOffPayRule, DayOffPortion } from '../domain/types';
import { useT } from '../i18n/useT';
import { addDayOff, getDayOff, updateDayOff } from '../repos/daysOff';
import { Button, ErrorText, Field, Label, Loading, Screen, ScreenHeader, Segmented, StatusChip, SwitchRow } from '../ui/components';
import { DateField } from '../ui/DateField';
import { space } from '../ui/theme';
import { holidayToFormValues, validateHolidayForm, type HolidayFormValues } from '../view/forms';

const SUGGESTIONS = ['durgaPuja', 'poilaBoishakh', 'eid', 'diwali', 'holi', 'republicDay', 'independenceDay', 'christmas'] as const;

export function HolidayFormScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'HolidayForm'>>();
  const dayOffId = params?.dayOffId;
  const { property } = useCurrentProperty();
  const today = sessionToday(session);
  const [values, setValues] = useState<HolidayFormValues | null>(dayOffId ? null : holidayToFormValues(null, today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!dayOffId) return;
    void getDayOff(session.db, dayOffId).then((d) => setValues(holidayToFormValues(d, today)));
  }, [dayOffId, session.db, today]);

  if (!values || !property) return <Loading />;
  const set = (patch: Partial<HolidayFormValues>) => setValues({ ...values, ...patch });

  async function save() {
    const r = validateHolidayForm(values!);
    if (!r.ok) { setErrors(r.errors); return; }
    setBusy(true);
    setSaveError(null);
    try {
      const v = r.value;
      if (dayOffId) {
        await updateDayOff(session.repo, dayOffId, { name: v.name, kind: v.kind, portion: v.portion, pay_rule: v.payRule, is_active: v.isActive ? 1 : 0 });
      } else {
        await addDayOff(session.repo, { propertyId: property!.id, date: v.date, name: v.name, kind: v.kind, portion: v.portion, payRule: v.payRule });
      }
    } catch {
      setSaveError('common.saveFailed');
      setBusy(false);
      return;
    }
    session.afterWrite();
    navigation.goBack();
  }

  return (
    <Screen header={<ScreenHeader title={t(dayOffId ? 'daysOff.edit' : 'daysOff.add')} showBack />}>
      <Field label={t('daysOff.name')} value={values.name} onChangeText={(name) => set({ name })}
        error={errors.name ? t(errors.name) : undefined} testID="holiday-name" />
      {dayOffId ? null : (
        <>
          <Label>{t('daysOff.suggestions')}</Label>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {SUGGESTIONS.map((k) => (
              <StatusChip key={k} label={t(`daysOff.suggest.${k}`)} tone="primary" onPress={() => set({ name: t(`daysOff.suggest.${k}`) })} />
            ))}
          </ScrollView>
        </>
      )}
      <DateField label={t('daysOff.date')} value={values.date} onChange={(date) => set({ date })} disabled={!!dayOffId} testID="holiday-date" />
      <Label>{t('daysOff.portion')}</Label>
      <Segmented<DayOffPortion>
        options={[{ value: 'full', label: t('daysOff.full') }, { value: 'half', label: t('daysOff.half') }]}
        value={values.portion} onChange={(portion) => set({ portion })} testIDPrefix="portion" />
      <Label>{t('daysOff.payRule')}</Label>
      <Segmented<DayOffPayRule>
        options={[
          { value: 'by_basis', label: t('daysOff.byBasis') },
          { value: 'all_paid', label: t('daysOff.allPaid') },
          { value: 'all_unpaid', label: t('daysOff.allUnpaid') },
        ]}
        value={values.payRule} onChange={(payRule) => set({ payRule })} testIDPrefix="payRule" />
      {dayOffId ? (
        <SwitchRow label={t('daysOff.active')} value={values.isActive} onChange={(isActive) => set({ isActive })} testID="holiday-active" />
      ) : null}
      {saveError ? <ErrorText>{t(saveError)}</ErrorText> : null}
      <Button title={t('common.save')} onPress={() => void save()} disabled={busy} testID="holiday-save" />
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { gap: space.xs, paddingVertical: space.xs } });
```

Prop-name checks before running the tests:
- If `StatusChip` has no `onPress`, wrap each chip in `<Pressable onPress=…>`.
- If `DateField` has no `disabled` prop, render the date as a `Row` with `title={values.date}` in edit mode instead.
- `common.save` and `common.saveFailed` must already exist (grep `en.json`). If `common.save` is missing, use the key the other form screens use for their save button.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): holidays list and holiday form for owners"
```

---

### Task 10: Today screen — shop closed, days off, overtime

**Files:**
- Modify: `mobile-chukta/src/screens/TodayScreen.tsx`
- Test: `mobile-chukta/src/__tests__/today.test.tsx` (append; existing tests must stay green)

**Interfaces:**
- Consumes:
  - from Task 8: `buildTodayRows(..., daysOff, overtime)`, `TodayRow.dayClass/overtime/autoOtHours`, `effectiveDayOffFor`, `parseOvertimeHours`, `parseOptionalAmount`;
  - from Task 6: `addDayOff`, `listDaysOff`, `addOvertime`, `listOvertimeForDate`, `markAttendance({ customAmountPaise })`.

Behaviour (spec §6.2):
1. **"Shop closed today" button** (owner and staff). It shows only when no active day off exists on `date`. It opens an inline card with reason chips (Bandh, Rain, Power cut; tapping one fills the reason), a reason field, Full/Half, and "Mark closed". That calls `addDayOff({ kind: 'closure', payRule: 'by_basis', name: reason, portion })`.
2. **Day-off banner.** When an active day off exists, show a card with its name, kind, and "half day" when relevant.
3. **Rows on a full day off** (`row.isOff`), which covers weekly off, holiday and closure:
   - the subtitle is the weekly-off text, or the day-off name;
   - the segmented control shows **Worked / Worked half / Not worked**, mapping to `present` / `half_day` / `absent`. Hours-mode workers still get the Worked / Not worked pair plus the hours field;
   - no entry counts as Not worked;
   - for owners, a "Custom amount (₹, optional)" field is saved with Worked or Worked half (spec A4);
   - bulk select is still disabled on off rows.
4. **Rows on a half day off:** normal controls, plus a "half day" subtitle.
5. **"+ Overtime" link on every row that isn't a full day off.**
   - It expands an hours field and a Save button. Owners also get a custom amount field.
   - Save calls `addOvertime` with the parsed hours (0 clears).
   - Invalid input shows `today.overtimeInvalid`.
   - When there is overtime (explicit entry, or `autoOtHours > 0` with no explicit entry), the row's chip area shows `today.overtimeValue` and, for by-hours rows, `today.inclOvertime`.
6. **Dedupe:** `mark()` treats "no entry" as `absent` on full days off and `present` otherwise. The skip of `row.isOff` applies only to bulk marking.

- [ ] **Step 1: Write the failing tests**

Append to `today.test.tsx`. The session date is 2026-09-07, a Monday; the fixture property's weekly off is Sunday.

```tsx
const dayOffRow = (over: object = {}) => ({ id: 'd1', property_id: 'p1', date: '2026-09-07', name: 'Bandh', kind: 'closure', portion: 'full',
  pay_rule: 'by_basis', is_active: 1, created_by: 'u2', created_by_role: 'staff', created_at: '2026-09-07T08:00:00Z', server_updated_at: null, ...over });

test('staff marks the shop closed with a reason chip', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('closure-open'));
  fireEvent.press(screen.getByText('Rain'));
  fireEvent.press(screen.getByTestId('closure-save'));
  await waitFor(async () => expect(await s.db.getAllAsync('select name, kind, portion, created_by_role from days_off'))
    .toEqual([{ name: 'Rain', kind: 'closure', portion: 'full', created_by_role: 'staff' }]));
});

test('on a closed day rows show the banner and Worked / Not worked; no entry means not worked', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'days_off', dayOffRow());
  renderScreen('Tabs', TodayScreen, s);
  expect(await screen.findByTestId('dayoff-banner')).toBeTruthy();
  expect(screen.queryByTestId('closure-open')).toBeNull();
  fireEvent.press(screen.getByTestId('status-w1-absent')); // "Not worked" = already the state → no write
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  expect(await rowsFor(s, 'w1')).toEqual([]);
  fireEvent.press(screen.getByTestId('status-w1-present')); // "Worked"
  await waitFor(async () => expect((await rowsFor(s, 'w1')).map((r) => r.status)).toEqual(['present']));
  expect(screen.getAllByText('Worked').length).toBeGreaterThan(0);
});

test('overtime: staff saves 2 hours; invalid input shows an error; owner-only custom amount is hidden for staff', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('ot-open-w1'));
  expect(screen.queryByTestId('ot-amount-w1')).toBeNull();
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '20');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  expect(await screen.findByText('Enter 0 to 16 hours.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('ot-hours-w1'), '2');
  fireEvent.press(screen.getByTestId('ot-save-w1'));
  await waitFor(async () => expect(await s.db.getAllAsync('select hours, custom_amount_paise from overtime_entries'))
    .toEqual([{ hours: 2, custom_amount_paise: null }]));
  expect(await screen.findByText('OT 2 h')).toBeTruthy();
});

test('owner can record work on a day off with a custom amount', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'days_off', dayOffRow({ created_by_role: 'owner', created_by: 'u1' }));
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.changeText(await screen.findByTestId('offday-amount-w1'), '800');
  fireEvent.press(screen.getByTestId('status-w1-present'));
  await waitFor(async () => expect(await s.db.getAllAsync('select status, custom_amount_paise from attendance_entries'))
    .toEqual([{ status: 'present', custom_amount_paise: 80000 }]));
});
```

Add `OWNER` to the helpers import.

Update the existing weekly-off test: off rows now have controls. Replace its last assertion with `expect(screen.getByTestId('status-w3-absent')).toBeTruthy(); expect(screen.queryByTestId('ot-open-w3')).toBeNull();`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/today.test.tsx`
Expected: FAIL. `closure-open` isn't found.

- [ ] **Step 3: Implement in `TodayScreen.tsx`**

**3a. Data:** load the extra lists, and keep the day off for the banner.

```tsx
  const { data } = useLocalData(async (s) => {
    const daysOff = await listDaysOff(s.db, property.id);
    const rows = buildTodayRows(await listWorkers(s.db, property.id, true), property,
      await listAttendanceForDate(s.db, property.id, date), date, daysOff, await listOvertimeForDate(s.db, property.id, date));
    return { rows, dayOff: effectiveDayOffFor(daysOff, date) };
  }, [property, date]);
  const rows = data?.rows;
```

Replace `if (!rows) return <Loading />;` with `if (!data || !rows) return <Loading />;`.

**3b. `mark()`:**
- the signature becomes `mark(workerIds, status, hours?, customAmountPaise?: number | null, bulk = false)`;
- the skip becomes `if (!row || (bulk && row.isOff)) continue;`;
- `same` becomes `cur ? cur.status === status && (status !== 'hours' || cur.hours === hours) && (cur.custom_amount_paise ?? null) === (customAmountPaise ?? null) : status === (row.isOff ? 'absent' : 'present')`;
- pass `customAmountPaise` to `markAttendance`;
- the bulk Segmented calls `mark([...selected], st, undefined, null, true)`.

**3c. Overtime save:**

```tsx
  async function saveOvertime(workerId: string, hours: number, customAmountPaise: number | null) {
    await addOvertime(session.repo, { propertyId: property.id, workerId, date, hours, customAmountPaise });
    session.afterWrite();
  }
```

**3d. Closure card, above the hint text:**

```tsx
      {data.dayOff ? (
        <Card testID="dayoff-banner" style={styles.selectionCard}>
          <StatusChip label={t(data.dayOff.kind === 'closure' ? 'daysOff.closure' : 'daysOff.holiday')}
            tone={data.dayOff.kind === 'closure' ? 'warning' : 'info'} />
          <Muted>{data.dayOff.portion === 'half' ? t('today.dayOffHalf', { name: data.dayOff.name }) : data.dayOff.name}</Muted>
        </Card>
      ) : (
        <ClosureCard onSave={async (name, portion) => {
          await addDayOff(session.repo, { propertyId: property.id, date, name, kind: 'closure', portion, payRule: 'by_basis' });
          session.afterWrite();
        }} />
      )}
```

**3e. `ClosureCard`, a new component in the same file:**

```tsx
function ClosureCard({ onSave }: { onSave: (name: string, portion: DayOffPortion) => Promise<void> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [portion, setPortion] = useState<DayOffPortion>('full');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) return <Button kind="secondary" title={t('closure.button')} onPress={() => setOpen(true)} testID="closure-open" />;
  const save = async () => {
    const name = reason.trim();
    setError(!name);
    if (!name || busy) return;
    setBusy(true);
    try { await onSave(name, portion); setOpen(false); setReason(''); } finally { setBusy(false); }
  };
  return (
    <Card style={styles.selectionCard}>
      <Label>{t('closure.title')}</Label>
      <View style={styles.chipRow}>
        {(['bandh', 'rain', 'powerCut'] as const).map((k) => (
          <StatusChip key={k} label={t(`closure.${k}`)} tone="primary" onPress={() => setReason(t(`closure.${k}`))} />
        ))}
      </View>
      <Field label={t('closure.reason')} value={reason} onChangeText={setReason}
        error={error ? t('closure.reasonRequired') : undefined} testID="closure-reason" />
      <Segmented<DayOffPortion> options={[{ value: 'full', label: t('daysOff.full') }, { value: 'half', label: t('daysOff.half') }]}
        value={portion} onChange={setPortion} testIDPrefix="closure-portion" />
      <Button title={t('closure.confirm')} onPress={() => void save()} disabled={busy} testID="closure-save" />
    </Card>
  );
}
```

Pressing a chip sets the reason text, and Save writes it. In the staff test, pressing "Rain" then Save writes `name: 'Rain'`. Use the same `StatusChip` `onPress` fallback as Task 9 (wrap it in `Pressable`) if needed. Add `chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }` to `styles`.

**3f. `AttendanceRow` changes:**
- New props: `isOwner: boolean`, `onOvertime: (hours: number, customAmountPaise: number | null) => Promise<void>`, and `onMark: (status, hours?, customAmountPaise?) => void`.
- Pass `isOwner={session.identity.kind === 'owner'}` and `onOvertime={(h, c) => saveOvertime(row.worker.id, h, c)}` from the list.
- Status labels and current value:

```tsx
  const offLabels: Record<AttendanceStatus, string> = { present: 'today.worked', half_day: 'today.workedHalf', absent: 'today.notWorked', hours: 'today.hours' };
  const labelKey = (st: AttendanceStatus) => (row.isOff ? offLabels[st] : STATUS_KEY[st]);
  const current: AttendanceStatus | null = row.entry ? row.entry.status : row.isOff ? 'absent' : 'present';
  const dayOff = row.dayClass.kind === 'off' && row.dayClass.dayOff ? row.dayClass.dayOff : null;
  const subtitle = row.isOff
    ? dayOff ? dayOff.name : t('today.weeklyOff')
    : row.entry?.status === 'hours'
      ? t('today.hoursValue', { hours: row.entry.hours })
      : dayOff ? t('today.dayOffHalf', { name: dayOff.name }) : undefined;
  const otHours = row.overtime ? row.overtime.hours : row.autoOtHours;
```

- `statusTone`/`statusLabel` use `labelKey(current)`.
- Always render the `StatusChip`. When `otHours > 0`, add a second chip with tone `info`. Its label is `t('today.overtimeValue', { hours: row.overtime.hours })` for an explicit entry. For automatic overflow from a by-hours entry (no explicit entry), it is `t('today.inclOvertime', { hours: row.autoOtHours })` (spec §6: "incl. Nh OT").
- Keep the long-press toggle disabled for `row.isOff`.
- Always render the controls; `Segmented` options use `labelKey`.
- When `row.isOff && isOwner`, render the custom amount field above the segmented control. Its status change calls `onMark(st, undefined, amount)`, where `amount = parseOptionalAmount(offdayAmount)`. If that's `undefined` (invalid), show `today.customAmountInvalid` and don't call. Otherwise every Segmented change calls `onMark(st)`.

```tsx
      {row.isOff && isOwner ? (
        <Field label={t('today.customAmount')} value={offdayAmount} onChangeText={setOffdayAmount} keyboardType="decimal-pad"
          error={amountError ? t('today.customAmountInvalid') : undefined} testID={`offday-amount-${id}`} />
      ) : null}
```

  Initialise `offdayAmount` from `row.entry?.custom_amount_paise` (rupee string via the existing `paiseToInput`, or `''`).

- After the hours block, for `!row.isOff`:

```tsx
      {row.isOff ? null : otOpen ? (
        <View style={styles.hoursRow}>
          <Field label={t('today.overtimeHours')} value={otText} onChangeText={setOtText} keyboardType="decimal-pad"
            error={otError ? t('today.overtimeInvalid') : undefined} testID={`ot-hours-${id}`} />
          {isOwner ? (
            <Field label={t('today.customAmount')} value={otAmount} onChangeText={setOtAmount} keyboardType="decimal-pad"
              testID={`ot-amount-${id}`} />
          ) : null}
          <Button kind="secondary" title={t('common.save')} testID={`ot-save-${id}`} onPress={() => {
            const h = parseOvertimeHours(otText);
            const amount = isOwner ? parseOptionalAmount(otAmount) : null;
            setOtError(h === null || amount === undefined);
            if (h !== null && amount !== undefined) void onOvertime(h, amount).then(() => setOtOpen(false));
          }} />
        </View>
      ) : (
        <Button kind="ghost" title={t('today.overtime')} onPress={() => setOtOpen(true)} testID={`ot-open-${id}`} />
      )}
```

  The local state is `otOpen`, `otText` (initial `row.overtime ? String(row.overtime.hours) : ''`), `otAmount`, `otError`, `offdayAmount` and `amountError`. If `Button` has no `'ghost'` kind, use `'secondary'`.

- Delete the local `parseHours` only if nothing else uses it. The hours field still uses it, so keep it.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): Today — shop closed, day-off banner, work on a day off, overtime"
```

---

### Task 11: Extra-pay settings on property and worker forms

**Files:**
- Create: `mobile-chukta/src/ui/ExtraPayFields.tsx`
- Modify: `mobile-chukta/src/screens/PropertyFormScreen.tsx`, `src/screens/WorkerFormScreen.tsx`
- Test: `mobile-chukta/src/__tests__/properties.test.tsx`, `src/__tests__/workers.test.tsx` (append)

**Interfaces:**
- Consumes:
  - from Task 8: `PropertyFormValues.offdayMultiplier/otMode/otMultiplier/otRate`, `WorkerFormValues` (the same four, nullable) and `MULTIPLIERS`;
  - from Tasks 5–6: `PropertySettingsPatch`/`WorkerPatch` with the new columns.
- Produces: `ExtraPayFields` component.

  ```ts
  props: {
    value: { offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRate: string };
    onChange: (patch: Partial<…same…>) => void;
    allowInherit: boolean;  // worker form: a "Property setting" option meaning null
    errors: Record<string, string>;
    testIDPrefix: string;
  }
  ```

Behaviour (spec §6.3):
- **PropertyForm** gets an "Extra pay" section:
  - "Work on a day off pays": 1× / 1.5× / 2×;
  - "Overtime pay": "× hourly pay" / "Fixed ₹ per hour";
  - in multiplier mode, an "Overtime rate" control with 1× / 1.5× / 2×;
  - in fixed mode, a "₹ per overtime hour" field.
- **WorkerForm** places the same section inside the existing "Customize for this worker" block. Each segmented control gets an extra first option, "Property setting", which maps to null. The fixed-rate field shows only when the worker's own `otMode` is `'fixed'`.

- [ ] **Step 1: Write the failing tests**

Append to `properties.test.tsx` (it has `seeded`/`OWNER` helpers for the property form; reuse whichever helper that file already uses to render `PropertyFormScreen` with `{ propertyId: 'p1' }`):

```tsx
test('owner sets fixed overtime ₹60/h and 2× day-off pay', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('PropertyForm', PropertyFormScreen, s, { propertyId: 'p1' });
  fireEvent.press(await screen.findByTestId('prop-extra-offday-2'));
  fireEvent.press(screen.getByTestId('prop-extra-otMode-fixed'));
  fireEvent.press(screen.getByTestId('property-save'));
  expect(await screen.findByText('Enter the ₹ per hour.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('prop-extra-otRate'), '60');
  fireEvent.press(screen.getByTestId('property-save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select offday_multiplier, ot_mode, ot_rate_paise from properties'))
    .toEqual({ offday_multiplier: 2, ot_mode: 'fixed', ot_rate_paise: 6000 }));
});
```

Use the save button `testID` that `PropertyFormScreen` already has; grep `testID=` in that file and substitute it for `property-save` if it differs.

Append to `workers.test.tsx` (open the worker form the same way the existing "Customize for this worker" test does, and use its toggle `testID`):

```tsx
test('worker override: 1.5× overtime, other extra-pay settings follow the property', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('customize-toggle'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('worker-extra-otMode-multiplier'));
  fireEvent.press(screen.getByTestId('worker-extra-otMultiplier-1.5'));
  fireEvent.press(screen.getByTestId('worker-save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select offday_multiplier, ot_mode, ot_multiplier, ot_rate_paise from workers'))
    .toEqual({ offday_multiplier: null, ot_mode: 'multiplier', ot_multiplier: 1.5, ot_rate_paise: null }));
});
```

Substitute the real customize-toggle and save `testID`s from `WorkerFormScreen.tsx`.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/properties.test.tsx src/__tests__/workers.test.tsx`
Expected: FAIL. `prop-extra-offday-2` isn't found.

- [ ] **Step 3: Implement**

```tsx
// mobile-chukta/src/ui/ExtraPayFields.tsx
import type { OtMode } from '../domain/types';
import { useT } from '../i18n/useT';
import { MULTIPLIERS } from '../view/forms';
import { Field, Label, Section, Segmented } from './components';

export type ExtraPayValue = { offdayMultiplier: number | null; otMode: OtMode | null; otMultiplier: number | null; otRate: string };

const INHERIT = 'inherit' as const;
type Opt<T> = T | typeof INHERIT;

/** "Extra pay" settings. With `allowInherit`, a "Property setting" option stores null (worker form). */
export function ExtraPayFields({ value, onChange, allowInherit, errors, testIDPrefix }: {
  value: ExtraPayValue; onChange: (patch: Partial<ExtraPayValue>) => void; allowInherit: boolean;
  errors: Record<string, string>; testIDPrefix: string;
}) {
  const t = useT();
  const inherit = allowInherit ? [{ value: INHERIT, label: t('extraPay.useProperty') }] : [];
  const mult = [...inherit, ...MULTIPLIERS.map((m) => ({ value: m, label: `${m}×` }))] as { value: Opt<number>; label: string }[];
  const fromOpt = <T,>(v: Opt<T>): T | null => (v === INHERIT ? null : v);
  const toOpt = <T,>(v: T | null): Opt<T> => (v === null ? INHERIT : v);
  return (
    <Section title={t('extraPay.title')}>
      <Label>{t('extraPay.offdayMultiplier')}</Label>
      <Segmented<Opt<number>> options={mult} value={toOpt(value.offdayMultiplier)}
        onChange={(v) => onChange({ offdayMultiplier: fromOpt(v) })} testIDPrefix={`${testIDPrefix}-offday`} />
      <Label>{t('extraPay.otMode')}</Label>
      <Segmented<Opt<OtMode>>
        options={[...inherit, { value: 'multiplier', label: t('extraPay.multiplierMode') }, { value: 'fixed', label: t('extraPay.fixedMode') }] as { value: Opt<OtMode>; label: string }[]}
        value={toOpt(value.otMode)} onChange={(v) => onChange({ otMode: fromOpt(v) })} testIDPrefix={`${testIDPrefix}-otMode`} />
      {value.otMode === 'fixed' ? (
        <Field label={t('extraPay.otRate')} value={value.otRate} onChangeText={(otRate) => onChange({ otRate })} keyboardType="decimal-pad"
          error={errors.otRate ? t(errors.otRate) : undefined} testID={`${testIDPrefix}-otRate`} />
      ) : (
        <>
          <Label>{t('extraPay.otMultiplier')}</Label>
          <Segmented<Opt<number>> options={mult} value={toOpt(value.otMultiplier)}
            onChange={(v) => onChange({ otMultiplier: fromOpt(v) })} testIDPrefix={`${testIDPrefix}-otMultiplier`} />
        </>
      )}
    </Section>
  );
}
```

**`PropertyFormScreen.tsx`:** after the settings fields and before the save button, add:

```tsx
      <ExtraPayFields value={values} allowInherit={false} errors={errors} testIDPrefix="prop-extra"
        onChange={(patch) => setValues({ ...values, ...(patch as Partial<PropertyFormValues>) })} />
```

Property values are never null. With `allowInherit={false}` no null option exists, so the cast is safe. The existing save path already passes `validatePropertyForm(...).value` to `updatePropertySettings`/`createProperty`, so the new snake_case fields flow through. Confirm `createProperty` accepts them. If it builds the row from named inputs, add the four fields to its input and row; Task 2 set the defaults.

**`WorkerFormScreen.tsx`:** inside the "Customize for this worker" block, after the existing override fields, add:

```tsx
          <ExtraPayFields value={values} allowInherit errors={errors} testIDPrefix="worker-extra"
            onChange={(patch) => setValues({ ...values, ...patch })} />
```

When the customize toggle is switched **off**, the existing handler resets the overrides. Also reset `offdayMultiplier: null, otMode: null, otMultiplier: null, otRate: ''`.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): extra-pay settings on property and worker forms"
```

---

### Task 12: Worker detail — bonus, deduction, calendar marks, ledger lines

**Files:**
- Modify:
  - `mobile-chukta/src/screens/WorkerDetailScreen.tsx`
  - `src/screens/MoneyEntryScreen.tsx`
  - `src/ui/MonthCalendar.tsx` (or wherever the calendar cells render; grep `MonthCalendar`)
  - `src/view/workerDetail.ts` (if the detail data loader lives there; grep `buildMonthGrid(` to find the caller)
- Test: `mobile-chukta/src/__tests__/money.test.tsx` (append)

**Interfaces:**
- Consumes:
  - from Task 6: `addAdjustment`, `voidAdjustment`, `listAdjustments`, `listDaysOff`, `listOvertime`;
  - from Task 8: `buildMoneyHistory(..., adjustments)`, `MoneyKind` with `'bonus' | 'deduction'`, and `DayCell.dayOff/halfOff/workedOnOff/otHours`;
  - from Task 4: `LedgerResult.bonusPaise/deductionPaise/overtimePaise/offdayExtraPaise`.

Behaviour (spec §6.4):
- **Owners** see two more action buttons: **Bonus** and **Deduction**. They open `MoneyEntry` with `kind: 'bonus' | 'deduction'`, which has no payment-mode control. A deduction needs a reason (the note).
- Money history lists bonuses and deductions. Owners can correct them, which calls `voidAdjustment`.
- The explanation list shows the new lines automatically, because they come from the ledger.
- In the calendar:
  - a holiday or closure day shows a sun icon (`sunny-outline`), or a half tint for a half day off;
  - work on a day off shows a small "+" badge;
  - overtime days show a small "OT" badge.
- **Staff** see none of the bonus/deduction buttons.

- [ ] **Step 1: Write the failing test**

Append to `money.test.tsx` (reuse its `seeded()` helper and `OWNER`/`STAFF` sessions):

```tsx
test('owner adds a deduction (reason required) and corrects a bonus', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'deduction' });
  expect(screen.queryByTestId('mode-cash')).toBeNull();
  fireEvent.changeText(await screen.findByTestId('money-amount'), '200');
  fireEvent.press(screen.getByTestId('money-save'));
  expect(await screen.findByText('A reason is required for a deduction.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('money-note'), 'Broken glass');
  fireEvent.press(screen.getByTestId('money-save'));
  await waitFor(async () => expect(await s.db.getAllAsync('select type, amount_paise, note from earning_adjustments'))
    .toEqual([{ type: 'deduction', amount_paise: 20000, note: 'Broken glass' }]));
});

test('worker detail: owner sees Bonus/Deduction and the ledger includes the bonus; staff do not see them', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'earning_adjustments', { id: 'b1', property_id: 'p1', worker_id: 'w1', type: 'bonus', amount_paise: 50000,
    date: '2026-09-05', note: null, voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null });
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('add-bonus')).toBeTruthy();
  expect(screen.getByText('Bonus: ₹500')).toBeTruthy();
  expect(screen.getByTestId('correct-b1')).toBeTruthy();

  const st = await makeSession(STAFF);
  await upsertLocal(st.db, 'properties', property());
  await upsertLocal(st.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  renderScreen('WorkerDetail', WorkerDetailScreen, st, { workerId: 'w1' });
  await screen.findAllByText('Ram');
  expect(screen.queryByTestId('add-bonus')).toBeNull();
});
```

Use the real `testID`s from `MoneyEntryScreen.tsx` for the amount, note, save and mode controls (grep `testID=`), substituting them for `money-amount`, `money-note`, `money-save` and `mode-cash` if they differ. If the second test renders two screens in one test and that clashes in RNTL, split it into two tests.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/money.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

**`MoneyEntryScreen.tsx`:**
- `const isAdjustment = params.kind === 'bonus' || params.kind === 'deduction';`.
- The initial `mode` becomes `isWriteoff || isAdjustment ? null : 'cash'`.
- Hide the mode `Segmented` when `isAdjustment`.
- `tracksAdvance` is unchanged.
- In `save()`, before the payment branch:

```tsx
      if (isAdjustment) await addAdjustment(session.repo, { propertyId: worker.property_id, workerId: worker.id,
        type: params.kind as 'bonus' | 'deduction', amountPaise: r.value.amountPaise, date: r.value.date, note: r.value.note ?? undefined });
      else if (params.kind === 'payment') await addPayment(session.repo, base);
      else await addAdvance(session.repo, { ...base, type: params.kind });
```

  Narrow the last branch's type with `params.kind as 'advance' | 'repayment' | 'writeoff'`.
- `validateMoneyForm` already requires a mode only when `mode` is non-null for payments. If it errors on a null mode for unknown kinds, make its mode check apply only to `advance | repayment | payment`.

**`WorkerDetailScreen.tsx`:**
- Load `listAdjustments(db, workerId)` alongside the advances and payments, and pass the result to `buildMoneyHistory`.
- The ledger comes from `getWorkerLedger`, which Task 6 already wired.
- Also load `listDaysOff(db, property.id)` and `listOvertime(db, workerId)` and pass them to `buildMonthGrid({ ..., daysOff, overtime })`.
- The action list becomes `[...(['advance','repayment','writeoff','payment'] as const), ...(isOwner ? (['bonus','deduction'] as const) : [])]`.
- In `correct()`, the branch becomes:

```tsx
          if (item.table === 'advance_entries') await voidAdvance(session.repo, item.id);
          else if (item.table === 'earning_adjustments') await voidAdjustment(session.repo, item.id);
          else await voidPayment(session.repo, item.id);
```

- History item titles use `t(\`entryType.${item.kind}\`)`, which already covers the two new kinds. Deductions show the amount with a leading "−", using the same style the repayment/writeoff rows use for negative amounts.

**Calendar cell (`MonthCalendar`):**
- When `cell.dayOff && cell.kind === 'off'`, render `<Icon name="sunny-outline" size={12} />` under the day number instead of the weekly-off style.
- When `cell.halfOff`, apply the existing off background at 50% opacity (`opacity: 0.5` overlay or a lighter token).
- When `cell.workedOnOff`, show a small `+` text badge.
- When `cell.otHours > 0`, show a small `OT` text badge.
- Badges: `fontSize: 9`, `colors.primary`, absolutely positioned top-right. Follow the file's existing style object.

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): bonus and deduction entries, calendar marks for days off and overtime"
```

---

### Task 13: Deploy and end-to-end check

**Files:**
- Create: `docs/superpowers/notes/2026-10-03-chukta-phase2a-deploy.md`

Claude Code cannot run `supabase db push`, so the **user** runs Step 1.

- [ ] **Step 1: Write the deploy note and hand it to the user**

```markdown
# Chukta Phase 2A — deploy

1. `supabase db push` — applies `20261004100000_chukta_phase2a.sql`.
2. Run pgTAP: `supabase test db` (or the scratch tapwrap flow; un-wrap bare `select` lines that call void-returning helpers).
   Expect `chukta_phase2a.test.sql` 18/18 plus all earlier suites green.
3. Rebuild the app: `cd mobile-chukta && npx expo run:android` (local `.env` must exist) or an EAS build.
4. Two-phone check (owner phone + staff phone, same property):
   - Owner: Settings › Holidays › add "Durga Puja" for today, full, by pay type. Staff phone pulls it; Today shows the banner.
   - Staff: on a normal day tap "Shop closed today" › Rain › Mark closed. Owner phone pulls it.
   - Staff: mark one worker "Worked" on the holiday. Owner: set a custom ₹ amount for another worker's day-off work.
   - Staff: "+ Overtime" 2 h on a working day. Owner: worker detail shows "2 overtime hours: ₹…".
   - Owner: Bonus ₹500, Deduction ₹200 with reason; correct the bonus. Earned updates; staff phone cannot see Bonus/Deduction buttons.
   - Owner: Property › Extra pay › Fixed ₹60/h; one worker overrides to 1.5×. Ledger lines match.
   - Airplane mode on the staff phone, mark overtime, reconnect — the row syncs, no sync issues.
5. Languages: switch to বাংলা and हिन्दी; check the Today banner, Holidays screen and explanation lines.
```

- [ ] **Step 2: Verify locally**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: all suites PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/notes/2026-10-03-chukta-phase2a-deploy.md
git commit -m "docs: Chukta Phase 2A deploy and check steps"
```

- [ ] **Step 4: Ask the user to run the deploy note's steps 1–2 and report the pgTAP output, then do the two-phone check together.**
