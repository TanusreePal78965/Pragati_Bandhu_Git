# Phase 0: Shared Account & App-Scoped Auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ShopAI's anon-key access with real Supabase Auth sessions that carry an `app` claim. One phone+password account works for both ShopAI and Chukta. ShopAI data is locked behind RLS in the same release, so Chukta Phase 1 can start on a secure base.

**Architecture:**
- **Identity.** Each shop gets one Supabase Auth user (`shops.auth_user_id`). The auth user signs in with a synthetic email derived from the shop id, so no SMS provider is needed.
- **Login.** The `login` edge function looks the shop up by phone, signs in, records `app_sessions(session_id → app)`, and returns the session.
- **Claims.** A Custom Access Token Hook stamps `app` and `shop_id` into every access token, and RLS checks them.
- **Subscriptions.** Per-app entitlement lives in `app_subscriptions`. The old `shops.plan_*` and `shops.password_hash` columns are dropped.
- **Existing shops.** No real users yet, so there's no lazy migration and no staged rollout. Existing shop rows are kept, but they can't log in until the owner resets the password through the new OTP flow.

**Tech Stack:** Supabase Postgres 15 + pgTAP, Supabase Edge Functions (Deno), `@supabase/supabase-js@2.47.10` (esm.sh), Expo 54 / RN 0.81 (ShopAI), Vite + React (web).

**Spec:** `docs/superpowers/specs/2026-09-28-chukta-shared-supabase-design.md`

## Global Constraints

- Supabase project ref: `mhtqufyaxpunhenqropn`. There is no local Docker stack. Migrations, pgTAP tests and functions all run against the linked project; this is safe because the project has no real users. pgTAP tests run inside `begin … rollback` and leave no data behind. If your CLI version rejects `supabase test db --linked`, use `supabase test db --db-url "<Dashboard → Connect → direct connection string>"` instead.
- All schema changes go through timestamped migrations in `supabase/migrations/`, named `YYYYMMDDHHMMSS_account_*.sql` or `_shopai_*.sql`.
- App names are exactly `'shopai'` and `'chukta'`, enforced by a `check` constraint wherever they're stored.
- Hook claims: `app` (text) and `shop_id` (uuid as text). Chukta staff claims (`app_role`, `property_id`) are **out of scope**.
- Auth user email is `s-<shop_id>@<AUTH_EMAIL_DOMAIN>`. Default domain is `accounts.pragatibandhu.internal`, overridable with the env var `AUTH_EMAIL_DOMAIN`. No email is ever sent.
- Login error codes (`body.error`):
  - `'Invalid phone number or password'` (401)
  - `'password_reset_required'` (401, shop exists but has no auth user)
  - `'not_subscribed'` (403)
- Minimum password length is 6.
- Never commit secrets (`mobile-shopai/.env.local`, `web/.env*`).
- No shared code between `mobile-shopai/` and `mobile-chukta/`. Edge functions share code only through `supabase/functions/_shared/`.

## File Map

| File | Responsibility |
|---|---|
| `supabase/migrations/20260928100000_account_tables.sql` | `shops.auth_user_id`, `app_subscriptions` (+ backfill), `app_sessions`, `payments.app`, `jwt_app()` / `jwt_shop_id()`; drops `shops.plan_type`, `plan_expires_at`, `password_hash` |
| `supabase/migrations/20260928100100_account_token_hook.sql` | `custom_access_token_hook`, `revoke_user_sessions` |
| `supabase/migrations/20260928100200_shopai_rls_lockdown.sql` | Replaces permissive policies, tightens grants |
| `supabase/tests/database/*.test.sql` | pgTAP tests for the three migrations |
| `supabase/functions/_shared/account.ts` | CORS/json, `parseApp(s)`, `authEmailForShop`, `decodeJwtPayload`, shared types |
| `supabase/functions/_shared/authUsers.ts` | `ensureAuthUser` (create or update the auth user for a shop) |
| `supabase/functions/_shared/firebase.ts` | `verifyFirebasePhone(idToken)` |
| `supabase/functions/login/{handler,index}.ts` | App-scoped login |
| `supabase/functions/register/{handler,index}.ts` | Registration + `check-phone` (replaces `register-shop`, which is deleted) |
| `supabase/functions/reset-password/{handler,index}.ts` | OTP-verified reset. This is also how existing shops get access |
| `supabase/functions/payments/{index,expiry}.ts` | Per-app subscriptions, `/lookup`, `/admin/settings`, no password hashes to admin |
| `mobile-shopai/src/lib/supabase.ts`, `services/authService.ts`, `services/subscription.ts`, `services/syncService.ts`, `screens/settings/SettingsScreen.tsx`, `screens/settings/EditShopScreen.tsx`, `screens/auth/ShopDeactivatedScreen.tsx` | Sessions; plan info from `app_subscriptions` |
| `web/src/App.tsx`, `pages/RenewPlan.tsx`, `pages/ForgotPassword.tsx`, `pages/admin/AdminSettings.tsx`, `pages/admin/AdminShops.tsx` | Edge functions instead of anon REST; forgot-password page |

---

### Task 0: Tooling and pre-flight checks

This task produces a findings note only. **Stop and report to the user if any check contradicts this plan.**

**Files:**
- Create: `docs/superpowers/notes/2026-09-28-phase0-preflight.md`

- [ ] **Step 1: Install tooling (no Docker needed)**

```bash
brew install supabase/tap/supabase deno
supabase --version && deno --version
```
Expected: both print versions.

- [ ] **Step 2: Link the project**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu
supabase login
supabase link --project-ref mhtqufyaxpunhenqropn
supabase migration list --linked
```
Expected: local and remote migration lists match, up to `20260823143000`. If the remote shows migrations that aren't local, or the other way round, record it and stop.

- [ ] **Step 3: Run read-only checks**

Run in Dashboard → SQL editor and paste the results into the notes file:

```sql
-- a) public tables with shop_id and its type (live schema has tables not in migrations)
select c.table_name, c.data_type
from information_schema.columns c
join information_schema.tables t using (table_schema, table_name)
where c.table_schema = 'public' and c.column_name = 'shop_id' and t.table_type = 'BASE TABLE'
order by 1;

-- b) duplicate phones (login looks up by phone with maybeSingle)
select phone, count(*) from public.shops group by phone having count(*) > 1;

-- c) shop count (these all need a password reset after this release)
select count(*) from public.shops;
```

**Stop conditions:**
- Query (b) returns rows. Fix the duplicates by hand first.
- Query (a) shows a `shop_id` type other than `uuid` or `text`.

- [ ] **Step 4: Check JWT signing keys**

Dashboard → Project Settings → JWT Keys. Record whether the project uses the **legacy HS256 secret**. Chukta Phase 1 staff tokens depend on this.

- [ ] **Step 5: Confirm the synthetic email is accepted**

```bash
SERVICE_ROLE_KEY=<paste from Dashboard → Settings → API; do not save to a file>
API_URL=https://mhtqufyaxpunhenqropn.supabase.co
curl -s -X POST "$API_URL/auth/v1/admin/users" \
  -H "apikey: $SERVICE_ROLE_KEY" -H "Authorization: Bearer $SERVICE_ROLE_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"email":"s-preflight-test@accounts.pragatibandhu.internal","password":"secret123","email_confirm":true}'
```
Expected: JSON containing `"id"`. Then delete that user in Dashboard → Authentication → Users.

If you get a validation error, switch `AUTH_EMAIL_DOMAIN` to a domain you own (e.g. `accounts.pragatibandhu.app`), record it, and use that value everywhere.

- [ ] **Step 6: Commit the notes**

```bash
git add docs/superpowers/notes/2026-09-28-phase0-preflight.md
git commit -m "docs: record Phase 0 pre-flight findings"
```

---

### Task 1: Rename `mobile/` → `mobile-shopai/`

**Files:**
- Move: `mobile/` → `mobile-shopai/`
- Modify: `.gitignore`, `PRAGATI_BANDHU_REFERENCE.md`, `SYNC_AND_SUPABASE_ARCHITECTURE.md`, `README.md`

- [ ] **Step 1: Capture the type-check baseline**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu/mobile && npx tsc --noEmit 2>&1 | tail -3 > /tmp/shopai-tsc-baseline.txt; cat /tmp/shopai-tsc-baseline.txt
```
Later tasks compare against this, so pre-existing errors don't count as new.

- [ ] **Step 2: Move**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu && git mv mobile mobile-shopai
```
`git mv` renames the directory on disk, so the ignored `android/`, `ios/`, `node_modules/` and `.env.local` move with it.

- [ ] **Step 3: Update `.gitignore`**

Replace the Expo block and the credentials line with:

```gitignore
# Expo / Mobile specific
mobile-shopai/.expo/
mobile-shopai/dist/
mobile-shopai/web-build/
mobile-shopai/expo-env.d.ts
mobile-shopai/ios/
mobile-shopai/android/
mobile-chukta/.expo/
mobile-chukta/dist/
mobile-chukta/web-build/
mobile-chukta/expo-env.d.ts
mobile-chukta/ios/
mobile-chukta/android/
```

```gitignore
# Firebase/Google secrets
mobile-shopai/credentials.json
mobile-chukta/credentials.json
```

- [ ] **Step 4: Update doc references**

```bash
grep -rn "mobile/" PRAGATI_BANDHU_REFERENCE.md SYNC_AND_SUPABASE_ARCHITECTURE.md README.md
```
Replace each `mobile/` path with `mobile-shopai/`. Leave `2026-09-28-worker-pay-advance-wage-diary-phase1.md` alone; it will be re-issued as the Chukta plan.

- [ ] **Step 5: Verify**

```bash
git check-ignore mobile-shopai/android && echo ignored
cd mobile-shopai && npx tsc --noEmit 2>&1 | tail -3 | diff - /tmp/shopai-tsc-baseline.txt && echo SAME
npx expo config --type public >/dev/null && echo CONFIG_OK
```
Expected: `ignored`, `SAME`, `CONFIG_OK`.

- [ ] **Step 6: Commit**

```bash
cd /Users/suvo/Developer/Pragati_Bandhu
git add -A .gitignore mobile-shopai PRAGATI_BANDHU_REFERENCE.md SYNC_AND_SUPABASE_ARCHITECTURE.md README.md
git commit -m "chore: rename mobile/ to mobile-shopai/ ahead of Chukta app"
```

---

### Task 2: Account tables migration

**Files:**
- Create: `supabase/migrations/20260928100000_account_tables.sql`
- Test: `supabase/tests/database/account_tables.test.sql`

**Interfaces:**
- Produces:
  - `public.shops.auth_user_id uuid unique`
  - `public.app_subscriptions(shop_id, app, plan_type, is_active, expires_at, created_at, updated_at)`, PK `(shop_id, app)`, owner-readable
  - `public.app_sessions(session_id uuid pk, user_id, app, device_id, created_at)`, no client access
  - `public.payments.app`
  - `public.jwt_app() → text`, `public.jwt_shop_id() → uuid`
  - Dropped: `shops.plan_type`, `shops.plan_expires_at`, `shops.password_hash`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/account_tables.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

select has_column('public', 'shops', 'auth_user_id', 'shops.auth_user_id exists');
select hasnt_column('public', 'shops', 'plan_expires_at', 'legacy plan_expires_at dropped');
select hasnt_column('public', 'shops', 'password_hash', 'legacy password_hash dropped');
select has_table('public', 'app_subscriptions', 'app_subscriptions exists');
select has_table('public', 'app_sessions', 'app_sessions exists');
select has_column('public', 'payments', 'app', 'payments.app exists');

insert into public.shops (id, shop_name, owner_name, phone)
values ('11111111-1111-1111-1111-111111111111', 'Test Shop', 'Owner', '+919800000001');

select throws_ok(
  $$ insert into public.app_subscriptions (shop_id, app, plan_type) values ('11111111-1111-1111-1111-111111111111', 'other', 'x') $$,
  '23514', null, 'unknown app rejected');

select lives_ok(
  $$ insert into public.app_subscriptions (shop_id, app, plan_type) values ('11111111-1111-1111-1111-111111111111', 'chukta', 'monthly') $$,
  'chukta subscription accepted');

select set_config('request.jwt.claims', '{"app":"chukta","shop_id":"11111111-1111-1111-1111-111111111111"}', true);
select is(public.jwt_app() || ':' || public.jwt_shop_id()::text,
          'chukta:11111111-1111-1111-1111-111111111111', 'jwt helpers read claims');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `supabase test db --linked`
Expected: FAIL. `shops.auth_user_id exists` fails and later statements error on the missing tables.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260928100000_account_tables.sql
-- Shared account layer for ShopAI + Chukta (spec §4.1, §4.2).

-- 1. Link each shop to a Supabase Auth user (set by register / reset-password).
alter table public.shops add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

-- 2. JWT claim helpers used by every app-scoped RLS policy.
create or replace function public.jwt_app() returns text
language sql stable as $$ select nullif(auth.jwt() ->> 'app', '') $$;

create or replace function public.jwt_shop_id() returns uuid
language sql stable as $$ select nullif(auth.jwt() ->> 'shop_id', '')::uuid $$;

-- 3. Per-app entitlement.
create table if not exists public.app_subscriptions (
  shop_id    uuid not null references public.shops(id) on delete cascade,
  app        text not null check (app in ('shopai', 'chukta')),
  plan_type  text not null,
  is_active  boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (shop_id, app)
);

alter table public.app_subscriptions enable row level security;
revoke all on public.app_subscriptions from anon, authenticated;
grant select on public.app_subscriptions to authenticated;
create policy "owner reads own subscriptions" on public.app_subscriptions
  for select to authenticated using (shop_id = public.jwt_shop_id());

-- 4. Session → app mapping, read only by the token hook and service role.
create table if not exists public.app_sessions (
  session_id uuid primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  app        text not null check (app in ('shopai', 'chukta')),
  device_id  text,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_sessions_user on public.app_sessions(user_id);
alter table public.app_sessions enable row level security;
revoke all on public.app_sessions from anon, authenticated;

-- 5. Payments know which app they pay for.
alter table public.payments add column if not exists app text not null default 'shopai'
  check (app in ('shopai', 'chukta'));

-- 6. Carry existing (test) shops' ShopAI plans over, then drop the legacy columns.
insert into public.app_subscriptions (shop_id, app, plan_type, is_active, expires_at)
select s.id, 'shopai', coalesce(s.plan_type, 'monthly'), true,
       coalesce(s.plan_expires_at, now() + interval '30 days')
from public.shops s
on conflict (shop_id, app) do nothing;

alter table public.shops drop column if exists plan_type;
alter table public.shops drop column if exists plan_expires_at;
alter table public.shops drop column if exists password_hash;
```

- [ ] **Step 4: Push the migration and run the test**

```bash
supabase db push --linked --dry-run   # expect exactly 20260928100000_account_tables.sql
supabase db push --linked
supabase test db --linked
```
Expected: all 9 assertions pass.

The deployed `login`, `register-shop` and `payments` functions break from this point until Task 11 redeploys them. That's acceptable because nobody uses ShopAI.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260928100000_account_tables.sql supabase/tests/database/account_tables.test.sql
git commit -m "feat(db): add shared account tables and per-app subscriptions"
```

---

### Task 3: Custom Access Token Hook and session revocation

**Files:**
- Create: `supabase/migrations/20260928100100_account_token_hook.sql`
- Modify: `supabase/config.toml` (append the hook section, which keeps the config honest for anyone who runs locally later)
- Test: `supabase/tests/database/token_hook.test.sql`

**Interfaces:**
- Consumes: `app_sessions`, `shops.auth_user_id` (Task 2)
- Produces:
  - `public.custom_access_token_hook(event jsonb) → jsonb`, which adds `claims.app` and `claims.shop_id`
  - `public.revoke_user_sessions(p_user_id uuid) → void` (service role only)

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/token_hook.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email) values ('aaaaaaaa-0000-0000-0000-000000000001', 'hook-test@accounts.pragatibandhu.internal');
insert into public.shops (id, shop_name, owner_name, phone, auth_user_id)
values ('bbbbbbbb-0000-0000-0000-000000000001', 'Hook Shop', 'Owner', '+919800000002', 'aaaaaaaa-0000-0000-0000-000000000001');
insert into public.app_sessions (session_id, user_id, app)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'chukta');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'cccccccc-0000-0000-0000-000000000001', 'role', 'authenticated')
  )) -> 'claims' ->> 'app',
  'chukta', 'hook adds app claim from app_sessions');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'cccccccc-0000-0000-0000-000000000001', 'role', 'authenticated')
  )) -> 'claims' ->> 'shop_id',
  'bbbbbbbb-0000-0000-0000-000000000001', 'hook adds shop_id claim');

select ok(
  (public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'dddddddd-0000-0000-0000-000000000009', 'role', 'authenticated')
  )) -> 'claims' ->> 'app') is null,
  'unknown session gets no app claim');

select is(
  public.custom_access_token_hook(jsonb_build_object(
    'user_id', 'aaaaaaaa-0000-0000-0000-000000000001',
    'claims', jsonb_build_object('session_id', 'cccccccc-0000-0000-0000-000000000001', 'role', 'authenticated')
  )) -> 'claims' ->> 'role',
  'authenticated', 'existing claims preserved');

select public.revoke_user_sessions('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.app_sessions where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
          0, 'revoke_user_sessions clears app_sessions');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `supabase test db --linked`
Expected: FAIL with `function public.custom_access_token_hook(jsonb) does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260928100100_account_token_hook.sql
-- Custom Access Token Hook: stamp app + shop_id into every access token (spec §4.4).

create or replace function public.custom_access_token_hook(event jsonb) returns jsonb
language plpgsql stable as $$
declare
  claims jsonb := event -> 'claims';
  v_app  text;
  v_shop uuid;
begin
  select s.app into v_app
    from public.app_sessions s
   where s.session_id = nullif(claims ->> 'session_id', '')::uuid;

  select sh.id into v_shop
    from public.shops sh
   where sh.auth_user_id = (event ->> 'user_id')::uuid;

  if v_app is not null then
    claims := jsonb_set(claims, '{app}', to_jsonb(v_app));
  end if;
  if v_shop is not null then
    claims := jsonb_set(claims, '{shop_id}', to_jsonb(v_shop::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end $$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook(jsonb) from authenticated, anon, public;

grant select on public.app_sessions to supabase_auth_admin;
grant select (id, auth_user_id) on public.shops to supabase_auth_admin;
create policy "auth admin reads app_sessions" on public.app_sessions
  for select to supabase_auth_admin using (true);
create policy "auth admin reads shops" on public.shops
  for select to supabase_auth_admin using (true);

-- Revoke every session of a user (password reset, forced logout).
create or replace function public.revoke_user_sessions(p_user_id uuid) returns void
language sql security definer set search_path = public, auth as $$
  delete from auth.sessions where user_id = p_user_id;
  delete from public.app_sessions where user_id = p_user_id;
$$;
revoke execute on function public.revoke_user_sessions(uuid) from public, anon, authenticated;
grant execute on function public.revoke_user_sessions(uuid) to service_role;
```

- [ ] **Step 4: Add the hook to `supabase/config.toml`**

Append:

```toml
[auth.hook.custom_access_token]
enabled = true
uri = "pg-functions://postgres/public/custom_access_token_hook"
```

- [ ] **Step 5: Push, enable in the Dashboard, and test**

```bash
supabase db push --linked
supabase test db --linked
```
Then Dashboard → Authentication → Hooks → Customize Access Token (JWT) Claims → Postgres function `public.custom_access_token_hook` → **Enable**.

Expected: all tests in `account_tables` and `token_hook` pass.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260928100100_account_token_hook.sql supabase/tests/database/token_hook.test.sql supabase/config.toml
git commit -m "feat(db): add access token hook stamping app and shop_id claims"
```

---

### Task 4: ShopAI RLS lockdown migration

**Files:**
- Create: `supabase/migrations/20260928100200_shopai_rls_lockdown.sql`
- Test: `supabase/tests/database/shopai_rls_lockdown.test.sql`

**Interfaces:**
- Consumes: `jwt_app()`, `jwt_shop_id()` (Task 2)
- Produces:
  - Every `public` table with `shop_id` (except `app_subscriptions` and `payments`) is accessible only to `authenticated` with `app='shopai'` and a matching `shop_id`
  - `bill_items` is scoped through `bills`
  - The `shops` row is visible only to its owner, with a narrow `UPDATE` column list (no `is_active`, no `phone`)
  - `app_settings` is read-only for clients
  - `anon` has no table access except `SELECT` on `app_settings`

- [ ] **Step 1: Write the failing test**

```sql
-- supabase/tests/database/shopai_rls_lockdown.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.shops (id, shop_name, owner_name, phone) values
  ('a0000000-0000-0000-0000-00000000000a', 'A', 'OA', '+919800000101'),
  ('b0000000-0000-0000-0000-00000000000b', 'B', 'OB', '+919800000102');
insert into public.categories (id, shop_id, name) values
  (gen_random_uuid(), 'a0000000-0000-0000-0000-00000000000a', 'cat A'),
  (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'cat B');

set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'shopai',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);

select is((select count(*)::int from public.categories where name like 'cat %'), 1, 'shopai token sees only its own shop rows');
select is((select name from public.categories where name like 'cat %'), 'cat A', 'and it is the right row');
select throws_ok(
  $$ insert into public.categories (id, shop_id, name) values (gen_random_uuid(), 'b0000000-0000-0000-0000-00000000000b', 'x') $$,
  '42501', null, 'cannot write rows for another shop');
select is((select count(*)::int from public.shops), 1, 'sees only own shops row');
select throws_ok($$ update public.shops set is_active = true $$, '42501', null, 'cannot update is_active');
select throws_ok($$ update public.shops set phone = '+910000000000' $$, '42501', null, 'cannot update phone');
select throws_ok($$ update public.app_settings set value = '1' where key = 'app_maintenance_mode' $$,
  '42501', null, 'cannot write app_settings');

select set_config('request.jwt.claims', json_build_object(
  'sub', gen_random_uuid(), 'role', 'authenticated', 'app', 'chukta',
  'shop_id', 'a0000000-0000-0000-0000-00000000000a')::text, true);
select is((select count(*)::int from public.categories), 0, 'chukta token cannot read ShopAI tables');

reset role;
set local role anon;
select throws_ok($$ select 1 from public.categories $$, '42501', null, 'anon has no table access');
select lives_ok($$ select key from public.app_settings limit 1 $$, 'anon can still read app_settings (version check)');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `supabase test db --linked`
Expected: FAIL. `shopai token sees only its own shop rows` returns 2, because the policies are still `USING (true)`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260928100200_shopai_rls_lockdown.sql
-- Replace the permissive policies from 20260708090742 with app + shop scoped policies (spec §4.8).

-- 1. Every public table carrying shop_id (includes tables created outside migrations).
do $$
declare
  r record;
  p record;
  shop_expr text;
begin
  for r in
    select c.table_name, c.data_type
      from information_schema.columns c
      join information_schema.tables t using (table_schema, table_name)
     where c.table_schema = 'public' and c.column_name = 'shop_id' and t.table_type = 'BASE TABLE'
       and c.table_name not in ('app_subscriptions', 'payments')
  loop
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = r.table_name loop
      execute format('drop policy %I on public.%I', p.policyname, r.table_name);
    end loop;

    shop_expr := case when r.data_type = 'uuid' then 'public.jwt_shop_id()' else 'public.jwt_shop_id()::text' end;

    execute format('alter table public.%I enable row level security', r.table_name);
    execute format(
      'create policy shopai_owner_access on public.%I for all to authenticated
         using (public.jwt_app() = %L and shop_id = %s)
         with check (public.jwt_app() = %L and shop_id = %s)',
      r.table_name, 'shopai', shop_expr, 'shopai', shop_expr);
    execute format('revoke all on public.%I from anon', r.table_name);
  end loop;
end $$;

-- 2. bill_items has no shop_id — scope through its bill.
drop policy if exists "owner_access" on public.bill_items;
create policy shopai_owner_access on public.bill_items for all to authenticated
  using (public.jwt_app() = 'shopai' and exists (
    select 1 from public.bills b where b.id = bill_items.bill_id and b.shop_id = public.jwt_shop_id()))
  with check (public.jwt_app() = 'shopai' and exists (
    select 1 from public.bills b where b.id = bill_items.bill_id and b.shop_id = public.jwt_shop_id()));
revoke all on public.bill_items from anon;

-- 3. shops: owner sees own row (either app); narrow column grants.
drop policy if exists "owner_access" on public.shops;
create policy owner_reads_own_shop on public.shops for select to authenticated
  using (id = public.jwt_shop_id());
create policy owner_updates_own_shop on public.shops for update to authenticated
  using (id = public.jwt_shop_id()) with check (id = public.jwt_shop_id());

revoke all on public.shops from anon, authenticated;
grant select (
  id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent,
  is_active, active_device_id, created_at, last_synced_at, allow_out_of_stock_billing
) on public.shops to authenticated;
grant update (
  shop_name, owner_name, whatsapp_number, business_category, ai_consent,
  active_device_id, last_synced_at, allow_out_of_stock_billing
) on public.shops to authenticated;

-- 4. payments: owners read their own; writes only via the payments function (service role).
drop policy if exists "owner_insert_payment" on public.payments;
drop policy if exists "owner_read_payment" on public.payments;
drop policy if exists "admin_read_all" on public.payments;
drop policy if exists "admin_update_all" on public.payments;
revoke all on public.payments from anon, authenticated;
grant select on public.payments to authenticated;
create policy owner_reads_own_payments on public.payments for select to authenticated
  using (shop_id = public.jwt_shop_id());

-- 5. app_settings: public read (version check runs before login); writes via admin function only.
drop policy if exists "Admin write app_settings" on public.app_settings;
revoke insert, update, delete, truncate on public.app_settings from anon, authenticated;
grant select on public.app_settings to anon, authenticated;
```

- [ ] **Step 4: Push and run all DB tests**

```bash
supabase db push --linked
supabase test db --linked
```
Expected: all three test files pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260928100200_shopai_rls_lockdown.sql supabase/tests/database/shopai_rls_lockdown.test.sql
git commit -m "feat(db): lock ShopAI tables to app- and shop-scoped RLS"
```

---

### Task 5: Shared edge-function helpers

**Files:**
- Create: `supabase/functions/_shared/account.ts`, `supabase/functions/_shared/authUsers.ts`, `supabase/functions/_shared/firebase.ts`
- Test: `supabase/functions/_shared/account.test.ts`, `supabase/functions/_shared/authUsers.test.ts`

**Interfaces:**
- Produces (`account.ts`):
  - `type AppName = 'shopai' | 'chukta'`
  - `parseApp(v: unknown, fallback?: AppName): AppName | null`
  - `parseApps(v: unknown, fallback: AppName[]): AppName[] | null`
  - `authEmailForShop(shopId: string, domain?: string): string`
  - `decodeJwtPayload(token: string): Record<string, unknown>`
  - `corsHeaders`
  - `json(status, body): Response`
  - `type HandlerResult = { status: number; body: Record<string, unknown> }`
  - `type Session = { access_token: string; refresh_token: string; [k: string]: unknown }`
  - `type ShopRow = { id: string; phone: string; auth_user_id: string | null; is_active: boolean | null; [k: string]: unknown }`
- Produces (`authUsers.ts`):
  - `interface AdminAuthPort { updatePassword(userId, password): Promise<void>; createUser({ email, password, phone }): Promise<string>; linkShop(shopId, userId): Promise<void> }`
  - `ensureAuthUser(port, shop: Pick<ShopRow,'id'|'phone'|'auth_user_id'>, password, emailDomain?): Promise<string>`
  - `adminAuthPort(admin: SupabaseClient): AdminAuthPort`
- Produces (`firebase.ts`): `verifyFirebasePhone(idToken: string): Promise<string>`

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/_shared/account.test.ts
import { assertEquals, assertThrows } from 'jsr:@std/assert@1'
import { authEmailForShop, decodeJwtPayload, parseApp, parseApps } from './account.ts'

Deno.test('parseApp accepts known apps, applies fallback, rejects others', () => {
  assertEquals(parseApp('chukta'), 'chukta')
  assertEquals(parseApp(undefined, 'shopai'), 'shopai')
  assertEquals(parseApp('other', 'shopai'), null)
})

Deno.test('parseApps validates every entry and de-duplicates', () => {
  assertEquals(parseApps(undefined, ['shopai']), ['shopai'])
  assertEquals(parseApps(['chukta', 'shopai', 'chukta'], ['shopai']), ['chukta', 'shopai'])
  assertEquals(parseApps(['nope'], ['shopai']), null)
  assertEquals(parseApps([], ['shopai']), null)
})

Deno.test('authEmailForShop is deterministic and domain-overridable', () => {
  assertEquals(authEmailForShop('abc', 'x.test'), 's-abc@x.test')
  assertEquals(authEmailForShop('abc'), 's-abc@accounts.pragatibandhu.internal')
})

Deno.test('decodeJwtPayload reads base64url payload', () => {
  const payload = btoa(JSON.stringify({ session_id: 's-1' })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
  assertEquals(decodeJwtPayload(`h.${payload}.sig`).session_id, 's-1')
  assertThrows(() => decodeJwtPayload('garbage'))
})
```

```ts
// supabase/functions/_shared/authUsers.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { type AdminAuthPort, ensureAuthUser } from './authUsers.ts'

function fakePort() {
  const calls: string[] = []
  const port: AdminAuthPort = {
    async updatePassword(id, pw) { calls.push(`update:${id}:${pw}`) },
    async createUser({ email }) { calls.push(`create:${email}`); return 'new-user-id' },
    async linkShop(shopId, userId) { calls.push(`link:${shopId}:${userId}`) },
  }
  return { port, calls }
}

Deno.test('linked shop only gets its password updated', async () => {
  const { port, calls } = fakePort()
  assertEquals(await ensureAuthUser(port, { id: 'shop1', phone: '+91', auth_user_id: 'u1' }, 'pw'), 'u1')
  assertEquals(calls, ['update:u1:pw'])
})

Deno.test('unlinked shop gets a new auth user keyed by shop id, then linked', async () => {
  const { port, calls } = fakePort()
  assertEquals(await ensureAuthUser(port, { id: 'shop2', phone: '+91', auth_user_id: null }, 'pw', 'd.test'), 'new-user-id')
  assertEquals(calls, ['create:s-shop2@d.test', 'link:shop2:new-user-id'])
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `deno test supabase/functions/_shared/`
Expected: FAIL with `Module not found "./account.ts"`.

- [ ] **Step 3: Implement `account.ts`**

```ts
// supabase/functions/_shared/account.ts
export type AppName = 'shopai' | 'chukta'
export const APPS: readonly AppName[] = ['shopai', 'chukta']

export type HandlerResult = { status: number; body: Record<string, unknown> }
export type Session = { access_token: string; refresh_token: string; [k: string]: unknown }
export type ShopRow = {
  id: string
  phone: string
  auth_user_id: string | null
  is_active: boolean | null
  [k: string]: unknown
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function parseApp(v: unknown, fallback?: AppName): AppName | null {
  if (v === undefined || v === null || v === '') return fallback ?? null
  return typeof v === 'string' && (APPS as readonly string[]).includes(v) ? (v as AppName) : null
}

export function parseApps(v: unknown, fallback: AppName[]): AppName[] | null {
  if (v === undefined || v === null) return fallback
  if (!Array.isArray(v) || v.length === 0) return null
  const out: AppName[] = []
  for (const item of v) {
    const app = parseApp(item)
    if (!app) return null
    if (!out.includes(app)) out.push(app)
  }
  return out
}

const DEFAULT_AUTH_EMAIL_DOMAIN = 'accounts.pragatibandhu.internal'

/** Auth users are keyed by shop id, never by phone, so a phone change can't collide with another account. */
export function authEmailForShop(shopId: string, domain?: string): string {
  const d = domain ?? (typeof Deno !== 'undefined' ? Deno.env.get('AUTH_EMAIL_DOMAIN') : undefined) ?? DEFAULT_AUTH_EMAIL_DOMAIN
  return `s-${shopId}@${d}`
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split('.')[1]
  if (!part) throw new Error('malformed jwt')
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(b64.padEnd(Math.ceil(b64.length / 4) * 4, '=')))
}
```

- [ ] **Step 4: Implement `authUsers.ts`**

```ts
// supabase/functions/_shared/authUsers.ts
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { authEmailForShop, type ShopRow } from './account.ts'

/** Narrow port over the admin API so the linking logic is unit-testable. */
export interface AdminAuthPort {
  updatePassword(userId: string, password: string): Promise<void>
  createUser(attrs: { email: string; password: string; phone: string }): Promise<string>
  linkShop(shopId: string, userId: string): Promise<void>
}

/** Returns the shop's auth user id, creating and linking one if the shop has none, and sets its password. */
export async function ensureAuthUser(
  port: AdminAuthPort,
  shop: Pick<ShopRow, 'id' | 'phone' | 'auth_user_id'>,
  password: string,
  emailDomain?: string,
): Promise<string> {
  if (shop.auth_user_id) {
    await port.updatePassword(shop.auth_user_id, password)
    return shop.auth_user_id
  }
  const userId = await port.createUser({ email: authEmailForShop(shop.id, emailDomain), password, phone: shop.phone })
  await port.linkShop(shop.id, userId)
  return userId
}

export function adminAuthPort(admin: SupabaseClient): AdminAuthPort {
  return {
    async updatePassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) throw error
    },
    async createUser({ email, password, phone }) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { phone } })
      if (error || !data.user) throw error ?? new Error('createUser returned no user')
      return data.user.id
    },
    async linkShop(shopId, userId) {
      const { error } = await admin.from('shops').update({ auth_user_id: userId }).eq('id', shopId)
      if (error) throw error
    },
  }
}
```

- [ ] **Step 5: Implement `firebase.ts`**

This is moved from `register-shop/index.ts`.

```ts
// supabase/functions/_shared/firebase.ts
import { createRemoteJWKSet, jwtVerify } from 'https://deno.land/x/jose@v5.2.4/index.ts'

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'))

/** Verifies a Firebase phone-auth ID token and returns its E.164 phone number. */
export async function verifyFirebasePhone(idToken: string): Promise<string> {
  const projectId = Deno.env.get('FIREBASE_PROJECT_ID')
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID environment variable is not configured')
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  })
  if (typeof payload.phone_number !== 'string') throw new Error('No phone number found in token')
  return payload.phone_number
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `deno test supabase/functions/_shared/ && deno check supabase/functions/_shared/*.ts`
Expected: 6 tests pass, and the type check is clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/_shared
git commit -m "feat(functions): add shared account, auth-user and firebase helpers"
```

---

### Task 6: App-scoped `login` function

**Files:**
- Create: `supabase/functions/login/handler.ts`
- Modify: `supabase/functions/login/index.ts` (full rewrite)
- Delete: `supabase/functions/login/deno.json` (unused import map)
- Modify: `supabase/config.toml` (`[functions.login]`: drop the `import_map` line)
- Test: `supabase/functions/login/handler.test.ts`

**Interfaces:**
- Consumes: `parseApp`, `decodeJwtPayload`, `ShopRow`, `Session`, `HandlerResult`, `AppName` (Task 5)
- Produces:
  - `POST /functions/v1/login`, body `{ phone, password, app?, deviceId? }`. `app` defaults to `'shopai'`.
  - 200 `{ shop, session, subscription }`
  - 400
  - 401 `{ error: 'Invalid phone number or password' | 'password_reset_required' }`
  - 403 `{ error: 'not_subscribed', app }`
  - `type Subscription = { app: AppName; plan_type: string; is_active: boolean; expires_at: string | null }`

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/login/handler.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { handleLogin, type LoginDeps } from './handler.ts'
import type { ShopRow } from '../_shared/account.ts'

const tok = (claims: Record<string, unknown>) =>
  `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`

const baseShop: ShopRow = { id: 'shop1', phone: '+919800000001', auth_user_id: 'user1', is_active: true, shop_name: 'S' }

function makeDeps(over: Partial<LoginDeps> = {}) {
  const log: string[] = []
  const deps: LoginDeps = {
    findShopByPhone: async () => ({ ...baseShop }),
    getAuthEmail: async () => 's-shop1@d.test',
    signIn: async (_e, pw) => (pw === 'right' ? { access_token: tok({ session_id: 'sess1' }), refresh_token: 'r1' } : null),
    getSubscription: async (_s, app) => ({ app, plan_type: 'monthly', is_active: true, expires_at: null }),
    recordSession: async (sid, uid, app, dev) => { log.push(`record:${sid}:${uid}:${app}:${dev}`) },
    refresh: async () => ({ access_token: tok({ session_id: 'sess1', app: 'shopai' }), refresh_token: 'r2' }),
    revoke: async () => { log.push('revoke') },
    ...over,
  }
  return { deps, log }
}

Deno.test('400 when phone or password missing', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleLogin({ phone: '+91' }, deps)).status, 400)
})

Deno.test('400 for unknown app', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleLogin({ phone: '+91', password: 'right', app: 'x' }, deps)).status, 400)
})

Deno.test('401 generic for unknown phone', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => null })
  assertEquals((await handleLogin({ phone: '+91', password: 'right' }, deps)).body, { error: 'Invalid phone number or password' })
})

Deno.test('401 password_reset_required when shop has no auth user yet', async () => {
  const { deps, log } = makeDeps({ findShopByPhone: async () => ({ ...baseShop, auth_user_id: null }) })
  const res = await handleLogin({ phone: '+91', password: 'right' }, deps)
  assertEquals(res.status, 401)
  assertEquals(res.body.error, 'password_reset_required')
  assertEquals(log, [])
})

Deno.test('401 for wrong password', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleLogin({ phone: '+91', password: 'wrong' }, deps)).status, 401)
})

Deno.test('success records session with app + device and returns refreshed session', async () => {
  const { deps, log } = makeDeps()
  const res = await handleLogin({ phone: '+91', password: 'right', app: 'shopai', deviceId: 'dev1' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['record:sess1:user1:shopai:dev1'])
  assertEquals((res.body.session as { refresh_token: string }).refresh_token, 'r2')
  assertEquals('auth_user_id' in (res.body.shop as Record<string, unknown>), false)
})

Deno.test('missing app defaults to shopai', async () => {
  const { deps, log } = makeDeps()
  await handleLogin({ phone: '+91', password: 'right' }, deps)
  assertEquals(log, ['record:sess1:user1:shopai:null'])
})

Deno.test('no subscription for app: 403 not_subscribed and session revoked', async () => {
  const { deps, log } = makeDeps({ getSubscription: async () => null })
  const res = await handleLogin({ phone: '+91', password: 'right', app: 'chukta' }, deps)
  assertEquals(res.status, 403)
  assertEquals(res.body, { error: 'not_subscribed', app: 'chukta' })
  assertEquals(log, ['revoke'])
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `deno test supabase/functions/login/`
Expected: FAIL with `Module not found "./handler.ts"`.

- [ ] **Step 3: Implement `handler.ts`**

```ts
// supabase/functions/login/handler.ts
import { type AppName, decodeJwtPayload, type HandlerResult, parseApp, type Session, type ShopRow } from '../_shared/account.ts'

export type Subscription = { app: AppName; plan_type: string; is_active: boolean; expires_at: string | null }

export interface LoginDeps {
  findShopByPhone(phone: string): Promise<ShopRow | null>
  getAuthEmail(userId: string): Promise<string | null>
  signIn(email: string, password: string): Promise<Session | null>
  getSubscription(shopId: string, app: AppName): Promise<Subscription | null>
  recordSession(sessionId: string, userId: string, app: AppName, deviceId: string | null): Promise<void>
  refresh(refreshToken: string): Promise<Session>
  revoke(accessToken: string): Promise<void>
}

const INVALID: HandlerResult = { status: 401, body: { error: 'Invalid phone number or password' } }

export async function handleLogin(
  input: { phone?: unknown; password?: unknown; app?: unknown; deviceId?: unknown },
  deps: LoginDeps,
): Promise<HandlerResult> {
  const phone = typeof input.phone === 'string' ? input.phone : ''
  const password = typeof input.password === 'string' ? input.password : ''
  if (!phone || !password) return { status: 400, body: { error: 'phone and password are required' } }

  const app = parseApp(input.app, 'shopai')
  if (!app) return { status: 400, body: { error: 'unknown app' } }
  const deviceId = typeof input.deviceId === 'string' ? input.deviceId : null

  const shop = await deps.findShopByPhone(phone)
  if (!shop) return INVALID
  // Shops created before Phase 0 have no auth user; the owner sets a password via reset-password.
  if (!shop.auth_user_id) return { status: 401, body: { error: 'password_reset_required' } }

  const email = await deps.getAuthEmail(shop.auth_user_id)
  if (!email) return INVALID
  const first = await deps.signIn(email, password)
  if (!first) return INVALID

  const subscription = await deps.getSubscription(shop.id, app)
  if (!subscription) {
    await deps.revoke(first.access_token)
    return { status: 403, body: { error: 'not_subscribed', app } }
  }

  const sessionId = decodeJwtPayload(first.access_token).session_id
  if (typeof sessionId !== 'string') throw new Error('session_id claim missing from access token')
  await deps.recordSession(sessionId, shop.auth_user_id, app, deviceId)
  // Refresh once so the access token is re-minted through the hook with the app claim.
  const session = await deps.refresh(first.refresh_token)

  const { auth_user_id: _uid, ...publicShop } = shop
  return { status: 200, body: { shop: publicShop, session, subscription } }
}
```

- [ ] **Step 4: Rewrite `index.ts`**

```ts
// supabase/functions/login/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json } from '../_shared/account.ts'
import { handleLogin, type LoginDeps } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noPersist)
const publicClient = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, noPersist)

const SHOP_COLUMNS =
  'id, auth_user_id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active'

const deps: LoginDeps = {
  async findShopByPhone(phone) {
    const { data, error } = await admin.from('shops').select(SHOP_COLUMNS).eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  },
  async getAuthEmail(userId) {
    const { data, error } = await admin.auth.admin.getUserById(userId)
    return error ? null : data.user?.email ?? null
  },
  async signIn(email, password) {
    const { data, error } = await publicClient().auth.signInWithPassword({ email, password })
    return error ? null : data.session
  },
  async getSubscription(shopId, app) {
    const { data, error } = await admin.from('app_subscriptions')
      .select('app, plan_type, is_active, expires_at').eq('shop_id', shopId).eq('app', app).maybeSingle()
    if (error) throw error
    return data
  },
  async recordSession(sessionId, userId, app, deviceId) {
    const { error } = await admin.from('app_sessions').insert({ session_id: sessionId, user_id: userId, app, device_id: deviceId })
    if (error) throw error
  },
  async refresh(refreshToken) {
    const { data, error } = await publicClient().auth.refreshSession({ refresh_token: refreshToken })
    if (error || !data.session) throw error ?? new Error('refresh returned no session')
    return data.session
  },
  async revoke(accessToken) {
    await admin.auth.admin.signOut(accessToken, 'local')
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const result = await handleLogin(await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('login error:', err)
    return json(500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})
```

- [ ] **Step 5: Remove the unused import map**

```bash
git rm supabase/functions/login/deno.json
```
In `supabase/config.toml`, delete the line `import_map = "./functions/login/deno.json"` under `[functions.login]`.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `deno test supabase/functions/login/ && deno check supabase/functions/login/index.ts`
Expected: 8 tests pass, and the type check is clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/login supabase/config.toml
git commit -m "feat(functions): app-scoped login issuing Supabase sessions"
```

---

### Task 7: `register` function (+ `check-phone`); delete `register-shop`

**Files:**
- Create: `supabase/functions/register/handler.ts`, `supabase/functions/register/index.ts`
- Delete: `supabase/functions/register-shop/`
- Modify: `supabase/config.toml`
- Test: `supabase/functions/register/handler.test.ts`

**Interfaces:**
- Consumes: `parseApps`, `ShopRow`, `AppName`, `HandlerResult` (Task 5); `ensureAuthUser`, `adminAuthPort` (Task 5); `verifyFirebasePhone` (Task 5)
- Produces:
  - `POST /functions/v1/register`, body `{ idToken, phone, password, shopName?, ownerName?, businessCategory?, whatsappNumber?, plan?, apps? }`. Returns 200 `{ shop, apps }`, 400, 401 (existing account, wrong password or no password yet), or 409 `{ error, apps }`.
  - `POST /functions/v1/register/check-phone`, body `{ phone }`. Returns 200 `{ exists, apps }`.

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/register/handler.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { handleCheckPhone, handleRegister, type RegisterDeps } from './handler.ts'
import type { ShopRow } from '../_shared/account.ts'

const existing: ShopRow = { id: 'shop1', phone: '+919800000001', auth_user_id: 'u1', is_active: true }

function makeDeps(over: Partial<RegisterDeps> = {}) {
  const log: string[] = []
  const deps: RegisterDeps = {
    verifyFirebasePhone: async () => '+919800000001',
    findShopByPhone: async () => null,
    createShop: async (f) => { log.push(`create:${f.shop_name}`); return { id: 'new', phone: f.phone, auth_user_id: null, is_active: true, shop_name: f.shop_name } },
    ensureAuthUser: async (shop) => { log.push(`ensure:${shop.id}`); return 'u-new' },
    checkPassword: async (_shop, pw) => pw === 'right1',
    listApps: async () => [],
    addSubscriptions: async (id, apps, plan) => { log.push(`subs:${id}:${apps.join(',')}:${plan}`) },
    ...over,
  }
  return { deps, log }
}

const base = { idToken: 't', phone: '+919800000001', password: 'right1', shopName: 'S', ownerName: 'O' }

Deno.test('400 when verified phone differs', async () => {
  const { deps } = makeDeps({ verifyFirebasePhone: async () => '+919899999999' })
  assertEquals((await handleRegister(base, deps)).status, 400)
})

Deno.test('400 when password shorter than 6', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleRegister({ ...base, password: '123' }, deps)).status, 400)
})

Deno.test('new phone: creates shop, auth user and subscriptions (default shopai)', async () => {
  const { deps, log } = makeDeps()
  const res = await handleRegister({ ...base, plan: 'yearly' }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['create:S', 'ensure:new', 'subs:new:shopai:yearly'])
})

Deno.test('new phone requires shopName and ownerName', async () => {
  const { deps } = makeDeps()
  assertEquals((await handleRegister({ ...base, shopName: '' }, deps)).status, 400)
})

Deno.test('existing phone + wrong password: 401', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => existing })
  assertEquals((await handleRegister({ ...base, password: 'wrong1', apps: ['chukta'] }, deps)).status, 401)
})

Deno.test('existing phone adds only missing apps', async () => {
  const { deps, log } = makeDeps({ findShopByPhone: async () => existing, listApps: async () => ['shopai'] })
  const res = await handleRegister({ ...base, apps: ['shopai', 'chukta'] }, deps)
  assertEquals(res.status, 200)
  assertEquals(log, ['subs:shop1:chukta:monthly'])
})

Deno.test('existing phone already on every requested app: 409', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => existing, listApps: async () => ['shopai'] })
  const res = await handleRegister({ ...base, apps: ['shopai'] }, deps)
  assertEquals(res.status, 409)
  assertEquals(res.body.error, 'This phone number is already registered')
})

Deno.test('check-phone reports subscribed apps', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => existing, listApps: async () => ['shopai'] })
  assertEquals((await handleCheckPhone({ phone: '+919800000001' }, deps)).body, { exists: true, apps: ['shopai'] })
  const { deps: none } = makeDeps()
  assertEquals((await handleCheckPhone({ phone: '+919800000001' }, none)).body, { exists: false, apps: [] })
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `deno test supabase/functions/register/`
Expected: FAIL with `Module not found "./handler.ts"`.

- [ ] **Step 3: Implement `handler.ts`**

```ts
// supabase/functions/register/handler.ts
import { type AppName, type HandlerResult, parseApps, type ShopRow } from '../_shared/account.ts'

export type NewShopFields = {
  shop_name: string
  owner_name: string
  phone: string
  whatsapp_number: string | null
  business_category: string | null
}

export interface RegisterDeps {
  verifyFirebasePhone(idToken: string): Promise<string>
  findShopByPhone(phone: string): Promise<ShopRow | null>
  createShop(fields: NewShopFields): Promise<ShopRow>
  ensureAuthUser(shop: ShopRow, password: string): Promise<string>
  /** Proves the caller knows the existing account's password. False if the shop has no auth user yet. */
  checkPassword(shop: ShopRow, password: string): Promise<boolean>
  listApps(shopId: string): Promise<AppName[]>
  addSubscriptions(shopId: string, apps: AppName[], planType: string): Promise<void>
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

export async function handleRegister(input: Record<string, unknown>, deps: RegisterDeps): Promise<HandlerResult> {
  const idToken = str(input.idToken)
  const phone = str(input.phone)
  const password = typeof input.password === 'string' ? input.password : ''
  const apps = parseApps(input.apps, ['shopai'])
  const plan = str(input.plan) || 'monthly'

  if (!idToken || !phone || !password) return { status: 400, body: { error: 'idToken, phone and password are required' } }
  if (password.length < 6) return { status: 400, body: { error: 'Password must be at least 6 characters' } }
  if (!apps) return { status: 400, body: { error: 'apps must be a non-empty list of shopai/chukta' } }

  if ((await deps.verifyFirebasePhone(idToken)) !== phone) {
    return { status: 400, body: { error: 'Verified phone number does not match submitted phone' } }
  }

  const existing = await deps.findShopByPhone(phone)

  if (!existing) {
    const shopName = str(input.shopName)
    const ownerName = str(input.ownerName)
    if (!shopName || !ownerName) return { status: 400, body: { error: 'shopName and ownerName are required' } }
    const shop = await deps.createShop({
      shop_name: shopName,
      owner_name: ownerName,
      phone,
      whatsapp_number: str(input.whatsappNumber) || null,
      business_category: str(input.businessCategory) || null,
    })
    await deps.ensureAuthUser(shop, password)
    await deps.addSubscriptions(shop.id, apps, plan)
    return { status: 200, body: { shop: { id: shop.id, shop_name: shop.shop_name, phone: shop.phone }, apps } }
  }

  if (!(await deps.checkPassword(existing, password))) {
    return { status: 401, body: { error: 'This number is already registered. Enter its existing password (or reset it) to add the app.' } }
  }
  const current = await deps.listApps(existing.id)
  const missing = apps.filter((a) => !current.includes(a))
  if (missing.length === 0) return { status: 409, body: { error: 'This phone number is already registered', apps: current } }
  await deps.addSubscriptions(existing.id, missing, plan)
  return { status: 200, body: { shop: { id: existing.id, phone: existing.phone }, apps: [...current, ...missing] } }
}

export async function handleCheckPhone(input: Record<string, unknown>, deps: RegisterDeps): Promise<HandlerResult> {
  const phone = str(input.phone)
  if (!phone) return { status: 400, body: { error: 'phone is required' } }
  const shop = await deps.findShopByPhone(phone)
  if (!shop) return { status: 200, body: { exists: false, apps: [] } }
  return { status: 200, body: { exists: true, apps: await deps.listApps(shop.id) } }
}
```

- [ ] **Step 4: Implement `index.ts`**

```ts
// supabase/functions/register/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { type AppName, corsHeaders, json } from '../_shared/account.ts'
import { adminAuthPort, ensureAuthUser } from '../_shared/authUsers.ts'
import { verifyFirebasePhone } from '../_shared/firebase.ts'
import { handleCheckPhone, handleRegister, type RegisterDeps } from './handler.ts'

const url = Deno.env.get('SUPABASE_URL')!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, noPersist)
const publicClient = () => createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, noPersist)
const TRIAL_DAYS = 30
const SHOP_COLUMNS = 'id, phone, auth_user_id, is_active, shop_name'

const deps: RegisterDeps = {
  verifyFirebasePhone,
  async findShopByPhone(phone) {
    const { data, error } = await admin.from('shops').select(SHOP_COLUMNS).eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  },
  async createShop(fields) {
    const { data, error } = await admin.from('shops')
      .insert({ ...fields, is_active: true, ai_consent: true }).select(SHOP_COLUMNS).single()
    if (error) throw error
    return data
  },
  ensureAuthUser: (shop, password) => ensureAuthUser(adminAuthPort(admin), shop, password),
  async checkPassword(shop, password) {
    if (!shop.auth_user_id) return false
    const { data: u } = await admin.auth.admin.getUserById(shop.auth_user_id)
    if (!u?.user?.email) return false
    const { data, error } = await publicClient().auth.signInWithPassword({ email: u.user.email, password })
    if (error || !data.session) return false
    await admin.auth.admin.signOut(data.session.access_token, 'local')
    return true
  },
  async listApps(shopId) {
    const { data, error } = await admin.from('app_subscriptions').select('app').eq('shop_id', shopId)
    if (error) throw error
    return (data ?? []).map((r) => r.app as AppName)
  },
  async addSubscriptions(shopId, apps, planType) {
    const expires = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString()
    const { error } = await admin.from('app_subscriptions')
      .insert(apps.map((app) => ({ shop_id: shopId, app, plan_type: planType, expires_at: expires })))
    if (error) throw error
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const body = await req.json()
    const result = new URL(req.url).pathname.endsWith('/check-phone')
      ? await handleCheckPhone(body, deps)
      : await handleRegister(body, deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('register error:', err)
    return json(500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})
```

- [ ] **Step 5: Delete `register-shop` and update the config**

```bash
git rm -r supabase/functions/register-shop
```

In `supabase/config.toml`, replace the whole `[functions.register-shop]` block with:

```toml
[functions.register]
enabled = true
verify_jwt = false  # called pre-login from the web registration page, no session yet
entrypoint = "./functions/register/index.ts"
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `deno test supabase/functions/register/ && deno check supabase/functions/register/index.ts`
Expected: 8 tests pass, and the type check is clean.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/register supabase/config.toml
git commit -m "feat(functions): add register with per-app subscriptions; remove register-shop"
```

---

### Task 8: `reset-password` function

This is also how existing shops get their first login.

**Files:**
- Create: `supabase/functions/reset-password/handler.ts`, `supabase/functions/reset-password/index.ts`
- Modify: `supabase/config.toml`
- Test: `supabase/functions/reset-password/handler.test.ts`

**Interfaces:**
- Consumes: `ShopRow`, `HandlerResult`, `ensureAuthUser`, `adminAuthPort`, `verifyFirebasePhone` (Task 5); SQL `revoke_user_sessions` (Task 3)
- Produces: `POST /functions/v1/reset-password`, body `{ idToken, phone, newPassword }`. Returns 200 `{ success: true }`, 400, or 404.

- [ ] **Step 1: Write the failing tests**

```ts
// supabase/functions/reset-password/handler.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { handleResetPassword, type ResetDeps } from './handler.ts'

function makeDeps(over: Partial<ResetDeps> = {}) {
  const log: string[] = []
  const deps: ResetDeps = {
    verifyFirebasePhone: async () => '+919800000001',
    findShopByPhone: async () => ({ id: 'shop1', phone: '+919800000001', auth_user_id: null, is_active: true }),
    ensureAuthUser: async (_s, pw) => { log.push(`ensure:${pw}`); return 'u1' },
    revokeAllSessions: async (uid) => { log.push(`revoke:${uid}`) },
    ...over,
  }
  return { deps, log }
}

const body = { idToken: 't', phone: '+919800000001', newPassword: 'newpass1' }

Deno.test('sets the password (creating the auth user for pre-Phase-0 shops) and revokes sessions', async () => {
  const { deps, log } = makeDeps()
  assertEquals((await handleResetPassword(body, deps)).status, 200)
  assertEquals(log, ['ensure:newpass1', 'revoke:u1'])
})

Deno.test('400 on phone mismatch or short password', async () => {
  const { deps } = makeDeps({ verifyFirebasePhone: async () => '+910000000000' })
  assertEquals((await handleResetPassword(body, deps)).status, 400)
  const { deps: d2 } = makeDeps()
  assertEquals((await handleResetPassword({ ...body, newPassword: '123' }, d2)).status, 400)
})

Deno.test('404 for unregistered phone', async () => {
  const { deps } = makeDeps({ findShopByPhone: async () => null })
  assertEquals((await handleResetPassword(body, deps)).status, 404)
})
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `deno test supabase/functions/reset-password/`
Expected: FAIL with `Module not found`.

- [ ] **Step 3: Implement `handler.ts` and `index.ts`**

```ts
// supabase/functions/reset-password/handler.ts
import type { HandlerResult, ShopRow } from '../_shared/account.ts'

export interface ResetDeps {
  verifyFirebasePhone(idToken: string): Promise<string>
  findShopByPhone(phone: string): Promise<ShopRow | null>
  ensureAuthUser(shop: ShopRow, password: string): Promise<string>
  revokeAllSessions(userId: string): Promise<void>
}

export async function handleResetPassword(input: Record<string, unknown>, deps: ResetDeps): Promise<HandlerResult> {
  const idToken = typeof input.idToken === 'string' ? input.idToken : ''
  const phone = typeof input.phone === 'string' ? input.phone : ''
  const newPassword = typeof input.newPassword === 'string' ? input.newPassword : ''
  if (!idToken || !phone || !newPassword) return { status: 400, body: { error: 'idToken, phone and newPassword are required' } }
  if (newPassword.length < 6) return { status: 400, body: { error: 'Password must be at least 6 characters' } }

  if ((await deps.verifyFirebasePhone(idToken)) !== phone) {
    return { status: 400, body: { error: 'Verified phone number does not match submitted phone' } }
  }
  const shop = await deps.findShopByPhone(phone)
  if (!shop) return { status: 404, body: { error: 'This phone number is not registered' } }

  // One password for both apps: a reset signs the user out of ShopAI and Chukta everywhere.
  const userId = await deps.ensureAuthUser(shop, newPassword)
  await deps.revokeAllSessions(userId)
  return { status: 200, body: { success: true } }
}
```

```ts
// supabase/functions/reset-password/index.ts
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.47.10'
import { corsHeaders, json } from '../_shared/account.ts'
import { adminAuthPort, ensureAuthUser } from '../_shared/authUsers.ts'
import { verifyFirebasePhone } from '../_shared/firebase.ts'
import { handleResetPassword, type ResetDeps } from './handler.ts'

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const deps: ResetDeps = {
  verifyFirebasePhone,
  async findShopByPhone(phone) {
    const { data, error } = await admin.from('shops')
      .select('id, phone, auth_user_id, is_active').eq('phone', phone).maybeSingle()
    if (error) throw error
    return data
  },
  ensureAuthUser: (shop, password) => ensureAuthUser(adminAuthPort(admin), shop, password),
  async revokeAllSessions(userId) {
    const { error } = await admin.rpc('revoke_user_sessions', { p_user_id: userId })
    if (error) throw error
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  try {
    const result = await handleResetPassword(await req.json(), deps)
    return json(result.status, result.body)
  } catch (err) {
    console.error('reset-password error:', err)
    return json(500, { error: err instanceof Error ? err.message : 'Internal error' })
  }
})
```

Append to `supabase/config.toml`:

```toml
[functions.reset-password]
enabled = true
verify_jwt = false  # caller proves phone ownership with a Firebase OTP token
entrypoint = "./functions/reset-password/index.ts"
```

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `deno test supabase/functions/reset-password/ && deno check supabase/functions/reset-password/index.ts`
Expected: 3 tests pass, and the type check is clean.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/reset-password supabase/config.toml
git commit -m "feat(functions): add OTP-verified password reset revoking all app sessions"
```

---

### Task 9: `payments` function — per-app subscriptions, lookup, admin settings

**Files:**
- Modify: `supabase/functions/payments/index.ts`
- Create: `supabase/functions/payments/expiry.ts`
- Test: `supabase/functions/payments/expiry.test.ts`

**Interfaces:**
- Consumes: `app_subscriptions`, `payments.app` (Task 2); `parseApp` (Task 5)
- Produces:
  - `extendExpiry(current: string | null, days: number, now?: Date): string`
  - `POST /payments/lookup`, body `{ phone, app? }`. Returns `{ shop_name, expires_at }` or 404.
  - `/initiate` accepts `app`
  - `POST /payments/admin/settings`, admin JWT, body `{ settings: { key, value }[] }`
  - `/admin/shops` embeds `app_subscriptions`
  - approve, extend-plan and set-expiry write `app_subscriptions`

- [ ] **Step 1: Write the failing test**

```ts
// supabase/functions/payments/expiry.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { extendExpiry } from './expiry.ts'

const now = new Date('2026-09-28T00:00:00Z')

Deno.test('extends from current expiry when still active', () => {
  assertEquals(extendExpiry('2026-10-10T00:00:00Z', 30, now), '2026-11-09T00:00:00.000Z')
})

Deno.test('extends from now when expired or missing', () => {
  assertEquals(extendExpiry('2026-01-01T00:00:00Z', 30, now), '2026-10-28T00:00:00.000Z')
  assertEquals(extendExpiry(null, 365, now), '2027-09-28T00:00:00.000Z')
})
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `deno test supabase/functions/payments/`
Expected: FAIL with `Module not found "./expiry.ts"`.

- [ ] **Step 3: Implement `expiry.ts`**

```ts
// supabase/functions/payments/expiry.ts
/** New expiry = max(current, now) + days. */
export function extendExpiry(current: string | null, days: number, now: Date = new Date()): string {
  const base = current && new Date(current) > now ? new Date(current) : new Date(now)
  base.setUTCDate(base.getUTCDate() + days)
  return base.toISOString()
}
```

- [ ] **Step 4: Edit `payments/index.ts`**

(a) Under the existing imports, add:

```ts
import { parseApp } from '../_shared/account.ts'
import { extendExpiry } from './expiry.ts'

const SHOP_ADMIN_COLUMNS =
  'id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active, active_device_id, created_at, last_synced_at, allow_out_of_stock_billing, auth_user_id'
```

(b) In `/initiate`, read and validate `app`:

```ts
      const { phone, utr, amount, planType, app: rawApp } = await req.json()
      const app = parseApp(rawApp, 'shopai')
      if (!phone || !utr || !amount || !planType || !app) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
```
and in the `payments` insert object add `app,` after `plan_type: planType,`.

(c) Directly after the `/initiate` block, add:

```ts
    // === PUBLIC: LOOKUP (RenewPlan page) ===
    if (path === '/lookup' && req.method === 'POST') {
      const { phone, app: rawApp } = await req.json()
      const app = parseApp(rawApp, 'shopai')
      if (!phone || !app) {
        return new Response(JSON.stringify({ error: 'phone is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: shop } = await supabase.from('shops').select('id, shop_name').eq('phone', phone).maybeSingle()
      if (!shop) {
        return new Response(JSON.stringify({ error: 'Shop not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: sub } = await supabase.from('app_subscriptions').select('expires_at').eq('shop_id', shop.id).eq('app', app).maybeSingle()
      return new Response(JSON.stringify({ shop_name: shop.shop_name, expires_at: sub?.expires_at ?? null }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
```

(d) In `/admin/shops` (GET list): **delete** the "Auto-populate 30-day trial" block. Replace the select with:

```ts
      const { data: shops, error } = await supabase
        .from('shops')
        .select(`${SHOP_ADMIN_COLUMNS}, app_subscriptions(app, plan_type, is_active, expires_at)`)
        .order('created_at', { ascending: false })
```

(e) In `/admin/shops/:id` (GET details), replace `.select('*')` with `.select(`${SHOP_ADMIN_COLUMNS}, app_subscriptions(app, plan_type, is_active, expires_at)`)`.

(f) Replace the body of `/extend-plan` after `await verifyAdminToken(token)`:

```ts
      const body = await req.json().catch(() => ({}))
      const app = parseApp(body.app, 'shopai')
      if (!app) throw new Error('unknown app')
      const { data: sub } = await supabase.from('app_subscriptions')
        .select('expires_at, plan_type').eq('shop_id', shopId).eq('app', app).maybeSingle()
      const newExpiry = extendExpiry(sub?.expires_at ?? null, 30)
      const { error: subErr } = await supabase.from('app_subscriptions').upsert(
        { shop_id: shopId, app, plan_type: sub?.plan_type || 'standard', expires_at: newExpiry, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'shop_id,app' })
      if (subErr) throw subErr
      await supabase.from('shops').update({ is_active: true }).eq('id', shopId)

      return new Response(JSON.stringify({ success: true, newExpiry }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

(g) Replace the body of `/set-expiry` after `await verifyAdminToken(token)`:

```ts
      const { plan_expires_at, app: rawApp } = await req.json()
      const app = parseApp(rawApp, 'shopai')
      if (!plan_expires_at || !app) throw new Error('plan_expires_at is required')
      const { error: subErr } = await supabase.from('app_subscriptions')
        .update({ expires_at: plan_expires_at, updated_at: new Date().toISOString() }).eq('shop_id', shopId).eq('app', app)
      if (subErr) throw subErr

      return new Response(JSON.stringify({ success: true, plan_expires_at }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

(h) In `/admin/approve/:id`, replace the `newExpiry` calculation and the `shops` update with the block below, and change the response to `JSON.stringify({ success: true, newExpiry })`. This also fixes early renewals losing their remaining days.

```ts
      const days = payment.plan_type === 'yearly' ? 365 : 30
      const app = parseApp(payment.app, 'shopai')!
      const { data: sub } = await supabase.from('app_subscriptions')
        .select('expires_at').eq('shop_id', payment.shop_id).eq('app', app).maybeSingle()
      const newExpiry = extendExpiry(sub?.expires_at ?? null, days)
      const { error: subErr } = await supabase.from('app_subscriptions').upsert(
        { shop_id: payment.shop_id, app, plan_type: payment.plan_type, expires_at: newExpiry, is_active: true, updated_at: new Date().toISOString() },
        { onConflict: 'shop_id,app' })
      if (subErr) throw subErr
      await supabase.from('shops').update({ is_active: true }).eq('id', payment.shop_id)
```

(i) Before the final 404 return, add:

```ts
    // === ADMIN: SAVE APP SETTINGS (replaces anon REST write from the web) ===
    if (path === '/admin/settings' && req.method === 'POST') {
      const authHeader = req.headers.get('authorization')
      if (!authHeader) throw new Error('Missing authorization')
      await verifyAdminToken(authHeader.replace('Bearer ', ''))

      const { settings } = await req.json()
      if (!Array.isArray(settings) || settings.some((s) => typeof s?.key !== 'string' || typeof s?.value !== 'string')) {
        return new Response(JSON.stringify({ error: 'settings must be [{ key, value }]' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const now = new Date().toISOString()
      const { error } = await supabase.from('app_settings')
        .upsert(settings.map((s: { key: string; value: string }) => ({ key: s.key, value: s.value, updated_at: now })), { onConflict: 'key' })
      if (error) throw error
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
```

- [ ] **Step 5: Run the tests and type check**

Run: `deno test supabase/functions/payments/ && deno check supabase/functions/payments/index.ts && grep -n "plan_expires_at\|password_hash" supabase/functions/payments/index.ts`
Expected: 2 tests pass, and the type check is clean. The only `plan_expires_at` left is the `/set-expiry` request field.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/payments
git commit -m "feat(payments): per-app subscriptions, lookup and admin settings endpoints"
```

---

### Task 10: ShopAI mobile — sessions and plan info from `app_subscriptions`

**Files:**
- Create: `mobile-shopai/src/services/subscription.ts`
- Modify:
  - `mobile-shopai/src/lib/supabase.ts`
  - `mobile-shopai/src/services/authService.ts`
  - `mobile-shopai/src/services/syncService.ts:40-62`
  - `mobile-shopai/src/screens/settings/SettingsScreen.tsx:123-136`
  - `mobile-shopai/src/screens/auth/ShopDeactivatedScreen.tsx:42-63`
  - `mobile-shopai/src/screens/settings/EditShopScreen.tsx`
  - `mobile-shopai/app.json`

**Interfaces:**
- Consumes: `POST /functions/v1/login` (Task 6); RLS on `app_subscriptions` (Task 2)
- Produces: `fetchShopStatus(shopId: string): Promise<ShopStatus | null>`, where `ShopStatus = { isActive: boolean; activeDeviceId: string | null; aiConsent: boolean; allowOutOfStockBilling: boolean; planType: string | null; planExpiresAt: string | null }`

- [ ] **Step 1: Create `services/subscription.ts`**

```ts
// mobile-shopai/src/services/subscription.ts
import { supabase } from '../lib/supabase';

export type ShopStatus = {
  isActive: boolean;
  activeDeviceId: string | null;
  aiConsent: boolean;
  allowOutOfStockBilling: boolean;
  planType: string | null;
  planExpiresAt: string | null;
};

/**
 * Shop flags plus this app's subscription. Plans live in app_subscriptions
 * (one row per app); RLS returns only this shop's rows.
 */
export const fetchShopStatus = async (shopId: string): Promise<ShopStatus | null> => {
  const [{ data: shop, error: shopError }, { data: sub, error: subError }] = await Promise.all([
    supabase
      .from('shops')
      .select('is_active, active_device_id, ai_consent, allow_out_of_stock_billing')
      .eq('id', shopId)
      .maybeSingle(),
    supabase
      .from('app_subscriptions')
      .select('plan_type, expires_at, is_active')
      .eq('shop_id', shopId)
      .eq('app', 'shopai')
      .maybeSingle(),
  ]);
  if (shopError || subError || !shop) return null;
  return {
    isActive: shop.is_active !== false && sub?.is_active !== false,
    activeDeviceId: shop.active_device_id ?? null,
    aiConsent: shop.ai_consent === true,
    allowOutOfStockBilling: shop.allow_out_of_stock_billing === true,
    planType: sub?.plan_type ?? null,
    planExpiresAt: sub?.expires_at ?? null,
  };
};

export const isPlanExpired = (planExpiresAt: string | null | undefined): boolean =>
  planExpiresAt ? new Date(planExpiresAt) < new Date() : false;
```

- [ ] **Step 2: Auto-refresh tied to app state (`lib/supabase.ts`)**

```ts
import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// React Native: only refresh tokens while foregrounded (supabase-js RN guidance).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 3: `authService.ts` — `login`**

Replace the doc comment and the body of `login` up to and including `const shop: ShopRecord = body.shop;`:

```ts
/**
 * Log in with a 10-digit phone number and password via the `login` Edge
 * Function. It returns a Supabase Auth session scoped to ShopAI (JWT claims
 * app='shopai', shop_id); RLS enforces shop isolation on every request.
 */
export const login = async (phone: string, password: string): Promise<ShopRecord> => {
  const e164Phone = `+91${phone}`;
  const deviceId = await getOrCreateDeviceId();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ phone: e164Phone, password, app: 'shopai', deviceId }),
  });

  const body = await res.json();
  if (body.error === 'password_reset_required') {
    throw new Error('Please set a new password first: open pragatibandhu website → Forgot password.');
  }
  if (body.error === 'not_subscribed') {
    throw new Error('This number is not registered for ShopAI. Please register on the Pragati Bandhu website.');
  }
  if (!res.ok) throw new Error(body.error ?? 'Login failed');

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: body.session.access_token,
    refresh_token: body.session.refresh_token,
  });
  if (sessionError) throw new Error('Could not start a secure session. Please try again.');

  // Plan info now comes from the per-app subscription, not the shops row.
  const shop: ShopRecord = {
    ...body.shop,
    plan_type: body.subscription?.plan_type ?? null,
    plan_expires_at: body.subscription?.expires_at ?? null,
  };
```

Further down in `login`, delete the second `const deviceId = await getOrCreateDeviceId();` above the `login_events` insert. The one declared at the top is in scope.

- [ ] **Step 4: `authService.ts` — `getStoredAuth` and `logout`**

In `getStoredAuth`, insert directly after the `if (!shopId) { ... }` block:

```ts
  // Builds before Phase 0 stored only a shop id (no Supabase session). Without a
  // session every request fails RLS, so send the user back to login once.
  // A network error while refreshing returns `error` — keep them signed in offline.
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (!sessionData.session && !sessionError) {
    await clearAllUserData();
    return { isAuthenticated: false, phone: null, uuid: null };
  }
```

Replace `logout`:

```ts
export const logout = async (): Promise<void> => {
  // scope 'local' ends only this device's ShopAI session; Chukta stays signed in.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  closeUserDatabase();
  await clearAllUserData();
};
```

- [ ] **Step 5: `syncService.ts`**

Replace the `shops` query and the code that uses it (currently lines ~40–62, from `const { data } = await supabase` through the `isExpired` / `onDeactivated()` block):

```ts
    const status = await fetchShopStatus(userId);
    if (!status) return;

    // Always sync latest shop info (plan info, etc.) to local storage
    const info = await getShopInfo();
    if (info) {
      await setShopInfo({
        ...info,
        isActive: status.isActive,
        planExpiresAt: status.planExpiresAt ?? undefined,
        planType: status.planType ?? undefined,
        allowOutOfStockBilling: status.allowOutOfStockBilling,
      });
    }

    // Admin deactivation or plan expiry — applies to all users
    if (!status.isActive || isPlanExpired(status.planExpiresAt)) {
      onDeactivated();
      return;
    }
```

In the device-conflict block that follows, replace `data.ai_consent` with `status.aiConsent` and `data.active_device_id` with `status.activeDeviceId`. Add the import `import { fetchShopStatus, isPlanExpired } from './subscription';`. Then run `grep -n "data\." mobile-shopai/src/services/syncService.ts` and make sure no reference to the removed `data` variable remains in that function.

- [ ] **Step 6: `SettingsScreen.tsx` (inside `loadLatestInfo`)**

Replace the `const { data } = await supabase.from('shops')...` line and the `if (data) { ... }` block:

```tsx
                        const status = await fetchShopStatus(shopId);
                        if (status) {
                            if (!status.isActive || isPlanExpired(status.planExpiresAt)) {
                                setShopActive(false);
                            }
                            if (info) {
                                info = {
                                    ...info,
                                    isActive: status.isActive,
                                    planExpiresAt: status.planExpiresAt ?? undefined,
                                    planType: status.planType ?? undefined,
                                    allowOutOfStockBilling: status.allowOutOfStockBilling,
                                };
                                await persistShopInfo(info);
                            }
                        }
```

Add `import { fetchShopStatus, isPlanExpired } from '../../services/subscription';`.

- [ ] **Step 7: `ShopDeactivatedScreen.tsx` (inside `handleRefresh`)**

Replace the `const { data } = await supabase.from("shops")...` query and the `if (data) { ... }` block:

```tsx
                const status = await fetchShopStatus(shopId);

                if (status) {
                    const isActive = status.isActive && !isPlanExpired(status.planExpiresAt);

                    if (status.planExpiresAt) {
                        setPlanExpiresAt(status.planExpiresAt);
                    }

                    const info = await getShopInfo();
                    if (info) {
                        await setShopInfo({
                            ...info,
                            isActive,
                            planExpiresAt: status.planExpiresAt ?? undefined,
                            planType: status.planType ?? undefined,
                        });
                    }

                    if (isActive) {
                        setShopActive(true);
                        return;
                    }
                }
```

Add `import { fetchShopStatus, isPlanExpired } from '../../services/subscription';`. If `supabase` is no longer used in the file, remove its import.

- [ ] **Step 8: Make phone read-only (`EditShopScreen.tsx`)**

The phone is the login identifier, and Task 4 removed client `UPDATE` on `shops.phone`.

```bash
grep -n "phone" mobile-shopai/src/screens/settings/EditShopScreen.tsx
```
Add `editable={false}` to the phone `TextInput`, and remove `phone` from the object this screen passes to the sync queue's `shop` payload. If the screen has no phone input, skip this step and say so in the commit message.

- [ ] **Step 9: Bump the version and type check**

Set `"version": "1.1.0"` in `mobile-shopai/app.json`.

```bash
cd mobile-shopai && npx tsc --noEmit 2>&1 | tail -3 | diff - /tmp/shopai-tsc-baseline.txt && echo SAME
grep -rn "plan_expires_at\|plan_type" src --include=*.ts --include=*.tsx | grep -v "services/authService.ts\|services/subscription.ts"
```
Expected: `SAME`, and the grep prints nothing.

- [ ] **Step 10: Commit**

```bash
git add mobile-shopai/src mobile-shopai/app.json
git commit -m "feat(shopai): app-scoped Supabase sessions; plan info from app_subscriptions"
```

---

### Task 11: Web — registration, renew, forgot password, admin

**Files:**
- Modify: `web/src/App.tsx`, `web/src/pages/RenewPlan.tsx`, `web/src/pages/admin/AdminSettings.tsx`, `web/src/pages/admin/AdminShops.tsx`
- Create: `web/src/pages/ForgotPassword.tsx`

**Interfaces:**
- Consumes: `/register`, `/register/check-phone` (Task 7); `/reset-password` (Task 8); `/payments/lookup`, `/payments/admin/settings`, and the `/payments/admin/shops` embed (Task 9)

- [ ] **Step 1: Registration phone check (`App.tsx`, `handleSendOtp`)**

Replace the anon REST check:

```tsx
      // Check if phone number is already registered for ShopAI
      const checkRes = await fetch(`${SUPABASE_URL}/functions/v1/register/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ phone: `+91${clean}` }),
      });
      const checkBody = await checkRes.json();
      if (!checkRes.ok) throw new Error(checkBody.error ?? 'Could not check phone number');
      if (checkBody.apps?.includes('shopai')) {
        setError('This phone number is already registered');
        setIsLoading(false);
        return;
      }
```

- [ ] **Step 2: Registration submit (`App.tsx`, `handleRegister`)**

Change the URL to `${SUPABASE_URL}/functions/v1/register` and add `apps: ['shopai'],` to the JSON body after `plan: selectedPlan,`.

- [ ] **Step 3: Renew lookup (`RenewPlan.tsx`)**

Replace the anon REST check in `handleVerifyPhone`:

```tsx
      const checkRes = await fetch(`${SUPABASE_URL}/functions/v1/payments/lookup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ phone: `+91${clean}`, app: 'shopai' }),
      });
      const checkBody = await checkRes.json();
      if (checkRes.status === 404) {
        setError('This phone number is not registered. Check the number and try again.');
        setIsLoading(false);
        return;
      }
      if (!checkRes.ok) throw new Error(checkBody.error ?? 'Could not verify phone number');

      setShopName(checkBody.shop_name || '');
      setCurrentExpiry(checkBody.expires_at || null);
      setStep('pay');
```

In `handleSubmitUtr`, add `app: 'shopai'` to the `/payments/initiate` JSON body.

- [ ] **Step 4: Create `ForgotPassword.tsx`**

First check the class names the registration page uses:

```bash
grep -n "className=\"" web/src/App.tsx | grep -o 'className="[^"]*"' | sort | uniq -c | sort -rn | head -15
```
Use those classes for the card, input, button and error elements. The names below are placeholders to swap if they differ.

```tsx
// web/src/pages/ForgotPassword.tsx
import { useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';
import '../App.css';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export default function ForgotPassword() {
  const [step, setStep] = useState<'phone' | 'otp' | 'password' | 'done'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idToken, setIdToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const clean = phone.replace(/\D/g, '');

  const sendOtp = async () => {
    setError('');
    if (clean.length !== 10) return setError('Enter a valid 10-digit mobile number');
    setIsLoading(true);
    try {
      const auth = getFirebaseAuth();
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      setConfirmation(await signInWithPhoneNumber(auth, `+91${clean}`, (window as any).recaptchaVerifier));
      setStep('otp');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (!confirmation) return;
    setIsLoading(true);
    try {
      const credential = await confirmation.confirm(otp);
      setIdToken(await credential.user.getIdToken());
      setStep('password');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const savePassword = async () => {
    setError('');
    if (password.length < 6) return setError('Password must be at least 6 characters');
    if (password !== confirmPassword) return setError('Passwords do not match');
    setIsLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ idToken, phone: `+91${clean}`, newPassword: password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? 'Could not reset password');
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Could not reset password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="header-section">
        <h1 className="hero-title">Reset password</h1>
        <p className="hero-subtitle">One password works for all Pragati Bandhu apps.</p>
      </div>
      <div className="form-card">
        {error && <div className="error-message">{error}</div>}
        {step === 'phone' && (
          <>
            <input className="form-input" placeholder="10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <button className="btn-primary" disabled={isLoading} onClick={sendOtp}>Send OTP</button>
          </>
        )}
        {step === 'otp' && (
          <>
            <input className="form-input" placeholder="Enter OTP" value={otp} onChange={(e) => setOtp(e.target.value)} />
            <button className="btn-primary" disabled={isLoading} onClick={verifyOtp}>Verify OTP</button>
          </>
        )}
        {step === 'password' && (
          <>
            <input className="form-input" type="password" placeholder="New password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input className="form-input" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            <button className="btn-primary" disabled={isLoading} onClick={savePassword}>Save password</button>
          </>
        )}
        {step === 'done' && <p>Password updated. Open the app and log in with your new password.</p>}
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the route (`App.tsx`)**

Add `import ForgotPassword from './pages/ForgotPassword';` beside the other page imports, and inside `<Route element={<Layout />}>` add:

```tsx
          <Route path="/forgot-password" element={<ForgotPassword />} />
```

- [ ] **Step 6: Admin settings save (`AdminSettings.tsx`)**

Replace the `fetch(...)` in the save handler:

```tsx
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/payments/admin/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: payload.map(({ key, value }: { key: string; value: string }) => ({ key, value })) }),
      });
```

- [ ] **Step 7: Admin shops reads subscriptions (`AdminShops.tsx`)**

In the `Shop` type, replace `plan_type: string;` and `plan_expires_at: string | null;` with:

```tsx
  app_subscriptions?: { app: 'shopai' | 'chukta'; plan_type: string; is_active: boolean; expires_at: string | null }[];
```

Add this helper above the component:

```tsx
const shopaiSub = (shop: Shop) => shop.app_subscriptions?.find((s) => s.app === 'shopai');
```

Then replace every `shop.plan_type` with `shopaiSub(shop)?.plan_type` and every `shop.plan_expires_at` with `shopaiSub(shop)?.expires_at`. Use `grep -n "plan_type\|plan_expires_at" web/src/pages/admin/AdminShops.tsx` to find them all, and also check the shop-details modal. Next to the plan badge, add:

```tsx
                      {shop.app_subscriptions?.some((s) => s.app === 'chukta') && (
                        <span className="badge badge-success" style={{ marginLeft: 4 }}>Chukta</span>
                      )}
```

- [ ] **Step 8: Build**

```bash
cd web && npm run build
grep -rn "rest/v1" src
```
Expected: the build succeeds. The only remaining `rest/v1` match is the `app_settings` **read** in `AdminSettings.tsx`, which is allowed because anon can still read.

- [ ] **Step 9: Commit**

```bash
git add web/src
git commit -m "feat(web): use edge functions for registration, renew, settings; add forgot password"
```

---

### Task 12: Deploy and verify

This changes production. Run it with the user.

- [ ] **Step 1: Set secrets and deploy functions (no Docker needed)**

```bash
supabase secrets set AUTH_EMAIL_DOMAIN=accounts.pragatibandhu.internal   # or the Task 0 value
supabase functions deploy login register reset-password payments --use-api
supabase functions delete register-shop
```

- [ ] **Step 2: API smoke test**

```bash
API=https://mhtqufyaxpunhenqropn.supabase.co
ANON=<anon key from mobile-shopai/eas.json>
# anon can no longer read shop data
curl -s "$API/rest/v1/products?select=id&limit=1" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
# an existing (pre-Phase-0) shop must be told to reset
curl -s "$API/functions/v1/login" -H 'Content-Type: application/json' -H "apikey: $ANON" \
  -d '{"phone":"<an existing shop phone>","password":"anything","app":"shopai"}'
```
Expected:
- The first call returns a `permission denied` error, not rows.
- The second returns `{"error":"password_reset_required"}`.

- [ ] **Step 3: Deploy the web app**

```bash
cd web && npm run build   # then publish dist/ the usual way
```

- [ ] **Step 4: End-to-end with a real phone**

1. **Web → Forgot password** for an existing test shop: OTP, then new password. `success`.
2. **Dev build of ShopAI 1.1.0** (`cd mobile-shopai && npx expo run:android`): log in with that phone and the new password. The home screen loads, and existing products appear (restore works under RLS).
3. Create a product and make a sale. Both sync. Studio → `products` shows the new row with the right `shop_id`.
4. Decode the access token (log `session.access_token` once, or read `app_sessions` in Studio) and confirm `app=shopai`.
5. Log out, then log back in. It works.
6. Airplane mode after the token expires (1h, or temporarily set Auth → JWT expiry to 60s): reopen the app. It must **stay logged in** and work offline.
7. **Web → Register** a brand-new number, then log in on ShopAI. It works.
8. **Admin:** shops list shows plans, settings save works, approving a test payment extends `app_subscriptions`.

If any sync call fails with `42501`, the failing table's upsert is missing `shop_id`. Fix it in `mobile-shopai/src/db/syncQueue.ts`, not in the policy.

- [ ] **Step 5: Release**

```bash
cd mobile-shopai && eas build -p android --profile production
```

- [ ] **Step 6: Record completion**

Append the deploy date and any fixes made in Step 4 to `docs/superpowers/notes/2026-09-28-phase0-preflight.md`, then commit.

---

## Self-Review Notes

- **Spec coverage:**
  - §4.1 → Tasks 2, 5
  - §4.2 → Task 2
  - §4.3 → Task 6
  - §4.4 → Task 3
  - §4.5 → Tasks 6, 10 (local sign-out), 3/8 (revoke)
  - §4.6 → Task 7
  - §4.7 → Tasks 8, 11
  - §4.8 → Task 4
  - §5 → Task 1
  - §8 → Tasks 9, 11
  - §10 → Tasks 6, 7, 10
  - §11 → pgTAP (Tasks 2–4) and Deno (Tasks 5–9)
  - §13 → Task 0
  - Deferred to the Chukta Phase 1 plan: §4.9 staff tokens, §6 `chukta` schema, §7 amendments.
- **Changes from the spec, driven by "ShopAI has no real users":**
  - No lazy migration. Existing shops must reset their password.
  - Single deploy, with no Stage A/B grace period or forced update.
  - `shops.plan_*` and `shops.password_hash` are dropped instead of kept as a mirror.
  - `register-shop` is deleted, not aliased.
  - Tests run against the linked project, with no Docker.
- **Other change from spec §4.1:** auth users sign in with a synthetic email derived from the **shop id**, not with `auth.users.phone`. This means no SMS provider is needed, and a phone change can't collide with another account. Users still enter their phone.
- **Found during planning, fixed here:**
  - `app_settings` was writable with the anon key (Tasks 4, 9, 11).
  - `shops.is_active` and `shops.phone` were client-updatable (Tasks 4, 10).
  - `/admin/shops` returned `password_hash` (Task 9, and the column is dropped).
  - Early renewals lost their remaining days (Task 9h).
- **Not fixed (flagged to user):**
  - The `payments` function falls back to `ADMIN_PASSWORD='admin123'` and a hardcoded `ADMIN_JWT_SECRET` if the env vars are unset.
  - `SettingsScreen` calls the admin-only `reset-data` endpoint with a user token (it always fails auth).
