# Chukta + ShopAI on One Supabase — Design

**Date:** 2026-09-28
**Status:** Approved in brainstorming, pending written-spec review
**Inputs:**
- Product spec: `Chukta-Worker-Pay-Advance-&-Wage-Diary-feature-plan.md`
- Chukta Phase 1 plan: `2026-09-28-worker-pay-advance-wage-diary-phase1.md` (to be amended per §7)
- Current auth/RLS: `supabase/migrations/20260708090742_password_login_permissive_rls.sql`, `supabase/functions/login`, `supabase/functions/register-shop`

> **Revision (2026-09-28, after planning):** ShopAI has no real users, so the Phase 0 plan (`docs/superpowers/plans/2026-09-28-phase0-shared-account-auth.md`) overrides this spec in four places:
> 1. **No lazy migration (§4.1, §4.3).** Existing shop rows are kept but can't log in (`password_reset_required`) until the owner resets the password through the OTP flow.
> 2. **Single deploy (§9).** No grace period, no forced update, no Stage A/B.
> 3. **Legacy columns dropped (§4.2).** `shops.plan_type`, `plan_expires_at` and `password_hash` are dropped, with no mirror; ShopAI reads `app_subscriptions`. `register-shop` is deleted.
> 4. **Auth identity (§4.1).** Auth users sign in with a synthetic email `s-<shop_id>@<AUTH_EMAIL_DOMAIN>`, not `auth.users.phone`, so no SMS provider is needed. Users still type phone + password.

---

## 1. Goal

Add a second mobile app, **Chukta** (worker pay, advance and wage diary), to this repo. It shares the existing Supabase project and web app with ShopAI. Requirements:

- One account per phone number. The same phone and password log into both apps.
- Each app has its own independent session: logging out of one doesn't affect the other, and a token from one app can't read the other app's data.
- Two separate mobile codebases with **no shared code**. The only contract between them is the database schema plus the edge functions.
- Chukta stores sensitive data (worker phones, salaries, advances), so tenant isolation has to be enforced by the server.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Account model | One shared account. `shops` is the tenant. Per-app entitlement lives in `app_subscriptions`. |
| D2 | Credentials | Phone + password, same credentials for both apps |
| D3 | Sessions | Real Supabase Auth sessions, one per app per device, tagged with an `app` JWT claim |
| D4 | Code sharing | None. `mobile-shopai/` and `mobile-chukta/` are fully independent |
| D5 | DB layout | Shared account tables in `public`; ShopAI tables stay in `public`; Chukta tables in a new `chukta` schema |
| D6 | Rollout | Phase 0 (auth, ShopAI first) comes before any Chukta table goes live |

## 3. Current state and why it must change

- The `login` edge function verifies a PBKDF2 hash against `shops.password_hash` and returns the shop row. **No session or JWT is issued.**
- `mobile/src/lib/supabase.ts` uses the anon key, so every request runs as `anon`.
- Migration `20260708090742` replaced all `auth.uid()` policies with `USING (true) WITH CHECK (true)` on `shops`, `products`, `categories`, `brands`, `customers`, `bills`, `bill_items`, `sales_log`, `purchase_log`. Anyone holding the anon key (which ships inside the APK) can read or write any shop's rows. On `shops`, that includes `plan_expires_at` and `is_active`.
- `shops.id` was decoupled from `auth.users` (the FK `shops_new_id_fkey` was dropped), so older shops may still have `id = auth user id` and newer ones have random UUIDs.

For ShopAI inventory this tradeoff was documented and accepted. For Chukta's salary and personal data it is not acceptable (product spec principle 9, Q7, India DPDP Act exposure). Phase 0 fixes it for both apps.

## 4. Auth design (Phase 0)

### 4.1 Identity

- One Supabase Auth user per phone number (`auth.users.phone`).
- New column `shops.auth_user_id uuid unique references auth.users(id)`.
- Passwords live in Supabase Auth. `shops.password_hash` is used only for lazy migration, then dropped once every active shop has an `auth_user_id`, or after 90 days, whichever comes first.

### 4.2 New tables (schema `public`)

```sql
create table public.app_subscriptions (
  shop_id     uuid not null references public.shops(id) on delete cascade,
  app         text not null check (app in ('shopai', 'chukta')),
  plan_type   text not null,
  is_active   boolean not null default true,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  primary key (shop_id, app)
);

create table public.app_sessions (
  session_id  uuid primary key,          -- auth.sessions.id
  user_id     uuid not null references auth.users(id) on delete cascade,
  app         text not null check (app in ('shopai', 'chukta')),
  device_id   text,
  created_at  timestamptz not null default now()
);
```

- Backfill: one `app_subscriptions` row with `app='shopai'` per existing shop, copied from `shops.plan_type` and `plan_expires_at`. Those two columns on `shops` stay in place (read-only) until ShopAI no longer reads them, then get dropped.
- Both tables have RLS on. `app_subscriptions` is read-only to its owner. `app_sessions` is only reachable through the service role and the token hook.

### 4.3 Login: `POST /functions/v1/login`

Request `{ phone, password, app: 'shopai' | 'chukta', deviceId? }`

1. Load the shop by `phone`, using the service role.
2. **Lazy migration:** if `shops.auth_user_id` is null, verify `password` against `shops.password_hash` (the existing PBKDF2 code). On success, run `auth.admin.createUser({ phone, password, phone_confirm: true })` and set `shops.auth_user_id`. On failure, return 401.
3. Call `signInWithPassword({ phone, password })` with an anon client. This creates a **new, independent session**. Wrong password returns 401 with the same generic message as today.
4. Check `app_subscriptions` for `(shop_id, app)`. If there is no row or it is inactive, return `403 { error: 'not_subscribed', app }` so the app can show a trial or upsell screen. The session is revoked before returning.
5. Insert `app_sessions(session_id, user_id, app, device_id)`. `session_id` comes from the access token's `session_id` claim.
6. Call `refreshSession()` once so the new access token carries the `app` claim (§4.4).
7. Return `{ session, shop, subscription }`. The client calls `supabase.auth.setSession(session)`.

### 4.4 Custom Access Token Hook

This is a Postgres function registered as the Supabase Custom Access Token Hook:

- Reads `event.claims.session_id` and looks up `public.app_sessions.app`.
- Adds `claims.app = <app>`. If no row is found, it adds nothing, and every app-scoped RLS policy then denies access.
- Adds `claims.shop_id` from `shops` where `auth_user_id = event.user_id`. This avoids a join in every RLS policy.

Refreshes re-run the hook, so the claims persist for the life of the session.

### 4.5 Session independence

- Each app stores its own session in its own storage. Logging out uses `signOut({ scope: 'local' })`, which ends only that session.
- "Log out of Chukta everywhere" means: delete the `auth.sessions` rows whose id is in `app_sessions where app='chukta' and user_id=…`. No UI for this in Phase 0, but the data model supports it.
- A password change affects both apps (one credential). After a reset, all sessions for the user are revoked.

### 4.6 Registration: `POST /functions/v1/register`

This replaces `register-shop`, which stays as a thin alias until the web app has switched over.

Request `{ idToken, phone, password, shopName, ownerName, businessCategory?, whatsappNumber?, apps: ('shopai'|'chukta')[] }`

1. Verify the Firebase ID token and require `phone_number == phone`. This is unchanged.
2. If the phone doesn't exist: create the auth user, then the `shops` row with `auth_user_id`, then one `app_subscriptions` row per requested app (30-day trial).
3. If the phone already exists: require the password to verify, then add any missing `app_subscriptions` rows. Return 409 only if every requested app is already subscribed.

### 4.7 Password reset: `POST /functions/v1/reset-password`

`{ idToken, phone, newPassword }`: verify the Firebase token, run `auth.admin.updateUserById(auth_user_id, { password })`, then revoke all of the user's sessions. If the shop hasn't been migrated yet, create the auth user at this point.

### 4.8 RLS

Helper functions, `stable` and `security invoker`:

```sql
create function public.jwt_app()     returns text language sql stable as $$ select auth.jwt() ->> 'app' $$;
create function public.jwt_shop_id() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'shop_id', '')::uuid $$;
```

- **ShopAI tables:** replace every `USING (true)` policy with `using (public.jwt_app() = 'shopai' and shop_id = public.jwt_shop_id())`, plus the same `with check`. On `shops` itself, the match is on `id = jwt_shop_id()`, and the columns `plan_type`, `plan_expires_at`, `is_active`, `password_hash` and `auth_user_id` are not updatable by `authenticated` (column privileges). Revoke all table privileges from `anon`.
- **Chukta tables:** see §6.3.

### 4.9 Staff PIN tokens (Chukta only)

The `chukta-login-staff` function mints a JWT with the claims:

```json
{ "sub": "<staff_id>", "role": "authenticated", "aud": "authenticated",
  "app": "chukta", "app_role": "staff", "property_id": "<uuid>", "exp": "<12h>" }
```

- `role` **must** be `authenticated`. PostgREST runs `SET ROLE` using this claim, and there is no Postgres role called `staff`. The draft Phase 1 plan's `role: 'staff'` would fail on every request.
- Signing: confirm which JWT signing keys the project uses after the region migration. If it uses asymmetric keys, then either sign with the legacy HS256 secret (if it is still accepted) or switch staff to real auth users. **This must be checked before Chukta Phase 1 Task 4.**

## 5. Repo layout

```
/mobile-shopai    git mv from mobile/; package com.pragatibandhu.app and EAS project 30909bed… unchanged
/mobile-chukta    new Expo app; new package (e.g. com.pragatibandhu.chukta) and new EAS project
/supabase         single source of truth: all migrations and all edge functions
/web              existing Vite app: registration + admin
```

**Rename fallout:**
- `.gitignore`: the `mobile/...` entries get duplicated for both app folders.
- Docs that reference `mobile/`, such as `SYNC_AND_SUPABASE_ARCHITECTURE.md` and `PRAGATI_BANDHU_REFERENCE.md`, get updated.
- Local EAS and credential paths: `mobile/credentials.json` moves to `mobile-shopai/credentials.json`.

**Ownership rules:**
- Migrations use timestamp names with an owner tag: `YYYYMMDDHHMMSS_account_*.sql`, `_shopai_*`, `_chukta_*`.
- Chukta migrations never alter ShopAI tables. `_account_` migrations need both apps checked before merge.
- Edge functions: shared ones are `login`, `register`, `reset-password`, `payments`. Chukta-only ones carry the `chukta-` prefix.
- Each app generates its own DB types (`supabase gen types`). Chukta uses `--schema chukta,public`. Nothing is imported across app folders.
- Shop data reset (the existing function) takes an `app` parameter. A ShopAI reset never touches `chukta.*`, and the reverse holds too.

## 6. Chukta data layer

### 6.1 Schema `chukta`

- Exposed through PostgREST: add `chukta` to `[api].schemas` in `supabase/config.toml` and in the hosted project's API settings.
- The client uses `supabase.schema('chukta').from('workers')`.
- Tables come from the Phase 1 plan, with these changes:
  - `properties.owner_id → auth.users` becomes `properties.shop_id uuid not null references public.shops(id)`.
  - Money is stored as `bigint` paise (`amount_paise`, `rate_paise`), not float `real` on device or `numeric` with float math.
  - `attendance_exceptions` is **append-only**. There is no unique `(worker_id, date)`. Each mark or correction is a new row with `status in ('absent','half_day','present')`, and the effective status is the latest row per `(worker_id, date)` by `created_at`. This satisfies O2 (history kept) and avoids the multi-device unique-conflict that would permanently jam the sync queue.
  - Every syncable table gets `updated_at` (server-set by a trigger) for pull sync.

### 6.2 Sync

- **Push:** a local `sync_queue`, as in the Phase 1 plan. Upsert by `id`. A row that fails with a permanent error (4xx, constraint) goes to a dead-letter state instead of retrying forever.
- **Pull (new, required):** per table, fetch `updated_at > last_cursor` for the active property and upsert into SQLite.
  - Without pull, owner and staff devices never see each other's entries, and restoring on a new phone (Q3) doesn't work.
  - Runs on app start, on reconnect, and after a push.

### 6.3 Chukta RLS

```sql
-- owner
using (public.jwt_app() = 'chukta'
       and coalesce(auth.jwt() ->> 'app_role', 'owner') = 'owner'
       and exists (select 1 from chukta.properties p
                   where p.id = property_id and p.shop_id = public.jwt_shop_id()))
-- staff
using (public.jwt_app() = 'chukta'
       and auth.jwt() ->> 'app_role' = 'staff'
       and property_id::text = auth.jwt() ->> 'property_id')
```

- The per-table grants for staff (read / insert / no delete, and no update on ledger tables) are as in the Phase 1 plan.
- `anon` has no privileges on schema `chukta`.

## 7. Required amendments to the Phase 1 plan

| Plan item | Amendment |
|---|---|
| Task 1 creates `supabase/config.toml` (`project_id="chukta"`) | Don't create it. Edit the existing config: add the `chukta` schema to `[api].schemas` and register the new functions |
| Migrations `000_`/`001_`/`002_` | Timestamped `_chukta_` migrations |
| Tables in `public` | `chukta` schema |
| `properties.owner_id → auth.users` | `properties.shop_id → public.shops` |
| `is_property_owner` uses `auth.uid()` | Uses the `jwt_shop_id()` and `jwt_app()` checks (§6.3) |
| Staff JWT `role: 'staff'` | `role: 'authenticated'`, `app_role: 'staff'`, `app: 'chukta'` (§4.9) |
| Task 5 scaffolds `mobile/` | Scaffold `mobile-chukta/` |
| Attendance unique `(worker_id, date)` plus upsert | Append-only, latest row wins (§6.1) |
| Push-only sync | Add pull sync (§6.2) |
| `real` money columns | Integer paise |
| `new Date(y,m,d).toISOString().slice(0,10)` in AttendanceScreen | **Bug in IST:** local midnight becomes the previous UTC day. Build `YYYY-MM-DD` strings from local components; never round-trip dates through UTC |
| Chukta login | Call shared `login` with `app: 'chukta'`; handle `403 not_subscribed` |

## 8. Web (`/web`)

- **Registration page:** app choice (ShopAI, Chukta, both), calls `register`. An existing phone adds the new app instead of getting a 409.
- **Admin:**
  - The shops list shows per-app subscriptions (plan, expiry, active) from `app_subscriptions`.
  - New Chukta tab: properties, worker count, staff count, last sync time, subscription. **No salary, advance or payment amounts.**
  - All admin reads and writes go through service-role edge functions, never the anon key.

## 9. Rollout

**Phase 0: account and auth (ShopAI only)**
1. Migration: `shops.auth_user_id`, `app_subscriptions` (plus backfill), `app_sessions`, the token hook function, the `jwt_*` helpers.
2. Enable the Custom Access Token Hook in the project.
3. Deploy the new `login`, `register` and `reset-password`. The old `login` response shape stays compatible for old app versions.
4. Release ShopAI: the login screen calls the new `login`, then `setSession`, and all queries run as `authenticated`. Web registration switches to `register`.
5. Bump the minimum version through ForceUpdateModal. Wait for the grace period (a target adoption %, e.g. more than 95% of active shops migrated per `auth_user_id`).
6. Migration: replace the permissive ShopAI policies (§4.8), revoke `anon`.
7. Later: drop `shops.password_hash`, `shops.plan_type` and `shops.plan_expires_at`.

**Phase 0.5: repo (can run in parallel with Phase 0)**
- `git mv mobile mobile-shopai`, plus the `.gitignore`, docs and credentials path updates. Verify that `eas build` still works from the new folder.

**Phase 1: Chukta core ledger**
- The Phase 1 plan with the §7 amendments. `chukta` schema migrations, `chukta-login-staff`, `mobile-chukta/`.

**Phase 2/3:** as in the Phase 1 plan's roadmap.

## 10. Error handling

| Case | Behaviour |
|---|---|
| Wrong phone or password | 401, generic message (unchanged) |
| Valid login, app not subscribed | 403 `not_subscribed`; session revoked; app shows trial/upsell |
| Subscription expired | Login allowed; the app reads `subscription.expires_at` and shows renew (matches current ShopAI behaviour) |
| Token without `app` claim (hook failed) | RLS denies; the app shows "please log in again" on the first 401/empty auth error |
| Old ShopAI build after the RLS switch | Blocked by ForceUpdateModal before the switch; any leftover anon calls fail closed |
| Sync push permanent error | Row moves to dead-letter; a visible "n entries failed to sync" indicator |

## 11. Testing

- **pgTAP** (`supabase/tests/`):
  - A ShopAI token can't read `chukta.*`, and a Chukta token can't read ShopAI tables.
  - Shop A can't read shop B.
  - Staff for property A can't read property B, and staff can't delete.
  - `anon` reads nothing.
  - The token hook adds `app` and `shop_id`.
- **Edge function tests (Deno):** lazy migration path, the `not_subscribed` path, registration that adds a second app to an existing phone, staff token claims (`role = authenticated`).
- **Manual:** log into both apps on one phone with the same credentials, log out of one and confirm the other stays logged in; an existing ShopAI user's first login after the upgrade.

## 12. Out of scope

- Shared code packages between the apps.
- Moving ShopAI tables out of `public`.
- Worker-facing link (K1), billing flows for Chukta (Phase 3).
- Admin visibility of Chukta money amounts.

## 13. Open items to verify during planning

1. The project's JWT signing key type (HS256 legacy vs asymmetric). This decides how staff tokens are minted (§4.9).
2. Whether Supabase phone+password sign-in needs the phone provider enabled with SMS disabled. OTP is handled by Firebase, so Supabase SMS must not be required.
3. How many existing shops have no `password_hash` (legacy OTP-only accounts). They need a reset-password path to migrate.
4. Every place ShopAI mobile and web read `shops.plan_type` / `plan_expires_at`, before those columns are dropped.
