# Chukta Phase 1 — Core Ledger Loop — Design

**Date:** 2026-09-29
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:**
- Shared account and app-scoped auth: `docs/superpowers/specs/2026-09-28-chukta-shared-supabase-design.md` (Phase 0, shipped 2026-09-29)
- Product spec: `Chukta-Worker-Pay-Advance-&-Wage-Diary-feature-plan.md`

**Supersedes:** the draft `2026-09-28-worker-pay-advance-wage-diary-phase1.md`. Its scope and intent carry over; its schema, auth and sync details are replaced by this document.

---

## 1. Goal

Ship the first Chukta mobile app. An owner, or a staff member they delegate, keeps a digital wage diary per property:
- workers;
- exception-only attendance, by day or by hours;
- advances and wage payments;
- a correct running **wage due** and **advance outstanding** per worker.

It must work fully offline, in English, Bengali and Hindi.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| D1 | Staff access | Staff PIN login is **in Phase 1**. Each staff member gets a hidden Supabase auth user, and the PIN is checked server-side |
| D2 | Staff login identity | The owner's phone number plus the staff member's PIN (unique within a property) |
| D3 | Signup | Owners sign up on the **website** (`/chukta`). The Chukta app is login-only |
| D4 | Offline/sync | Same pattern as ShopAI, written fresh in `mobile-chukta/`: local SQLite plus a push queue plus a new pull sync. No shared code |
| D5 | Pay bases | hourly, daily, weekly, monthly |
| D6 | Attendance | Exception-only. The mode is set by the owner: **by day** (absent/half-day) or **by hours** |
| D7 | Settings | Property-level defaults that each worker can override |
| D8 | Languages | English, Bengali, Hindi from day one, chosen on the first screen |
| D9 | Money | Integer paise (`bigint`) everywhere. Rounding happens once, at the final amount |
| D10 | Mutability | No hard deletes. Attendance is only ever added to (the latest row wins). Money entries are corrected by a `voids_id` row |

**Terms.** A **worker** is a person being paid: they never log in and are only records. **Staff** are the people the owner allows to log in and enter data, limited to one property.

## 3. Out of scope (Phase 2+)

- Settlement cycles, paydays and slips (J).
- Holidays and closures (D).
- Overtime (F): day credit is capped at 1.
- Paid leave (E) and piece-rate (G).
- Rate history with an effective date (B6): a rate change applies from joining.
- Worker link (K1), reminders (L), app lock (Q5), WhatsApp share (K6).
- Hiding salaries from staff (N3 restriction), in-app signup, billing (R).

## 4. Data model (schema `chukta`)

Exposed to PostgREST: add `chukta` to `[api].schemas` in `supabase/config.toml` and in the hosted API settings. Clients use `supabase.schema('chukta')`.

The columns below are on every table unless noted: `id uuid pk` (generated on the client for offline inserts), `property_id uuid not null`, `created_by uuid not null`, `created_by_role text check in ('owner','staff')`, `created_at timestamptz` (the client's time, kept for audit), and `server_updated_at timestamptz not null default now()`. A trigger sets `server_updated_at` on every insert and update; it is the pull-sync cursor.

| Table | Columns (beyond common) | Rules |
|---|---|---|
| `properties` | `shop_id uuid → public.shops`, `name`, `address`, `is_active bool`, **defaults:** `default_pay_basis`, `default_attendance_mode ('day','hours')`, `shift_hours numeric(4,2) default 8`, `weekly_off smallint null (0=Sun..6=Sat; null = none) default 0`, `monthly_divisor ('calendar','26','30') default 'calendar'` | No `property_id`, `created_by_role` or `created_by` columns (the owner creates it). Archived, never deleted |
| `staff_users` | `name`, `auth_user_id uuid unique → auth.users`, `pin_hash`, `pin_salt`, `failed_attempts int default 0`, `locked_until timestamptz`, `is_active bool` | `pin_hash`, `pin_salt`, `failed_attempts` and `locked_until` are never granted to clients. Staff are created and edited only by the edge function |
| `workers` | `name`, `phone`, `pay_basis ('hourly','daily','weekly','monthly')`, `rate_paise bigint > 0`, `joining_date date`, `status ('active','left')`, `left_date date`, **overrides (null = use property default):** `attendance_mode`, `shift_hours`, `weekly_off_override bool default false` + `weekly_off smallint null`, `monthly_divisor` | `pay_basis='hourly'` forces `attendance_mode='hours'`. Archived (`status='left'`), never deleted |
| `attendance_entries` | `worker_id`, `date date`, `status ('absent','half_day','present','hours')`, `hours numeric(4,2) null`, `note` | Only ever added to. Effective status per `(worker_id, date)` = the row with the greatest `(created_at, id)`. `status='hours'` requires `hours` between 0 and 24 |
| `advance_entries` | `worker_id`, `type ('advance','repayment','writeoff')`, `amount_paise bigint > 0`, `date`, `mode ('cash','upi','bank') null`, `note`, `voids_id uuid null → advance_entries(id)` | `note` is required when `type='writeoff'`. A voiding row copies `type`/`amount_paise` from the target, and the target is then excluded from all sums |
| `wage_payments` | `worker_id`, `amount_paise bigint > 0`, `date`, `mode`, `note`, `voids_id uuid null → wage_payments(id)` | Same void semantics |

A trigger rejects a `voids_id` that points at a row in another property or at a row that is itself a void.

## 5. Access control

### 5.1 Hook extension (Phase 0 hook)

`public.custom_access_token_hook` additionally looks up `chukta.staff_users` by `auth_user_id = event.user_id` and `is_active`. If found, it adds `app_role='staff'` and `property_id`. Owners are unchanged: `shop_id` comes from `public.shops.auth_user_id`, and there is no `app_role` (treated as owner). The hook needs `usage on schema chukta`, `select (auth_user_id, property_id, is_active)` on `staff_users`, and a policy for `supabase_auth_admin`.

### 5.2 RLS helpers and policies

- `chukta.is_owner_of(pid uuid)`: `jwt_app()='chukta' and coalesce(jwt()->>'app_role','owner')='owner' and exists(select 1 from chukta.properties p where p.id=pid and p.shop_id=jwt_shop_id())`.
- `chukta.is_staff_of(pid uuid)`: `jwt_app()='chukta' and jwt()->>'app_role'='staff' and jwt()->>'property_id' = pid::text`.

| Table | Owner | Staff |
|---|---|---|
| properties | select/insert/update own shop's rows | select own property |
| staff_users (granted columns) | select | select self |
| workers | select/insert/update | select/insert/update |
| attendance_entries | select/insert | select/insert |
| advance_entries, wage_payments | select/insert (including voids) | select/insert, `voids_id` must be null |

- Nobody may delete. Updates are allowed only on `properties` and `workers`.
- `anon` has no access to schema `chukta`, and ShopAI tokens (`app='shopai'`) get nothing.
- `alter default privileges ... revoke all ... from anon` is applied to schema `chukta` too.

## 6. Wage calculation (`calculateWorkerLedger`, pure function)

**Inputs:** the worker (with overrides resolved against the property defaults), the attendance entries, the advance entries and the wage payments.

**Period:** `joining_date` .. `min(today, left_date)`. Future days never count.

**Day credit.** Each date in the period is either a **weekly-off day** (it matches the worker's resolved `weekly_off`) or a **working day**.
- Working days use the effective attendance entry:
  - no entry → 1;
  - `present` → 1; `absent` → 0; `half_day` → 0.5; `hours` → `min(hours / shift_hours, 1)`.
- Weekly-off days ignore attendance entries in Phase 1 (paid work on an off day is D5, Phase 2). Whether an off day is paid depends on the basis (table below).

**Earned by basis:**
| Basis | Rule |
|---|---|
| hourly | Σ over working days of hours worked × rate. A normal day = `shift_hours`; `hours` entries use their hours, capped at `shift_hours`. Weekly off is unpaid |
| daily | Σ credit over working days × rate. Weekly off is unpaid |
| weekly | Per day `rate / 7`. Weekly off is paid (credit 1). Earned = Σ credit × rate / 7 |
| monthly | For each calendar month overlapping the period: `perDay = rate / divisor`, where divisor = days in that month, 26 or 30. `base` = `rate` if the period covers the **whole** month (1st through last day); otherwise `base = min(rate, eligibleDays × perDay)`. `eligibleDays` counts the month's days inside the period, and for divisor 26 only the working days among them. This is the case for joining or leaving mid-month, and for the current month so far. Earned for the month = `max(0, base − Σ(1 − credit) × perDay)` over its working days in the period. Weekly off is paid. A full month with no absences therefore always equals exactly `rate`, whatever the divisor |

**Outputs (all in paise, rounded half-up once at the end):**
- `earnedPaise`;
- `paidPaise` (Σ non-voided payments);
- `wageDuePaise = earned − paid` (may be negative, meaning overpaid);
- `advanceOutstandingPaise = Σ advance − Σ repayment − Σ writeoff` (non-voided);
- `explanation`: localized plain-words lines, e.g. "5.5 days × ₹500", "September: ₹30,000 − 1 day × ₹1,000 (÷30)".

**Required test cases:**
- The worked example (daily ₹500, Sunday off, Sep 1–7, one absence and one 4-of-8-hour day → ₹2,750).
- A full month with no absences = exactly the salary, for each divisor.
- Joining mid-month.
- Leaving mid-month.
- A weekly worker with absences.
- An hourly worker with hour entries above the shift (capped).
- Voided entries are excluded.
- An entry after a correction (latest wins).

## 7. Edge functions

| Function | Caller | Behaviour |
|---|---|---|
| `login` (Phase 0) | Owner app | `app: 'chukta'`. Chukta handles `not_subscribed` and `password_reset_required` |
| `chukta-staff` | Owner (token `app='chukta'`, owner role) | `POST create {propertyId, name, pin}`: checks the property belongs to the caller's shop and the PIN is 4–6 digits and unique among the property's active staff; creates the auth user `st-<staffId>@<AUTH_EMAIL_DOMAIN>` (random password, never stored); stores the PBKDF2 PIN hash. `POST update {staffId, name?, pin?, isActive?}`: changing the PIN or deactivating revokes all of that staff member's sessions (`revoke_user_sessions`) |
| `chukta-login-staff` | Staff app (pre-login) | `{ownerPhone, pin, deviceId}` → finds the shop by phone, then the active staff of all its active properties; the PIN must match exactly one staff member who is not locked. On a mismatch, increments `failed_attempts` for every candidate that is not locked (5 → `locked_until = now()+15 min`) and returns a generic 401. On a match: resets the counter, runs `admin.generateLink({type:'magiclink', email})` and redeems it via `verifyOtp({type:'magiclink', token_hash})` for a session (no email is sent), inserts `app_sessions(app='chukta')`, refreshes once for the claims, and returns `{session, staff:{id,name}, property:{id,name}}` |

`verify_jwt=false` for `chukta-login-staff`. `chukta-staff` verifies the caller's token inside the function, using `auth.getUser(jwt)` and the claims.

## 8. Mobile app (`mobile-chukta/`)

- **Stack:**
  - Expo SDK 54, RN 0.81, TypeScript;
  - `@react-navigation` (bottom tabs + native stack), `expo-sqlite`, `@react-native-community/netinfo`, `@supabase/supabase-js`;
  - `i18next` + `react-i18next` + `expo-localization`;
  - Jest (`jest-expo`).
- **App identity:** package `com.pragatibandhu.chukta`, its own EAS project, name "Chukta".
- **Local DB:** SQLite mirrors the chukta tables, plus `sync_queue`, `sync_cursor(table, cursor)` and `app_meta`. Migrations are versioned with `PRAGMA user_version`. There is one database file per login identity (owner shop or staff).
- **Push:**
  - The queue is drained in insertion order, one row upsert by `id` per item.
  - Network or 5xx errors → retry with backoff.
  - A 4xx or constraint error → the row is marked `dead` and shown under Settings → "Entries that didn't sync".
  - The queue is skipped when there is no session.
- **Pull:**
  - For each table, `select * where server_updated_at > cursor order by server_updated_at, id limit 500`, repeated until done.
  - Rows are upserted into SQLite, and the cursor is advanced to the last row's `server_updated_at`.
  - Runs on app start, on reconnect, after each push, and on pull-to-refresh.
- **Sessions:** the same patterns as ShopAI 1.1.0:
  - `setSession` after login;
  - AppState auto-refresh;
  - a 3-second `getSession` race at startup, with `isAuthRetryableFetchError` to tell offline apart from revoked;
  - `onAuthStateChange('SIGNED_OUT')` → back to login;
  - local-scope sign-out.

  These are written fresh in this app, not imported.
- **Screens:**
  1. Language
  2. Login (Owner | Staff)
  3. Property switcher (owner; staff are fixed to their property)
  4. **Today** (mark exceptions for today or a picked date, including several workers at once)
  5. Workers list (wage due / advance per worker)
  6. Worker detail (month calendar, ledger with struck-through voids, balances with explanation)
  7. Add/Edit worker
  8. Add advance / repayment / write-off / payment; Correct (owner only)
  9. Advances outstanding
  10. Settings (property defaults, staff management (owner), language, sync status, logout)
- **Formatting:** Indian grouping (₹1,23,456) and dates in the chosen language.

## 9. Web and admin

- `web/src/pages/ChuktaSignup.tsx` at `/chukta`: the same OTP → details → password flow as ShopAI registration, with Chukta branding.
  - It calls `register` with `apps: ['chukta']`.
  - It uses `check-phone`: if the phone is already registered and doesn't have Chukta, it asks only for the existing password and explains that the same login works for both apps.
  - Footer link "Chukta".
- Admin shops list: property count and worker count per shop through a service-role endpoint in `payments` (`/admin/shops` embeds `chukta` counts). **No money amounts.**

## 10. Error handling

| Case | Behaviour |
|---|---|
| Owner not subscribed to Chukta | Login screen: "Register for Chukta at `<site>/chukta`" |
| Pre-Phase-0 account | Login screen: link to Forgot password |
| Wrong staff PIN / locked | Generic "Wrong PIN" / "Too many attempts, try in 15 min" |
| Staff deactivated or PIN changed | Their sessions are revoked; the next refresh fails → back to login |
| Push permanent failure | The row is marked dead and listed in Settings, never silently dropped |
| Two devices mark the same day | Both rows are kept; the latest `(created_at, id)` wins; the history shows both |

## 11. Testing

- **pgTAP:**
  - schema and constraints (void rules, hours range, writeoff note);
  - RLS matrix: owner vs other owner vs staff (own property / other property) vs ShopAI token vs anon;
  - staff cannot void, update money rows or delete;
  - hook staff claims;
  - grants hide `pin_hash`.
- **Deno:** the `chukta-staff` and `chukta-login-staff` handlers (PIN hashing, lockout, uniqueness, ownership checks, revoke on change).
- **Jest:** `calculateWorkerLedger` (all section 6 cases), the effective-attendance resolver, the sync queue (order, dead-letter, no-session skip), pull merge and cursor, and the i18n key parity check (every key present in en/bn/hi).
- **Manual end to end:** an owner phone and a staff phone on the same property, offline entry on both, reconnect, both see all entries; staff deactivation logs the staff member out.

## 12. Open items for the plan

1. Confirm that hosted `admin.generateLink` + `verifyOtp` works while signups are disabled. Staff users already exist, so it should; verify this in the plan's first function task.
2. The Bengali and Hindi strings are drafted by Claude and need review by a native speaker before release.
3. Chukta brand assets (icon, splash) are placeholders until provided.
