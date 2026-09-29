# Chukta Phase 1A — Backend and Headless App Core — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build everything in Chukta Phase 1 below the UI, fully tested:
- the `chukta` schema with RLS and staff token claims;
- the staff-management and staff-login edge functions;
- the `mobile-chukta` Expo app skeleton with i18n, a local SQLite store, repositories, the wage calculation, push/pull sync and the auth service.

Plan 1B (screens, web signup, admin) builds on this.

**Architecture:**
- **Postgres:** schema `chukta`, where every row is scoped to a property. RLS reads the Phase 0 JWT claims (`app`, `shop_id`); the extended hook adds `app_role='staff'` and `property_id` for staff users.
- **Edge functions:** thin Deno handlers with dependencies injected, so each is unit-tested.
- **Mobile core:** plain TypeScript modules over a small `SqlDb` interface. `expo-sqlite` backs it in the app; `better-sqlite3` backs it in Jest.
- **Sync:** writes go to SQLite first and join a queue that is pushed in order; pull uses a `(server_updated_at, id)` cursor per table.

**Tech Stack:**
- Supabase Postgres 17 + pgTAP; Supabase Edge Functions (Deno 2, `@supabase/supabase-js@2.47.10` via esm.sh).
- Expo SDK 54 / React Native 0.81 / TypeScript; `expo-sqlite`, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `@react-native-community/netinfo`, `expo-crypto`, `i18next`, `react-i18next`, `expo-localization`.
- Jest (`jest-expo` preset) + `better-sqlite3` for tests.

**Spec:** `docs/superpowers/specs/2026-09-29-chukta-phase1-design.md`. It builds on `docs/superpowers/specs/2026-09-28-chukta-shared-supabase-design.md` (Phase 0).

## Global Constraints

- **Supabase:** project ref `mhtqufyaxpunhenqropn`, Postgres 17.
  - Migrations are timestamped in `supabase/migrations/` and named `YYYYMMDDHHMMSS_chukta_*.sql`.
  - Claude Code cannot run `supabase db push` or `supabase functions deploy`; the user runs them in Task 14.
  - pgTAP files are run against the live DB through the scratch wrapper described in Task 14 (the CLI's `test db` needs Docker, which isn't installed).
- **App names:** exactly `'shopai'` and `'chukta'`. Phase 0 claims are `app` and `shop_id`. Chukta adds `app_role` (`'staff'`; absent means owner) and `property_id` (uuid text, staff only).
- **Money:** integer paise (`bigint` in Postgres, `number` holding an integer in TS). Round half-up once, at the final amount.
- **Nothing is hard-deleted:** no DELETE grants on `chukta`. Only `properties` and `workers` are updatable. `attendance_entries` rows are only ever added; the effective row per `(worker_id, date)` is the greatest `(created_at, id)`. Money corrections are made by a row whose `voids_id` points at the target. Sums exclude void rows **and** rows that have been voided.
- **Values:**
  - `pay_basis` ∈ `hourly|daily|weekly|monthly`;
  - `attendance_mode` ∈ `day|hours` (hourly pay forces `hours`);
  - `monthly_divisor` ∈ `calendar|26|30`;
  - `weekly_off` 0 = Sunday … 6 = Saturday, null = none;
  - property defaults: `default_pay_basis='daily'`, `default_attendance_mode='day'`, `shift_hours=8`, `weekly_off=0`, `monthly_divisor='calendar'`.
- **Staff:**
  - PIN is 4–6 digits, unique among the **shop's** active staff (all properties); reactivation requires a new PIN, stored only as PBKDF2-SHA256 (100,000 iterations, 16-byte salt).
  - The hidden auth email is `st-<staff_id>@<AUTH_EMAIL_DOMAIN>` (default `accounts.pragatibandhu.internal`).
  - per-shop throttle: 10 attempts / 15 min, then escalating lock 15 min × 2^(n−1) (max 16 h), cleared on success (`chukta.reserve_pin_attempt` / `chukta.clear_pin_attempts`).
  - Staff login input: the owner's phone (E.164) plus the PIN.
- **Staff login errors** (`body.error`): `wrong_pin` (401), `too_many_attempts` (429), `ambiguous_pin` (409).
- **Owner login:** the Phase 0 `login` function with `app: 'chukta'`, with errors `Invalid phone number or password` (401), `password_reset_required` (401), `not_subscribed` (403).
- **Mobile app:**
  - folder `mobile-chukta/`, package `com.pragatibandhu.chukta`, display name `Chukta`;
  - **no imports from `mobile-shopai/`**;
  - languages `en`, `bn`, `hi`, with every key present in all three;
  - dates are `YYYY-MM-DD` strings built from local calendar parts, never through `toISOString()` (IST off-by-one).
- **Tests:**
  - Deno: `deno test --no-check --allow-env <dir>` plus `deno check <files>`;
  - mobile: `cd mobile-chukta && npx jest <path>` and `npx tsc --noEmit`.
- Never commit secrets, `deno.lock`, `node_modules`, `.env*`, `android/` or `ios/`.

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260930100000_chukta_schema.sql` | Schema, tables, constraints, triggers |
| `supabase/migrations/20260930100100_chukta_access.sql` | RLS helpers and policies, grants, hook extension, `reserve_pin_attempt`/`clear_pin_attempts` |
| `supabase/tests/database/chukta_schema.test.sql`, `chukta_access.test.sql` | pgTAP |
| `supabase/functions/_shared/pin.ts` (+test) | PIN validation/hash/verify, random password, staff email |
| `supabase/functions/chukta-staff/{handler,index}.ts` (+test) | Owner creates/updates staff |
| `supabase/functions/chukta-login-staff/{handler,index}.ts` (+test) | Staff PIN login → session |
| `mobile-chukta/` scaffold (`app.json`, `eas.json`, `package.json`, `jest.config.js`, `tsconfig.json`) | App shell |
| `mobile-chukta/src/lib/supabase.ts` | Supabase client + AppState refresh |
| `mobile-chukta/src/i18n/{index.ts,en.json,bn.json,hi.json}`, `src/utils/money.ts`, `src/utils/dates.ts` | Languages and formatting |
| `mobile-chukta/src/db/{sqlDb.ts,schema.ts,openDb.ts}`, `src/db/testing/betterSqliteDb.ts` | Local store |
| `mobile-chukta/src/domain/{types.ts,settings.ts,attendance.ts,ledger.ts}` | Domain types and pure logic |
| `mobile-chukta/src/repos/{context.ts,write.ts,properties.ts,workers.ts,attendance.ts,money.ts}` | Local writes + enqueue, reads |
| `mobile-chukta/src/sync/{push.ts,pull.ts,remote.ts}` | Sync |
| `mobile-chukta/src/auth/{authService.ts,identity.ts}` | Owner/staff login, restore, logout |

---

### Task 1: `chukta` schema migration

**Files:**
- Create: `supabase/migrations/20260930100000_chukta_schema.sql`
- Test: `supabase/tests/database/chukta_schema.test.sql`

**Interfaces:**
- Produces:
  - tables `chukta.properties`, `chukta.staff_users`, `chukta.workers`, `chukta.attendance_entries`, `chukta.advance_entries`, `chukta.wage_payments` with the exact columns below;
  - trigger function `chukta.touch_server_updated_at()`, which sets `server_updated_at := clock_timestamp()`;
  - trigger function `chukta.check_entry_consistency()`.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/chukta_schema.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

select has_schema('chukta', 'chukta schema exists');
select has_table('chukta', 'properties', 'properties');
select has_table('chukta', 'staff_users', 'staff_users');
select has_table('chukta', 'workers', 'workers');
select has_table('chukta', 'attendance_entries', 'attendance_entries');
select has_table('chukta', 'advance_entries', 'advance_entries');
select has_table('chukta', 'wage_payments', 'wage_payments');

insert into public.shops (id, shop_name, owner_name, phone)
values ('c1000000-0000-0000-0000-000000000001', 'S', 'O', '+919800000901');
insert into chukta.properties (id, shop_id, name)
values ('c2000000-0000-0000-0000-000000000001', 'c1000000-0000-0000-0000-000000000001', 'P1'),
       ('c2000000-0000-0000-0000-000000000002', 'c1000000-0000-0000-0000-000000000001', 'P2');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role)
values ('c3000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'Ram', 'daily', 50000, '2026-09-01', 'c9000000-0000-0000-0000-000000000009', 'owner'),
       ('c3000000-0000-0000-0000-000000000002', 'c2000000-0000-0000-0000-000000000001', 'Sita', 'daily', 50000, '2026-09-01', 'c9000000-0000-0000-0000-000000000009', 'owner');
insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role)
values ('c4000000-0000-0000-0000-000000000001', 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'advance', 100000, '2026-09-02', 'c9000000-0000-0000-0000-000000000009', 'owner');

select throws_ok(
  $$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', '2026-09-03', 'hours', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'status hours requires hours');

select throws_ok(
  $$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000001', 'writeoff', 500, '2026-09-03', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'writeoff requires a note');

select throws_ok(
  $$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000002', 'c3000000-0000-0000-0000-000000000001', '2026-09-03', 'absent', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'entry property must match the worker property');

select throws_ok(
  $$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by, created_by_role)
     values (gen_random_uuid(), 'c2000000-0000-0000-0000-000000000001', 'c3000000-0000-0000-0000-000000000002', 'advance', 100000, '2026-09-03', 'c4000000-0000-0000-0000-000000000001', 'c9000000-0000-0000-0000-000000000009', 'owner') $$,
  '23514', null, 'void must target the same worker');

update chukta.workers set server_updated_at = '2000-01-01', name = 'Ram K' where id = 'c3000000-0000-0000-0000-000000000001';
select ok((select server_updated_at > '2001-01-01' from chukta.workers where id = 'c3000000-0000-0000-0000-000000000001'),
  'trigger stamps server_updated_at on update');

select * from finish();
rollback;
```

- [ ] **Step 2: Confirm the test fails (static)**

There is no DB access yet: the test runs in Task 14. Confirm that `plan(12)` equals the number of assertion `select`s:

```bash
grep -cE "^select (has_|throws_ok|ok\()" supabase/tests/database/chukta_schema.test.sql
```
Expected: `12`.

- [ ] **Step 3: Write the migration**

```sql
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
  failed_attempts   int not null default 0,
  locked_until      timestamptz,
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
```

- [ ] **Step 4: Static self-check**

Re-read the migration for balanced parentheses and `$$` pairs, and check that every table named in the DO block exists. Test execution is deferred to Task 14.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260930100000_chukta_schema.sql supabase/tests/database/chukta_schema.test.sql
git commit -m "feat(db): add chukta schema for Phase 1 ledger"
```

---

### Task 2: Access control, hook extension, PIN-failure function

> Superseded in part by fix rounds — see commits f22e138, 0fa3803 and the spec §7.

**Files:**
- Create: `supabase/migrations/20260930100100_chukta_access.sql`
- Modify: `supabase/config.toml` (`[api] schemas`)
- Test: `supabase/tests/database/chukta_access.test.sql`

**Interfaces:**
- Consumes: the Task 1 tables; the Phase 0 functions `public.jwt_app()`, `public.jwt_shop_id()`, `public.custom_access_token_hook(jsonb)`.
- Produces:
  - `chukta.jwt_role() → text` (`'owner'` unless the claim `app_role='staff'`);
  - `chukta.is_owner_of(uuid) → boolean`, `chukta.is_staff_of(uuid) → boolean`;
  - `chukta.reserve_pin_attempt(uuid) → text`, `chukta.clear_pin_attempts(uuid) → void` (per-shop PIN throttle, service role only);
  - a hook that adds `app_role` and `property_id` for active staff.

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/chukta_access.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

-- fixtures (as postgres)
insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-00000000000a', 'owner-a@test.internal'),
  ('d0000000-0000-0000-0000-00000000000b', 'owner-b@test.internal'),
  ('d0000000-0000-0000-0000-000000000051', 'staff-1@test.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id) values
  ('d1000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000911', 'd0000000-0000-0000-0000-00000000000a'),
  ('d1000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000912', 'd0000000-0000-0000-0000-00000000000b');
insert into chukta.properties (id, shop_id, name) values
  ('d2000000-0000-0000-0000-00000000000a', 'd1000000-0000-0000-0000-00000000000a', 'PA'),
  ('d2000000-0000-0000-0000-00000000000b', 'd1000000-0000-0000-0000-00000000000b', 'PB');
insert into chukta.staff_users (id, property_id, name, auth_user_id, pin_hash, pin_salt) values
  ('d3000000-0000-0000-0000-000000000001', 'd2000000-0000-0000-0000-00000000000a', 'Mgr', 'd0000000-0000-0000-0000-000000000051', 'h', 's');
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role) values
  ('d4000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000a', 'WA', 'daily', 50000, '2026-09-01', 'd0000000-0000-0000-0000-00000000000a', 'owner'),
  ('d4000000-0000-0000-0000-00000000000b', 'd2000000-0000-0000-0000-00000000000b', 'WB', 'daily', 50000, '2026-09-01', 'd0000000-0000-0000-0000-00000000000b', 'owner');
insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, created_by, created_by_role) values
  ('d5000000-0000-0000-0000-00000000000a', 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', 'advance', 100000, '2026-09-02', 'd0000000-0000-0000-0000-00000000000a', 'owner');
insert into public.app_sessions (session_id, user_id, app) values
  ('d6000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000051', 'chukta');

-- hook: staff claims
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'd0000000-0000-0000-0000-000000000051',
    'claims', jsonb_build_object('session_id', 'd6000000-0000-0000-0000-000000000001', 'role', 'authenticated'))) -> 'claims' ->> 'app_role',
  'staff', 'hook adds app_role=staff for active staff');
select is(
  public.custom_access_token_hook(jsonb_build_object('user_id', 'd0000000-0000-0000-0000-000000000051',
    'claims', jsonb_build_object('session_id', 'd6000000-0000-0000-0000-000000000001', 'role', 'authenticated'))) -> 'claims' ->> 'property_id',
  'd2000000-0000-0000-0000-00000000000a', 'hook adds property_id for staff');

-- owner A
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'chukta', 'shop_id', 'd1000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.properties), 1, 'owner sees only own shop properties');
select lives_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'New', 'daily', 40000, '2026-09-05', 'owner') $$, 'owner inserts worker in own property');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000b', 'X', 'daily', 40000, '2026-09-05', 'owner') $$, '42501', null, 'owner cannot insert into another shop property');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'X', 'daily', 40000, '2026-09-05', 'd0000000-0000-0000-0000-00000000000b', 'owner') $$, '42501', null, 'created_by cannot be spoofed');
select throws_ok($$ delete from chukta.workers where id = 'd4000000-0000-0000-0000-00000000000a' $$, '42501', null, 'owner cannot delete');
select lives_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', 'advance', 100000, '2026-09-03', 'd5000000-0000-0000-0000-00000000000a', 'owner') $$, 'owner can void');

-- staff of PA
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-000000000051', 'role', 'authenticated',
  'app', 'chukta', 'app_role', 'staff', 'property_id', 'd2000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.properties), 1, 'staff sees only own property');
select is((select count(*)::int from chukta.workers where property_id = 'd2000000-0000-0000-0000-00000000000b'), 0, 'staff sees no other property workers');
select lives_ok($$ insert into chukta.attendance_entries (id, property_id, worker_id, date, status, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', '2026-09-04', 'absent', 'staff') $$, 'staff marks attendance');
select throws_ok($$ insert into chukta.advance_entries (id, property_id, worker_id, type, amount_paise, date, voids_id, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'd4000000-0000-0000-0000-00000000000a', 'advance', 100000, '2026-09-03', 'd5000000-0000-0000-0000-00000000000a', 'staff') $$, '42501', null, 'staff cannot void');
select throws_ok($$ update chukta.advance_entries set amount_paise = 1 $$, '42501', null, 'money rows are not updatable');
select throws_ok($$ select pin_hash from chukta.staff_users $$, '42501', null, 'pin_hash is never readable');
select throws_ok($$ insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by_role)
  values (gen_random_uuid(), 'd2000000-0000-0000-0000-00000000000a', 'X', 'daily', 40000, '2026-09-05', 'owner') $$, '42501', null, 'staff cannot claim owner role');

-- ShopAI token and anon
select set_config('request.jwt.claims', json_build_object('sub', 'd0000000-0000-0000-0000-00000000000a', 'role', 'authenticated',
  'app', 'shopai', 'shop_id', 'd1000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from chukta.workers), 0, 'shopai token sees no chukta data');
reset role;
set local role anon;
select throws_ok($$ select 1 from chukta.workers $$, '42501', null, 'anon has no access');

select * from finish();
rollback;
```

- [ ] **Step 2: Confirm the assertion count (static)**

```bash
grep -cE "^select (is\(|lives_ok|throws_ok|ok\()" supabase/tests/database/chukta_access.test.sql
```
Expected: `17`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260930100100_chukta_access.sql
-- Chukta Phase 1 access control (spec §5).

-- 1. Claim helpers.
create or replace function chukta.jwt_role() returns text
language sql stable set search_path = '' as $$ select coalesce(auth.jwt() ->> 'app_role', 'owner') $$;

create or replace function chukta.is_owner_of(pid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner'
     and exists (select 1 from chukta.properties p where p.id = pid and p.shop_id = public.jwt_shop_id())
$$;

create or replace function chukta.is_staff_of(pid uuid) returns boolean
language sql stable set search_path = '' as $$
  select public.jwt_app() = 'chukta' and chukta.jwt_role() = 'staff'
     and (auth.jwt() ->> 'property_id') = pid::text
$$;

create or replace function chukta.is_member_of(pid uuid) returns boolean
language sql stable set search_path = '' as $$ select chukta.is_owner_of(pid) or chukta.is_staff_of(pid) $$;

create or replace function chukta.is_own_write(p_created_by uuid, p_role text) returns boolean
language sql stable set search_path = '' as $$ select p_created_by = auth.uid() and p_role = chukta.jwt_role() $$;

-- 2. Grants.
revoke all on schema chukta from anon;
revoke all on all tables in schema chukta from anon, authenticated;
grant usage on schema chukta to authenticated, service_role, supabase_auth_admin;
grant select, insert, update on chukta.properties, chukta.workers to authenticated;
grant select, insert on chukta.attendance_entries, chukta.advance_entries, chukta.wage_payments to authenticated;
grant select (id, property_id, name, auth_user_id, is_active, created_at, server_updated_at) on chukta.staff_users to authenticated;
grant all on all tables in schema chukta to service_role;
grant execute on function chukta.jwt_role(), chukta.is_owner_of(uuid), chukta.is_staff_of(uuid),
  chukta.is_member_of(uuid), chukta.is_own_write(uuid, text) to authenticated;
alter default privileges for role postgres in schema chukta revoke all on tables from anon;

-- 3. RLS.
alter table chukta.properties enable row level security;
alter table chukta.staff_users enable row level security;
alter table chukta.workers enable row level security;
alter table chukta.attendance_entries enable row level security;
alter table chukta.advance_entries enable row level security;
alter table chukta.wage_payments enable row level security;

create policy owner_select on chukta.properties for select to authenticated
  using (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id());
create policy owner_insert on chukta.properties for insert to authenticated
  with check (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id());
create policy owner_update on chukta.properties for update to authenticated
  using (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id())
  with check (public.jwt_app() = 'chukta' and chukta.jwt_role() = 'owner' and shop_id = public.jwt_shop_id());
create policy staff_select on chukta.properties for select to authenticated using (chukta.is_staff_of(id));

create policy owner_select on chukta.staff_users for select to authenticated using (chukta.is_owner_of(property_id));
create policy staff_select_self on chukta.staff_users for select to authenticated
  using (public.jwt_app() = 'chukta' and auth_user_id = auth.uid());

create policy member_select on chukta.workers for select to authenticated using (chukta.is_member_of(property_id));
create policy member_insert on chukta.workers for insert to authenticated
  with check (chukta.is_member_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy member_update on chukta.workers for update to authenticated
  using (chukta.is_member_of(property_id)) with check (chukta.is_member_of(property_id));

create policy member_select on chukta.attendance_entries for select to authenticated using (chukta.is_member_of(property_id));
create policy member_insert on chukta.attendance_entries for insert to authenticated
  with check (chukta.is_member_of(property_id) and chukta.is_own_write(created_by, created_by_role));

create policy member_select on chukta.advance_entries for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.advance_entries for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.advance_entries for insert to authenticated
  with check (chukta.is_staff_of(property_id) and voids_id is null and chukta.is_own_write(created_by, created_by_role));

create policy member_select on chukta.wage_payments for select to authenticated using (chukta.is_member_of(property_id));
create policy owner_insert on chukta.wage_payments for insert to authenticated
  with check (chukta.is_owner_of(property_id) and chukta.is_own_write(created_by, created_by_role));
create policy staff_insert on chukta.wage_payments for insert to authenticated
  with check (chukta.is_staff_of(property_id) and voids_id is null and chukta.is_own_write(created_by, created_by_role));

-- 4. Hook: add staff claims (keeps Phase 0 behaviour for app + shop_id).
grant select (auth_user_id, property_id, is_active) on chukta.staff_users to supabase_auth_admin;
create policy auth_admin_reads_staff on chukta.staff_users for select to supabase_auth_admin using (true);

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable set search_path = '' as $$
declare
  claims jsonb := event -> 'claims';
  v_app  text;
  v_shop uuid;
  v_staff_property uuid;
begin
  select s.app into v_app
    from public.app_sessions s
   where s.session_id = nullif(claims ->> 'session_id', '')::uuid;

  select sh.id into v_shop
    from public.shops sh
   where sh.auth_user_id = (event ->> 'user_id')::uuid;

  select su.property_id into v_staff_property
    from chukta.staff_users su
   where su.auth_user_id = (event ->> 'user_id')::uuid and su.is_active;

  if v_app is not null then
    claims := jsonb_set(claims, '{app}', to_jsonb(v_app));
  end if;
  if v_shop is not null then
    claims := jsonb_set(claims, '{shop_id}', to_jsonb(v_shop::text));
  end if;
  if v_staff_property is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb('staff'::text));
    claims := jsonb_set(claims, '{property_id}', to_jsonb(v_staff_property::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

-- 5. Atomic PIN failure counter (service role only).
create or replace function chukta.record_pin_failure(p_staff_ids uuid[]) returns void
language sql security definer set search_path = '' as $$
  update chukta.staff_users
     set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
         locked_until    = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
   where id = any(p_staff_ids);
$$;
revoke execute on function chukta.record_pin_failure(uuid[]) from public, anon, authenticated;
grant execute on function chukta.record_pin_failure(uuid[]) to service_role;
```

- [ ] **Step 4: Expose the schema locally**

In `supabase/config.toml`, change the `[api]` line to:

```toml
schemas = ["public", "graphql_public", "chukta"]
```

- [ ] **Step 5: Static self-check and commit**

Re-read for syntax. Confirm that the hook still includes every Phase 0 statement (the `app` and `shop_id` blocks).

```bash
git add supabase/migrations/20260930100100_chukta_access.sql supabase/tests/database/chukta_access.test.sql supabase/config.toml
git commit -m "feat(db): chukta RLS, staff token claims and PIN failure counter"
```

---

### Task 3: Shared PIN helpers

**Files:**
- Create: `supabase/functions/_shared/pin.ts`
- Test: `supabase/functions/_shared/pin.test.ts`

**Interfaces:**
- Produces:
  - `isValidPin(pin: unknown): pin is string`
  - `hashPin(pin: string, salt?: Uint8Array): Promise<{ hash: string; salt: string }>`
  - `verifyPin(pin: string, hash: string, salt: string): Promise<boolean>`
  - `randomPassword(): string`
  - `staffAuthEmail(staffId: string, domain?: string): string`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/_shared/pin.test.ts
import { assert, assertEquals, assertNotEquals } from 'jsr:@std/assert@1'
import { hashPin, isValidPin, randomPassword, staffAuthEmail, verifyPin } from './pin.ts'

Deno.test('isValidPin accepts 4-6 digits only', () => {
  assertEquals(['1234', '123456', '0000'].map(isValidPin), [true, true, true])
  assertEquals(['123', '1234567', '12a4', 1234, null].map(isValidPin), [false, false, false, false, false])
})

Deno.test('hashPin/verifyPin round-trip with random salt', async () => {
  const a = await hashPin('4821')
  const b = await hashPin('4821')
  assertNotEquals(a.salt, b.salt)
  assertEquals(await verifyPin('4821', a.hash, a.salt), true)
  assertEquals(await verifyPin('4822', a.hash, a.salt), false)
  assertEquals(await verifyPin('4821', a.hash, 'bad'), false)
})

Deno.test('randomPassword is long and unique', () => {
  const a = randomPassword()
  assert(a.length >= 40)
  assertNotEquals(a, randomPassword())
})

Deno.test('staffAuthEmail uses st- prefix and domain', () => {
  assertEquals(staffAuthEmail('abc', 'd.test'), 'st-abc@d.test')
  assertEquals(staffAuthEmail('abc'), 'st-abc@accounts.pragatibandhu.internal')
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `deno test --no-check --allow-env supabase/functions/_shared/pin.test.ts`
Expected: FAIL with `Module not found "./pin.ts"`.

- [ ] **Step 3: Implement**

```ts
// supabase/functions/_shared/pin.ts
const ITERATIONS = 100_000
const DEFAULT_AUTH_EMAIL_DOMAIN = 'accounts.pragatibandhu.internal'

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))

export function isValidPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin)
}

export async function hashPin(
  pin: string,
  salt: Uint8Array = crypto.getRandomValues(new Uint8Array(16)),
): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return { hash: toB64(new Uint8Array(bits)), salt: toB64(salt) }
}

export async function verifyPin(pin: string, hash: string, salt: string): Promise<boolean> {
  let saltBytes: Uint8Array
  try {
    saltBytes = Uint8Array.from(atob(salt), (c) => c.charCodeAt(0))
  } catch {
    return false
  }
  if (saltBytes.length !== 16) return false
  const { hash: computed } = await hashPin(pin, saltBytes)
  if (computed.length !== hash.length) return false
  let diff = 0
  for (let i = 0; i < computed.length; i++) diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i)
  return diff === 0
}

/** Password for hidden staff auth users; never stored or shown — staff sign in via PIN + server-side magic link. */
export function randomPassword(): string {
  return toB64(crypto.getRandomValues(new Uint8Array(32)))
}

export function staffAuthEmail(staffId: string, domain?: string): string {
  const d = domain ?? Deno.env.get('AUTH_EMAIL_DOMAIN') ?? DEFAULT_AUTH_EMAIL_DOMAIN
  return `st-${staffId}@${d}`
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `deno test --no-check --allow-env supabase/functions/_shared/pin.test.ts && deno check supabase/functions/_shared/pin.ts`
Expected: 4 passed, and the type check is clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/_shared/pin.ts supabase/functions/_shared/pin.test.ts
git commit -m "feat(functions): shared PIN hashing and staff identity helpers"
```

---

### Task 4: `chukta-staff` function (owner creates/updates staff)

> Superseded in part by fix rounds — see commits f22e138, 0fa3803 and the spec §7.

**Files:**
- Create: `supabase/functions/chukta-staff/handler.ts`, `supabase/functions/chukta-staff/index.ts`
- Modify: `supabase/config.toml`
- Test: `supabase/functions/chukta-staff/handler.test.ts`

**Interfaces:**
- Consumes: `isValidPin`, `hashPin`, `verifyPin`, `randomPassword`, `staffAuthEmail` (Task 3); `HandlerResult`, `json`, `corsHeaders`, `decodeJwtPayload` (Phase 0 `_shared/account.ts`); SQL `public.revoke_user_sessions(uuid)`.
- Produces:
  - `POST /functions/v1/chukta-staff/create` `{ propertyId, name, pin }` → 200 `{ staff: { id, property_id, name, is_active } }` | 400 | 401 | 403 | 404 | 409 `{ error: 'pin_in_use' }`.
  - `POST /functions/v1/chukta-staff/update` `{ staffId, name?, pin?, isActive? }` → 200 `{ staff }` | 400 | 401 | 403 | 404 | 409.

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/chukta-staff/handler.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { type Caller, handleStaff, type StaffDeps, type StaffRecord } from './handler.ts'
import { hashPin } from '../_shared/pin.ts'

const owner: Caller = { userId: 'u-owner', app: 'chukta', appRole: null, shopId: 'shop1' }

async function staffRow(id: string, pin: string, over: Partial<StaffRecord> = {}): Promise<StaffRecord> {
  const h = await hashPin(pin)
  return { id, property_id: 'p1', name: id, auth_user_id: `auth-${id}`, pin_hash: h.hash, pin_salt: h.salt, is_active: true, ...over }
}

function makeDeps(over: Partial<StaffDeps> = {}) {
  const log: string[] = []
  const deps: StaffDeps = {
    getCaller: async () => owner,
    getPropertyShop: async (pid) => (pid === 'p1' ? 'shop1' : pid === 'p2' ? 'shop2' : null),
    listActiveStaff: async () => [],
    getStaff: async () => null,
    createAuthUser: async (email) => { log.push(`auth:${email}`); return 'auth-new' },
    insertStaff: async (row) => { log.push(`insert:${row.id}:${row.name}:${row.auth_user_id}`) },
    updateStaff: async (id, patch) => { log.push(`update:${id}:${Object.keys(patch).sort().join(',')}`) },
    revokeSessions: async (uid) => { log.push(`revoke:${uid}`) },
    newId: () => 'st1',
    ...over,
  }
  return { deps, log }
}

Deno.test('create: 401 without a valid caller', async () => {
  const { deps } = makeDeps({ getCaller: async () => null })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, deps)).status, 401)
})

Deno.test('create: 403 for staff callers, shopai tokens, or another shop property', async () => {
  const staffCaller = makeDeps({ getCaller: async () => ({ ...owner, appRole: 'staff' }) })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, staffCaller.deps)).status, 403)
  const shopai = makeDeps({ getCaller: async () => ({ ...owner, app: 'shopai' }) })
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, shopai.deps)).status, 403)
  const other = makeDeps()
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p2', name: 'A', pin: '1234' }, other.deps)).status, 403)
})

Deno.test('create: 400 on bad name or pin', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: ' ', pin: '1234' }, deps)).status, 400)
  assertEquals((await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '12' }, deps)).status, 400)
})

Deno.test('create: 409 when an active staff member already uses the pin', async () => {
  const existing = await staffRow('s0', '1234')
  const { deps, log } = makeDeps({ listActiveStaff: async () => [existing] })
  const res = await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'A', pin: '1234' }, deps)
  assertEquals(res.status, 409)
  assertEquals(res.body.error, 'pin_in_use')
  assertEquals(log, [])
})

Deno.test('create: creates hidden auth user and staff row', async () => {
  const { deps, log } = makeDeps()
  const res = await handleStaff('create', 'jwt', { propertyId: 'p1', name: 'Manager', pin: '4821' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['auth:st-st1@accounts.pragatibandhu.internal', 'insert:st1:Manager:auth-new'])
  assertEquals(res.body.staff, { id: 'st1', property_id: 'p1', name: 'Manager', is_active: true })
})

Deno.test('update: pin change checks uniqueness excluding self, resets lockout and revokes sessions', async () => {
  const self = await staffRow('s1', '1111')
  const other = await staffRow('s2', '2222')
  const { deps, log } = makeDeps({ getStaff: async () => self, listActiveStaff: async () => [self, other] })
  assertEquals((await handleStaff('update', 'jwt', { staffId: 's1', pin: '2222' }, deps)).status, 409)
  const res = await handleStaff('update', 'jwt', { staffId: 's1', pin: '1111' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['update:s1:failed_attempts,locked_until,pin_hash,pin_salt', 'revoke:auth-s1'])
})

Deno.test('update: deactivation revokes sessions; rename does not', async () => {
  const self = await staffRow('s1', '1111')
  const a = makeDeps({ getStaff: async () => self })
  await handleStaff('update', 'jwt', { staffId: 's1', isActive: false }, a.deps)
  assertEquals(a.log, ['update:s1:is_active', 'revoke:auth-s1'])
  const b = makeDeps({ getStaff: async () => self })
  await handleStaff('update', 'jwt', { staffId: 's1', name: 'New' }, b.deps)
  assertEquals(b.log, ['update:s1:name'])
})

Deno.test('update: 404 unknown staff, 403 staff of another shop', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleStaff('update', 'jwt', { staffId: 'nope' }, deps)).status, 404)
  const foreign = await staffRow('s9', '9999', { property_id: 'p2' })
  const f = makeDeps({ getStaff: async () => foreign })
  assertEquals((await handleStaff('update', 'jwt', { staffId: 's9', name: 'X' }, f.deps)).status, 403)
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `deno test --no-check --allow-env supabase/functions/chukta-staff/`
Expected: FAIL with `Module not found "./handler.ts"`.

- [ ] **Step 3: Implement `handler.ts`**

```ts
// supabase/functions/chukta-staff/handler.ts
import type { HandlerResult } from '../_shared/account.ts'
import { hashPin, isValidPin, randomPassword, staffAuthEmail, verifyPin } from '../_shared/pin.ts'

export type Caller = { userId: string; app: string | null; appRole: string | null; shopId: string | null }
export type StaffRecord = {
  id: string
  property_id: string
  name: string
  auth_user_id: string
  pin_hash: string
  pin_salt: string
  is_active: boolean
}
export type StaffPatch = {
  name?: string
  pin_hash?: string
  pin_salt?: string
  is_active?: boolean
  failed_attempts?: number
  locked_until?: null
}

export interface StaffDeps {
  getCaller(jwt: string): Promise<Caller | null>
  getPropertyShop(propertyId: string): Promise<string | null>
  listActiveStaff(propertyId: string): Promise<StaffRecord[]>
  getStaff(staffId: string): Promise<StaffRecord | null>
  createAuthUser(email: string, password: string): Promise<string>
  insertStaff(row: Omit<StaffRecord, 'is_active'>): Promise<void>
  updateStaff(id: string, patch: StaffPatch): Promise<void>
  revokeSessions(authUserId: string): Promise<void>
  newId(): string
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fail = (status: number, error: string): HandlerResult => ({ status, body: { error } })

async function pinTaken(pin: string, staff: StaffRecord[], exceptId?: string): Promise<boolean> {
  for (const s of staff) {
    if (s.id !== exceptId && s.is_active && (await verifyPin(pin, s.pin_hash, s.pin_salt))) return true
  }
  return false
}

export async function handleStaff(
  action: 'create' | 'update',
  jwt: string | null,
  input: Record<string, unknown>,
  deps: StaffDeps,
): Promise<HandlerResult> {
  const caller = jwt ? await deps.getCaller(jwt) : null
  if (!caller) return fail(401, 'unauthorized')
  if (caller.app !== 'chukta' || caller.appRole === 'staff' || !caller.shopId) return fail(403, 'forbidden')

  if (action === 'create') {
    const propertyId = str(input.propertyId)
    const name = str(input.name)
    if (!propertyId || !name || !isValidPin(input.pin)) return fail(400, 'propertyId, name and a 4-6 digit pin are required')
    const shop = await deps.getPropertyShop(propertyId)
    if (!shop) return fail(404, 'property_not_found')
    if (shop !== caller.shopId) return fail(403, 'forbidden')
    if (await pinTaken(input.pin, await deps.listActiveStaff(propertyId))) return fail(409, 'pin_in_use')

    const id = deps.newId()
    const authUserId = await deps.createAuthUser(staffAuthEmail(id), randomPassword())
    const { hash, salt } = await hashPin(input.pin)
    await deps.insertStaff({ id, property_id: propertyId, name, auth_user_id: authUserId, pin_hash: hash, pin_salt: salt })
    return { status: 200, body: { staff: { id, property_id: propertyId, name, is_active: true } } }
  }

  const staffId = str(input.staffId)
  if (!staffId) return fail(400, 'staffId is required')
  const staff = await deps.getStaff(staffId)
  if (!staff) return fail(404, 'staff_not_found')
  if ((await deps.getPropertyShop(staff.property_id)) !== caller.shopId) return fail(403, 'forbidden')

  const patch: StaffPatch = {}
  let revoke = false
  if (input.name !== undefined) {
    const name = str(input.name)
    if (!name) return fail(400, 'name must not be empty')
    patch.name = name
  }
  if (input.pin !== undefined) {
    if (!isValidPin(input.pin)) return fail(400, 'pin must be 4-6 digits')
    if (await pinTaken(input.pin, await deps.listActiveStaff(staff.property_id), staff.id)) return fail(409, 'pin_in_use')
    const { hash, salt } = await hashPin(input.pin)
    Object.assign(patch, { pin_hash: hash, pin_salt: salt, failed_attempts: 0, locked_until: null })
    revoke = true
  }
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== 'boolean') return fail(400, 'isActive must be boolean')
    patch.is_active = input.isActive
    if (!input.isActive) revoke = true
  }
  if (Object.keys(patch).length === 0) return fail(400, 'nothing to update')

  await deps.updateStaff(staff.id, patch)
  if (revoke) await deps.revokeSessions(staff.auth_user_id)
  return {
    status: 200,
    body: { staff: { id: staff.id, property_id: staff.property_id, name: patch.name ?? staff.name, is_active: patch.is_active ?? staff.is_active } },
  }
}
```

- [ ] **Step 4: Implement `index.ts`**

```ts
// supabase/functions/chukta-staff/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, decodeJwtPayload, json } from '../_shared/account.ts'
import { handleStaff, type StaffDeps } from './handler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const chukta = () => admin.schema('chukta')
const STAFF_COLUMNS = 'id, property_id, name, auth_user_id, pin_hash, pin_salt, is_active'

const deps: StaffDeps = {
  async getCaller(jwt) {
    const { data, error } = await admin.auth.getUser(jwt)
    if (error || !data.user) return null
    const claims = decodeJwtPayload(jwt)
    return {
      userId: data.user.id,
      app: typeof claims.app === 'string' ? claims.app : null,
      appRole: typeof claims.app_role === 'string' ? claims.app_role : null,
      shopId: typeof claims.shop_id === 'string' ? claims.shop_id : null,
    }
  },
  async getPropertyShop(propertyId) {
    const { data, error } = await chukta().from('properties').select('shop_id').eq('id', propertyId).maybeSingle()
    if (error) throw error
    return data?.shop_id ?? null
  },
  async listActiveStaff(propertyId) {
    const { data, error } = await chukta().from('staff_users').select(STAFF_COLUMNS).eq('property_id', propertyId).eq('is_active', true)
    if (error) throw error
    return data ?? []
  },
  async getStaff(staffId) {
    const { data, error } = await chukta().from('staff_users').select(STAFF_COLUMNS).eq('id', staffId).maybeSingle()
    if (error) throw error
    return data
  },
  async createAuthUser(email, password) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { kind: 'chukta_staff' } })
    if (error || !data.user) throw error ?? new Error('createUser returned no user')
    return data.user.id
  },
  async insertStaff(row) {
    const { error } = await chukta().from('staff_users').insert(row)
    if (error) throw error
  },
  async updateStaff(id, patch) {
    const { error } = await chukta().from('staff_users').update(patch).eq('id', id)
    if (error) throw error
  },
  async revokeSessions(authUserId) {
    const { error } = await admin.rpc('revoke_user_sessions', { p_user_id: authUserId })
    if (error) throw error
  },
  newId: () => crypto.randomUUID(),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const path = new URL(req.url).pathname
    const action = path.endsWith('/create') ? 'create' : path.endsWith('/update') ? 'update' : null
    if (!action || req.method !== 'POST') return json(404, { error: 'not_found' })
    const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
    const result = await handleStaff(action, jwt, await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('chukta-staff error:', err)
    return json(500, { error: 'Internal error' })
  }
})
```

Append to `supabase/config.toml`:

```toml
[functions.chukta-staff]
enabled = true
verify_jwt = false  # the function validates the owner's token itself (auth.getUser) and reads app/app_role/shop_id claims
entrypoint = "./functions/chukta-staff/index.ts"
```

- [ ] **Step 5: Run the tests and type check**

Run: `deno test --no-check --allow-env supabase/functions/chukta-staff/ && deno check supabase/functions/chukta-staff/index.ts`
Expected: 8 passed, and the type check is clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/chukta-staff supabase/config.toml
git commit -m "feat(functions): chukta-staff for owner-managed staff PIN accounts"
```

---

### Task 5: `chukta-login-staff` function

> Superseded in part by fix rounds — see commits f22e138, 0fa3803 and the spec §7.

**Files:**
- Create: `supabase/functions/chukta-login-staff/handler.ts`, `supabase/functions/chukta-login-staff/index.ts`
- Modify: `supabase/config.toml`
- Test: `supabase/functions/chukta-login-staff/handler.test.ts`

**Interfaces:**
- Consumes: `isValidPin`, `verifyPin`, `hashPin` (in tests) (Task 3); `decodeJwtPayload`, `HandlerResult`, `Session`, `json`, `corsHeaders` (Phase 0); SQL `chukta.reserve_pin_attempt(uuid)`, `chukta.clear_pin_attempts(uuid)`.
- Produces: `POST /functions/v1/chukta-login-staff` `{ ownerPhone, pin, deviceId? }` → 200 `{ session, staff: { id, name }, property: { id, name } }` | 400 | 401 `{error:'wrong_pin'}` | 409 `{error:'ambiguous_pin'}` | 429 `{error:'too_many_attempts'}`.

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/chukta-login-staff/handler.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { handleStaffLogin, type StaffCandidate, type StaffLoginDeps } from './handler.ts'
import { hashPin } from '../_shared/pin.ts'

const tok = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`
const NOW = new Date('2026-09-30T10:00:00Z')

async function cand(id: string, pin: string, over: Partial<StaffCandidate> = {}): Promise<StaffCandidate> {
  const h = await hashPin(pin)
  return { id, name: `N-${id}`, property_id: 'p1', property_name: 'Main', auth_user_id: `auth-${id}`, pin_hash: h.hash, pin_salt: h.salt, locked_until: null, ...over }
}

function makeDeps(staff: StaffCandidate[], over: Partial<StaffLoginDeps> = {}) {
  const log: string[] = []
  const deps: StaffLoginDeps = {
    findShopIdByPhone: async (p) => (p === '+919800000001' ? 'shop1' : null),
    listStaffForShop: async () => staff,
    recordFailures: async (ids) => { log.push(`fail:${ids.join(',')}`) },
    resetFailures: async (id) => { log.push(`reset:${id}`) },
    createSession: async (uid) => { log.push(`session:${uid}`); return { access_token: tok({ session_id: 'sess1' }), refresh_token: 'r1' } },
    recordSession: async (sid, uid, dev) => { log.push(`record:${sid}:${uid}:${dev}`) },
    refresh: async () => ({ access_token: tok({ session_id: 'sess1', app: 'chukta', app_role: 'staff' }), refresh_token: 'r2' }),
    now: () => NOW,
    ...over,
  }
  return { deps, log }
}

const input = { ownerPhone: '+919800000001', pin: '4821', deviceId: 'dev1' }

Deno.test('400 on invalid input', async () => {
  const { deps } = makeDeps([])
  assertEquals((await handleStaffLogin({ ownerPhone: '', pin: '4821' }, deps)).status, 400)
  assertEquals((await handleStaffLogin({ ownerPhone: '+91', pin: '12' }, deps)).status, 400)
})

Deno.test('unknown owner phone: 401 wrong_pin, nothing recorded', async () => {
  const { deps, log } = makeDeps([])
  const res = await handleStaffLogin({ ...input, ownerPhone: '+910000000000' }, deps)
  assertEquals(res.body, { error: 'wrong_pin' })
  assertEquals(log, [])
})

Deno.test('wrong pin: 401 and failure recorded for unlocked candidates only', async () => {
  const a = await cand('a', '1111')
  const b = await cand('b', '2222', { locked_until: '2026-09-30T10:05:00Z' })
  const { deps, log } = makeDeps([a, b])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 401)
  assertEquals(log, ['fail:a'])
})

Deno.test('all candidates locked: 429 too_many_attempts', async () => {
  const a = await cand('a', '4821', { locked_until: '2026-09-30T10:05:00Z' })
  const { deps, log } = makeDeps([a])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 429)
  assertEquals(res.body.error, 'too_many_attempts')
  assertEquals(log, [])
})

Deno.test('expired lock counts as unlocked', async () => {
  const a = await cand('a', '4821', { locked_until: '2026-09-30T09:00:00Z' })
  const { deps } = makeDeps([a])
  assertEquals((await handleStaffLogin(input, deps)).status, 200)
})

Deno.test('same pin at two properties: 409 ambiguous_pin', async () => {
  const a = await cand('a', '4821')
  const b = await cand('b', '4821', { property_id: 'p2' })
  const { deps } = makeDeps([a, b])
  assertEquals((await handleStaffLogin(input, deps)).body.error, 'ambiguous_pin')
})

Deno.test('match: resets counter, creates + records session, returns refreshed session', async () => {
  const a = await cand('a', '4821')
  const { deps, log } = makeDeps([a, await cand('b', '9999')])
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['reset:a', 'session:auth-a', 'record:sess1:auth-a:dev1'])
  assertEquals((res.body.session as { refresh_token: string }).refresh_token, 'r2')
  assertEquals(res.body.staff, { id: 'a', name: 'N-a' })
  assertEquals(res.body.property, { id: 'p1', name: 'Main' })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `deno test --no-check --allow-env supabase/functions/chukta-login-staff/`
Expected: FAIL with `Module not found "./handler.ts"`.

- [ ] **Step 3: Implement `handler.ts`**

```ts
// supabase/functions/chukta-login-staff/handler.ts
import { decodeJwtPayload, type HandlerResult, type Session } from '../_shared/account.ts'
import { isValidPin, verifyPin } from '../_shared/pin.ts'

export type StaffCandidate = {
  id: string
  name: string
  property_id: string
  property_name: string
  auth_user_id: string
  pin_hash: string
  pin_salt: string
  locked_until: string | null
}

export interface StaffLoginDeps {
  findShopIdByPhone(phone: string): Promise<string | null>
  /** Active staff of the shop's active properties. */
  listStaffForShop(shopId: string): Promise<StaffCandidate[]>
  recordFailures(staffIds: string[]): Promise<void>
  resetFailures(staffId: string): Promise<void>
  createSession(authUserId: string): Promise<Session>
  recordSession(sessionId: string, userId: string, deviceId: string | null): Promise<void>
  refresh(refreshToken: string): Promise<Session>
  now(): Date
}

const WRONG_PIN: HandlerResult = { status: 401, body: { error: 'wrong_pin' } }

export async function handleStaffLogin(
  input: { ownerPhone?: unknown; pin?: unknown; deviceId?: unknown },
  deps: StaffLoginDeps,
): Promise<HandlerResult> {
  const ownerPhone = typeof input.ownerPhone === 'string' ? input.ownerPhone.trim() : ''
  if (!ownerPhone || !isValidPin(input.pin)) return { status: 400, body: { error: 'ownerPhone and a 4-6 digit pin are required' } }
  const pin = input.pin
  const deviceId = typeof input.deviceId === 'string' ? input.deviceId : null

  const shopId = await deps.findShopIdByPhone(ownerPhone)
  if (!shopId) return WRONG_PIN

  const now = deps.now().getTime()
  const staff = await deps.listStaffForShop(shopId)
  const unlocked = staff.filter((s) => !s.locked_until || new Date(s.locked_until).getTime() <= now)
  if (staff.length > 0 && unlocked.length === 0) return { status: 429, body: { error: 'too_many_attempts' } }

  const matches: StaffCandidate[] = []
  for (const s of unlocked) {
    if (await verifyPin(pin, s.pin_hash, s.pin_salt)) matches.push(s)
  }
  if (matches.length === 0) {
    if (unlocked.length > 0) await deps.recordFailures(unlocked.map((s) => s.id))
    return WRONG_PIN
  }
  if (matches.length > 1) return { status: 409, body: { error: 'ambiguous_pin' } }

  const match = matches[0]
  await deps.resetFailures(match.id)
  const first = await deps.createSession(match.auth_user_id)
  const sessionId = decodeJwtPayload(first.access_token).session_id
  if (typeof sessionId !== 'string') throw new Error('session_id claim missing from access token')
  await deps.recordSession(sessionId, match.auth_user_id, deviceId)
  const session = await deps.refresh(first.refresh_token)

  return {
    status: 200,
    body: { session, staff: { id: match.id, name: match.name }, property: { id: match.property_id, name: match.property_name } },
  }
}
```

- [ ] **Step 4: Implement `index.ts`**

```ts
// supabase/functions/chukta-login-staff/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json, type Session } from '../_shared/account.ts'
import { handleStaffLogin, type StaffLoginDeps } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noPersist)
const publicClient = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, noPersist)

const deps: StaffLoginDeps = {
  async findShopIdByPhone(phone) {
    const { data, error } = await admin.from('shops').select('id').eq('phone', phone).maybeSingle()
    if (error) throw error
    return data?.id ?? null
  },
  async listStaffForShop(shopId) {
    const { data, error } = await admin.schema('chukta').from('staff_users')
      .select('id, name, property_id, auth_user_id, pin_hash, pin_salt, locked_until, properties!inner(name, shop_id, is_active)')
      .eq('is_active', true)
      .eq('properties.shop_id', shopId)
      .eq('properties.is_active', true)
    if (error) throw error
    return (data ?? []).map((r: Record<string, unknown>) => {
      const p = r.properties as { name: string }
      return {
        id: r.id as string, name: r.name as string, property_id: r.property_id as string, property_name: p.name,
        auth_user_id: r.auth_user_id as string, pin_hash: r.pin_hash as string, pin_salt: r.pin_salt as string,
        locked_until: (r.locked_until as string | null) ?? null,
      }
    })
  },
  async recordFailures(ids) {
    const { error } = await admin.schema('chukta').rpc('record_pin_failure', { p_staff_ids: ids })
    if (error) throw error
  },
  async resetFailures(id) {
    const { error } = await admin.schema('chukta').from('staff_users').update({ failed_attempts: 0, locked_until: null }).eq('id', id)
    if (error) throw error
  },
  async createSession(authUserId) {
    const { data: u, error: uErr } = await admin.auth.admin.getUserById(authUserId)
    if (uErr || !u.user?.email) throw uErr ?? new Error('staff auth user has no email')
    // Server-side one-time link, redeemed immediately; no email is sent and no password is stored.
    const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: 'magiclink', email: u.user.email })
    if (lErr || !link.properties?.hashed_token) throw lErr ?? new Error('generateLink returned no token')
    const { data, error } = await publicClient().auth.verifyOtp({ type: 'magiclink', token_hash: link.properties.hashed_token })
    if (error || !data.session) throw error ?? new Error('verifyOtp returned no session')
    return data.session as unknown as Session
  },
  async recordSession(sessionId, userId, deviceId) {
    const { error } = await admin.from('app_sessions').insert({ session_id: sessionId, user_id: userId, app: 'chukta', device_id: deviceId })
    if (error) throw error
  },
  async refresh(refreshToken) {
    const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw error ?? new Error('refresh returned no session')
    return data.session as unknown as Session
  },
  now: () => new Date(),
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const result = await handleStaffLogin(await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('chukta-login-staff error:', err)
    return json(500, { error: 'Internal error' })
  }
})
```

Append to `supabase/config.toml`:

```toml
[functions.chukta-login-staff]
enabled = true
verify_jwt = false  # pre-login; staff prove identity with owner phone + PIN
entrypoint = "./functions/chukta-login-staff/index.ts"
```

- [ ] **Step 5: Run the tests and type check**

Run: `deno test --no-check --allow-env supabase/functions/chukta-login-staff/ && deno check supabase/functions/chukta-login-staff/index.ts`
Expected: 7 passed, and the type check is clean.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/chukta-login-staff supabase/config.toml
git commit -m "feat(functions): chukta-login-staff PIN login with lockout"
```

---

### Task 6: `mobile-chukta` scaffold

**Files:**
- Create: `mobile-chukta/` (Expo blank TypeScript, SDK 54), `mobile-chukta/app.json`, `mobile-chukta/eas.json`, `mobile-chukta/jest.config.js`, `mobile-chukta/.env.example`, `mobile-chukta/src/lib/supabase.ts`, `mobile-chukta/src/__tests__/smoke.test.ts`

**Interfaces:**
- Produces:
  - `supabase: SupabaseClient` (`src/lib/supabase.ts`);
  - the npm scripts `test` (jest) and `typecheck` (tsc --noEmit).

- [ ] **Step 1: Scaffold and install**

```bash
cd /path/to/repo   # repo root
npx create-expo-app@latest mobile-chukta --template blank-typescript@sdk-54 --no-install
cd mobile-chukta
npm install
npx expo install expo-sqlite @react-native-async-storage/async-storage @react-native-community/netinfo expo-crypto expo-localization react-native-url-polyfill
npm install @supabase/supabase-js i18next react-i18next
npm install -D jest jest-expo @types/jest better-sqlite3 @types/better-sqlite3
```
If `--template blank-typescript@sdk-54` is rejected, use `--template expo-template-blank-typescript@sdk-54`. Verify that `package.json` `expo` is `~54.x` and `react-native` is `0.81.x`.

- [ ] **Step 2: Configure the app identity**

Replace `mobile-chukta/app.json` with:

```json
{
  "expo": {
    "name": "Chukta",
    "slug": "chukta",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": { "image": "./assets/splash-icon.png", "resizeMode": "contain", "backgroundColor": "#FFFFFF" },
    "ios": { "supportsTablet": false, "bundleIdentifier": "com.pragatibandhu.chukta" },
    "android": {
      "package": "com.pragatibandhu.chukta",
      "adaptiveIcon": { "foregroundImage": "./assets/adaptive-icon.png", "backgroundColor": "#FFFFFF" },
      "edgeToEdgeEnabled": true
    },
    "plugins": ["expo-sqlite", "expo-localization"]
  }
}
```

Create `mobile-chukta/eas.json`:

```json
{
  "cli": { "version": ">= 12.5.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" } },
    "production": { "autoIncrement": true }
  },
  "submit": { "production": {} }
}
```

Create `mobile-chukta/.env.example`:

```
EXPO_PUBLIC_SUPABASE_URL=https://mhtqufyaxpunhenqropn.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

- [ ] **Step 3: Jest config and scripts**

`mobile-chukta/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@supabase/.*|i18next|react-i18next))',
  ],
};
```

In `mobile-chukta/package.json` `scripts`, add `"test": "jest"` and `"typecheck": "tsc --noEmit"`.

- [ ] **Step 4: Supabase client**

```ts
// mobile-chukta/src/lib/supabase.ts
import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 5: Smoke test**

```ts
// mobile-chukta/src/__tests__/smoke.test.ts
test('jest runs', () => {
  expect(1 + 1).toBe(2);
});
```

Run: `cd mobile-chukta && npx jest src/__tests__/smoke.test.ts && npx tsc --noEmit`
Expected: 1 passed, and tsc reports no errors.

- [ ] **Step 6: Commit**

```bash
cd ..
git add mobile-chukta/package.json mobile-chukta/package-lock.json mobile-chukta/app.json mobile-chukta/eas.json mobile-chukta/jest.config.js mobile-chukta/.env.example mobile-chukta/tsconfig.json mobile-chukta/App.tsx mobile-chukta/index.ts mobile-chukta/assets mobile-chukta/src mobile-chukta/.gitignore
git commit -m "chore(chukta): scaffold Expo SDK 54 app with Supabase client and Jest"
```
Check `git status` first: no `node_modules`, `.env`, `android/` or `ios/` may be staged.

---

### Task 7: i18n, money and date utilities

**Files:**
- Create: `mobile-chukta/src/i18n/index.ts`, `mobile-chukta/src/i18n/en.json`, `mobile-chukta/src/i18n/bn.json`, `mobile-chukta/src/i18n/hi.json`, `mobile-chukta/src/utils/money.ts`, `mobile-chukta/src/utils/dates.ts`
- Test: `mobile-chukta/src/__tests__/i18n.test.ts`, `mobile-chukta/src/__tests__/money.test.ts`, `mobile-chukta/src/__tests__/dates.test.ts`

**Interfaces:**
- Produces:
  - `type Language = 'en' | 'bn' | 'hi'`
  - `initI18n(lang: Language): Promise<void>`
  - `setLanguage(lang: Language): Promise<void>` (persists `chukta.language`)
  - `getStoredLanguage(): Promise<Language | null>`
  - `i18n` (the i18next instance)
  - `formatRupees(paise: number): string`
  - `rupeesToPaise(input: string): number | null`
  - `todayLocal(now?: Date): string`
  - `addDays(date: string, n: number): string`
  - `weekday(date: string): number`
  - `daysInMonth(year: number, month1: number): number`
  - `compareDates(a: string, b: string): number`

- [ ] **Step 1: Write the failing tests**

```ts
// mobile-chukta/src/__tests__/money.test.ts
import { formatRupees, rupeesToPaise } from '../utils/money';

test('formatRupees uses Indian grouping and drops zero paise', () => {
  expect(formatRupees(0)).toBe('₹0');
  expect(formatRupees(50000)).toBe('₹500');
  expect(formatRupees(12345600)).toBe('₹1,23,456');
  expect(formatRupees(1234567850)).toBe('₹1,23,45,678.50');
  expect(formatRupees(-250005)).toBe('-₹2,500.05');
});

test('rupeesToPaise parses user input', () => {
  expect(rupeesToPaise('500')).toBe(50000);
  expect(rupeesToPaise('1,23,456.5')).toBe(12345650);
  expect(rupeesToPaise('0.05')).toBe(5);
  expect(rupeesToPaise('')).toBeNull();
  expect(rupeesToPaise('abc')).toBeNull();
  expect(rupeesToPaise('1.234')).toBeNull();
});
```

```ts
// mobile-chukta/src/__tests__/dates.test.ts
import { addDays, compareDates, daysInMonth, todayLocal, weekday } from '../utils/dates';

test('todayLocal uses local calendar parts, not UTC', () => {
  // 00:30 on 1 Sep in local time must be 2026-09-01 regardless of UTC offset
  expect(todayLocal(new Date(2026, 8, 1, 0, 30))).toBe('2026-09-01');
});

test('date arithmetic on YYYY-MM-DD strings', () => {
  expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  expect(weekday('2026-09-06')).toBe(0); // Sunday
  expect(weekday('2026-09-01')).toBe(2); // Tuesday
  expect(daysInMonth(2026, 2)).toBe(28);
  expect(daysInMonth(2028, 2)).toBe(29);
  expect(compareDates('2026-09-01', '2026-09-02')).toBeLessThan(0);
});
```

```ts
// mobile-chukta/src/__tests__/i18n.test.ts
import en from '../i18n/en.json';
import bn from '../i18n/bn.json';
import hi from '../i18n/hi.json';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`],
  ).sort();
}

test('bn and hi have exactly the en keys', () => {
  expect(keys(bn)).toEqual(keys(en));
  expect(keys(hi)).toEqual(keys(en));
});

test('no empty strings', () => {
  for (const dict of [en, bn, hi]) {
    for (const k of keys(dict)) {
      const v = k.split('.').reduce<unknown>((o, part) => (o as Record<string, unknown>)[part], dict);
      expect(typeof v === 'string' && v.trim().length > 0).toBe(true);
    }
  }
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/money.test.ts src/__tests__/dates.test.ts src/__tests__/i18n.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the utilities**

```ts
// mobile-chukta/src/utils/money.ts
function groupIndian(n: string): string {
  if (n.length <= 3) return n;
  const last3 = n.slice(-3);
  const rest = n.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${rest},${last3}`;
}

/** Integer paise → "₹1,23,456.50" (paise part omitted when zero). */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? '-' : '';
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100).toString();
  const p = abs % 100;
  return `${sign}₹${groupIndian(rupees)}${p ? `.${p.toString().padStart(2, '0')}` : ''}`;
}

/** "1,23,456.5" → 12345650; null when not a valid non-negative amount with ≤2 decimals. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [r, d = ''] = cleaned.split('.');
  return Number(r) * 100 + Number(d.padEnd(2, '0'));
}
```

```ts
// mobile-chukta/src/utils/dates.ts
const pad = (n: number) => n.toString().padStart(2, '0');

function parse(date: string): [number, number, number] {
  const [y, m, d] = date.split('-').map(Number);
  return [y, m, d];
}

function fromUtc(ms: number): string {
  const dt = new Date(ms);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Today's date from local calendar parts (never via toISOString, which shifts IST midnight to the previous day). */
export function todayLocal(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = parse(date);
  return fromUtc(Date.UTC(y, m - 1, d + n));
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: string): number {
  const [y, m, d] = parse(date);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

export function compareDates(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
```

- [ ] **Step 4: Implement i18n with the Phase 1A keys**

```json
// mobile-chukta/src/i18n/en.json
{
  "common": { "appName": "Chukta", "ok": "OK", "cancel": "Cancel", "save": "Save", "retry": "Retry" },
  "language": { "title": "Choose language", "en": "English", "bn": "বাংলা", "hi": "हिन्दी" },
  "auth": {
    "error": {
      "invalidCredentials": "Wrong phone number or password.",
      "passwordResetRequired": "Please set a new password first on the Pragati Bandhu website (Forgot password).",
      "notSubscribed": "This number is not registered for Chukta. Register on the website under Chukta.",
      "wrongPin": "Wrong PIN.",
      "tooManyAttempts": "Too many wrong PINs. Try again in 15 minutes.",
      "ambiguousPin": "This PIN is used at two places. Ask the owner to change it.",
      "network": "No internet. Please try again.",
      "unknown": "Something went wrong. Please try again."
    }
  },
  "ledger": {
    "explain": {
      "hourly": "{{hours}} hours × {{rate}}",
      "daily": "{{days}} days × {{rate}}",
      "weekly": "{{days}} days × {{rate}} ÷ 7",
      "monthly": "{{month}}: {{base}} − {{deductionDays}} days × {{perDay}}"
    }
  }
}
```

```json
// mobile-chukta/src/i18n/bn.json
{
  "common": { "appName": "চুকতা", "ok": "ঠিক আছে", "cancel": "বাতিল", "save": "সেভ করুন", "retry": "আবার চেষ্টা করুন" },
  "language": { "title": "ভাষা বেছে নিন", "en": "English", "bn": "বাংলা", "hi": "हिन्दी" },
  "auth": {
    "error": {
      "invalidCredentials": "ফোন নম্বর বা পাসওয়ার্ড ভুল।",
      "passwordResetRequired": "আগে প্রগতি বন্ধু ওয়েবসাইটে নতুন পাসওয়ার্ড সেট করুন (Forgot password)।",
      "notSubscribed": "এই নম্বরটি চুকতায় নথিভুক্ত নয়। ওয়েবসাইটে চুকতার জন্য রেজিস্টার করুন।",
      "wrongPin": "পিন ভুল।",
      "tooManyAttempts": "অনেকবার ভুল পিন। ১৫ মিনিট পরে আবার চেষ্টা করুন।",
      "ambiguousPin": "এই পিন দুই জায়গায় ব্যবহার হচ্ছে। মালিককে পিন বদলাতে বলুন।",
      "network": "ইন্টারনেট নেই। আবার চেষ্টা করুন।",
      "unknown": "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।"
    }
  },
  "ledger": {
    "explain": {
      "hourly": "{{hours}} ঘণ্টা × {{rate}}",
      "daily": "{{days}} দিন × {{rate}}",
      "weekly": "{{days}} দিন × {{rate}} ÷ ৭",
      "monthly": "{{month}}: {{base}} − {{deductionDays}} দিন × {{perDay}}"
    }
  }
}
```

```json
// mobile-chukta/src/i18n/hi.json
{
  "common": { "appName": "चुकता", "ok": "ठीक है", "cancel": "रद्द करें", "save": "सेव करें", "retry": "फिर से कोशिश करें" },
  "language": { "title": "भाषा चुनें", "en": "English", "bn": "বাংলা", "hi": "हिन्दी" },
  "auth": {
    "error": {
      "invalidCredentials": "फ़ोन नंबर या पासवर्ड गलत है।",
      "passwordResetRequired": "पहले प्रगति बंधु वेबसाइट पर नया पासवर्ड सेट करें (Forgot password)।",
      "notSubscribed": "यह नंबर चुकता के लिए रजिस्टर नहीं है। वेबसाइट पर चुकता के लिए रजिस्टर करें।",
      "wrongPin": "पिन गलत है।",
      "tooManyAttempts": "बहुत बार गलत पिन। 15 मिनट बाद फिर कोशिश करें।",
      "ambiguousPin": "यह पिन दो जगह इस्तेमाल हो रहा है। मालिक से पिन बदलवाएँ।",
      "network": "इंटरनेट नहीं है। फिर से कोशिश करें।",
      "unknown": "कुछ गलत हो गया। फिर से कोशिश करें।"
    }
  },
  "ledger": {
    "explain": {
      "hourly": "{{hours}} घंटे × {{rate}}",
      "daily": "{{days}} दिन × {{rate}}",
      "weekly": "{{days}} दिन × {{rate}} ÷ 7",
      "monthly": "{{month}}: {{base}} − {{deductionDays}} दिन × {{perDay}}"
    }
  }
}
```

```ts
// mobile-chukta/src/i18n/index.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import bn from './bn.json';
import hi from './hi.json';

export type Language = 'en' | 'bn' | 'hi';
const KEY = 'chukta.language';

export async function initI18n(lang: Language): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { en: { translation: en }, bn: { translation: bn }, hi: { translation: hi } },
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  } else {
    await i18n.changeLanguage(lang);
  }
}

export async function setLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(KEY, lang);
  await initI18n(lang);
}

export async function getStoredLanguage(): Promise<Language | null> {
  const v = await AsyncStorage.getItem(KEY);
  return v === 'en' || v === 'bn' || v === 'hi' ? v : null;
}

export { i18n };
```

If `tsc` complains about importing JSON, add `"resolveJsonModule": true` to `compilerOptions` in `mobile-chukta/tsconfig.json`.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd mobile-chukta && npx jest src/__tests__/money.test.ts src/__tests__/dates.test.ts src/__tests__/i18n.test.ts && npx tsc --noEmit`
Expected: all pass, and tsc is clean.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/i18n mobile-chukta/src/utils mobile-chukta/src/__tests__/money.test.ts mobile-chukta/src/__tests__/dates.test.ts mobile-chukta/src/__tests__/i18n.test.ts mobile-chukta/tsconfig.json
git commit -m "feat(chukta): en/bn/hi i18n, Indian rupee formatting and local date utils"
```

---

### Task 8: Local SQLite store

**Files:**
- Create: `mobile-chukta/src/db/sqlDb.ts`, `mobile-chukta/src/db/schema.ts`, `mobile-chukta/src/db/openDb.ts`, `mobile-chukta/src/db/testing/betterSqliteDb.ts`
- Test: `mobile-chukta/src/__tests__/schema.test.ts`

**Interfaces:**
- Produces:
  - `type SqlParam = string | number | null`
  - `interface SqlDb { execAsync(sql): Promise<void>; runAsync(sql, params?): Promise<unknown>; getAllAsync<T>(sql, params?): Promise<T[]>; getFirstAsync<T>(sql, params?): Promise<T | null>; withTransactionAsync(fn: () => Promise<void>): Promise<void> }`
  - `SYNCED_TABLES` (ordered parents-first): `['properties','staff_users','workers','attendance_entries','advance_entries','wage_payments'] as const`, and `type SyncedTable`
  - `TABLE_COLUMNS: Record<SyncedTable, readonly string[]>`
  - `migrate(db: SqlDb): Promise<void>`
  - `openChuktaDb(identityKey: string): Promise<SqlDb>` (app only)
  - `openTestDb(): SqlDb` (tests only)

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/schema.test.ts
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
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/schema.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/db/sqlDb.ts
export type SqlParam = string | number | null;

/** Minimal surface shared by expo-sqlite's SQLiteDatabase and the better-sqlite3 test adapter. */
export interface SqlDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<unknown>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
}
```

```ts
// mobile-chukta/src/db/schema.ts
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
  seq integer primary key autoincrement, table_name text not null, row_id text not null, payload text not null,
  status text not null default 'pending', attempts integer not null default 0, last_error text, created_at text not null
);
create index if not exists idx_sync_queue_status on sync_queue(status, seq);
create table if not exists sync_cursor (table_name text primary key, cursor text not null);
`;

export async function migrate(db: SqlDb): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('pragma user_version');
  const version = row?.user_version ?? 0;
  if (version < 1) {
    await db.execAsync(SCHEMA_V1);
    await db.execAsync('pragma user_version = 1');
  }
}
```

```ts
// mobile-chukta/src/db/openDb.ts
import * as SQLite from 'expo-sqlite';
import { migrate } from './schema';
import type { SqlDb } from './sqlDb';

/** One database file per login identity (owner shop or staff member), so identities never mix data. */
export async function openChuktaDb(identityKey: string): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(`chukta_${identityKey.replace(/[^a-zA-Z0-9_-]/g, '_')}.db`);
  await db.execAsync('pragma journal_mode = WAL; pragma foreign_keys = OFF;');
  await migrate(db as unknown as SqlDb);
  return db as unknown as SqlDb;
}
```

```ts
// mobile-chukta/src/db/testing/betterSqliteDb.ts
import Database from 'better-sqlite3';
import type { SqlDb, SqlParam } from '../sqlDb';

/** Test-only SqlDb backed by in-memory better-sqlite3 (never imported by app code). */
export function openTestDb(): SqlDb {
  const raw = new Database(':memory:');
  return {
    async execAsync(sql) { raw.exec(sql); },
    async runAsync(sql, params: SqlParam[] = []) { return raw.prepare(sql).run(...params); },
    async getAllAsync<T>(sql: string, params: SqlParam[] = []) {
      const stmt = raw.prepare(sql);
      return (stmt.reader ? stmt.all(...params) : []) as T[];
    },
    async getFirstAsync<T>(sql: string, params: SqlParam[] = []) {
      const stmt = raw.prepare(sql);
      return ((stmt.reader ? stmt.get(...params) : undefined) ?? null) as T | null;
    },
    async withTransactionAsync(fn) {
      raw.exec('begin');
      try { await fn(); raw.exec('commit'); } catch (e) { raw.exec('rollback'); throw e; }
    },
  };
}
```

`pragma user_version` via `prepare(...).get()` works in better-sqlite3. If `getFirstAsync('pragma user_version')` returns `undefined` in the adapter, use `raw.pragma('user_version', { simple: true })`, and report it.

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd mobile-chukta && npx jest src/__tests__/schema.test.ts && npx tsc --noEmit`
Expected: 2 passed, and tsc is clean.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/db mobile-chukta/src/__tests__/schema.test.ts
git commit -m "feat(chukta): local SQLite schema with versioned migrations"
```

---

### Task 9: Domain types, settings resolution, attendance resolver, wage calculation

**Files:**
- Create: `mobile-chukta/src/domain/types.ts`, `mobile-chukta/src/domain/settings.ts`, `mobile-chukta/src/domain/attendance.ts`, `mobile-chukta/src/domain/ledger.ts`
- Test: `mobile-chukta/src/__tests__/ledger.test.ts`, `mobile-chukta/src/__tests__/attendance.test.ts`

**Interfaces:**
- Consumes: `addDays`, `weekday`, `daysInMonth`, `compareDates` (Task 7).
- Produces:
  - types `PayBasis`, `AttendanceMode`, `MonthlyDivisor`, `Role`, `Property`, `Worker`, `AttendanceEntry`, `AdvanceEntry`, `WagePayment` (snake_case fields matching `TABLE_COLUMNS`, with booleans as `0 | 1` numbers), `ResolvedSettings`, `ExplanationLine`, `LedgerResult`;
  - `resolveSettings(worker: Worker, property: Property): ResolvedSettings`;
  - `effectiveAttendance(entries: AttendanceEntry[]): Map<string, AttendanceEntry>`;
  - `activeMoneyRows<T extends { id: string; voids_id: string | null }>(rows: T[]): T[]`;
  - `calculateWorkerLedger(input: { settings: ResolvedSettings; ratePaise: number; joiningDate: string; leftDate: string | null; today: string; attendance: AttendanceEntry[]; advances: AdvanceEntry[]; payments: WagePayment[] }): LedgerResult`.

- [ ] **Step 1: Write the failing tests**

```ts
// mobile-chukta/src/__tests__/attendance.test.ts
import { activeMoneyRows, effectiveAttendance } from '../domain/attendance';
import type { AttendanceEntry } from '../domain/types';

const e = (id: string, date: string, status: AttendanceEntry['status'], created_at: string, hours: number | null = null): AttendanceEntry => ({
  id, property_id: 'p', worker_id: 'w', date, status, hours, note: null,
  created_by: 'u', created_by_role: 'owner', created_at, server_updated_at: null,
});

test('latest (created_at, id) wins per date', () => {
  const m = effectiveAttendance([
    e('a', '2026-09-02', 'absent', '2026-09-02T10:00:00Z'),
    e('b', '2026-09-02', 'present', '2026-09-02T11:00:00Z'),
    e('c', '2026-09-03', 'half_day', '2026-09-03T09:00:00Z'),
    e('z', '2026-09-03', 'absent', '2026-09-03T09:00:00Z'),
  ]);
  expect(m.get('2026-09-02')?.status).toBe('present');
  expect(m.get('2026-09-03')?.id).toBe('z'); // same created_at → greater id wins
});

test('activeMoneyRows drops voids and voided rows', () => {
  const rows = [
    { id: '1', voids_id: null }, { id: '2', voids_id: null }, { id: '3', voids_id: '2' },
  ];
  expect(activeMoneyRows(rows).map((r) => r.id)).toEqual(['1']);
});
```

```ts
// mobile-chukta/src/__tests__/ledger.test.ts
import { calculateWorkerLedger } from '../domain/ledger';
import type { AttendanceEntry, ResolvedSettings } from '../domain/types';

const S = (over: Partial<ResolvedSettings> = {}): ResolvedSettings => ({
  payBasis: 'daily', attendanceMode: 'day', shiftHours: 8, weeklyOff: 0, monthlyDivisor: 'calendar', ...over,
});
let n = 0;
const att = (date: string, status: AttendanceEntry['status'], hours: number | null = null): AttendanceEntry => ({
  id: `a${n++}`, property_id: 'p', worker_id: 'w', date, status, hours, note: null,
  created_by: 'u', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null,
});
const base = { leftDate: null, advances: [], payments: [] };

test('spec example: daily ₹500, Sunday off, Sep 1–7, one absence, one 4/8h day → ₹2,250', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-09-01', today: '2026-09-07',
    attendance: [att('2026-09-03', 'absent'), att('2026-09-05', 'hours', 4)],
  });
  expect(r.earnedPaise).toBe(225000);
  expect(r.explanation).toEqual([{ key: 'ledger.explain.daily', params: { days: 4.5, rate: 50000 } }]);
});

test('daily: weekly-off entries are ignored and off days unpaid', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-09-06', today: '2026-09-07',
    attendance: [att('2026-09-06', 'present')],
  });
  expect(r.earnedPaise).toBe(50000); // only Monday 7th
});

test('hourly: normal day = shift hours, entries capped at shift', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'hourly', attendanceMode: 'hours' }), ratePaise: 6000,
    joiningDate: '2026-09-01', today: '2026-09-02', attendance: [att('2026-09-02', 'hours', 12)],
  });
  expect(r.earnedPaise).toBe(16 * 6000);
});

test('weekly: off day paid, absence deducts rate/7', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'weekly' }), ratePaise: 350000, joiningDate: '2026-09-01', today: '2026-09-07',
    attendance: [att('2026-09-02', 'absent')],
  });
  expect(r.earnedPaise).toBe(300000); // 6 of 7 days × 3500/7
});

test.each([
  ['calendar', '2026-02-01', '2026-02-28'],
  ['26', '2026-02-01', '2026-02-28'],
  ['30', '2026-02-01', '2026-02-28'],
  ['30', '2026-08-01', '2026-08-31'],
] as const)('monthly full month with no absences = exact salary (divisor %s)', (divisor, from, to) => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly', monthlyDivisor: divisor }), ratePaise: 3000000, joiningDate: from, today: to, attendance: [],
  });
  expect(r.earnedPaise).toBe(3000000);
});

test('monthly calendar: one absence in September deducts salary/30', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-01', today: '2026-09-30',
    attendance: [att('2026-09-10', 'absent')],
  });
  expect(r.earnedPaise).toBe(2900000);
});

test('monthly: joining mid-month pays eligible days only', () => {
  const r = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-21', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(1000000); // 10 days × 1000
});

test('monthly: leaving mid-month stops at left_date', () => {
  const r = calculateWorkerLedger({
    ...base, leftDate: '2026-09-10', settings: S({ payBasis: 'monthly' }), ratePaise: 3000000,
    joiningDate: '2026-09-01', today: '2026-09-30', attendance: [],
  });
  expect(r.earnedPaise).toBe(1000000);
});

test('future joining date earns nothing', () => {
  const r = calculateWorkerLedger({ ...base, settings: S(), ratePaise: 50000, joiningDate: '2026-10-01', today: '2026-09-30', attendance: [] });
  expect(r.earnedPaise).toBe(0);
});

test('correction: latest entry wins, and voided money rows are excluded', () => {
  const r = calculateWorkerLedger({
    settings: S(), ratePaise: 50000, joiningDate: '2026-09-01', today: '2026-09-01', leftDate: null,
    attendance: [
      { ...att('2026-09-01', 'absent'), created_at: '2026-09-01T09:00:00Z' },
      { ...att('2026-09-01', 'present'), created_at: '2026-09-01T12:00:00Z' },
    ],
    advances: [
      { id: 'x1', property_id: 'p', worker_id: 'w', type: 'advance', amount_paise: 500000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
      { id: 'x2', property_id: 'p', worker_id: 'w', type: 'advance', amount_paise: 500000, date: '2026-09-01', mode: 'cash', note: null, voids_id: 'x1', created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
      { id: 'x3', property_id: 'p', worker_id: 'w', type: 'advance', amount_paise: 50000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
      { id: 'x4', property_id: 'p', worker_id: 'w', type: 'repayment', amount_paise: 10000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
    ],
    payments: [
      { id: 'y1', property_id: 'p', worker_id: 'w', amount_paise: 20000, date: '2026-09-01', mode: 'cash', note: null, voids_id: null, created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: null },
    ],
  });
  expect(r.earnedPaise).toBe(50000);
  expect(r.paidPaise).toBe(20000);
  expect(r.wageDuePaise).toBe(30000);
  expect(r.advanceOutstandingPaise).toBe(40000);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/ledger.test.ts src/__tests__/attendance.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the types, settings and attendance**

```ts
// mobile-chukta/src/domain/types.ts
export type PayBasis = 'hourly' | 'daily' | 'weekly' | 'monthly';
export type AttendanceMode = 'day' | 'hours';
export type MonthlyDivisor = 'calendar' | '26' | '30';
export type Role = 'owner' | 'staff';
export type PaymentMode = 'cash' | 'upi' | 'bank';

type Audit = { created_by: string; created_by_role: Role; created_at: string; server_updated_at: string | null };

export type Property = {
  id: string; shop_id: string; name: string; address: string | null; is_active: 0 | 1;
  default_pay_basis: PayBasis; default_attendance_mode: AttendanceMode; shift_hours: number;
  weekly_off: number | null; monthly_divisor: MonthlyDivisor; created_at: string; server_updated_at: string | null;
};

export type StaffUser = {
  id: string; property_id: string; name: string; auth_user_id: string; is_active: 0 | 1;
  created_at: string; server_updated_at: string | null;
};

export type Worker = Audit & {
  id: string; property_id: string; name: string; phone: string | null; pay_basis: PayBasis; rate_paise: number;
  joining_date: string; status: 'active' | 'left'; left_date: string | null;
  attendance_mode: AttendanceMode | null; shift_hours: number | null; weekly_off_override: 0 | 1;
  weekly_off: number | null; monthly_divisor: MonthlyDivisor | null;
};

export type AttendanceStatus = 'absent' | 'half_day' | 'present' | 'hours';
export type AttendanceEntry = Audit & {
  id: string; property_id: string; worker_id: string; date: string; status: AttendanceStatus; hours: number | null; note: string | null;
};

export type AdvanceType = 'advance' | 'repayment' | 'writeoff';
export type AdvanceEntry = Audit & {
  id: string; property_id: string; worker_id: string; type: AdvanceType; amount_paise: number; date: string;
  mode: PaymentMode | null; note: string | null; voids_id: string | null;
};

export type WagePayment = Audit & {
  id: string; property_id: string; worker_id: string; amount_paise: number; date: string;
  mode: PaymentMode | null; note: string | null; voids_id: string | null;
};

export type ResolvedSettings = {
  payBasis: PayBasis; attendanceMode: AttendanceMode; shiftHours: number; weeklyOff: number | null; monthlyDivisor: MonthlyDivisor;
};

export type ExplanationLine = { key: string; params: Record<string, string | number> };

export type LedgerResult = {
  earnedPaise: number; paidPaise: number; wageDuePaise: number; advanceOutstandingPaise: number; explanation: ExplanationLine[];
};
```

```ts
// mobile-chukta/src/domain/settings.ts
import type { Property, ResolvedSettings, Worker } from './types';

export function resolveSettings(worker: Worker, property: Property): ResolvedSettings {
  const payBasis = worker.pay_basis;
  return {
    payBasis,
    attendanceMode: payBasis === 'hourly' ? 'hours' : worker.attendance_mode ?? property.default_attendance_mode,
    shiftHours: worker.shift_hours ?? property.shift_hours,
    weeklyOff: worker.weekly_off_override ? worker.weekly_off : property.weekly_off,
    monthlyDivisor: worker.monthly_divisor ?? property.monthly_divisor,
  };
}
```

```ts
// mobile-chukta/src/domain/attendance.ts
import type { AttendanceEntry } from './types';

/** Effective entry per date: greatest (created_at, id). Rows are append-only; corrections are newer rows. */
export function effectiveAttendance(entries: AttendanceEntry[]): Map<string, AttendanceEntry> {
  const out = new Map<string, AttendanceEntry>();
  for (const e of entries) {
    const cur = out.get(e.date);
    if (!cur || e.created_at > cur.created_at || (e.created_at === cur.created_at && e.id > cur.id)) out.set(e.date, e);
  }
  return out;
}

/** Excludes void rows and the rows they void. */
export function activeMoneyRows<T extends { id: string; voids_id: string | null }>(rows: T[]): T[] {
  const voided = new Set(rows.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  return rows.filter((r) => !r.voids_id && !voided.has(r.id));
}
```

- [ ] **Step 4: Implement `ledger.ts`**

```ts
// mobile-chukta/src/domain/ledger.ts
import { addDays, compareDates, daysInMonth, weekday } from '../utils/dates';
import { activeMoneyRows, effectiveAttendance } from './attendance';
import type { AdvanceEntry, AttendanceEntry, ExplanationLine, LedgerResult, ResolvedSettings, WagePayment } from './types';

type Input = {
  settings: ResolvedSettings;
  ratePaise: number;
  joiningDate: string;
  leftDate: string | null;
  today: string;
  attendance: AttendanceEntry[];
  advances: AdvanceEntry[];
  payments: WagePayment[];
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Day credit for a working day: no entry → 1; absent 0; half 0.5; hours → min(h / shift, 1). */
function credit(entry: AttendanceEntry | undefined, shiftHours: number): number {
  if (!entry || entry.status === 'present') return 1;
  if (entry.status === 'absent') return 0;
  if (entry.status === 'half_day') return 0.5;
  return Math.min((entry.hours ?? 0) / shiftHours, 1);
}

function eachDate(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

export function calculateWorkerLedger(input: Input): LedgerResult {
  const { settings: s, ratePaise: rate } = input;
  const end = input.leftDate && compareDates(input.leftDate, input.today) < 0 ? input.leftDate : input.today;
  const dates = compareDates(input.joiningDate, end) <= 0 ? eachDate(input.joiningDate, end) : [];
  const byDate = effectiveAttendance(input.attendance);
  const isOff = (d: string) => s.weeklyOff !== null && weekday(d) === s.weeklyOff;

  let earned = 0;
  const explanation: ExplanationLine[] = [];

  if (s.payBasis === 'hourly') {
    let hours = 0;
    for (const d of dates) {
      if (isOff(d)) continue;
      hours += credit(byDate.get(d), s.shiftHours) * s.shiftHours;
    }
    earned = hours * rate;
    explanation.push({ key: 'ledger.explain.hourly', params: { hours: round2(hours), rate } });
  } else if (s.payBasis === 'daily') {
    let days = 0;
    for (const d of dates) if (!isOff(d)) days += credit(byDate.get(d), s.shiftHours);
    earned = days * rate;
    explanation.push({ key: 'ledger.explain.daily', params: { days: round2(days), rate } });
  } else if (s.payBasis === 'weekly') {
    let days = 0;
    for (const d of dates) days += isOff(d) ? 1 : credit(byDate.get(d), s.shiftHours);
    earned = (days * rate) / 7;
    explanation.push({ key: 'ledger.explain.weekly', params: { days: round2(days), rate } });
  } else {
    // monthly: per calendar month overlapping the period
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
      const workingDates = monthDates.filter((d) => !isOff(d));
      const eligible = s.monthlyDivisor === '26' ? workingDates.length : monthDates.length;
      const baseAmount = whole ? rate : Math.min(rate, eligible * perDay);
      let deductionDays = 0;
      for (const d of workingDates) deductionDays += 1 - credit(byDate.get(d), s.shiftHours);
      earned += Math.max(0, baseAmount - deductionDays * perDay);
      explanation.push({
        key: 'ledger.explain.monthly',
        params: { month, base: Math.round(baseAmount), deductionDays: round2(deductionDays), perDay: Math.round(perDay) },
      });
    }
  }

  const earnedPaise = Math.round(earned);
  const paidPaise = activeMoneyRows(input.payments).reduce((sum, p) => sum + p.amount_paise, 0);
  const advanceOutstandingPaise = activeMoneyRows(input.advances).reduce(
    (sum, a) => sum + (a.type === 'advance' ? a.amount_paise : -a.amount_paise), 0);

  return { earnedPaise, paidPaise, wageDuePaise: earnedPaise - paidPaise, advanceOutstandingPaise, explanation };
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd mobile-chukta && npx jest src/__tests__/ledger.test.ts src/__tests__/attendance.test.ts && npx tsc --noEmit`
Expected: all pass (ledger: 13 including the 4 `test.each` rows; attendance: 2), and tsc is clean.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/domain mobile-chukta/src/__tests__/ledger.test.ts mobile-chukta/src/__tests__/attendance.test.ts
git commit -m "feat(chukta): wage calculation for hourly/daily/weekly/monthly pay"
```

---

### Task 10: Repositories (local write + enqueue, reads)

**Files:**
- Create: `mobile-chukta/src/repos/context.ts`, `mobile-chukta/src/repos/write.ts`, `mobile-chukta/src/repos/properties.ts`, `mobile-chukta/src/repos/workers.ts`, `mobile-chukta/src/repos/attendance.ts`, `mobile-chukta/src/repos/money.ts`
- Test: `mobile-chukta/src/__tests__/repos.test.ts`

**Interfaces:**
- Consumes: `SqlDb`, `migrate`, `TABLE_COLUMNS`, `SyncedTable` (Task 8); the domain types (Task 9).
- Produces:
  - `type RepoContext = { db: SqlDb; userId: string; role: Role; now: () => Date; newId: () => string }`
  - `insertAndEnqueue(ctx, table: SyncedTable, row: Record<string, unknown>): Promise<void>`
  - `updateAndEnqueue(ctx, table: 'properties' | 'workers', id: string, patch: Record<string, unknown>): Promise<void>`
  - `upsertLocal(db, table, row): Promise<void>` (no enqueue; used by pull)
  - properties: `createProperty(ctx, { shopId, name, address? }): Promise<Property>`, `updatePropertySettings(ctx, id, patch)`, `listProperties(db): Promise<Property[]>`, `getProperty(db, id): Promise<Property | null>`
  - workers: `createWorker(ctx, input: NewWorker): Promise<Worker>`, `updateWorker(ctx, id, patch)`, `listWorkers(db, propertyId, includeLeft?): Promise<Worker[]>`, `getWorker(db, id): Promise<Worker | null>`
  - attendance: `markAttendance(ctx, { propertyId, workerId, date, status, hours?, note? }): Promise<AttendanceEntry>`, `listAttendance(db, workerId, from, to): Promise<AttendanceEntry[]>`
  - money: `addAdvance(ctx, { propertyId, workerId, type, amountPaise, date, mode?, note? })`, `addPayment(ctx, { propertyId, workerId, amountPaise, date, mode?, note? })`, `voidAdvance(ctx, targetId)`, `voidPayment(ctx, targetId)`, `listAdvances(db, workerId)`, `listPayments(db, workerId)`

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/repos.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import type { RepoContext } from '../repos/context';
import { createProperty, listProperties, updatePropertySettings } from '../repos/properties';
import { createWorker, listWorkers, updateWorker } from '../repos/workers';
import { listAttendance, markAttendance } from '../repos/attendance';
import { addAdvance, listAdvances, voidAdvance } from '../repos/money';

async function ctx(role: RepoContext['role'] = 'owner'): Promise<RepoContext> {
  const db = openTestDb();
  await migrate(db);
  let i = 0;
  return { db, userId: 'u1', role, now: () => new Date('2026-09-30T10:00:00Z'), newId: () => `id-${++i}` };
}
const queue = (c: RepoContext) => c.db.getAllAsync<{ table_name: string; row_id: string; payload: string }>('select * from sync_queue order by seq');

test('create property + worker writes locally and enqueues in order', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  const w = await createWorker(c, { propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01' });
  expect((await listProperties(c.db)).map((x) => x.name)).toEqual(['Main']);
  expect((await listWorkers(c.db, p.id)).map((x) => x.id)).toEqual([w.id]);
  const q = await queue(c);
  expect(q.map((r) => `${r.table_name}:${r.row_id}`)).toEqual([`properties:${p.id}`, `workers:${w.id}`]);
  expect(JSON.parse(q[1].payload)).toMatchObject({ created_by: 'u1', created_by_role: 'owner', rate_paise: 50000 });
});

test('updates enqueue the full row; workers can be archived', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  await updatePropertySettings(c, p.id, { weekly_off: 5, shift_hours: 9 });
  const w = await createWorker(c, { propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01' });
  await updateWorker(c, w.id, { status: 'left', left_date: '2026-09-20' });
  expect(await listWorkers(c.db, p.id)).toEqual([]);
  expect((await listWorkers(c.db, p.id, true))[0].status).toBe('left');
  const last = (await queue(c)).at(-1)!;
  expect(JSON.parse(last.payload)).toMatchObject({ id: w.id, status: 'left', name: 'Ram' });
});

test('attendance rows are appended, never updated', async () => {
  const c = await ctx('staff');
  await markAttendance(c, { propertyId: 'p', workerId: 'w', date: '2026-09-02', status: 'absent' });
  await markAttendance(c, { propertyId: 'p', workerId: 'w', date: '2026-09-02', status: 'present' });
  const rows = await listAttendance(c.db, 'w', '2026-09-01', '2026-09-30');
  expect(rows.map((r) => r.status)).toEqual(['absent', 'present']);
  expect(rows[0].created_by_role).toBe('staff');
});

test('markAttendance validates hours', async () => {
  const c = await ctx();
  await expect(markAttendance(c, { propertyId: 'p', workerId: 'w', date: '2026-09-02', status: 'hours' })).rejects.toThrow('hours');
});

test('voidAdvance copies the target and links voids_id; staff cannot void', async () => {
  const c = await ctx();
  const a = await addAdvance(c, { propertyId: 'p', workerId: 'w', type: 'advance', amountPaise: 300000, date: '2026-09-02' });
  const v = await voidAdvance(c, a.id);
  expect(v).toMatchObject({ voids_id: a.id, amount_paise: 300000, type: 'advance', worker_id: 'w' });
  expect((await listAdvances(c.db, 'w')).length).toBe(2);
  const s = { ...c, role: 'staff' as const };
  await expect(voidAdvance(s, a.id)).rejects.toThrow('owner');
});

test('writeoff requires a note', async () => {
  const c = await ctx();
  await expect(addAdvance(c, { propertyId: 'p', workerId: 'w', type: 'writeoff', amountPaise: 100, date: '2026-09-02' })).rejects.toThrow('note');
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/repos.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/repos/context.ts
import type { SqlDb } from '../db/sqlDb';
import type { Role } from '../domain/types';

export type RepoContext = { db: SqlDb; userId: string; role: Role; now: () => Date; newId: () => string };
```

```ts
// mobile-chukta/src/repos/write.ts
import { TABLE_COLUMNS, type SyncedTable } from '../db/schema';
import type { SqlDb, SqlParam } from '../db/sqlDb';
import type { RepoContext } from './context';

const toParam = (v: unknown): SqlParam => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : (v as SqlParam));

/** Local upsert of known columns only (used by pull; never enqueues). */
export async function upsertLocal(db: SqlDb, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  const cols = TABLE_COLUMNS[table].filter((c) => c in row);
  const placeholders = cols.map(() => '?').join(', ');
  await db.runAsync(`insert or replace into ${table} (${cols.join(', ')}) values (${placeholders})`, cols.map((c) => toParam(row[c])));
}

async function enqueue(ctx: RepoContext, table: SyncedTable, id: string, row: Record<string, unknown>): Promise<void> {
  const payload: Record<string, unknown> = {};
  for (const c of TABLE_COLUMNS[table]) if (c !== 'server_updated_at' && c in row) payload[c] = row[c];
  await ctx.db.runAsync(
    'insert into sync_queue (table_name, row_id, payload, created_at) values (?, ?, ?, ?)',
    [table, id, JSON.stringify(payload), ctx.now().toISOString()],
  );
}

export async function insertAndEnqueue(ctx: RepoContext, table: SyncedTable, row: Record<string, unknown>): Promise<void> {
  await ctx.db.withTransactionAsync(async () => {
    await upsertLocal(ctx.db, table, row);
    await enqueue(ctx, table, row.id as string, row);
  });
}

/** Updates a mutable table locally and enqueues the full resulting row (upsert by id on the server). */
export async function updateAndEnqueue(
  ctx: RepoContext, table: 'properties' | 'workers', id: string, patch: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  let merged: Record<string, unknown> = {};
  await ctx.db.withTransactionAsync(async () => {
    const current = await ctx.db.getFirstAsync<Record<string, unknown>>(`select * from ${table} where id = ?`, [id]);
    if (!current) throw new Error(`${table} ${id} not found`);
    merged = { ...current, ...patch };
    await upsertLocal(ctx.db, table, merged);
    await enqueue(ctx, table, id, merged);
  });
  return merged;
}
```

```ts
// mobile-chukta/src/repos/properties.ts
import type { SqlDb } from '../db/sqlDb';
import type { Property } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue, updateAndEnqueue } from './write';

export type PropertySettingsPatch = Partial<Pick<Property,
  'name' | 'address' | 'is_active' | 'default_pay_basis' | 'default_attendance_mode' | 'shift_hours' | 'weekly_off' | 'monthly_divisor'>>;

export async function createProperty(ctx: RepoContext, input: { shopId: string; name: string; address?: string }): Promise<Property> {
  const row: Property = {
    id: ctx.newId(), shop_id: input.shopId, name: input.name.trim(), address: input.address ?? null, is_active: 1,
    default_pay_basis: 'daily', default_attendance_mode: 'day', shift_hours: 8, weekly_off: 0, monthly_divisor: 'calendar',
    created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'properties', row);
  return row;
}

export async function updatePropertySettings(ctx: RepoContext, id: string, patch: PropertySettingsPatch): Promise<void> {
  await updateAndEnqueue(ctx, 'properties', id, patch);
}

export async function listProperties(db: SqlDb): Promise<Property[]> {
  return db.getAllAsync<Property>('select * from properties where is_active = 1 order by name');
}

export async function getProperty(db: SqlDb, id: string): Promise<Property | null> {
  return db.getFirstAsync<Property>('select * from properties where id = ?', [id]);
}
```

```ts
// mobile-chukta/src/repos/workers.ts
import type { SqlDb } from '../db/sqlDb';
import type { AttendanceMode, MonthlyDivisor, PayBasis, Worker } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue, updateAndEnqueue } from './write';

export type NewWorker = {
  propertyId: string; name: string; phone?: string; payBasis: PayBasis; ratePaise: number; joiningDate: string;
  attendanceMode?: AttendanceMode; shiftHours?: number; weeklyOff?: number | null; monthlyDivisor?: MonthlyDivisor;
};
export type WorkerPatch = Partial<Pick<Worker,
  'name' | 'phone' | 'pay_basis' | 'rate_paise' | 'joining_date' | 'status' | 'left_date' | 'attendance_mode'
  | 'shift_hours' | 'weekly_off_override' | 'weekly_off' | 'monthly_divisor'>>;

export async function createWorker(ctx: RepoContext, input: NewWorker): Promise<Worker> {
  if (!input.name.trim()) throw new Error('name is required');
  if (!Number.isInteger(input.ratePaise) || input.ratePaise <= 0) throw new Error('rate must be a positive amount');
  const row: Worker = {
    id: ctx.newId(), property_id: input.propertyId, name: input.name.trim(), phone: input.phone ?? null,
    pay_basis: input.payBasis, rate_paise: input.ratePaise, joining_date: input.joiningDate, status: 'active', left_date: null,
    attendance_mode: input.payBasis === 'hourly' ? 'hours' : input.attendanceMode ?? null,
    shift_hours: input.shiftHours ?? null,
    weekly_off_override: input.weeklyOff === undefined ? 0 : 1,
    weekly_off: input.weeklyOff ?? null,
    monthly_divisor: input.monthlyDivisor ?? null,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'workers', row);
  return row;
}

export async function updateWorker(ctx: RepoContext, id: string, patch: WorkerPatch): Promise<void> {
  if (patch.status === 'left' && !patch.left_date) throw new Error('left_date is required when a worker leaves');
  await updateAndEnqueue(ctx, 'workers', id, patch);
}

export async function listWorkers(db: SqlDb, propertyId: string, includeLeft = false): Promise<Worker[]> {
  return db.getAllAsync<Worker>(
    `select * from workers where property_id = ? ${includeLeft ? '' : "and status = 'active'"} order by name`, [propertyId]);
}

export async function getWorker(db: SqlDb, id: string): Promise<Worker | null> {
  return db.getFirstAsync<Worker>('select * from workers where id = ?', [id]);
}
```

```ts
// mobile-chukta/src/repos/attendance.ts
import type { SqlDb } from '../db/sqlDb';
import type { AttendanceEntry, AttendanceStatus } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue } from './write';

export async function markAttendance(
  ctx: RepoContext,
  input: { propertyId: string; workerId: string; date: string; status: AttendanceStatus; hours?: number; note?: string },
): Promise<AttendanceEntry> {
  if (input.status === 'hours' && (input.hours === undefined || input.hours < 0 || input.hours > 24)) {
    throw new Error('hours between 0 and 24 required for status hours');
  }
  const row: AttendanceEntry = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, date: input.date, status: input.status,
    hours: input.status === 'hours' ? input.hours! : null, note: input.note ?? null,
    created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null,
  };
  await insertAndEnqueue(ctx, 'attendance_entries', row);
  return row;
}

export async function listAttendance(db: SqlDb, workerId: string, from: string, to: string): Promise<AttendanceEntry[]> {
  return db.getAllAsync<AttendanceEntry>(
    'select * from attendance_entries where worker_id = ? and date between ? and ? order by created_at, id', [workerId, from, to]);
}
```

```ts
// mobile-chukta/src/repos/money.ts
import type { SqlDb } from '../db/sqlDb';
import type { AdvanceEntry, AdvanceType, PaymentMode, WagePayment } from '../domain/types';
import type { RepoContext } from './context';
import { insertAndEnqueue } from './write';

type Base = { propertyId: string; workerId: string; amountPaise: number; date: string; mode?: PaymentMode; note?: string };

function assertAmount(amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) throw new Error('amount must be a positive number of paise');
}

function audit(ctx: RepoContext) {
  return { created_by: ctx.userId, created_by_role: ctx.role, created_at: ctx.now().toISOString(), server_updated_at: null };
}

export async function addAdvance(ctx: RepoContext, input: Base & { type: AdvanceType }): Promise<AdvanceEntry> {
  assertAmount(input.amountPaise);
  if (input.type === 'writeoff' && !input.note?.trim()) throw new Error('a note is required for a write-off');
  const row: AdvanceEntry = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, type: input.type, amount_paise: input.amountPaise,
    date: input.date, mode: input.mode ?? null, note: input.note ?? null, voids_id: null, ...audit(ctx),
  };
  await insertAndEnqueue(ctx, 'advance_entries', row);
  return row;
}

export async function addPayment(ctx: RepoContext, input: Base): Promise<WagePayment> {
  assertAmount(input.amountPaise);
  const row: WagePayment = {
    id: ctx.newId(), property_id: input.propertyId, worker_id: input.workerId, amount_paise: input.amountPaise,
    date: input.date, mode: input.mode ?? null, note: input.note ?? null, voids_id: null, ...audit(ctx),
  };
  await insertAndEnqueue(ctx, 'wage_payments', row);
  return row;
}

async function voidRow<T extends AdvanceEntry | WagePayment>(
  ctx: RepoContext, table: 'advance_entries' | 'wage_payments', targetId: string,
): Promise<T> {
  if (ctx.role !== 'owner') throw new Error('only the owner can correct money entries');
  const target = await ctx.db.getFirstAsync<T>(`select * from ${table} where id = ?`, [targetId]);
  if (!target) throw new Error('entry not found');
  if (target.voids_id) throw new Error('cannot correct a correction');
  const row = { ...target, id: ctx.newId(), voids_id: target.id, note: null, ...audit(ctx) } as T;
  await insertAndEnqueue(ctx, table, row as unknown as Record<string, unknown>);
  return row;
}

export const voidAdvance = (ctx: RepoContext, targetId: string) => voidRow<AdvanceEntry>(ctx, 'advance_entries', targetId);
export const voidPayment = (ctx: RepoContext, targetId: string) => voidRow<WagePayment>(ctx, 'wage_payments', targetId);

export async function listAdvances(db: SqlDb, workerId: string): Promise<AdvanceEntry[]> {
  return db.getAllAsync<AdvanceEntry>('select * from advance_entries where worker_id = ? order by date, created_at', [workerId]);
}

export async function listPayments(db: SqlDb, workerId: string): Promise<WagePayment[]> {
  return db.getAllAsync<WagePayment>('select * from wage_payments where worker_id = ? order by date, created_at', [workerId]);
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd mobile-chukta && npx jest src/__tests__/repos.test.ts && npx tsc --noEmit`
Expected: 6 passed, and tsc is clean.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/repos mobile-chukta/src/__tests__/repos.test.ts
git commit -m "feat(chukta): local repositories with append-only entries and sync enqueue"
```

---

### Task 11: Push sync

**Files:**
- Create: `mobile-chukta/src/sync/push.ts`
- Test: `mobile-chukta/src/__tests__/push.test.ts`

**Interfaces:**
- Consumes: `SqlDb`, `migrate`, `SyncedTable` (Task 8).
- Produces:
  - `type RemoteError = { status: number | null; code: string | null; message: string }`
  - `interface RemoteWriter { upsert(table: SyncedTable, row: Record<string, unknown>): Promise<RemoteError | null> }`
  - `isPermanent(err: RemoteError): boolean`
  - `flushPush(db: SqlDb, remote: RemoteWriter, hasSession: () => Promise<boolean>): Promise<{ pushed: number; dead: number; stopped: boolean }>`
  - `listDead(db): Promise<{ seq: number; table_name: string; row_id: string; last_error: string | null }[]>`

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/push.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { flushPush, isPermanent, listDead, type RemoteError, type RemoteWriter } from '../sync/push';

async function dbWith(items: [string, string][]) {
  const db = openTestDb();
  await migrate(db);
  for (const [t, id] of items) {
    await db.runAsync('insert into sync_queue (table_name, row_id, payload, created_at) values (?, ?, ?, ?)', [t, id, JSON.stringify({ id }), 't']);
  }
  return db;
}
const remote = (fn: (t: string, id: string) => RemoteError | null, seen: string[] = []): RemoteWriter => ({
  async upsert(t, row) { seen.push(`${t}:${row.id}`); return fn(t, row.id as string); },
});
const pending = async (db: Awaited<ReturnType<typeof dbWith>>) =>
  (await db.getAllAsync<{ row_id: string }>("select row_id from sync_queue where status = 'pending' order by seq")).map((r) => r.row_id);

test('pushes in queue order and removes successes', async () => {
  const db = await dbWith([['properties', 'p1'], ['workers', 'w1']]);
  const seen: string[] = [];
  const r = await flushPush(db, remote(() => null, seen), async () => true);
  expect(seen).toEqual(['properties:p1', 'workers:w1']);
  expect(r).toEqual({ pushed: 2, dead: 0, stopped: false });
  expect(await pending(db)).toEqual([]);
});

test('retryable error stops the flush and keeps order', async () => {
  const db = await dbWith([['workers', 'w1'], ['workers', 'w2']]);
  const r = await flushPush(db, remote((_, id) => (id === 'w1' ? { status: 503, code: null, message: 'down' } : null)), async () => true);
  expect(r.stopped).toBe(true);
  expect(await pending(db)).toEqual(['w1', 'w2']);
  const row = await db.getFirstAsync<{ attempts: number }>("select attempts from sync_queue where row_id = 'w1'");
  expect(row?.attempts).toBe(1);
});

test('permanent error marks the row dead and continues', async () => {
  const db = await dbWith([['workers', 'w1'], ['workers', 'w2']]);
  const r = await flushPush(db, remote((_, id) => (id === 'w1' ? { status: 403, code: '42501', message: 'rls' } : null)), async () => true);
  expect(r).toEqual({ pushed: 1, dead: 1, stopped: false });
  expect((await listDead(db)).map((d) => [d.row_id, d.last_error])).toEqual([['w1', 'rls']]);
});

test('no session: nothing attempted, attempts unchanged', async () => {
  const db = await dbWith([['workers', 'w1']]);
  const seen: string[] = [];
  const r = await flushPush(db, remote(() => null, seen), async () => false);
  expect(seen).toEqual([]);
  expect(r.stopped).toBe(true);
});

test('isPermanent classification', () => {
  expect(isPermanent({ status: 400, code: '23514', message: '' })).toBe(true);
  expect(isPermanent({ status: 401, code: null, message: '' })).toBe(false);
  expect(isPermanent({ status: 409, code: '23505', message: '' })).toBe(true);
  expect(isPermanent({ status: 429, code: null, message: '' })).toBe(false);
  expect(isPermanent({ status: null, code: null, message: 'Network request failed' })).toBe(false);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/push.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/sync/push.ts
import type { SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';

export type RemoteError = { status: number | null; code: string | null; message: string };
export interface RemoteWriter {
  upsert(table: SyncedTable, row: Record<string, unknown>): Promise<RemoteError | null>;
}

/** 4xx (except auth/throttle/timeout) or a Postgres class 22/23/42 error will never succeed on retry. */
export function isPermanent(err: RemoteError): boolean {
  if (err.code && /^(22|23|42)/.test(err.code)) return true;
  if (err.status === null) return false;
  return err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}

type QueueRow = { seq: number; table_name: SyncedTable; row_id: string; payload: string };

export async function flushPush(
  db: SqlDb, remote: RemoteWriter, hasSession: () => Promise<boolean>,
): Promise<{ pushed: number; dead: number; stopped: boolean }> {
  if (!(await hasSession())) return { pushed: 0, dead: 0, stopped: true };
  const rows = await db.getAllAsync<QueueRow>("select seq, table_name, row_id, payload from sync_queue where status = 'pending' order by seq");
  let pushed = 0;
  let dead = 0;
  for (const row of rows) {
    const err = await remote.upsert(row.table_name, JSON.parse(row.payload));
    if (!err) {
      await db.runAsync('delete from sync_queue where seq = ?', [row.seq]);
      pushed++;
      continue;
    }
    if (isPermanent(err)) {
      await db.runAsync("update sync_queue set status = 'dead', attempts = attempts + 1, last_error = ? where seq = ?", [err.message, row.seq]);
      dead++;
      continue;
    }
    // Retryable: keep order (children depend on parents), try again next flush.
    await db.runAsync('update sync_queue set attempts = attempts + 1, last_error = ? where seq = ?', [err.message, row.seq]);
    return { pushed, dead, stopped: true };
  }
  return { pushed, dead, stopped: false };
}

export async function listDead(db: SqlDb) {
  return db.getAllAsync<{ seq: number; table_name: string; row_id: string; last_error: string | null }>(
    "select seq, table_name, row_id, last_error from sync_queue where status = 'dead' order by seq");
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `cd mobile-chukta && npx jest src/__tests__/push.test.ts && npx tsc --noEmit`
Expected: 5 passed, and tsc is clean.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/sync/push.ts mobile-chukta/src/__tests__/push.test.ts
git commit -m "feat(chukta): ordered push sync with dead-letter and session guard"
```

---

### Task 12: Pull sync and the Supabase remote adapter

**Files:**
- Create: `mobile-chukta/src/sync/pull.ts`, `mobile-chukta/src/sync/remote.ts`
- Test: `mobile-chukta/src/__tests__/pull.test.ts`

**Interfaces:**
- Consumes: `SqlDb`, `SYNCED_TABLES`, `SyncedTable` (Task 8); `upsertLocal` (Task 10); `RemoteWriter`, `RemoteError` (Task 11); `supabase` (Task 6).
- Produces:
  - `type Cursor = { ts: string; id: string }`
  - `interface RemoteReader { fetchSince(table: SyncedTable, cursor: Cursor | null, limit: number): Promise<{ rows: Record<string, unknown>[]; error: RemoteError | null }> }`
  - `pullAll(db: SqlDb, remote: RemoteReader, pageSize?: number): Promise<Record<SyncedTable, number>>`
  - `createSupabaseRemote(client: SupabaseClient): RemoteWriter & RemoteReader`

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/pull.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate, type SyncedTable } from '../db/schema';
import { pullAll, type Cursor, type RemoteReader } from '../sync/pull';

const worker = (id: string, ts: string, name = id) => ({
  id, property_id: 'p', name, phone: null, pay_basis: 'daily', rate_paise: 50000, joining_date: '2026-09-01', status: 'active',
  left_date: null, attendance_mode: null, shift_hours: null, weekly_off_override: false, weekly_off: null, monthly_divisor: null,
  created_by: 'u', created_by_role: 'owner', created_at: 't', server_updated_at: ts,
});

function fakeRemote(data: Partial<Record<SyncedTable, Record<string, unknown>[]>>, calls: string[] = []): RemoteReader {
  return {
    async fetchSince(table, cursor: Cursor | null, limit) {
      calls.push(`${table}:${cursor ? `${cursor.ts}|${cursor.id}` : '-'}`);
      const rows = (data[table] ?? [])
        .filter((r) => !cursor || (r.server_updated_at as string) > cursor.ts
          || ((r.server_updated_at as string) === cursor.ts && (r.id as string) > cursor.id))
        .sort((a, b) => `${a.server_updated_at}|${a.id}`.localeCompare(`${b.server_updated_at}|${b.id}`))
        .slice(0, limit);
      return { rows, error: null };
    },
  };
}

test('pages through rows with equal timestamps using (ts, id) cursor', async () => {
  const db = openTestDb();
  await migrate(db);
  const rows = ['a', 'b', 'c'].map((id) => worker(id, '2026-09-30T10:00:00Z'));
  const counts = await pullAll(db, fakeRemote({ workers: rows }), 2);
  expect(counts.workers).toBe(3);
  const cur = await db.getFirstAsync<{ cursor: string }>("select cursor from sync_cursor where table_name = 'workers'");
  expect(JSON.parse(cur!.cursor)).toEqual({ ts: '2026-09-30T10:00:00Z', id: 'c' });
});

test('second pull resumes from cursor', async () => {
  const db = openTestDb();
  await migrate(db);
  const calls: string[] = [];
  const remote = fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z')] }, calls);
  await pullAll(db, remote);
  await pullAll(db, remote);
  expect(calls.filter((c) => c.startsWith('workers')).at(-1)).toBe('workers:2026-09-30T10:00:00Z|a');
});

test('rows with pending local changes are not overwritten', async () => {
  const db = openTestDb();
  await migrate(db);
  await db.runAsync("insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at) values ('a','p','Local','daily',1,'2026-09-01','u','owner','t')");
  await db.runAsync("insert into sync_queue (table_name, row_id, payload, created_at) values ('workers','a','{}','t')");
  await pullAll(db, fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z', 'Server')] }));
  const w = await db.getFirstAsync<{ name: string }>("select name from workers where id = 'a'");
  expect(w?.name).toBe('Local');
});

test('booleans from the server are stored as 0/1', async () => {
  const db = openTestDb();
  await migrate(db);
  await pullAll(db, fakeRemote({ workers: [worker('a', '2026-09-30T10:00:00Z')] }));
  const w = await db.getFirstAsync<{ weekly_off_override: number }>("select weekly_off_override from workers where id = 'a'");
  expect(w?.weekly_off_override).toBe(0);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/pull.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `pull.ts`**

```ts
// mobile-chukta/src/sync/pull.ts
import { SYNCED_TABLES, type SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';
import { upsertLocal } from '../repos/write';
import type { RemoteError } from './push';

export type Cursor = { ts: string; id: string };
export interface RemoteReader {
  fetchSince(table: SyncedTable, cursor: Cursor | null, limit: number): Promise<{ rows: Record<string, unknown>[]; error: RemoteError | null }>;
}

async function getCursor(db: SqlDb, table: SyncedTable): Promise<Cursor | null> {
  const row = await db.getFirstAsync<{ cursor: string }>('select cursor from sync_cursor where table_name = ?', [table]);
  return row ? (JSON.parse(row.cursor) as Cursor) : null;
}

export async function pullAll(db: SqlDb, remote: RemoteReader, pageSize = 500): Promise<Record<SyncedTable, number>> {
  const counts = Object.fromEntries(SYNCED_TABLES.map((t) => [t, 0])) as Record<SyncedTable, number>;
  for (const table of SYNCED_TABLES) {
    let cursor = await getCursor(db, table);
    for (;;) {
      const { rows, error } = await remote.fetchSince(table, cursor, pageSize);
      if (error) throw new Error(`pull ${table}: ${error.message}`);
      if (rows.length === 0) break;
      const pendingIds = new Set(
        (await db.getAllAsync<{ row_id: string }>("select row_id from sync_queue where table_name = ? and status = 'pending'", [table]))
          .map((r) => r.row_id));
      await db.withTransactionAsync(async () => {
        for (const row of rows) {
          if (!pendingIds.has(row.id as string)) await upsertLocal(db, table, row);
        }
        const last = rows[rows.length - 1];
        cursor = { ts: last.server_updated_at as string, id: last.id as string };
        await db.runAsync('insert or replace into sync_cursor (table_name, cursor) values (?, ?)', [table, JSON.stringify(cursor)]);
      });
      counts[table] += rows.length;
      if (rows.length < pageSize) break;
    }
  }
  return counts;
}
```

`upsertLocal` already converts booleans to 0/1 (Task 10 `toParam`).

- [ ] **Step 4: Implement `remote.ts`**

```ts
// mobile-chukta/src/sync/remote.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { TABLE_COLUMNS, type SyncedTable } from '../db/schema';
import type { Cursor, RemoteReader } from './pull';
import type { RemoteError, RemoteWriter } from './push';

const BOOLEAN_COLUMNS = new Set(['is_active', 'weekly_off_override']);

function toServer(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[k] = BOOLEAN_COLUMNS.has(k) ? v === 1 || v === true : v;
  return out;
}

function toError(e: { code?: string; message: string } | null, status: number | null): RemoteError | null {
  return e ? { status, code: e.code ?? null, message: e.message } : null;
}

export function createSupabaseRemote(client: SupabaseClient): RemoteWriter & RemoteReader {
  const chukta = () => client.schema('chukta');
  return {
    async upsert(table, row) {
      try {
        const { error, status } = await chukta().from(table).upsert(toServer(row), { onConflict: 'id' });
        return toError(error, status);
      } catch (e) {
        return { status: null, code: null, message: e instanceof Error ? e.message : String(e) };
      }
    },
    async fetchSince(table: SyncedTable, cursor: Cursor | null, limit: number) {
      try {
        let q = chukta().from(table).select(TABLE_COLUMNS[table].join(','))
          .order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(limit);
        if (cursor) {
          q = q.or(`server_updated_at.gt.${cursor.ts},and(server_updated_at.eq.${cursor.ts},id.gt.${cursor.id})`);
        }
        const { data, error, status } = await q;
        return { rows: (data ?? []) as unknown as Record<string, unknown>[], error: toError(error, status) };
      } catch (e) {
        return { rows: [], error: { status: null, code: null, message: e instanceof Error ? e.message : String(e) } };
      }
    },
  };
}
```

The server returns `server_updated_at` as an ISO string with a timezone offset. Because the cursor values are used verbatim in the `or` filter, PostgREST parses them. Timestamps containing `+` must be URL-safe, and supabase-js encodes the query, so this is fine.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd mobile-chukta && npx jest src/__tests__/pull.test.ts && npx tsc --noEmit`
Expected: 4 passed, and tsc is clean.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/sync/pull.ts mobile-chukta/src/sync/remote.ts mobile-chukta/src/__tests__/pull.test.ts
git commit -m "feat(chukta): cursor-based pull sync and Supabase remote adapter"
```

---

### Task 13: Auth service (owner and staff login, restore, logout)

**Files:**
- Create: `mobile-chukta/src/auth/identity.ts`, `mobile-chukta/src/auth/authService.ts`
- Test: `mobile-chukta/src/__tests__/authService.test.ts`

**Interfaces:**
- Consumes: the `login` edge function (Phase 0) and `chukta-login-staff` (Task 5) over HTTP.
- Produces:
  - `type Identity = { kind: 'owner'; userId: string; shopId: string; phone: string } | { kind: 'staff'; userId: string; staffId: string; staffName: string; propertyId: string; propertyName: string }`
  - `identityKey(i: Identity): string` (`owner_<shopId>` / `staff_<staffId>`)
  - `type AuthErrorKey = 'auth.error.invalidCredentials' | 'auth.error.passwordResetRequired' | 'auth.error.notSubscribed' | 'auth.error.wrongPin' | 'auth.error.tooManyAttempts' | 'auth.error.ambiguousPin' | 'auth.error.network' | 'auth.error.unknown'`
  - `class AuthError extends Error { key: AuthErrorKey }`
  - `interface AuthDeps { post(path: string, body: unknown): Promise<{ status: number; body: any }>; setSession(access: string, refresh: string): Promise<void>; getSession(): Promise<{ hasSession: boolean; retryableError: boolean }>; signOutLocal(): Promise<void>; clearStoredSession(): Promise<void>; saveIdentity(i: Identity | null): Promise<void>; loadIdentity(): Promise<Identity | null>; deviceId(): Promise<string> }`
  - `createAuthService(deps: AuthDeps, timeoutMs?: number): { loginOwner(phone10: string, password: string): Promise<Identity>; loginStaff(ownerPhone10: string, pin: string): Promise<Identity>; restore(): Promise<Identity | null>; logout(): Promise<void> }`

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/authService.test.ts
import { AuthError, createAuthService, type AuthDeps } from '../auth/authService';
import type { Identity } from '../auth/identity';

function deps(over: Partial<AuthDeps> = {}) {
  const log: string[] = [];
  let stored: Identity | null = null;
  const d: AuthDeps = {
    post: async () => ({ status: 500, body: {} }),
    setSession: async (a, r) => { log.push(`setSession:${a}:${r}`); },
    getSession: async () => ({ hasSession: true, retryableError: false }),
    signOutLocal: async () => { log.push('signOut'); },
    clearStoredSession: async () => { log.push('clearStored'); },
    saveIdentity: async (i) => { stored = i; log.push(`save:${i ? i.kind : 'null'}`); },
    loadIdentity: async () => stored,
    deviceId: async () => 'dev1',
    ...over,
  };
  return { d, log, setStored: (i: Identity | null) => { stored = i; } };
}

test('loginOwner posts app=chukta with +91 and stores identity', async () => {
  const calls: unknown[] = [];
  const { d, log } = deps({
    post: async (path, body) => {
      calls.push([path, body]);
      return { status: 200, body: { session: { access_token: 'a', refresh_token: 'r', user: { id: 'u1' } }, shop: { id: 'shop1', phone: '+919800000001' } } };
    },
  });
  const id = await createAuthService(d).loginOwner('9800000001', 'secret1');
  expect(calls[0]).toEqual(['login', { phone: '+919800000001', password: 'secret1', app: 'chukta', deviceId: 'dev1' }]);
  expect(id).toEqual({ kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+919800000001' });
  expect(log).toEqual(['setSession:a:r', 'save:owner']);
});

test.each([
  [401, { error: 'Invalid phone number or password' }, 'auth.error.invalidCredentials'],
  [401, { error: 'password_reset_required' }, 'auth.error.passwordResetRequired'],
  [403, { error: 'not_subscribed', app: 'chukta' }, 'auth.error.notSubscribed'],
  [500, { error: 'Internal error' }, 'auth.error.unknown'],
])('loginOwner maps %s %j', async (status, body, key) => {
  const { d } = deps({ post: async () => ({ status, body }) });
  await expect(createAuthService(d).loginOwner('9800000001', 'x')).rejects.toMatchObject({ key });
});

test('loginStaff returns staff identity; maps pin errors', async () => {
  const ok = deps({
    post: async () => ({ status: 200, body: {
      session: { access_token: 'a', refresh_token: 'r', user: { id: 'su' } }, staff: { id: 's1', name: 'Mgr' }, property: { id: 'p1', name: 'Main' } } }),
  });
  expect(await createAuthService(ok.d).loginStaff('9800000001', '4821')).toEqual({
    kind: 'staff', userId: 'su', staffId: 's1', staffName: 'Mgr', propertyId: 'p1', propertyName: 'Main',
  });
  for (const [status, error, key] of [[401, 'wrong_pin', 'auth.error.wrongPin'], [429, 'too_many_attempts', 'auth.error.tooManyAttempts'], [409, 'ambiguous_pin', 'auth.error.ambiguousPin']] as const) {
    const { d } = deps({ post: async () => ({ status, body: { error } }) });
    await expect(createAuthService(d).loginStaff('9800000001', '4821')).rejects.toMatchObject({ key });
  }
});

test('network failure maps to auth.error.network', async () => {
  const { d } = deps({ post: async () => { throw new TypeError('Network request failed'); } });
  const err = await createAuthService(d).loginOwner('9800000001', 'x').catch((e) => e);
  expect(err).toBeInstanceOf(AuthError);
  expect(err.key).toBe('auth.error.network');
});

test('restore: keeps identity offline, clears it when session is truly gone', async () => {
  const owner: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+91' };
  const offline = deps({ getSession: async () => ({ hasSession: false, retryableError: true }) });
  offline.setStored(owner);
  expect(await createAuthService(offline.d).restore()).toEqual(owner);

  const gone = deps({ getSession: async () => ({ hasSession: false, retryableError: false }) });
  gone.setStored(owner);
  expect(await createAuthService(gone.d).restore()).toBeNull();
  expect(gone.log).toContain('save:null');
});

test('restore: a slow getSession times out and keeps the user signed in', async () => {
  const owner: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+91' };
  const slow = deps({ getSession: () => new Promise(() => {}) });
  slow.setStored(owner);
  expect(await createAuthService(slow.d, 20).restore()).toEqual(owner);
});

test('logout signs out locally, clears stored session and identity', async () => {
  const { d, log } = deps();
  await createAuthService(d).logout();
  expect(log).toEqual(['signOut', 'clearStored', 'save:null']);
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/authService.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement `identity.ts`**

```ts
// mobile-chukta/src/auth/identity.ts
export type Identity =
  | { kind: 'owner'; userId: string; shopId: string; phone: string }
  | { kind: 'staff'; userId: string; staffId: string; staffName: string; propertyId: string; propertyName: string };

/** Database-file key: owner data and each staff member's data never share a local database. */
export function identityKey(i: Identity): string {
  return i.kind === 'owner' ? `owner_${i.shopId}` : `staff_${i.staffId}`;
}
```

- [ ] **Step 4: Implement `authService.ts`**

```ts
// mobile-chukta/src/auth/authService.ts
import type { Identity } from './identity';

export type AuthErrorKey =
  | 'auth.error.invalidCredentials' | 'auth.error.passwordResetRequired' | 'auth.error.notSubscribed'
  | 'auth.error.wrongPin' | 'auth.error.tooManyAttempts' | 'auth.error.ambiguousPin'
  | 'auth.error.network' | 'auth.error.unknown';

export class AuthError extends Error {
  constructor(public key: AuthErrorKey) {
    super(key);
  }
}

export interface AuthDeps {
  post(path: string, body: unknown): Promise<{ status: number; body: any }>;
  setSession(access: string, refresh: string): Promise<void>;
  getSession(): Promise<{ hasSession: boolean; retryableError: boolean }>;
  signOutLocal(): Promise<void>;
  clearStoredSession(): Promise<void>;
  saveIdentity(i: Identity | null): Promise<void>;
  loadIdentity(): Promise<Identity | null>;
  deviceId(): Promise<string>;
}

const OWNER_ERRORS: Record<string, AuthErrorKey> = {
  'Invalid phone number or password': 'auth.error.invalidCredentials',
  password_reset_required: 'auth.error.passwordResetRequired',
  not_subscribed: 'auth.error.notSubscribed',
};
const STAFF_ERRORS: Record<string, AuthErrorKey> = {
  wrong_pin: 'auth.error.wrongPin',
  too_many_attempts: 'auth.error.tooManyAttempts',
  ambiguous_pin: 'auth.error.ambiguousPin',
};

export function createAuthService(deps: AuthDeps, timeoutMs = 3000) {
  async function call(path: string, body: unknown, errors: Record<string, AuthErrorKey>) {
    let res: { status: number; body: any };
    try {
      res = await deps.post(path, body);
    } catch {
      throw new AuthError('auth.error.network');
    }
    if (res.status !== 200) throw new AuthError(errors[res.body?.error] ?? 'auth.error.unknown');
    await deps.setSession(res.body.session.access_token, res.body.session.refresh_token);
    return res.body;
  }

  return {
    async loginOwner(phone10: string, password: string): Promise<Identity> {
      const body = await call('login', { phone: `+91${phone10}`, password, app: 'chukta', deviceId: await deps.deviceId() }, OWNER_ERRORS);
      const identity: Identity = { kind: 'owner', userId: body.session.user.id, shopId: body.shop.id, phone: body.shop.phone };
      await deps.saveIdentity(identity);
      return identity;
    },

    async loginStaff(ownerPhone10: string, pin: string): Promise<Identity> {
      const body = await call('chukta-login-staff', { ownerPhone: `+91${ownerPhone10}`, pin, deviceId: await deps.deviceId() }, STAFF_ERRORS);
      const identity: Identity = {
        kind: 'staff', userId: body.session.user.id, staffId: body.staff.id, staffName: body.staff.name,
        propertyId: body.property.id, propertyName: body.property.name,
      };
      await deps.saveIdentity(identity);
      return identity;
    },

    /** Offline-first restore: only a definite "no session" (not a network failure or a timeout) signs the user out. */
    async restore(): Promise<Identity | null> {
      const identity = await deps.loadIdentity();
      if (!identity) return null;
      const check = await Promise.race([
        deps.getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      if (check && !check.hasSession && !check.retryableError) {
        await deps.saveIdentity(null);
        return null;
      }
      return identity;
    },

    async logout(): Promise<void> {
      await deps.signOutLocal().catch(() => {});
      await deps.clearStoredSession().catch(() => {});
      await deps.saveIdentity(null);
    },
  };
}
```

The real `AuthDeps` wiring (fetch with `apikey`, `supabase.auth.setSession` / `getSession` with `isAuthRetryableFetchError`, the AsyncStorage keys `chukta.identity` / `sb-<ref>-auth-token`, and `expo-crypto` device id) is done in Plan 1B, where the app shell uses it.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `cd mobile-chukta && npx jest src/__tests__/authService.test.ts && npx tsc --noEmit`
Expected: 10 passed (4 `test.each` rows plus 6 tests), and tsc is clean.

- [ ] **Step 6: Run the full mobile suite, then commit**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: all suites pass.

```bash
git add mobile-chukta/src/auth mobile-chukta/src/__tests__/authService.test.ts
git commit -m "feat(chukta): owner and staff auth service with offline-safe restore"
```

---

### Task 14: Deploy and verify (with the user)

This task changes production, and Claude Code's auto mode blocks `db push` and `functions deploy`. **The user runs the marked commands.** Claude runs the read-only checks and the test wrapper.

- [ ] **Step 1 (user):** `supabase db push --linked` from the **worktree/branch** that has the migrations.

- [ ] **Step 2 (user, immediately):** log in as an existing ShopAI owner in the app or web, and read one ShopAI screen. If login fails, restore the Phase 0 hook body (`supabase/migrations/20260928100100_account_token_hook.sql` function) via SQL right away.

- [ ] **Step 3:** (user) Dashboard → API → Exposed schemas: add `chukta`. Then (Claude) run `notify pgrst, 'reload schema'` via `supabase db query --linked`.

- [ ] **Step 4 (Claude):** run the pgTAP files through the tapwrap wrapper. Expect: `chukta_schema` 1..12, `chukta_access` 1..28, and Phase 0 `token_hook` 1..17 (re-run because the hook changed). If `set local role supabase_auth_admin` is not permitted on hosted, record it and rely on Step 2 instead.

- [ ] **Step 5 (user):** `supabase functions deploy chukta-staff chukta-login-staff --use-api`.

- [ ] **Step 6 (Claude):** smoke tests:
  - `chukta-login-staff` with an unknown phone → 401 `wrong_pin`;
  - `chukta-staff/create` without auth → 401;
  - anon REST with `Accept-Profile: chukta` → permission denied.

- [ ] **Step 7 (user + Claude):** end to end with a Chukta-subscribed test owner:
  - owner login `app:'chukta'`, then create a property via REST (`Content-Profile: chukta`);
  - `chukta-staff/create`;
  - staff login → decode the token to confirm `app=chukta`, `app_role=staff`, `property_id`;
  - the **same staff member logs in twice within 60 s** (generateLink frequency) and a burst of 5 staff logins (GoTrue token-verification limit). Raise Dashboard → Auth → Rate limits if throttled;
  - **11** wrong PINs → 429, then `select chukta.clear_pin_attempts('<shop id>')`;
  - push/pull round trip of a property and a worker with `is_active` / `weekly_off_override` / `shift_hours`, confirming the booleans, numerics and server timestamp format parse;
  - archive the property → the staff member's next refresh fails.

- [ ] **Step 8: Record the results**

Record the results in `docs/superpowers/notes/` (append under a new heading in `2026-09-29-phase0-preflight.md`, or a new note file), then commit:

```bash
git add docs/superpowers/notes/
git commit -m "docs: record Chukta Phase 1A deploy verification"
```

---

## Self-Review Notes

- **Spec coverage:**
  - §4 → Task 1
  - §5.1–5.2 → Task 2
  - §6 → Task 9 (all required test cases)
  - §7 → Tasks 3–5
  - §8:
    - stack/identity → Task 6
    - i18n and formatting → Task 7
    - local DB → Task 8
    - push/pull → Tasks 11–12
    - sessions/auth → Task 13
  - §10 error mapping → Tasks 5, 11, 13
  - §11 → pgTAP (Tasks 1–2, 14), Deno (3–5), Jest (7–13)
  - §12 item 1 → Task 14 Step 6
  - **In Plan 1B:** §8 screens and the auth deps wiring, §9 web and admin, §11 manual owner+staff end to end, and the rest of the UI strings.
- **Type consistency:**
  - Row types use the server's snake_case column names in both SQLite and Postgres (`TABLE_COLUMNS`).
  - `Role`, `SyncedTable`, `RemoteError`, `Cursor` and `Identity` are each defined once and imported.
  - Booleans are `0 | 1` locally and converted to real booleans only in `remote.ts` `toServer`.
- **Known limits (accepted):**
  - The push queue sends each row upsert separately (no batching). That's fine at Phase 1 volumes.
  - The pull fetches every row this login can see per table (RLS-scoped); there's no per-property filter, and none is needed because RLS already scopes it.
