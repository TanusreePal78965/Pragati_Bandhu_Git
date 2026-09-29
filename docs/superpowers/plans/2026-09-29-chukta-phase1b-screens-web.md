# Chukta Phase 1B — Screens, Web Signup and Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Phase 1A core into a usable product:
- the Chukta mobile app screens (spec §8) wired to real auth, SQLite and sync;
- the website signup at `/chukta` and admin property/worker counts (spec §9);
- the carry-overs from the 1A reviews (dead-letter screen, narrower retry rule, single-flight sync with backoff, owner "unlock staff login", staff entitlement check).

**Architecture:**
- **Backend:** small additions only: a staff-login subscription check, an `/unlock` route on `chukta-staff`, and a service-role counting function for admin.
- **Mobile:** screens stay thin. Logic that can be wrong lives in plain TypeScript modules with Jest tests:
  - `src/view/*`: view models and form validation;
  - `src/sync/engine.ts`, `src/sync/deadLetters.ts`: sync;
  - `src/auth/authDeps.ts`, `src/api/staffApi.ts`: auth and staff API.

  Screens read SQLite through the 1A repositories and re-read whenever the session's `version` counter changes (bumped on every local write and every sync).
- **Web:** one new page, `ChuktaSignup.tsx`, which reuses the existing `register` and `check-phone` endpoints with `apps: ['chukta']`.

**Tech Stack:**
- Supabase Postgres 17 + pgTAP; Deno edge functions (`@supabase/supabase-js@2.47.10` via esm.sh).
- Expo SDK 54 / React Native 0.81 / TypeScript:
  - `@react-navigation/native` + `native-stack` + `bottom-tabs` v7;
  - `react-native-screens`, `react-native-safe-area-context`;
  - `@react-native-community/datetimepicker`, `@expo/vector-icons`.
- Jest (`jest-expo` ~54) + `better-sqlite3` + `@testing-library/react-native`.
- Web: Vite + React 19 + `react-router-dom` 7 + Firebase phone auth (existing).

**Spec:** `docs/superpowers/specs/2026-09-29-chukta-phase1-design.md` (§8 mobile app, §9 web and admin, §10 error handling, §11 testing). Phase 1A plan (the code this builds on): `docs/superpowers/plans/2026-09-29-chukta-phase1a-backend-core.md`.

## Global Constraints

- **Supabase:**
  - project ref `mhtqufyaxpunhenqropn`, Postgres 17;
  - new migrations are named `YYYYMMDDHHMMSS_chukta_*.sql`;
  - Claude Code cannot run `supabase db push` or `supabase functions deploy`, so the user runs them in Task 16;
  - pgTAP runs against the live DB through the scratch `tapwrap.py` wrapper, because `supabase test db` needs Docker.
- **App names:** exactly `'shopai'` and `'chukta'`.
  - Claims are `app`, `shop_id`, and for staff `app_role='staff'` + `property_id`.
- **Money:**
  - integer paise everywhere;
  - UI input goes through `rupeesToPaise` and output through `formatRupees` (Indian grouping, e.g. `₹1,23,456`);
  - never display a float rupee value.
- **Nothing is hard-deleted on the server.** Only `properties` and `workers` are updated, and only with columns in `UPDATABLE_COLUMNS`. Money corrections go through `voidAdvance` / `voidPayment`, and they are owner-only.
- **Mobile app:**
  - folder `mobile-chukta/`;
  - **no imports from `mobile-shopai/`**;
  - every user-visible string goes through `t()`;
  - every key exists in `en.json`, `bn.json` and `hi.json` (the parity test in `src/__tests__/i18n.test.ts` enforces this). A task that needs a new key adds it to all three files.
- **Dates:**
  - `YYYY-MM-DD` strings from local calendar parts: use `todayLocal()`, `addDays()` and `compareDates()` from `src/utils/dates.ts`, and never `toISOString().slice(0, 10)`;
  - display through `formatDate` / `formatMonth` (Task 7), which build text from the i18n `months.*` keys, never from `Intl`.
- **Website:**
  - base URL `https://tanusreepal78965.github.io/Pragati_Bandhu_Git`;
  - the app links to `${WEBSITE_URL}/chukta` (register) and `${WEBSITE_URL}/forgot-password`.
- **Staff management needs the internet:** it goes through the `chukta-staff` function (`/create`, `/update`, `/unlock`). Its local list is read from the synced `staff_users` table.
- **Tests:**
  - Deno: `cd supabase/functions && deno test --no-check --allow-env <dir>` plus `deno check <files>`;
  - mobile: `cd mobile-chukta && npx jest <path>` and `npx tsc --noEmit`;
  - web: `cd web && npm run build && npm run lint`.
- **Never commit** secrets, `deno.lock`, `node_modules`, `.env*` (except `.env.example`), `android/` or `ios/`.
- **Worktree:** run `supabase link --project-ref mhtqufyaxpunhenqropn` once in a new worktree before any `supabase db query --linked` (`supabase/.temp` is untracked), and run `npm install` in `mobile-chukta/` before Task 4.

## Product rulings in this plan (defaults — the user may override before execution)

| # | Question | Ruling | Where |
|---|---|---|---|
| R1 | Should staff login check the shop's Chukta entitlement? | **Yes.** After the PIN matches (and attempts are cleared), `chukta-login-staff` returns 403 `not_subscribed` when the shop's `app_subscriptions` row for `chukta` is missing or `is_active=false`. This is the same rule as owner login, and expiry is not checked, again like owner login. The app shows "The owner's Chukta account is not active." | Task 1 |
| R2 | The divisor-30 partial-month behaviour (joining 2 Feb pays 27/30 = 90%; joining the 2nd of a 31-day month pays the full salary, capped) | **Keep the spec rule unchanged.** The explanation line for a partial month now names the eligible days, so the number is visible to the owner. | Task 7 (copy only) |
| R3 | Retry rule for PostgREST errors | Only `PGRST106` and `PGRST200`–`PGRST205` except `PGRST204` are retryable. Retryable **server** errors (5xx, 408, 429, PGRST) dead-letter after **20** attempts. Network errors (status null/0) and 401 are never capped. | Task 4 |
| R4 | Discarding a dead-lettered insert | Removes the local row only if it was never pulled from the server (`server_updated_at is null`). A dead update clears that table's cursor, so the next pull restores the server version. | Task 4 |
| R5 | The Chukta signup plan | No price is shown. `register` gives the existing 30-day term (`plan: 'monthly'`); billing is out of scope (spec §3). | Task 3 |

## File Map

| File | Responsibility |
|---|---|
| `supabase/functions/chukta-login-staff/{handler,index}.ts` (+test) | R1 entitlement check |
| `supabase/functions/chukta-staff/{handler,index}.ts` (+test) | `/unlock` route (owner clears the shop's PIN throttle) |
| `supabase/migrations/20261001100000_chukta_admin_counts.sql`, `supabase/tests/database/chukta_admin_counts.test.sql` | `public.admin_chukta_counts()` (service role only) |
| `supabase/functions/payments/{chuktaCounts.ts,chuktaCounts.test.ts,index.ts}` | `/admin/shops` embeds `chukta_counts` |
| `web/src/pages/admin/AdminShops.tsx` | Shows property/worker counts |
| `web/src/pages/ChuktaSignup.tsx`, `web/src/App.tsx`, `web/src/components/Layout.tsx` | `/chukta` signup + footer link |
| `mobile-chukta/src/sync/push.ts`, `src/sync/deadLetters.ts` | R3 retry rule and cap; dead-letter grouping, requeue, discard |
| `mobile-chukta/src/sync/engine.ts` | Single-flight sync, backoff, status |
| `mobile-chukta/src/auth/authDeps.ts`, `src/api/staffApi.ts`, `src/config.ts` | Real `AuthDeps`, staff API client, env/URLs |
| `mobile-chukta/src/repos/{staff.ts,attendance.ts,properties.ts}` | New reads: staff list, attendance by date, all properties |
| `mobile-chukta/src/i18n/*.json`, `src/utils/format.ts`, `src/domain/ledger.ts` | UI strings, date/explanation formatting, `dayCredit` export, partial-month key |
| `mobile-chukta/src/view/{today,monthGrid,moneyHistory,ledgerQueries,forms}.ts` | View models and form validation |
| `mobile-chukta/src/ui/{theme.ts,components.tsx,DateField.tsx}` | Small UI kit |
| `mobile-chukta/src/app/{session.tsx,SessionProvider.tsx,AppRoot.tsx,navigation.tsx}`, `App.tsx` | App shell |
| `mobile-chukta/src/screens/*.tsx` | 13 screens |
| `mobile-chukta/jest.setup.ts`, `src/__tests__/helpers/*.tsx` | Test setup and render helpers |

---

### Task 1: Staff login entitlement (R1) and owner "unlock staff login"

**Files:**
- Modify: `supabase/functions/chukta-login-staff/handler.ts`, `supabase/functions/chukta-login-staff/index.ts`
- Modify: `supabase/functions/chukta-staff/handler.ts`, `supabase/functions/chukta-staff/index.ts`
- Test: `supabase/functions/chukta-login-staff/handler.test.ts`, `supabase/functions/chukta-staff/handler.test.ts`

**Interfaces:**
- Produces:
  - `StaffLoginDeps.hasActiveSubscription(shopId: string): Promise<boolean>`;
  - staff login error `403 {error:'not_subscribed'}`;
  - `handleStaff(action: 'create' | 'update' | 'unlock', …)`;
  - `StaffDeps.clearPinAttempts(shopId: string): Promise<void>`;
  - `POST /functions/v1/chukta-staff/unlock` with body `{}` → `200 {ok:true}`.

- [ ] **Step 1: Write the failing tests**

In `supabase/functions/chukta-login-staff/handler.test.ts`, add `hasActiveSubscription: async () => true,` to the `deps` object inside `makeDeps` (just before `...over`), then append:

```ts
Deno.test('correct pin but no active chukta subscription: 403 not_subscribed, attempts cleared, no session', async () => {
  const { deps, log } = makeDeps([await cand('a', '4821')], { hasActiveSubscription: async () => false })
  const res = await handleStaffLogin(input, deps)
  assertEquals(res.status, 403)
  assertEquals(res.body, { error: 'not_subscribed' })
  assertEquals(log, ['reserve:shop1', 'list', 'clear:shop1'])
})

Deno.test('wrong pin never reveals subscription state', async () => {
  let asked = false
  const { deps } = makeDeps([await cand('a', '1111')], { hasActiveSubscription: async () => { asked = true; return false } })
  assertEquals((await handleStaffLogin(input, deps)).body, { error: 'wrong_pin' })
  assertEquals(asked, false)
})
```

In `supabase/functions/chukta-staff/handler.test.ts`, add `clearPinAttempts: async (s) => { log.push(`clearPins:${s}`) },` to the `deps` object inside `makeDeps` (just before `...over`), then append:

```ts
Deno.test('unlock: owner clears the shop pin throttle', async () => {
  const { deps, log } = makeDeps()
  const res = await handleStaff('unlock', 'jwt', {}, deps)
  assertEquals(res.status, 200)
  assertEquals(res.body, { ok: true })
  assertEquals(log, ['clearPins:shop1'])
})

Deno.test('unlock: 401 without caller, 403 for staff or shopai callers', async () => {
  assertEquals((await handleStaff('unlock', 'jwt', {}, makeDeps({ getCaller: async () => null }).deps)).status, 401)
  const staff = makeDeps({ getCaller: async () => ({ ...owner, appRole: 'staff' }) })
  assertEquals((await handleStaff('unlock', 'jwt', {}, staff.deps)).status, 403)
  assertEquals(staff.log, [])
  const shopai = makeDeps({ getCaller: async () => ({ ...owner, app: 'shopai' }) })
  assertEquals((await handleStaff('unlock', 'jwt', {}, shopai.deps)).status, 403)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd supabase/functions && deno test --no-check --allow-env chukta-login-staff chukta-staff`
Expected: FAIL. The new login test gets status 200 instead of 403, and `handleStaff('unlock', …)` falls into the update branch and returns 400 `staffId is required`.

- [ ] **Step 3: Implement**

`chukta-login-staff/handler.ts`: add to `StaffLoginDeps`:

```ts
  /** The shop's `app_subscriptions` row for chukta exists and is_active (same rule as owner login). */
  hasActiveSubscription(shopId: string): Promise<boolean>
```

Then replace the line `await deps.clearAttempts(shopId)` with:

```ts
  await deps.clearAttempts(shopId)
  if (!(await deps.hasActiveSubscription(shopId))) return { status: 403, body: { error: 'not_subscribed' } }
```

`chukta-login-staff/index.ts`: add this dependency next to `findShopIdByPhone`:

```ts
  async hasActiveSubscription(shopId) {
    const { data, error } = await admin.from('app_subscriptions').select('is_active').eq('shop_id', shopId).eq('app', 'chukta').maybeSingle()
    if (error) throw error
    return data?.is_active === true
  },
```

`chukta-staff/handler.ts`:
- Add `clearPinAttempts(shopId: string): Promise<void>` to `StaffDeps` (after `deleteAuthUser`).
- Change the signature to `action: 'create' | 'update' | 'unlock',`.
- Directly after the line `if (caller.app !== 'chukta' || caller.appRole === 'staff' || !caller.shopId) return fail(403, 'forbidden')`, insert:

```ts
  if (action === 'unlock') {
    await deps.clearPinAttempts(caller.shopId)
    return { status: 200, body: { ok: true } }
  }
```

`chukta-staff/index.ts`: add the dependency and the route.

```ts
  async clearPinAttempts(shopId) {
    const { error } = await chukta().rpc('clear_pin_attempts', { p_shop_id: shopId })
    if (error) throw error
  },
```

and replace the `action` line with:

```ts
    const action = path.endsWith('/create') ? 'create' : path.endsWith('/update') ? 'update' : path.endsWith('/unlock') ? 'unlock' : null
```

- [ ] **Step 4: Run the tests and the type check**

Run: `cd supabase/functions && deno test --no-check --allow-env chukta-login-staff chukta-staff && deno check chukta-login-staff/index.ts chukta-staff/index.ts`
Expected: all tests PASS (the 19 existing tests plus the 4 new ones); `deno check` prints nothing.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/chukta-login-staff supabase/functions/chukta-staff
git commit -m "feat(chukta): staff login requires an active chukta subscription; owner can unlock staff login"
```

---

### Task 2: Admin property/worker counts

**Files:**
- Create: `supabase/migrations/20261001100000_chukta_admin_counts.sql`
- Create: `supabase/tests/database/chukta_admin_counts.test.sql`
- Create: `supabase/functions/payments/chuktaCounts.ts`, `supabase/functions/payments/chuktaCounts.test.ts`
- Modify: `supabase/functions/payments/index.ts` (the `/admin/shops` list route)
- Modify: `web/src/pages/admin/AdminShops.tsx:8-16` and `:227-229`

**Interfaces:**
- Produces:
  - SQL `public.admin_chukta_counts() returns table(shop_id uuid, property_count bigint, worker_count bigint)`, executable by `service_role` only;
  - `withChuktaCounts(shops, counts)`;
  - on each shop in `GET /payments/admin/shops`, the field `chukta_counts: { properties: number; workers: number } | null`.
- **No money amounts are exposed.**

- [ ] **Step 1: Write the failing pgTAP test**

```sql
-- supabase/tests/database/chukta_admin_counts.test.sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

select has_function('public', 'admin_chukta_counts', 'admin_chukta_counts exists');
select ok(not has_function_privilege('anon', 'public.admin_chukta_counts()', 'execute'), 'anon cannot execute');
select ok(not has_function_privilege('authenticated', 'public.admin_chukta_counts()', 'execute'), 'authenticated cannot execute');

insert into public.shops (id, shop_name, owner_name, phone) values
  ('ca000000-0000-0000-0000-000000000001', 'S1', 'O', '+919800000951'),
  ('ca000000-0000-0000-0000-000000000002', 'S2', 'O', '+919800000952');
insert into chukta.properties (id, shop_id, name, is_active) values
  ('cb000000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'A', true),
  ('cb000000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000001', 'B', true),
  ('cb000000-0000-0000-0000-000000000003', 'ca000000-0000-0000-0000-000000000001', 'Archived', false);
insert into chukta.workers (id, property_id, name, pay_basis, rate_paise, joining_date, status, left_date, created_by, created_by_role) values
  ('cc000000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'W1', 'daily', 50000, '2026-09-01', 'active', null, 'c9000000-0000-0000-0000-000000000009', 'owner'),
  ('cc000000-0000-0000-0000-000000000002', 'cb000000-0000-0000-0000-000000000001', 'W2', 'daily', 50000, '2026-09-01', 'left', '2026-09-10', 'c9000000-0000-0000-0000-000000000009', 'owner'),
  ('cc000000-0000-0000-0000-000000000003', 'cb000000-0000-0000-0000-000000000003', 'W3', 'daily', 50000, '2026-09-01', 'active', null, 'c9000000-0000-0000-0000-000000000009', 'owner');

select results_eq(
  $$ select property_count, worker_count from public.admin_chukta_counts() where shop_id = 'ca000000-0000-0000-0000-000000000001' $$,
  $$ values (2::bigint, 1::bigint) $$,
  'counts active properties and active workers of active properties');
select is((select count(*) from public.admin_chukta_counts() where shop_id = 'ca000000-0000-0000-0000-000000000002'), 0::bigint,
  'shops without properties are absent');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run it through the scratch wrapper, the same way as the 1A tests: `python3 <scratchpad>/tapwrap.py supabase/tests/database/chukta_admin_counts.test.sql > <scratchpad>/c3.sql && supabase db query --linked -f <scratchpad>/c3.sql`. If the wrapper isn't in this session's scratchpad, recreate it as described in `docs/superpowers/notes/2026-09-29-chukta-phase1a-deploy.md`.
Expected: `not ok 1 - admin_chukta_counts exists`.

Note: until Task 16 pushes the migration, the live run can only show the failure. The passing run happens in Task 16.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20261001100000_chukta_admin_counts.sql
-- Admin shop list: how many active properties and active workers each shop has in Chukta. Counts only — no money.
create or replace function public.admin_chukta_counts()
returns table (shop_id uuid, property_count bigint, worker_count bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select p.shop_id, count(distinct p.id) as property_count, count(w.id) as worker_count
  from chukta.properties p
  left join chukta.workers w on w.property_id = p.id and w.status = 'active'
  where p.is_active
  group by p.shop_id
$$;

revoke execute on function public.admin_chukta_counts() from public, anon, authenticated;
grant execute on function public.admin_chukta_counts() to service_role;
```

- [ ] **Step 4: Write the failing Deno test for the merge**

```ts
// supabase/functions/payments/chuktaCounts.test.ts
import { assertEquals } from 'jsr:@std/assert@1'
import { withChuktaCounts } from './chuktaCounts.ts'

Deno.test('attaches counts by shop id; shops without chukta rows get null', () => {
  const shops = [{ id: 's1', shop_name: 'A' }, { id: 's2', shop_name: 'B' }]
  const out = withChuktaCounts(shops, [{ shop_id: 's1', property_count: 2, worker_count: 7 }])
  assertEquals(out, [
    { id: 's1', shop_name: 'A', chukta_counts: { properties: 2, workers: 7 } },
    { id: 's2', shop_name: 'B', chukta_counts: null },
  ])
})

Deno.test('numeric strings from bigint columns become numbers', () => {
  const out = withChuktaCounts([{ id: 's1' }], [{ shop_id: 's1', property_count: '3' as unknown as number, worker_count: '12' as unknown as number }])
  assertEquals(out[0].chukta_counts, { properties: 3, workers: 12 })
})
```

Run: `cd supabase/functions && deno test --no-check --allow-env payments/chuktaCounts.test.ts`
Expected: FAIL, "Module not found … chuktaCounts.ts".

- [ ] **Step 5: Implement the merge and wire it in**

```ts
// supabase/functions/payments/chuktaCounts.ts
export type ChuktaCountRow = { shop_id: string; property_count: number; worker_count: number }
export type ChuktaCounts = { properties: number; workers: number }

export function withChuktaCounts<T extends { id: string }>(shops: T[], counts: ChuktaCountRow[]): (T & { chukta_counts: ChuktaCounts | null })[] {
  const byShop = new Map(counts.map((c) => [c.shop_id, { properties: Number(c.property_count), workers: Number(c.worker_count) }]))
  return shops.map((s) => ({ ...s, chukta_counts: byShop.get(s.id) ?? null }))
}
```

In `payments/index.ts`, add `import { type ChuktaCountRow, withChuktaCounts } from './chuktaCounts.ts'` after the `extendExpiry` import. In the `// === ADMIN: ALL SHOPS ===` block, replace:

```ts
      if (error) throw error

      return new Response(JSON.stringify(shops), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

with:

```ts
      if (error) throw error
      const { data: counts, error: countsError } = await supabase.rpc('admin_chukta_counts')
      if (countsError) throw countsError

      return new Response(JSON.stringify(withChuktaCounts((shops ?? []) as { id: string }[], (counts ?? []) as ChuktaCountRow[])), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
```

- [ ] **Step 6: Show the counts in the admin UI**

In `web/src/pages/admin/AdminShops.tsx`, add this field to `type Shop` after `app_subscriptions`:

```ts
  chukta_counts?: { properties: number; workers: number } | null;
```

Replace:

```tsx
                      {shop.app_subscriptions?.some((s) => s.app === 'chukta') && (
                        <span className="badge badge-success" style={{ marginLeft: 4 }}>Chukta</span>
                      )}
```

with:

```tsx
                      {shop.app_subscriptions?.some((s) => s.app === 'chukta') && (
                        <span className="badge badge-success" style={{ marginLeft: 4 }}>Chukta</span>
                      )}
                      {shop.chukta_counts && (
                        <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: 4 }}>
                          {shop.chukta_counts.properties} properties · {shop.chukta_counts.workers} workers
                        </div>
                      )}
```

- [ ] **Step 7: Verify**

Run: `cd supabase/functions && deno test --no-check --allow-env payments && deno check payments/index.ts`
Expected: PASS (both `expiry` and `chuktaCounts` tests).

Run: `cd web && npm run build && npm run lint`
Expected: the build succeeds and oxlint reports no errors.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20261001100000_chukta_admin_counts.sql supabase/tests/database/chukta_admin_counts.test.sql supabase/functions/payments web/src/pages/admin/AdminShops.tsx
git commit -m "feat(admin): chukta property and worker counts per shop"
```

---

### Task 3: Web `/chukta` signup page

**Files:**
- Create: `web/src/pages/ChuktaSignup.tsx`
- Modify: `web/src/App.tsx` (import + route), `web/src/components/Layout.tsx` (footer link)

**Interfaces:**
- Consumes:
  - `POST /functions/v1/register/check-phone {phone}` → `{exists, apps}`;
  - `POST /functions/v1/register {idToken, phone, password, apps:['chukta'], plan:'monthly', shopName?, ownerName?}` → 200, or `{error}` with 400/401/409;
  - `getFirebaseAuth()` from `web/src/lib/firebase`.
- Produces: route `/chukta`.

**Flow:**
1. **Phone:** call `check-phone`. If `apps` already includes `chukta`, show an error pointing to the app. Otherwise remember `exists`.
2. **OTP:** Firebase invisible reCAPTCHA, the same as the ShopAI page.
3. **Next step:**
   - `exists=true` → the **existing** step: the password only, with the explanation "This number already has a Pragati Bandhu account (ShopAI). Enter its password — the same login works in both apps." and a link to `/forgot-password`.
   - `exists=false` → the **details** step: business name, owner name, password and confirm.
4. **Done:** "Install the Chukta app and log in with this mobile number and password."

- [ ] **Step 1: Create the page**

```tsx
// web/src/pages/ChuktaSignup.tsx
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RecaptchaVerifier, signInWithPhoneNumber, type ConfirmationResult } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

type Step = 'phone' | 'otp' | 'details' | 'existing' | 'done';

async function postJson(path: string, body: unknown): Promise<{ ok: boolean; body: any }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, body: await res.json().catch(() => ({})) };
}

export default function ChuktaSignup() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [idToken, setIdToken] = useState('');
  const [exists, setExists] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationResult | null>(null);
  const [businessName, setBusinessName] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => () => {
    (window as any).recaptchaVerifier?.clear();
    delete (window as any).recaptchaVerifier;
  }, []);

  const e164 = () => `+91${phone.replace(/\D/g, '')}`;

  const handleSendOtp = async () => {
    setError('');
    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }
    setIsLoading(true);
    try {
      const check = await postJson('register/check-phone', { phone: e164() });
      if (!check.ok) throw new Error(check.body.error ?? 'Could not check phone number');
      if (check.body.apps?.includes('chukta')) {
        setError('This number is already registered for Chukta. Open the Chukta app and log in.');
        return;
      }
      setExists(check.body.exists === true);
      const auth = getFirebaseAuth();
      if (!(window as any).recaptchaVerifier) {
        (window as any).recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });
      }
      setConfirmation(await signInWithPhoneNumber(auth, e164(), (window as any).recaptchaVerifier));
      setStep('otp');
    } catch (e: any) {
      setError(e?.message ?? 'Could not send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError('');
    if (!confirmation) return;
    setIsLoading(true);
    try {
      const credential = await confirmation.confirm(otp);
      setIdToken(await credential.user.getIdToken());
      setStep(exists ? 'existing' : 'details');
    } catch (e: any) {
      setError(e?.message ?? 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    setError('');
    if (!exists) {
      if (!businessName.trim() || !ownerName.trim()) {
        setError('Business name and owner name are required');
        return;
      }
      if (password.length < 6) {
        setError('Password must be at least 6 characters');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
    } else if (!password) {
      setError('Enter your existing password');
      return;
    }
    setIsLoading(true);
    try {
      const body: Record<string, unknown> = { idToken, phone: e164(), password, apps: ['chukta'], plan: 'monthly' };
      if (!exists) Object.assign(body, { shopName: businessName.trim(), ownerName: ownerName.trim() });
      const res = await postJson('register', body);
      if (!res.ok) throw new Error(res.body.error ?? 'Registration failed');
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="content-wrapper">
      <div className="header-section">
        <h1 className="hero-title">Chukta</h1>
        <p className="hero-subtitle">Worker pay, advances and wages — one simple diary for your staff.</p>
      </div>

      <div className="registration-container step-enter">
        <div className="glass-card">
          {step === 'phone' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Register for Chukta</h2>
                <p>Enter your mobile number</p>
              </div>
              <div className="input-group">
                <label>Mobile Number</label>
                <div className="phone-input">
                  <span className="phone-prefix">+91</span>
                  <input type="tel" maxLength={10} value={phone} autoFocus placeholder="10-digit mobile number"
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))} />
                </div>
              </div>
              <button className="btn-primary" disabled={isLoading || phone.length < 10} onClick={handleSendOtp}>
                {isLoading ? <span className="spinner"></span> : 'Send OTP'}
              </button>
            </div>
          )}

          {step === 'otp' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Verify Number</h2>
                <p>We sent a 6-digit code to +91 {phone}</p>
              </div>
              <div className="input-group">
                <label>One Time Password</label>
                <input type="text" maxLength={6} value={otp} autoFocus placeholder="Enter 6-digit OTP"
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))} />
              </div>
              <button className="btn-primary" disabled={isLoading || otp.length < 6} onClick={handleVerifyOtp}>
                {isLoading ? <span className="spinner"></span> : 'Verify OTP'}
              </button>
            </div>
          )}

          {step === 'details' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Your details</h2>
                <p>You can add properties and workers in the app</p>
              </div>
              <div className="input-group">
                <label>Business Name</label>
                <input placeholder="e.g. Sharma Hotel" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Owner Name</label>
                <input placeholder="e.g. Rahul Sharma" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="input-group">
                  <label>Password</label>
                  <input type="password" placeholder="Min 6 chars" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Confirm</label>
                  <input type="password" placeholder="Repeat password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
              </div>
              <button className="btn-primary" disabled={isLoading} onClick={handleSubmit}>
                {isLoading ? <span className="spinner"></span> : 'Create Account'}
              </button>
            </div>
          )}

          {step === 'existing' && (
            <div className="step-container step-enter">
              <div className="step-header">
                <h2>Add Chukta to your account</h2>
                <p>This number already has a Pragati Bandhu account (ShopAI). Enter its password — the same login works in both apps.</p>
              </div>
              <div className="input-group">
                <label>Existing Password</label>
                <input type="password" value={password} autoFocus onChange={(e) => setPassword(e.target.value)} />
              </div>
              <button className="btn-primary" disabled={isLoading || !password} onClick={handleSubmit}>
                {isLoading ? <span className="spinner"></span> : 'Add Chukta'}
              </button>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                Forgot it? <Link to="/forgot-password">Reset your password</Link>
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="step-container step-enter success-state">
              <div className="success-icon">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2>You're registered for Chukta</h2>
              <p>Install the Chukta app and log in with +91 {phone} and your password.</p>
            </div>
          )}

          {error && <div className="error-msg step-enter">{error}</div>}
        </div>
        <div id="recaptcha-container" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Route and footer link**

`web/src/App.tsx`: add `import ChuktaSignup from './pages/ChuktaSignup';` after the `ForgotPassword` import, and add `<Route path="/chukta" element={<ChuktaSignup />} />` after the `/forgot-password` route.

`web/src/components/Layout.tsx`: add this as the first link in the footer link row:

```tsx
          <Link to="/chukta" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>Chukta</Link>
```

- [ ] **Step 3: Verify the build**

Run: `cd web && npm run build && npm run lint`
Expected: the build succeeds and there are no lint errors.

Then run `npm run dev` and open `http://localhost:5173/Pragati_Bandhu_Git/chukta`. Expected: the phone step renders; entering 9 digits keeps "Send OTP" disabled. The live OTP flow is tested in Task 16.

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/ChuktaSignup.tsx web/src/App.tsx web/src/components/Layout.tsx
git commit -m "feat(web): Chukta signup page at /chukta"
```

---
### Task 4: Push retry rule (R3), attempt cap, and dead-letter management (R4)

**Files:**
- Modify: `mobile-chukta/src/sync/push.ts` (whole file shown below)
- Create: `mobile-chukta/src/sync/deadLetters.ts`
- Test: `mobile-chukta/src/__tests__/push.test.ts` (append), `mobile-chukta/src/__tests__/deadLetters.test.ts`

**Interfaces:**
- Consumes: the `sync_queue(seq, table_name, row_id, op, payload, status, attempts, last_error, created_at)` table from 1A.
- Produces:
  - `MAX_SERVER_ATTEMPTS = 20`;
  - `isPermanent(err: RemoteError): boolean`;
  - `countsTowardCap(err: RemoteError): boolean`;
  - `flushPush(db, remote, hasSession)`, with the same signature and return type as 1A;
  - `listDead(db)`, unchanged;
  - `DeadGroup = { error: string; count: number; tables: SyncedTable[]; seqs: number[] }`;
  - `listDeadGroups(db: SqlDb): Promise<DeadGroup[]>`;
  - `requeueDead(db: SqlDb, seqs: number[]): Promise<void>`;
  - `discardDead(db: SqlDb, seqs: number[]): Promise<void>`.

- [ ] **Step 1: Write the failing tests**

Append to `mobile-chukta/src/__tests__/push.test.ts`. Change the import on line 3 to `import { countsTowardCap, flushPush, isPermanent, listDead, MAX_SERVER_ATTEMPTS, type PushItem, type RemoteError, type RemoteWriter } from '../sync/push';`, then append:

```ts
test('R3: only PGRST106 and PGRST200-205 (not 204) and PGRST0xx are retryable; other PGRST codes are permanent', () => {
  expect(isPermanent({ status: 406, code: 'PGRST106', message: '' })).toBe(false);
  for (const code of ['PGRST200', 'PGRST201', 'PGRST202', 'PGRST203', 'PGRST205']) {
    expect(isPermanent({ status: 400, code, message: '' })).toBe(false);
  }
  expect(isPermanent({ status: 503, code: 'PGRST000', message: '' })).toBe(false);
  expect(isPermanent({ status: 400, code: 'PGRST204', message: '' })).toBe(true);
  expect(isPermanent({ status: 400, code: 'PGRST100', message: '' })).toBe(true);
  expect(isPermanent({ status: 500, code: null, message: '' })).toBe(false);
});

test('countsTowardCap: server-side transient errors count, network and 401 never do', () => {
  expect(countsTowardCap({ status: 503, code: null, message: '' })).toBe(true);
  expect(countsTowardCap({ status: 429, code: null, message: '' })).toBe(true);
  expect(countsTowardCap({ status: 406, code: 'PGRST106', message: '' })).toBe(true);
  expect(countsTowardCap({ status: null, code: null, message: 'Network request failed' })).toBe(false);
  expect(countsTowardCap({ status: 0, code: null, message: '' })).toBe(false);
  expect(countsTowardCap({ status: 401, code: null, message: '' })).toBe(false);
  expect(countsTowardCap({ status: 400, code: '23514', message: '' })).toBe(false); // permanent, not "capped"
});

test('a server error on the last allowed attempt dead-letters the row and the flush continues', async () => {
  const db = await dbWith([['workers', 'w1', 'update'], ['workers', 'w2']]);
  await db.runAsync("update sync_queue set attempts = ? where row_id = 'w1'", [MAX_SERVER_ATTEMPTS - 1]);
  await db.runAsync("insert or replace into sync_cursor (table_name, cursor) values ('workers', ?)", [JSON.stringify({ ts: 't', id: 'x' })]);
  const r = await flushPush(db, remote((_, id) => (id === 'w1' ? { status: 503, code: null, message: 'down' } : null)), async () => true);
  expect(r).toEqual({ pushed: 1, dead: 1, stopped: false });
  expect((await listDead(db)).map((d) => d.row_id)).toEqual(['w1']);
  expect(await db.getFirstAsync("select 1 from sync_cursor where table_name = 'workers'")).toBeNull();
});

test('network errors never dead-letter, however many attempts', async () => {
  const db = await dbWith([['workers', 'w1']]);
  await db.runAsync("update sync_queue set attempts = 500 where row_id = 'w1'");
  const r = await flushPush(db, remote(() => ({ status: null, code: null, message: 'Network request failed' })), async () => true);
  expect(r.stopped).toBe(true);
  expect(await pending(db)).toEqual(['w1']);
});
```

Create `mobile-chukta/src/__tests__/deadLetters.test.ts`:

```ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { discardDead, listDeadGroups, requeueDead } from '../sync/deadLetters';

async function setup() {
  const db = openTestDb();
  await migrate(db);
  const q = (table: string, id: string, op: string, status: string, err: string | null) =>
    db.runAsync('insert into sync_queue (table_name, row_id, op, payload, status, attempts, last_error, created_at) values (?, ?, ?, ?, ?, 3, ?, ?)',
      [table, id, op, JSON.stringify({ id }), status, err, 't']);
  await q('workers', 'w1', 'insert', 'dead', 'violates check constraint');
  await q('attendance_entries', 'a1', 'insert', 'dead', 'violates check constraint');
  await q('workers', 'w2', 'update', 'dead', 'not found or not permitted');
  await q('workers', 'w3', 'insert', 'pending', null);
  return db;
}

test('groups dead rows by error, in queue order, with tables and seqs', async () => {
  const db = await setup();
  expect(await listDeadGroups(db)).toEqual([
    { error: 'violates check constraint', count: 2, tables: ['workers', 'attendance_entries'], seqs: [1, 2] },
    { error: 'not found or not permitted', count: 1, tables: ['workers'], seqs: [3] },
  ]);
});

test('requeue puts rows back to pending with attempts reset, keeping their order', async () => {
  const db = await setup();
  await requeueDead(db, [1, 2]);
  const rows = await db.getAllAsync<{ seq: number; status: string; attempts: number; last_error: string | null }>(
    'select seq, status, attempts, last_error from sync_queue order by seq');
  expect(rows.slice(0, 2)).toEqual([
    { seq: 1, status: 'pending', attempts: 0, last_error: null },
    { seq: 2, status: 'pending', attempts: 0, last_error: null },
  ]);
  expect(rows[2].status).toBe('dead');
});

test('discard: a never-synced insert removes the local row; an update clears the cursor; pending rows are untouched', async () => {
  const db = await setup();
  await db.runAsync(`insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at, server_updated_at)
    values ('w1', 'p', 'Local', 'daily', 100, '2026-09-01', 'u', 'owner', 't', null),
           ('w2', 'p', 'Server', 'daily', 100, '2026-09-01', 'u', 'owner', 't', '2026-09-01T00:00:00Z')`);
  await db.runAsync("insert into sync_cursor (table_name, cursor) values ('workers', '{}')");
  await discardDead(db, [1, 3]);
  expect(await db.getAllAsync<{ id: string }>('select id from workers order by id')).toEqual([{ id: 'w2' }]);
  expect(await db.getFirstAsync("select 1 from sync_cursor where table_name = 'workers'")).toBeNull();
  expect((await db.getAllAsync<{ seq: number }>('select seq from sync_queue order by seq')).map((r) => r.seq)).toEqual([2, 4]);
});

test('discard never deletes a row that the server already has', async () => {
  const db = await setup();
  await db.runAsync(`insert into workers (id, property_id, name, pay_basis, rate_paise, joining_date, created_by, created_by_role, created_at, server_updated_at)
    values ('w1', 'p', 'Pulled', 'daily', 100, '2026-09-01', 'u', 'owner', 't', '2026-09-01T00:00:00Z')`);
  await discardDead(db, [1]);
  expect(await db.getFirstAsync("select id from workers where id = 'w1'")).toEqual({ id: 'w1' });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/push.test.ts src/__tests__/deadLetters.test.ts`
Expected: FAIL.
- `countsTowardCap` / `MAX_SERVER_ATTEMPTS` are not exported.
- `PGRST204` is reported as not permanent.
- `Cannot find module '../sync/deadLetters'`.

- [ ] **Step 3: Implement `push.ts`**

Replace the whole of `mobile-chukta/src/sync/push.ts` with:

```ts
import type { SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';
import type { SyncOp } from '../repos/write';

export type RemoteError = { status: number | null; code: string | null; message: string };
export type { SyncOp };
export type PushItem = { table: SyncedTable; op: SyncOp; rowId: string; payload: Record<string, unknown> };
export interface RemoteWriter {
  write(item: PushItem): Promise<RemoteError | null>;
}

/** Retryable server-side errors give up after this many attempts (network errors and 401 never do). */
export const MAX_SERVER_ATTEMPTS = 20;

/** PGRST0xx = cannot reach the database; PGRST106 = schema not exposed; PGRST200-205 (not 204) = stale schema cache. */
const RETRYABLE_PGRST = /^PGRST(0\d\d|106|20[0-35])$/;

/** An error that will never succeed on retry: dead-letter it right away. */
export function isPermanent(err: RemoteError): boolean {
  // A lost session (401) or throttle/timeout can carry a misleading Postgres code (e.g. 42501 from an
  // anon-role RLS fallback) — the HTTP status is the ground truth for these and must win, so check it first.
  if (err.status === null || err.status === 0 || [401, 408, 429].includes(err.status)) return false;
  if (err.code && RETRYABLE_PGRST.test(err.code)) return false;
  if (err.code && /^(22|23|42)/.test(err.code)) return true;
  if (err.code && /^PGRST/.test(err.code)) return true;
  return err.status >= 400 && err.status < 500;
}

/** A transient failure reported by the server (not the network, not the session): retried, but only up to the cap. */
export function countsTowardCap(err: RemoteError): boolean {
  if (isPermanent(err)) return false;
  return err.status !== null && err.status !== 0 && err.status !== 401;
}

type QueueRow = { seq: number; table_name: SyncedTable; row_id: string; op: SyncOp; payload: string; attempts: number };

async function markDead(db: SqlDb, row: QueueRow, message: string): Promise<void> {
  await db.runAsync("update sync_queue set status = 'dead', attempts = attempts + 1, last_error = ? where seq = ?", [message, row.seq]);
  if (row.op === 'update') {
    // The server version is now stranded: pull skipped this row while it was pending, and other
    // devices' changes may have moved the cursor past it. Drop the cursor so the next pull re-reads
    // the table from scratch and restores the authoritative server row over our dead-lettered patch.
    await db.runAsync('delete from sync_cursor where table_name = ?', [row.table_name]);
  }
}

export async function flushPush(
  db: SqlDb, remote: RemoteWriter, hasSession: () => Promise<boolean>,
): Promise<{ pushed: number; dead: number; stopped: boolean }> {
  if (!(await hasSession())) return { pushed: 0, dead: 0, stopped: true };
  const rows = await db.getAllAsync<QueueRow>(
    "select seq, table_name, row_id, op, payload, attempts from sync_queue where status = 'pending' order by seq");
  let pushed = 0;
  let dead = 0;
  for (const row of rows) {
    const err = await remote.write({ table: row.table_name, op: row.op, rowId: row.row_id, payload: JSON.parse(row.payload) });
    if (!err) {
      await db.runAsync('delete from sync_queue where seq = ?', [row.seq]);
      pushed++;
      continue;
    }
    if (isPermanent(err) || (countsTowardCap(err) && row.attempts + 1 >= MAX_SERVER_ATTEMPTS)) {
      await markDead(db, row, err.message);
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

- [ ] **Step 4: Implement `deadLetters.ts`**

```ts
// mobile-chukta/src/sync/deadLetters.ts
import { SYNCED_TABLES, type SyncedTable } from '../db/schema';
import type { SqlDb } from '../db/sqlDb';

export type DeadGroup = { error: string; count: number; tables: SyncedTable[]; seqs: number[] };
type DeadRow = { seq: number; table_name: SyncedTable; row_id: string; op: 'insert' | 'update'; last_error: string | null };

const isSyncedTable = (t: string): t is SyncedTable => (SYNCED_TABLES as readonly string[]).includes(t);

/** Dead rows grouped by their error (the usual root cause), ordered by the first row of each group. */
export async function listDeadGroups(db: SqlDb): Promise<DeadGroup[]> {
  const rows = await db.getAllAsync<DeadRow>(
    "select seq, table_name, row_id, op, last_error from sync_queue where status = 'dead' order by seq");
  const groups = new Map<string, DeadGroup>();
  for (const r of rows) {
    const key = r.last_error ?? 'unknown';
    const g = groups.get(key) ?? { error: key, count: 0, tables: [], seqs: [] };
    g.count++;
    g.seqs.push(r.seq);
    if (!g.tables.includes(r.table_name)) g.tables.push(r.table_name);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Back to pending in their original positions (seq is unchanged, so parent-before-child order holds). */
export async function requeueDead(db: SqlDb, seqs: number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const seq of seqs) {
      await db.runAsync("update sync_queue set status = 'pending', attempts = 0, last_error = null where seq = ? and status = 'dead'", [seq]);
    }
  });
}

/**
 * Gives up on dead rows. An insert the server never accepted is removed from this phone (only if it was never
 * pulled, i.e. server_updated_at is null). An update clears the table cursor so the next pull restores the server row.
 */
export async function discardDead(db: SqlDb, seqs: number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const seq of seqs) {
      const row = await db.getFirstAsync<DeadRow>(
        "select seq, table_name, row_id, op, last_error from sync_queue where seq = ? and status = 'dead'", [seq]);
      if (!row || !isSyncedTable(row.table_name)) continue;
      if (row.op === 'insert') {
        await db.runAsync(`delete from ${row.table_name} where id = ? and server_updated_at is null`, [row.row_id]);
      } else {
        await db.runAsync('delete from sync_cursor where table_name = ?', [row.table_name]);
      }
      await db.runAsync('delete from sync_queue where seq = ?', [seq]);
    }
  });
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `cd mobile-chukta && npx jest src/__tests__/push.test.ts src/__tests__/deadLetters.test.ts && npx tsc --noEmit`
Expected: PASS, with no type errors.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/sync/push.ts mobile-chukta/src/sync/deadLetters.ts mobile-chukta/src/__tests__/push.test.ts mobile-chukta/src/__tests__/deadLetters.test.ts
git commit -m "feat(chukta): narrow PGRST retry rule, cap server retries, dead-letter requeue/discard"
```

---

### Task 5: Sync engine (single flight + head-of-line backoff)

**Files:**
- Create: `mobile-chukta/src/sync/engine.ts`
- Test: `mobile-chukta/src/__tests__/engine.test.ts`

**Interfaces:**
- Consumes:
  - `flushPush(db, remote, hasSession)` (Task 4);
  - `pullAll(db, remote)` (1A);
  - `RemoteWriter & RemoteReader` (1A `createSupabaseRemote`).
- Produces:
  - `SyncStatus = { running: boolean; lastSyncedAt: string | null; lastError: string | null; pending: number; dead: number }`;
  - `IDLE_STATUS: SyncStatus`;
  - `backoffDelay(failures: number): number`;
  - `createSyncEngine(deps: SyncEngineDeps): SyncEngine`.

    `SyncEngine` has these members:
    - `run(): Promise<void>` runs now, sharing an in-flight run;
    - `runSoon(): void` debounces by 2 s when healthy; while backing off it leaves the backoff timer in charge;
    - `getStatus(): SyncStatus`;
    - `subscribe(fn: (s: SyncStatus) => void): () => void`;
    - `dispose(): void`.
- **Behaviour:**
  - One pass is push, then pull, whether or not the push stalled; pull skips rows that are still pending.
  - Any stall (a retryable push error or a thrown pull) counts as a failure and schedules a retry after `backoffDelay(failures)`: 5 s, 10 s, 20 s … capped at 300 s.
  - A clean pass resets failures and sets `lastSyncedAt`.
  - Calls to `run()` during a pass make exactly one extra pass.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/engine.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { backoffDelay, createSyncEngine } from '../sync/engine';
import type { RemoteReader } from '../sync/pull';
import type { RemoteError, RemoteWriter } from '../sync/push';

async function dbWithQueue(n: number) {
  const db = openTestDb();
  await migrate(db);
  for (let i = 1; i <= n; i++) {
    await db.runAsync('insert into sync_queue (table_name, row_id, op, payload, created_at) values (?, ?, ?, ?, ?)',
      ['workers', `w${i}`, 'insert', JSON.stringify({ id: `w${i}` }), 't']);
  }
  return db;
}

function fakeRemote(writeResult: () => Promise<RemoteError | null> | RemoteError | null) {
  const calls = { write: 0, fetch: 0 };
  const remote: RemoteWriter & RemoteReader = {
    async write() { calls.write++; return writeResult(); },
    async fetchSince() { calls.fetch++; return { rows: [], error: null }; },
  };
  return { remote, calls };
}

function fakeTimers() {
  const timers: { fn: () => void; ms: number; cleared: boolean }[] = [];
  return {
    timers,
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn: () => { t.cleared = true; fn(); }, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (h: unknown) => { (h as { cleared: boolean }).cleared = true; },
    live: () => timers.filter((t) => !t.cleared),
  };
}

const NOW = new Date('2026-09-07T10:00:00Z');

/** Resolves when the pass that a fired timer started has finished (calling run() here would add an extra pass). */
const idle = (engine: ReturnType<typeof createSyncEngine>) => new Promise<void>((resolve) => {
  const off = engine.subscribe((s) => { if (!s.running) { off(); resolve(); } });
});

test('a clean pass pushes, pulls every table, and records lastSyncedAt', async () => {
  const db = await dbWithQueue(1);
  const { remote, calls } = fakeRemote(() => null);
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  await engine.run();
  expect(calls).toEqual({ write: 1, fetch: 6 });
  expect(engine.getStatus()).toMatchObject({ running: false, pending: 0, dead: 0, lastError: null, lastSyncedAt: NOW.toISOString() });
  expect(t.live()).toEqual([]);
});

test('single flight: runs requested mid-pass collapse into one extra pass', async () => {
  const db = await dbWithQueue(1);
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { remote, calls } = fakeRemote(async () => { await gate; return null; });
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW });
  const a = engine.run();
  const b = engine.run();
  const c = engine.run();
  release();
  await Promise.all([a, b, c]);
  expect(calls.write).toBe(1); // second pass finds the queue empty
  expect(calls.fetch).toBe(12); // two passes × 6 tables
});

test('retryable push failure backs off 5s, 10s, 20s and resets after success', async () => {
  const db = await dbWithQueue(1);
  let fail = true;
  const { remote } = fakeRemote(() => (fail ? { status: 503, code: null, message: 'down' } : null));
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  await engine.run();
  expect(t.live().map((x) => x.ms)).toEqual([5000]);
  expect(engine.getStatus()).toMatchObject({ pending: 1, lastError: 'down', lastSyncedAt: null });
  t.live()[0].fn();
  await idle(engine);
  expect(t.live().map((x) => x.ms)).toEqual([10000]);
  fail = false;
  t.live()[0].fn();
  await idle(engine);
  expect(t.live()).toEqual([]);
  expect(engine.getStatus()).toMatchObject({ pending: 0, lastError: null, lastSyncedAt: NOW.toISOString() });
});

test('no session: nothing is sent or pulled; counts are still reported', async () => {
  const db = await dbWithQueue(2);
  const { remote, calls } = fakeRemote(() => null);
  const engine = createSyncEngine({ db, remote, hasSession: async () => false, now: () => NOW });
  await engine.run();
  expect(calls).toEqual({ write: 0, fetch: 0 });
  expect(engine.getStatus().pending).toBe(2);
});

test('runSoon debounces to 2s when healthy and leaves an active backoff alone', async () => {
  const db = await dbWithQueue(1);
  const { remote } = fakeRemote(() => ({ status: 503, code: null, message: 'down' }));
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  engine.runSoon();
  engine.runSoon();
  expect(t.live().map((x) => x.ms)).toEqual([2000]);
  t.live()[0].fn();
  await idle(engine);
  expect(t.live().map((x) => x.ms)).toEqual([5000]);
  engine.runSoon();
  expect(t.live().map((x) => x.ms)).toEqual([5000]);
});

test('subscribers see running flip and the final status; dispose stops timers', async () => {
  const db = await dbWithQueue(0);
  const { remote } = fakeRemote(() => null);
  const t = fakeTimers();
  const engine = createSyncEngine({ db, remote, hasSession: async () => true, now: () => NOW, setTimer: t.setTimer, clearTimer: t.clearTimer });
  const seen: boolean[] = [];
  const unsubscribe = engine.subscribe((s) => seen.push(s.running));
  await engine.run();
  expect(seen[0]).toBe(true);
  expect(seen.at(-1)).toBe(false);
  unsubscribe();
  engine.runSoon();
  engine.dispose();
  expect(t.live()).toEqual([]);
});

test('backoffDelay doubles from 5s and caps at 5 minutes', () => {
  expect([1, 2, 3, 4].map(backoffDelay)).toEqual([5000, 10000, 20000, 40000]);
  expect(backoffDelay(20)).toBe(300000);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/engine.test.ts`
Expected: FAIL, "Cannot find module '../sync/engine'".

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/sync/engine.ts
import type { SqlDb } from '../db/sqlDb';
import { pullAll, type RemoteReader } from './pull';
import { flushPush, type RemoteWriter } from './push';

export type SyncStatus = { running: boolean; lastSyncedAt: string | null; lastError: string | null; pending: number; dead: number };
export const IDLE_STATUS: SyncStatus = { running: false, lastSyncedAt: null, lastError: null, pending: 0, dead: 0 };

export type SyncEngineDeps = {
  db: SqlDb;
  remote: RemoteWriter & RemoteReader;
  hasSession(): Promise<boolean>;
  now?: () => Date;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
};

export type SyncEngine = {
  run(): Promise<void>;
  runSoon(): void;
  getStatus(): SyncStatus;
  subscribe(fn: (s: SyncStatus) => void): () => void;
  dispose(): void;
};

const BACKOFF_BASE_MS = 5_000;
const BACKOFF_MAX_MS = 300_000;
const DEBOUNCE_MS = 2_000;

export function backoffDelay(failures: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** Math.max(0, failures - 1), BACKOFF_MAX_MS);
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const now = deps.now ?? (() => new Date());
  const setTimer = deps.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimer = deps.clearTimer ?? ((h: unknown) => clearTimeout(h as ReturnType<typeof setTimeout>));
  const listeners = new Set<(s: SyncStatus) => void>();
  let status: SyncStatus = { ...IDLE_STATUS };
  let inflight: Promise<void> | null = null;
  let again = false;
  let failures = 0;
  let timer: unknown = null;
  let disposed = false;

  const emit = (patch: Partial<SyncStatus>) => {
    status = { ...status, ...patch };
    for (const l of listeners) l(status);
  };

  function schedule(ms: number) {
    if (disposed) return;
    if (timer !== null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void run();
    }, ms);
  }

  async function counts(): Promise<{ pending: number; dead: number }> {
    const r = await deps.db.getFirstAsync<{ pending: number | null; dead: number | null }>(
      "select sum(status = 'pending') as pending, sum(status = 'dead') as dead from sync_queue");
    return { pending: r?.pending ?? 0, dead: r?.dead ?? 0 };
  }

  async function headError(): Promise<string | null> {
    const r = await deps.db.getFirstAsync<{ last_error: string | null }>(
      "select last_error from sync_queue where status = 'pending' order by seq limit 1");
    return r?.last_error ?? null;
  }

  async function pass(): Promise<void> {
    if (!(await deps.hasSession())) {
      emit(await counts());
      return;
    }
    let error: string | null = null;
    let stalled = false;
    try {
      const push = await flushPush(deps.db, deps.remote, deps.hasSession);
      stalled = push.stopped;
      await pullAll(deps.db, deps.remote);
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      stalled = true;
    }
    const c = await counts();
    if (stalled) {
      failures++;
      schedule(backoffDelay(failures));
      emit({ ...c, lastError: error ?? (await headError()) ?? 'sync stalled' });
    } else {
      failures = 0;
      emit({ ...c, lastError: null, lastSyncedAt: now().toISOString() });
    }
  }

  function run(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (inflight) {
      again = true;
      return inflight;
    }
    if (timer !== null) {
      clearTimer(timer);
      timer = null;
    }
    emit({ running: true });
    inflight = (async () => {
      try {
        do {
          again = false;
          await pass();
        } while (again && !disposed);
      } finally {
        inflight = null;
        emit({ running: false });
      }
    })();
    return inflight;
  }

  return {
    run,
    runSoon() {
      if (failures > 0 && timer !== null) return;
      schedule(DEBOUNCE_MS);
    },
    getStatus: () => status,
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    dispose() {
      disposed = true;
      if (timer !== null) clearTimer(timer);
      timer = null;
      listeners.clear();
    },
  };
}
```

Note: with a stalled pass inside the `do … while` loop, the backoff timer is already scheduled when an extra pass runs. The extra pass reschedules it with the next failure count, so the backoff still grows.

- [ ] **Step 4: Run the tests and the type check**

Run: `cd mobile-chukta && npx jest src/__tests__/engine.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/sync/engine.ts mobile-chukta/src/__tests__/engine.test.ts
git commit -m "feat(chukta): single-flight sync engine with head-of-line backoff"
```

---

### Task 6: Real auth deps, staff API client, and new repository reads

**Files:**
- Create: `mobile-chukta/src/auth/authDeps.ts`, `mobile-chukta/src/api/staffApi.ts`, `mobile-chukta/src/config.ts`, `mobile-chukta/src/repos/staff.ts`
- Modify: `mobile-chukta/src/auth/authService.ts` (staff `not_subscribed`), `mobile-chukta/src/repos/attendance.ts`, `mobile-chukta/src/repos/properties.ts`
- Modify: `mobile-chukta/src/i18n/{en,bn,hi}.json`: add `auth.error.staffNotSubscribed`. Task 7 rewrites these files in full and keeps this key.
- Test: `mobile-chukta/src/__tests__/authDeps.test.ts`, `mobile-chukta/src/__tests__/staffApi.test.ts`, `mobile-chukta/src/__tests__/authService.test.ts` (append), `mobile-chukta/src/__tests__/repos.test.ts` (append)

**Interfaces:**
- Consumes: `AuthDeps` and `createAuthService` (1A); `Identity` (1A).
- Produces:
  - `KeyValueStore = { getItem(k): Promise<string|null>; setItem(k, v): Promise<void>; removeItem(k): Promise<void> }`;
  - `IDENTITY_KEY = 'chukta.identity'`, `DEVICE_ID_KEY = 'chukta.deviceId'`;
  - `projectRef(url): string`;
  - `parseIdentity(raw: string | null): Identity | null`;
  - `createAuthDeps(opts: { client: SupabaseClient; storage: KeyValueStore; supabaseUrl: string; anonKey: string; newId: () => string; fetchFn?: typeof fetch }): AuthDeps`;
  - `AuthErrorKey` now also includes `'auth.error.staffNotSubscribed'`;
  - `StaffApiErrorKey`, `StaffApiError`, `StaffApi`, `createStaffApi(deps)`;
  - `WEBSITE_URL`, `REGISTER_URL`, `FORGOT_PASSWORD_URL`;
  - `listStaff(db, propertyId): Promise<StaffUser[]>`;
  - `listAttendanceForDate(db, propertyId, date): Promise<AttendanceEntry[]>`;
  - `listAllProperties(db): Promise<Property[]>`.

- [ ] **Step 1: Write the failing tests**

```ts
// mobile-chukta/src/__tests__/authDeps.test.ts
import { AuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { createAuthDeps, DEVICE_ID_KEY, IDENTITY_KEY, parseIdentity, projectRef } from '../auth/authDeps';

function memStore() {
  const m = new Map<string, string>();
  return { m, getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => { m.set(k, v); }, removeItem: async (k: string) => { m.delete(k); } };
}

function fakeClient(over: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const auth = {
    setSession: async (s: { access_token: string; refresh_token: string }) => { calls.push(`set:${s.access_token}:${s.refresh_token}`); return { error: null }; },
    getSession: async () => ({ data: { session: { access_token: 'a' } }, error: null }),
    signOut: async (o: { scope: string }) => { calls.push(`signOut:${o.scope}`); return { error: null }; },
    ...over,
  };
  return { client: { auth } as unknown as SupabaseClient, calls };
}

const URL_ = 'https://mhtqufyaxpunhenqropn.supabase.co';

test('post calls the edge function with apikey and parses JSON; a non-JSON body becomes null', async () => {
  const fetchFn = jest.fn(async () => ({ status: 401, json: async () => ({ error: 'wrong_pin' }) }));
  const deps = createAuthDeps({ client: fakeClient().client, storage: memStore(), supabaseUrl: URL_, anonKey: 'anon', newId: () => 'x', fetchFn: fetchFn as unknown as typeof fetch });
  expect(await deps.post('chukta-login-staff', { pin: '1' })).toEqual({ status: 401, body: { error: 'wrong_pin' } });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe(`${URL_}/functions/v1/chukta-login-staff`);
  expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer anon', 'Content-Type': 'application/json' });
  const bad = createAuthDeps({ client: fakeClient().client, storage: memStore(), supabaseUrl: URL_, anonKey: 'anon', newId: () => 'x',
    fetchFn: (async () => ({ status: 502, json: async () => { throw new Error('html'); } })) as unknown as typeof fetch });
  expect(await bad.post('login', {})).toEqual({ status: 502, body: null });
});

test('getSession distinguishes a definite "no session" from a retryable network failure', async () => {
  const none = createAuthDeps({ client: fakeClient({ getSession: async () => ({ data: { session: null }, error: null }) }).client,
    storage: memStore(), supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  expect(await none.getSession()).toEqual({ hasSession: false, retryableError: false });
  const offline = createAuthDeps({ client: fakeClient({ getSession: async () => ({ data: { session: null }, error: new AuthRetryableFetchError('offline', 0) }) }).client,
    storage: memStore(), supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  expect(await offline.getSession()).toEqual({ hasSession: false, retryableError: true });
});

test('setSession, local sign-out and stored-session key', async () => {
  const store = memStore();
  store.m.set('sb-mhtqufyaxpunhenqropn-auth-token', '{}');
  const { client, calls } = fakeClient();
  const deps = createAuthDeps({ client, storage: store, supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  await deps.setSession('acc', 'ref');
  await deps.signOutLocal();
  await deps.clearStoredSession();
  expect(calls).toEqual(['set:acc:ref', 'signOut:local']);
  expect(store.m.has('sb-mhtqufyaxpunhenqropn-auth-token')).toBe(false);
  expect(projectRef(URL_)).toBe('mhtqufyaxpunhenqropn');
});

test('setSession throws when supabase rejects the tokens', async () => {
  const deps = createAuthDeps({ client: fakeClient({ setSession: async () => ({ error: new Error('bad jwt') }) }).client,
    storage: memStore(), supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  await expect(deps.setSession('a', 'b')).rejects.toThrow('bad jwt');
});

test('identity round-trips; garbage is ignored; null removes it', async () => {
  const store = memStore();
  const deps = createAuthDeps({ client: fakeClient().client, storage: store, supabaseUrl: URL_, anonKey: 'a', newId: () => 'x' });
  const staff = { kind: 'staff' as const, userId: 'u', staffId: 's', staffName: 'M', propertyId: 'p', propertyName: 'Main' };
  await deps.saveIdentity(staff);
  expect(await deps.loadIdentity()).toEqual(staff);
  await deps.saveIdentity(null);
  expect(store.m.has(IDENTITY_KEY)).toBe(false);
  expect(parseIdentity('{"kind":"owner"}')).toBeNull();
  expect(parseIdentity('not json')).toBeNull();
  expect(parseIdentity('{"kind":"owner","userId":"u","shopId":"s","phone":"+91"}')).toEqual({ kind: 'owner', userId: 'u', shopId: 's', phone: '+91' });
});

test('deviceId is created once and reused', async () => {
  const store = memStore();
  let n = 0;
  const deps = createAuthDeps({ client: fakeClient().client, storage: store, supabaseUrl: URL_, anonKey: 'a', newId: () => `dev-${++n}` });
  expect(await deps.deviceId()).toBe('dev-1');
  expect(await deps.deviceId()).toBe('dev-1');
  expect(store.m.get(DEVICE_ID_KEY)).toBe('dev-1');
});
```

```ts
// mobile-chukta/src/__tests__/staffApi.test.ts
import { createStaffApi, StaffApiError } from '../api/staffApi';

function api(status: number, body: unknown, token: string | null = 'tok') {
  const fetchFn = jest.fn(async () => ({ status, json: async () => body }));
  return { fetchFn, api: createStaffApi({ supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', accessToken: async () => token, fetchFn: fetchFn as unknown as typeof fetch }) };
}

const keyOf = async (p: Promise<unknown>) => p.then(() => 'ok', (e) => (e instanceof StaffApiError ? e.key : `raw:${e}`));

test('create posts to /chukta-staff/create with the user token', async () => {
  const { fetchFn, api: a } = api(200, { staff: { id: 's1' } });
  await a.create({ propertyId: 'p', name: 'Mgr', pin: '4821' });
  const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe('https://x.supabase.co/functions/v1/chukta-staff/create');
  expect(init.headers).toMatchObject({ apikey: 'anon', Authorization: 'Bearer tok' });
  expect(JSON.parse(init.body as string)).toEqual({ propertyId: 'p', name: 'Mgr', pin: '4821' });
});

test('maps server errors to i18n keys', async () => {
  expect(await keyOf(api(409, { error: 'pin_in_use' }).api.create({ propertyId: 'p', name: 'A', pin: '1111' }))).toBe('staff.error.pinInUse');
  expect(await keyOf(api(400, { error: 'pin_required_to_reactivate' }).api.update({ staffId: 's', isActive: true }))).toBe('staff.error.reactivateNeedsPin');
  expect(await keyOf(api(401, { error: 'unauthorized' }).api.unlock())).toBe('staff.error.sessionExpired');
  expect(await keyOf(api(500, { error: 'Internal error' }).api.unlock())).toBe('staff.error.unknown');
  expect(await keyOf(api(200, {}, null).api.unlock())).toBe('staff.error.sessionExpired');
});

test('network failure maps to staff.error.network', async () => {
  const a = createStaffApi({ supabaseUrl: 'https://x.supabase.co', anonKey: 'anon', accessToken: async () => 't',
    fetchFn: (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch });
  expect(await keyOf(a.unlock())).toBe('staff.error.network');
});
```

Append to `mobile-chukta/src/__tests__/authService.test.ts`:

```ts
test('staff login: owner shop not subscribed maps to auth.error.staffNotSubscribed', async () => {
  const { d } = deps({ post: async () => ({ status: 403, body: { error: 'not_subscribed' } }) });
  await expect(createAuthService(d).loginStaff('9800000001', '4821')).rejects.toMatchObject({ key: 'auth.error.staffNotSubscribed' });
});
```

Append to `mobile-chukta/src/__tests__/repos.test.ts`. Also add these imports at the top: `import { listAllProperties } from '../repos/properties';` (merged into the existing properties import), `import { listAttendanceForDate } from '../repos/attendance';` (merged into the existing attendance import), and `import { listStaff } from '../repos/staff';`.

```ts
test('listAttendanceForDate returns all rows for the property on that date only', async () => {
  const c = await ctx();
  const p = await createProperty(c, { shopId: 'shop1', name: 'Main' });
  const w = await createWorker(c, { propertyId: p.id, name: 'Ram', payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01' });
  await markAttendance(c, { propertyId: p.id, workerId: w.id, date: '2026-09-03', status: 'absent' });
  await markAttendance(c, { propertyId: p.id, workerId: w.id, date: '2026-09-04', status: 'absent' });
  expect((await listAttendanceForDate(c.db, p.id, '2026-09-03')).map((a) => a.date)).toEqual(['2026-09-03']);
  expect(await listAttendanceForDate(c.db, 'other', '2026-09-03')).toEqual([]);
});

test('listAllProperties lists active first, then archived, each by name', async () => {
  const c = await ctx();
  const b = await createProperty(c, { shopId: 'shop1', name: 'B' });
  await createProperty(c, { shopId: 'shop1', name: 'C' });
  await createProperty(c, { shopId: 'shop1', name: 'A' });
  await updatePropertySettings(c, b.id, { is_active: 0 });
  expect((await listAllProperties(c.db)).map((p) => p.name)).toEqual(['A', 'C', 'B']);
});

test('listStaff returns the property staff, active first', async () => {
  const c = await ctx();
  await c.db.runAsync(`insert into staff_users (id, property_id, name, auth_user_id, is_active, created_at) values
    ('s1', 'p1', 'Zed', 'a1', 1, 't'), ('s2', 'p1', 'Amy', 'a2', 0, 't'), ('s3', 'p2', 'Bob', 'a3', 1, 't')`);
  expect((await listStaff(c.db, 'p1')).map((s) => s.name)).toEqual(['Zed', 'Amy']);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/authDeps.test.ts src/__tests__/staffApi.test.ts src/__tests__/authService.test.ts src/__tests__/repos.test.ts`
Expected: FAIL. The new modules are missing; `staffNotSubscribed` maps to `auth.error.unknown`; `listAttendanceForDate`, `listAllProperties` and `listStaff` are not exported.

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/config.ts
export const WEBSITE_URL = 'https://tanusreepal78965.github.io/Pragati_Bandhu_Git';
export const REGISTER_URL = `${WEBSITE_URL}/chukta`;
export const FORGOT_PASSWORD_URL = `${WEBSITE_URL}/forgot-password`;
```

```ts
// mobile-chukta/src/auth/authDeps.ts
import { isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import type { AuthDeps } from './authService';
import type { Identity } from './identity';

export type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const IDENTITY_KEY = 'chukta.identity';
export const DEVICE_ID_KEY = 'chukta.deviceId';

export function projectRef(supabaseUrl: string): string {
  return new URL(supabaseUrl).hostname.split('.')[0];
}

const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

export function parseIdentity(raw: string | null): Identity | null {
  if (!raw) return null;
  let v: Record<string, unknown>;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (v?.kind === 'owner' && isStr(v.userId) && isStr(v.shopId)) {
    return { kind: 'owner', userId: v.userId, shopId: v.shopId, phone: typeof v.phone === 'string' ? v.phone : '' };
  }
  if (v?.kind === 'staff' && isStr(v.userId) && isStr(v.staffId) && isStr(v.propertyId)) {
    return {
      kind: 'staff', userId: v.userId, staffId: v.staffId, propertyId: v.propertyId,
      staffName: typeof v.staffName === 'string' ? v.staffName : '', propertyName: typeof v.propertyName === 'string' ? v.propertyName : '',
    };
  }
  return null;
}

export function createAuthDeps(opts: {
  client: SupabaseClient; storage: KeyValueStore; supabaseUrl: string; anonKey: string; newId: () => string; fetchFn?: typeof fetch;
}): AuthDeps {
  const fetchFn = opts.fetchFn ?? fetch;
  return {
    async post(path, body) {
      const res = await fetchFn(`${opts.supabaseUrl}/functions/v1/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: opts.anonKey, Authorization: `Bearer ${opts.anonKey}` },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json().catch(() => null) };
    },
    async setSession(access_token, refresh_token) {
      const { error } = await opts.client.auth.setSession({ access_token, refresh_token });
      if (error) throw error;
    },
    async getSession() {
      const { data, error } = await opts.client.auth.getSession();
      return { hasSession: !!data.session, retryableError: !!error && isAuthRetryableFetchError(error) };
    },
    async signOutLocal() {
      await opts.client.auth.signOut({ scope: 'local' });
    },
    async clearStoredSession() {
      await opts.storage.removeItem(`sb-${projectRef(opts.supabaseUrl)}-auth-token`);
    },
    async saveIdentity(identity) {
      if (identity) await opts.storage.setItem(IDENTITY_KEY, JSON.stringify(identity));
      else await opts.storage.removeItem(IDENTITY_KEY);
    },
    async loadIdentity() {
      return parseIdentity(await opts.storage.getItem(IDENTITY_KEY));
    },
    async deviceId() {
      const existing = await opts.storage.getItem(DEVICE_ID_KEY);
      if (existing) return existing;
      const id = opts.newId();
      await opts.storage.setItem(DEVICE_ID_KEY, id);
      return id;
    },
  };
}
```

```ts
// mobile-chukta/src/api/staffApi.ts
export type StaffApiErrorKey =
  | 'staff.error.pinInUse' | 'staff.error.reactivateNeedsPin' | 'staff.error.network'
  | 'staff.error.sessionExpired' | 'staff.error.unknown';

export class StaffApiError extends Error {
  constructor(public key: StaffApiErrorKey) {
    super(key);
  }
}

export type StaffApi = {
  create(input: { propertyId: string; name: string; pin: string }): Promise<void>;
  update(input: { staffId: string; name?: string; pin?: string; isActive?: boolean }): Promise<void>;
  /** Clears the shop's staff-PIN lockout. */
  unlock(): Promise<void>;
};

const ERRORS: Record<string, StaffApiErrorKey> = {
  pin_in_use: 'staff.error.pinInUse',
  pin_required_to_reactivate: 'staff.error.reactivateNeedsPin',
};

export function createStaffApi(deps: {
  supabaseUrl: string; anonKey: string; accessToken(): Promise<string | null>; fetchFn?: typeof fetch;
}): StaffApi {
  const fetchFn = deps.fetchFn ?? fetch;
  async function call(route: 'create' | 'update' | 'unlock', body: unknown): Promise<void> {
    const token = await deps.accessToken();
    if (!token) throw new StaffApiError('staff.error.sessionExpired');
    let res: { status: number; json(): Promise<any> };
    try {
      res = await fetchFn(`${deps.supabaseUrl}/functions/v1/chukta-staff/${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: deps.anonKey, Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
    } catch {
      throw new StaffApiError('staff.error.network');
    }
    if (res.status === 200) return;
    const payload = await res.json().catch(() => null);
    if (res.status === 401) throw new StaffApiError('staff.error.sessionExpired');
    throw new StaffApiError(ERRORS[payload?.error] ?? 'staff.error.unknown');
  }
  return {
    create: (input) => call('create', input),
    update: (input) => call('update', input),
    unlock: () => call('unlock', {}),
  };
}
```

`mobile-chukta/src/auth/authService.ts`:
- Extend the `AuthErrorKey` union with `| 'auth.error.staffNotSubscribed'`.
- Add `not_subscribed: 'auth.error.staffNotSubscribed',` to `STAFF_ERRORS`.

Add `"staffNotSubscribed"` under `auth.error` in all three language files:
- en: `"The owner's Chukta account is not active."`
- bn: `"মালিকের চুকতা অ্যাকাউন্ট চালু নেই।"`
- hi: `"मालिक का चुकता अकाउंट चालू नहीं है।"`

```ts
// mobile-chukta/src/repos/staff.ts
import type { SqlDb } from '../db/sqlDb';
import type { StaffUser } from '../domain/types';

/** Staff of one property as synced from the server (no PIN data ever reaches the phone). */
export async function listStaff(db: SqlDb, propertyId: string): Promise<StaffUser[]> {
  return db.getAllAsync<StaffUser>('select * from staff_users where property_id = ? order by is_active desc, name', [propertyId]);
}
```

Append to `mobile-chukta/src/repos/attendance.ts`:

```ts
export async function listAttendanceForDate(db: SqlDb, propertyId: string, date: string): Promise<AttendanceEntry[]> {
  return db.getAllAsync<AttendanceEntry>(
    'select * from attendance_entries where property_id = ? and date = ? order by created_at, id', [propertyId, date]);
}
```

Append to `mobile-chukta/src/repos/properties.ts`:

```ts
export async function listAllProperties(db: SqlDb): Promise<Property[]> {
  return db.getAllAsync<Property>('select * from properties order by is_active desc, name');
}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: every suite PASSes (including i18n parity), with no type errors.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/config.ts mobile-chukta/src/auth mobile-chukta/src/api mobile-chukta/src/repos mobile-chukta/src/i18n mobile-chukta/src/__tests__
git commit -m "feat(chukta): real auth deps, staff API client, staff entitlement error, new repo reads"
```

---

### Task 7: UI strings (en/bn/hi), date and explanation formatting, partial-month explanation

**Files:**
- Modify (full rewrite): `mobile-chukta/src/i18n/en.json`, `mobile-chukta/src/i18n/bn.json`, `mobile-chukta/src/i18n/hi.json`
- Create: `mobile-chukta/src/utils/format.ts`
- Modify: `mobile-chukta/src/domain/ledger.ts` (export `dayCredit`, partial-month key)
- Test: `mobile-chukta/src/__tests__/format.test.ts`, `mobile-chukta/src/__tests__/ledger.test.ts` (append)

**Interfaces:**
- Produces:
  - `Translate = (key: string, params?: Record<string, unknown>) => string`;
  - `formatDate(date: string, t: Translate): string`, e.g. `"7 Sep 2026"`;
  - `formatMonth(month: string /* YYYY-MM */, t): string`, e.g. `"September 2026"`;
  - `weekdayName(n: number | null, t): string`;
  - `formatTime(iso: string): string` (`HH:MM` local);
  - `explanationText(line: ExplanationLine, t): string`;
  - `dayCredit(entry: AttendanceEntry | undefined, shiftHours: number): number`;
  - a monthly partial month now emits key `ledger.explain.monthlyPartial`.
- Every key used by Tasks 10–15 is defined here.

- [ ] **Step 1: Write the failing tests**

```ts
// mobile-chukta/src/__tests__/format.test.ts
import en from '../i18n/en.json';
import { explanationText, formatDate, formatMonth, formatTime, weekdayName, type Translate } from '../utils/format';

// Minimal i18next-like translator over en.json so the tests check real strings.
const t: Translate = (key, params = {}) => {
  const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], en);
  if (typeof raw !== 'string') throw new Error(`missing key ${key}`);
  return raw.replace(/\{\{(\w+)\}\}/g, (_, p) => String(params[p]));
};

test('dates and months come from i18n keys', () => {
  expect(formatDate('2026-09-07', t)).toBe('7 Sep 2026');
  expect(formatMonth('2026-02', t)).toBe('February 2026');
  expect(weekdayName(0, t)).toBe('Sun');
  expect(weekdayName(null, t)).toBe('None');
});

test('formatTime uses local clock parts', () => {
  const d = new Date(2026, 8, 7, 9, 5);
  expect(formatTime(d.toISOString())).toBe('09:05');
});

test('explanation lines format money params as rupees and the month by name', () => {
  expect(explanationText({ key: 'ledger.explain.daily', params: { days: 4.5, rate: 50000 } }, t)).toBe('4.5 days × ₹500');
  expect(explanationText({ key: 'ledger.explain.monthlyPartial',
    params: { month: '2026-09', base: 1000000, deductionDays: 1, perDay: 100000, divisor: 30, eligibleDays: 10 } }, t))
    .toBe('September 2026 (10 days): ₹10,000 − 1 days × ₹1,000');
});
```

Append to `mobile-chukta/src/__tests__/ledger.test.ts`:

```ts
test('explanation key: whole month vs partial month', () => {
  const whole = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-01', today: '2026-09-30', attendance: [],
  });
  expect(whole.explanation.map((e) => e.key)).toEqual(['ledger.explain.monthly']);
  const partial = calculateWorkerLedger({
    ...base, settings: S({ payBasis: 'monthly' }), ratePaise: 3000000, joiningDate: '2026-09-21', today: '2026-09-30', attendance: [],
  });
  expect(partial.explanation[0]).toMatchObject({ key: 'ledger.explain.monthlyPartial', params: { eligibleDays: 10 } });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/format.test.ts src/__tests__/ledger.test.ts`
Expected: FAIL. `../utils/format` is missing, and the partial month still uses `ledger.explain.monthly`.

- [ ] **Step 3: Update `ledger.ts`**

- Rename the private `function credit(` to `export function dayCredit(` and update its three call sites (`credit(byDate.get(d), shift)` → `dayCredit(byDate.get(d), shift)`).
- In the monthly branch, change `key: 'ledger.explain.monthly',` to `key: whole ? 'ledger.explain.monthly' : 'ledger.explain.monthlyPartial',`.

- [ ] **Step 4: Create `format.ts`**

```ts
// mobile-chukta/src/utils/format.ts
import type { ExplanationLine } from '../domain/types';
import { formatRupees } from './money';

export type Translate = (key: string, params?: Record<string, unknown>) => string;

const pad = (n: number) => n.toString().padStart(2, '0');
const MONEY_PARAMS = new Set(['rate', 'base', 'perDay']);

/** "2026-09-07" → "7 Sep 2026" in the current language (month names come from i18n, never Intl). */
export function formatDate(date: string, t: Translate): string {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${t(`months.short.m${m}`)} ${y}`;
}

/** "2026-09" → "September 2026". */
export function formatMonth(month: string, t: Translate): string {
  const [y, m] = month.split('-').map(Number);
  return `${t(`months.long.m${m}`)} ${y}`;
}

export function weekdayName(n: number | null, t: Translate): string {
  return n === null ? t('weekdays.none') : t(`weekdays.d${n}`);
}

export function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function explanationText(line: ExplanationLine, t: Translate): string {
  const params: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(line.params)) {
    params[k] = MONEY_PARAMS.has(k) && typeof v === 'number' ? formatRupees(v) : k === 'month' && typeof v === 'string' ? formatMonth(v, t) : v;
  }
  return t(line.key, params);
}
```

- [ ] **Step 5: Rewrite the three language files**

`mobile-chukta/src/i18n/en.json`:

```json
{
  "common": { "appName": "Chukta", "ok": "OK", "cancel": "Cancel", "save": "Save", "retry": "Retry", "loading": "Loading…", "confirm": "Confirm", "edit": "Edit", "add": "Add", "needsInternet": "Needs internet." },
  "language": { "title": "Choose language", "en": "English", "bn": "বাংলা", "hi": "हिन्दी" },
  "months": {
    "long": { "m1": "January", "m2": "February", "m3": "March", "m4": "April", "m5": "May", "m6": "June", "m7": "July", "m8": "August", "m9": "September", "m10": "October", "m11": "November", "m12": "December" },
    "short": { "m1": "Jan", "m2": "Feb", "m3": "Mar", "m4": "Apr", "m5": "May", "m6": "Jun", "m7": "Jul", "m8": "Aug", "m9": "Sep", "m10": "Oct", "m11": "Nov", "m12": "Dec" }
  },
  "weekdays": { "d0": "Sun", "d1": "Mon", "d2": "Tue", "d3": "Wed", "d4": "Thu", "d5": "Fri", "d6": "Sat", "none": "None" },
  "auth": {
    "login": {
      "title": "Log in", "owner": "Owner", "staff": "Staff", "phone": "Mobile number", "password": "Password",
      "ownerPhone": "Owner's mobile number", "pin": "PIN", "submit": "Log in", "forgot": "Forgot password?",
      "register": "New to Chukta? Register on the website", "sessionEnded": "You were logged out. Please log in again."
    },
    "error": {
      "invalidCredentials": "Wrong phone number or password.",
      "passwordResetRequired": "Please set a new password first on the Pragati Bandhu website (Forgot password).",
      "notSubscribed": "This number is not registered for Chukta. Register on the website under Chukta.",
      "wrongPin": "Wrong PIN.",
      "tooManyAttempts": "Too many wrong PINs. Staff login is paused — ask the owner to unlock it in Settings, or try later.",
      "ambiguousPin": "This PIN is used at two places. Ask the owner to change it.",
      "staffNotSubscribed": "The owner's Chukta account is not active.",
      "network": "No internet. Please try again.",
      "unknown": "Something went wrong. Please try again."
    }
  },
  "tabs": { "today": "Today", "workers": "Workers", "advances": "Advances", "settings": "Settings" },
  "properties": {
    "title": "Properties", "add": "Add property", "edit": "Property settings", "name": "Property name", "address": "Address (optional)",
    "archived": "Archived", "archive": "Archive property", "archiveConfirm": "Staff of this property will be logged out and lose access. Continue?",
    "restore": "Restore", "restoreNote": "After restoring, set a new PIN for each staff member before they can log in again.",
    "empty": "Add your first property to start.", "defaults": "Settings for workers", "switch": "Switch property",
    "nameRequired": "Enter a property name.", "waitingForSync": "Loading your properties…", "choose": "Choose a property"
  },
  "fields": { "payBasis": "Pay basis", "attendanceMode": "Attendance", "shiftHours": "Shift hours", "weeklyOff": "Weekly off", "monthlyDivisor": "Monthly salary per day", "shiftInvalid": "Shift hours must be more than 0 and at most 24." },
  "payBasis": { "hourly": "Hourly", "daily": "Daily", "weekly": "Weekly", "monthly": "Monthly" },
  "rateLabel": { "hourly": "Rate per hour (₹)", "daily": "Rate per day (₹)", "weekly": "Rate per week (₹)", "monthly": "Salary per month (₹)" },
  "rateSuffix": { "hourly": "/hour", "daily": "/day", "weekly": "/week", "monthly": "/month" },
  "attendanceMode": { "day": "By day", "hours": "By hours" },
  "divisor": { "calendar": "Days in the month", "26": "26 working days", "30": "30 days" },
  "today": {
    "title": "Attendance", "hint": "Everyone is present unless you mark otherwise.", "present": "Present", "halfDay": "Half day", "absent": "Absent",
    "hours": "Hours", "hoursValue": "{{hours}} h", "hoursPrompt": "Hours worked", "hoursInvalid": "Enter hours between 0 and 24.",
    "weeklyOff": "Weekly off", "selected": "{{count}} selected", "markSelected": "Mark selected as", "clearSelection": "Clear",
    "noWorkers": "No workers yet. Add workers in the Workers tab.", "selectHint": "Long-press to select several workers."
  },
  "workers": { "add": "Add worker", "due": "Wage due", "advance": "Advance", "overpaid": "Overpaid", "showLeft": "Show workers who left", "left": "Left", "empty": "No workers yet. Add one." },
  "worker": {
    "due": "Wage due", "earned": "Earned", "paid": "Paid", "advance": "Advance outstanding", "howCalculated": "How this is calculated",
    "calendar": "Attendance", "history": "Money entries", "correct": "Correct",
    "correctConfirm": "This entry will be cancelled and removed from the totals. Continue?", "correction": "Correction", "cancelled": "Cancelled",
    "noHistory": "No money entries yet.", "joined": "Joined {{date}}", "leftOn": "Left {{date}}", "prevMonth": "Previous month", "nextMonth": "Next month",
    "notFound": "Worker not found."
  },
  "entryType": { "advance": "Advance", "repayment": "Repayment", "writeoff": "Write-off", "payment": "Wage payment" },
  "mode": { "cash": "Cash", "upi": "UPI", "bank": "Bank" },
  "workerForm": {
    "titleNew": "Add worker", "titleEdit": "Edit worker", "name": "Name", "phone": "Phone (optional)", "joiningDate": "Joining date",
    "overrides": "Different from property settings", "useDefault": "Property setting", "ownWeeklyOff": "Own weekly off",
    "hasLeft": "Worker has left", "leftDate": "Last working day",
    "nameRequired": "Enter a name.", "rateInvalid": "Enter an amount above ₹0.", "phoneInvalid": "Enter a 10-digit mobile number.",
    "leftBeforeJoin": "Last working day can't be before joining."
  },
  "money": { "amount": "Amount (₹)", "date": "Date", "mode": "Paid by", "note": "Note", "noteRequired": "A note is required for a write-off.", "amountInvalid": "Enter an amount above ₹0." },
  "advances": { "title": "Advances outstanding", "total": "Total outstanding", "empty": "No advances outstanding." },
  "settings": {
    "property": "Property", "staff": "Staff", "addStaff": "Add staff", "staffHelp": "Staff log in with your mobile number ({{phone}}) and their own PIN.",
    "unlock": "Unlock staff login", "unlocked": "Staff login unlocked.", "language": "Language", "sync": "Sync",
    "pending": "{{count}} waiting to sync", "lastSync": "Last synced {{time}}", "neverSynced": "Not synced yet", "syncing": "Syncing…",
    "syncNow": "Sync now", "issues": "{{count}} entries didn't sync", "logout": "Log out",
    "logoutConfirm": "{{count}} entries on this phone haven't synced yet. They will sync when you log in again on this phone. Log out?",
    "loggedInAs": "Logged in as {{name}}", "ownerAccount": "Owner {{phone}}"
  },
  "staff": {
    "titleNew": "Add staff", "titleEdit": "Edit staff", "name": "Name", "pin": "PIN (4–6 digits)", "pinConfirm": "Repeat PIN",
    "newPin": "New PIN (leave empty to keep)", "active": "Can log in", "inactive": "Deactivated",
    "error": {
      "nameRequired": "Enter a name.", "pinInvalid": "PIN must be 4–6 digits.", "pinMismatch": "PINs don't match.",
      "pinInUse": "Another staff member already uses this PIN.", "reactivateNeedsPin": "Set a new PIN to reactivate.",
      "network": "No internet. Staff changes need internet.", "sessionExpired": "Please log in again.", "unknown": "Could not save. Please try again."
    }
  },
  "syncIssues": {
    "title": "Entries that didn't sync", "explain": "The server rejected these changes. Retry after fixing the cause, or discard them from this phone.",
    "retry": "Retry", "discard": "Discard", "discardConfirm": "Discarded entries are removed from this phone. Continue?", "count": "{{count}} entries",
    "empty": "Everything is synced."
  },
  "tables": { "properties": "Property", "staff_users": "Staff", "workers": "Worker", "attendance_entries": "Attendance", "advance_entries": "Advance", "wage_payments": "Payment" },
  "ledger": {
    "explain": {
      "hourly": "{{hours}} hours × {{rate}}",
      "daily": "{{days}} days × {{rate}}",
      "weekly": "{{days}} days × {{rate}} ÷ 7",
      "monthly": "{{month}}: {{base}} − {{deductionDays}} days × {{perDay}}",
      "monthlyPartial": "{{month}} ({{eligibleDays}} days): {{base}} − {{deductionDays}} days × {{perDay}}"
    }
  }
}
```

`mobile-chukta/src/i18n/bn.json`:

```json
{
  "common": { "appName": "চুকতা", "ok": "ঠিক আছে", "cancel": "বাতিল", "save": "সেভ করুন", "retry": "আবার চেষ্টা করুন", "loading": "লোড হচ্ছে…", "confirm": "নিশ্চিত করুন", "edit": "বদলান", "add": "যোগ করুন", "needsInternet": "ইন্টারনেট দরকার।" },
  "language": { "title": "ভাষা বেছে নিন", "en": "English", "bn": "বাংলা", "hi": "हिन्दी" },
  "months": {
    "long": { "m1": "জানুয়ারি", "m2": "ফেব্রুয়ারি", "m3": "মার্চ", "m4": "এপ্রিল", "m5": "মে", "m6": "জুন", "m7": "জুলাই", "m8": "আগস্ট", "m9": "সেপ্টেম্বর", "m10": "অক্টোবর", "m11": "নভেম্বর", "m12": "ডিসেম্বর" },
    "short": { "m1": "জানু", "m2": "ফেব্রু", "m3": "মার্চ", "m4": "এপ্রি", "m5": "মে", "m6": "জুন", "m7": "জুলা", "m8": "আগ", "m9": "সেপ্টে", "m10": "অক্টো", "m11": "নভে", "m12": "ডিসে" }
  },
  "weekdays": { "d0": "রবি", "d1": "সোম", "d2": "মঙ্গল", "d3": "বুধ", "d4": "বৃহঃ", "d5": "শুক্র", "d6": "শনি", "none": "নেই" },
  "auth": {
    "login": {
      "title": "লগইন", "owner": "মালিক", "staff": "স্টাফ", "phone": "মোবাইল নম্বর", "password": "পাসওয়ার্ড",
      "ownerPhone": "মালিকের মোবাইল নম্বর", "pin": "পিন", "submit": "লগইন করুন", "forgot": "পাসওয়ার্ড ভুলে গেছেন?",
      "register": "চুকতায় নতুন? ওয়েবসাইটে রেজিস্টার করুন", "sessionEnded": "আপনি লগআউট হয়ে গেছেন। আবার লগইন করুন।"
    },
    "error": {
      "invalidCredentials": "ফোন নম্বর বা পাসওয়ার্ড ভুল।",
      "passwordResetRequired": "আগে প্রগতি বন্ধু ওয়েবসাইটে নতুন পাসওয়ার্ড সেট করুন (Forgot password)।",
      "notSubscribed": "এই নম্বরটি চুকতায় নথিভুক্ত নয়। ওয়েবসাইটে চুকতার জন্য রেজিস্টার করুন।",
      "wrongPin": "পিন ভুল।",
      "tooManyAttempts": "অনেকবার ভুল পিন। স্টাফ লগইন বন্ধ আছে — মালিককে সেটিংস থেকে খুলে দিতে বলুন, বা পরে চেষ্টা করুন।",
      "ambiguousPin": "এই পিন দুই জায়গায় ব্যবহার হচ্ছে। মালিককে পিন বদলাতে বলুন।",
      "staffNotSubscribed": "মালিকের চুকতা অ্যাকাউন্ট চালু নেই।",
      "network": "ইন্টারনেট নেই। আবার চেষ্টা করুন।",
      "unknown": "কিছু ভুল হয়েছে। আবার চেষ্টা করুন।"
    }
  },
  "tabs": { "today": "আজ", "workers": "কর্মী", "advances": "অগ্রিম", "settings": "সেটিংস" },
  "properties": {
    "title": "প্রপার্টি", "add": "প্রপার্টি যোগ করুন", "edit": "প্রপার্টির সেটিংস", "name": "প্রপার্টির নাম", "address": "ঠিকানা (ঐচ্ছিক)",
    "archived": "আর্কাইভ করা", "archive": "প্রপার্টি আর্কাইভ করুন", "archiveConfirm": "এই প্রপার্টির স্টাফরা লগআউট হবে এবং আর ঢুকতে পারবে না। এগোবেন?",
    "restore": "ফিরিয়ে আনুন", "restoreNote": "ফিরিয়ে আনার পর প্রতিটি স্টাফের জন্য নতুন পিন সেট করুন, তবেই তারা লগইন করতে পারবে।",
    "empty": "শুরু করতে প্রথম প্রপার্টি যোগ করুন।", "defaults": "কর্মীদের সেটিংস", "switch": "প্রপার্টি বদলান",
    "nameRequired": "প্রপার্টির নাম লিখুন।", "waitingForSync": "আপনার প্রপার্টি লোড হচ্ছে…", "choose": "একটি প্রপার্টি বেছে নিন"
  },
  "fields": { "payBasis": "মজুরির ধরন", "attendanceMode": "হাজিরা", "shiftHours": "শিফটের ঘণ্টা", "weeklyOff": "সাপ্তাহিক ছুটি", "monthlyDivisor": "মাসিক বেতনের দৈনিক হিসাব", "shiftInvalid": "শিফটের ঘণ্টা ০-এর বেশি এবং সর্বোচ্চ ২৪ হতে হবে।" },
  "payBasis": { "hourly": "ঘণ্টা হিসাবে", "daily": "দৈনিক", "weekly": "সাপ্তাহিক", "monthly": "মাসিক" },
  "rateLabel": { "hourly": "প্রতি ঘণ্টার রেট (₹)", "daily": "প্রতি দিনের রেট (₹)", "weekly": "প্রতি সপ্তাহের রেট (₹)", "monthly": "মাসিক বেতন (₹)" },
  "rateSuffix": { "hourly": "/ঘণ্টা", "daily": "/দিন", "weekly": "/সপ্তাহ", "monthly": "/মাস" },
  "attendanceMode": { "day": "দিন হিসাবে", "hours": "ঘণ্টা হিসাবে" },
  "divisor": { "calendar": "মাসের মোট দিন", "26": "২৬ কাজের দিন", "30": "৩০ দিন" },
  "today": {
    "title": "হাজিরা", "hint": "আলাদা করে না দিলে সবাই উপস্থিত ধরা হবে।", "present": "উপস্থিত", "halfDay": "অর্ধেক দিন", "absent": "অনুপস্থিত",
    "hours": "ঘণ্টা", "hoursValue": "{{hours}} ঘণ্টা", "hoursPrompt": "কত ঘণ্টা কাজ", "hoursInvalid": "০ থেকে ২৪-এর মধ্যে ঘণ্টা লিখুন।",
    "weeklyOff": "সাপ্তাহিক ছুটি", "selected": "{{count}} জন বাছা হয়েছে", "markSelected": "বাছাইদের দিন", "clearSelection": "মুছুন",
    "noWorkers": "এখনও কোনো কর্মী নেই। কর্মী ট্যাবে কর্মী যোগ করুন।", "selectHint": "একসাথে কয়েকজনকে বাছতে লম্বা চাপ দিন।"
  },
  "workers": { "add": "কর্মী যোগ করুন", "due": "বাকি মজুরি", "advance": "অগ্রিম", "overpaid": "বেশি দেওয়া", "showLeft": "চলে যাওয়া কর্মীদের দেখান", "left": "চলে গেছে", "empty": "এখনও কোনো কর্মী নেই। একজন যোগ করুন।" },
  "worker": {
    "due": "বাকি মজুরি", "earned": "উপার্জন", "paid": "দেওয়া হয়েছে", "advance": "বাকি অগ্রিম", "howCalculated": "কীভাবে হিসাব হলো",
    "calendar": "হাজিরা", "history": "টাকার হিসাব", "correct": "সংশোধন",
    "correctConfirm": "এই এন্ট্রি বাতিল হবে এবং মোট হিসাব থেকে বাদ যাবে। এগোবেন?", "correction": "সংশোধন", "cancelled": "বাতিল",
    "noHistory": "এখনও কোনো টাকার এন্ট্রি নেই।", "joined": "যোগ দিয়েছে {{date}}", "leftOn": "চলে গেছে {{date}}", "prevMonth": "আগের মাস", "nextMonth": "পরের মাস",
    "notFound": "কর্মী পাওয়া যায়নি।"
  },
  "entryType": { "advance": "অগ্রিম", "repayment": "অগ্রিম ফেরত", "writeoff": "মাফ", "payment": "মজুরি দেওয়া" },
  "mode": { "cash": "নগদ", "upi": "UPI", "bank": "ব্যাংক" },
  "workerForm": {
    "titleNew": "কর্মী যোগ করুন", "titleEdit": "কর্মীর তথ্য বদলান", "name": "নাম", "phone": "ফোন (ঐচ্ছিক)", "joiningDate": "যোগদানের তারিখ",
    "overrides": "প্রপার্টির সেটিংস থেকে আলাদা", "useDefault": "প্রপার্টির সেটিং", "ownWeeklyOff": "নিজের সাপ্তাহিক ছুটি",
    "hasLeft": "কর্মী চলে গেছে", "leftDate": "শেষ কাজের দিন",
    "nameRequired": "নাম লিখুন।", "rateInvalid": "₹০-এর বেশি টাকা লিখুন।", "phoneInvalid": "১০ সংখ্যার মোবাইল নম্বর লিখুন।",
    "leftBeforeJoin": "শেষ কাজের দিন যোগদানের আগে হতে পারে না।"
  },
  "money": { "amount": "টাকা (₹)", "date": "তারিখ", "mode": "কীভাবে দেওয়া", "note": "নোট", "noteRequired": "মাফ করার জন্য নোট লিখতে হবে।", "amountInvalid": "₹০-এর বেশি টাকা লিখুন।" },
  "advances": { "title": "বাকি অগ্রিম", "total": "মোট বাকি", "empty": "কোনো অগ্রিম বাকি নেই।" },
  "settings": {
    "property": "প্রপার্টি", "staff": "স্টাফ", "addStaff": "স্টাফ যোগ করুন", "staffHelp": "স্টাফরা আপনার মোবাইল নম্বর ({{phone}}) আর নিজের পিন দিয়ে লগইন করবে।",
    "unlock": "স্টাফ লগইন খুলে দিন", "unlocked": "স্টাফ লগইন খুলে দেওয়া হয়েছে।", "language": "ভাষা", "sync": "সিঙ্ক",
    "pending": "{{count}}টি সিঙ্কের অপেক্ষায়", "lastSync": "শেষ সিঙ্ক {{time}}", "neverSynced": "এখনও সিঙ্ক হয়নি", "syncing": "সিঙ্ক হচ্ছে…",
    "syncNow": "এখন সিঙ্ক করুন", "issues": "{{count}}টি এন্ট্রি সিঙ্ক হয়নি", "logout": "লগআউট",
    "logoutConfirm": "এই ফোনের {{count}}টি এন্ট্রি এখনও সিঙ্ক হয়নি। এই ফোনে আবার লগইন করলে সিঙ্ক হবে। লগআউট করবেন?",
    "loggedInAs": "{{name}} হিসাবে লগইন", "ownerAccount": "মালিক {{phone}}"
  },
  "staff": {
    "titleNew": "স্টাফ যোগ করুন", "titleEdit": "স্টাফের তথ্য বদলান", "name": "নাম", "pin": "পিন (৪–৬ সংখ্যা)", "pinConfirm": "পিন আবার লিখুন",
    "newPin": "নতুন পিন (না বদলালে খালি রাখুন)", "active": "লগইন করতে পারবে", "inactive": "বন্ধ করা",
    "error": {
      "nameRequired": "নাম লিখুন।", "pinInvalid": "পিন ৪–৬ সংখ্যার হতে হবে।", "pinMismatch": "দুটো পিন মিলছে না।",
      "pinInUse": "এই পিন অন্য একজন স্টাফ ব্যবহার করছে।", "reactivateNeedsPin": "আবার চালু করতে নতুন পিন দিন।",
      "network": "ইন্টারনেট নেই। স্টাফ বদলাতে ইন্টারনেট লাগবে।", "sessionExpired": "আবার লগইন করুন।", "unknown": "সেভ করা যায়নি। আবার চেষ্টা করুন।"
    }
  },
  "syncIssues": {
    "title": "যে এন্ট্রিগুলো সিঙ্ক হয়নি", "explain": "সার্ভার এই পরিবর্তনগুলো নেয়নি। কারণ ঠিক করে আবার চেষ্টা করুন, বা এই ফোন থেকে বাদ দিন।",
    "retry": "আবার চেষ্টা", "discard": "বাদ দিন", "discardConfirm": "বাদ দেওয়া এন্ট্রি এই ফোন থেকে মুছে যাবে। এগোবেন?", "count": "{{count}}টি এন্ট্রি",
    "empty": "সব সিঙ্ক হয়ে গেছে।"
  },
  "tables": { "properties": "প্রপার্টি", "staff_users": "স্টাফ", "workers": "কর্মী", "attendance_entries": "হাজিরা", "advance_entries": "অগ্রিম", "wage_payments": "মজুরি" },
  "ledger": {
    "explain": {
      "hourly": "{{hours}} ঘণ্টা × {{rate}}",
      "daily": "{{days}} দিন × {{rate}}",
      "weekly": "{{days}} দিন × {{rate}} ÷ ৭",
      "monthly": "{{month}}: {{base}} − {{deductionDays}} দিন × {{perDay}}",
      "monthlyPartial": "{{month}} ({{eligibleDays}} দিন): {{base}} − {{deductionDays}} দিন × {{perDay}}"
    }
  }
}
```

`mobile-chukta/src/i18n/hi.json`:

```json
{
  "common": { "appName": "चुकता", "ok": "ठीक है", "cancel": "रद्द करें", "save": "सेव करें", "retry": "फिर से कोशिश करें", "loading": "लोड हो रहा है…", "confirm": "पक्का करें", "edit": "बदलें", "add": "जोड़ें", "needsInternet": "इंटरनेट चाहिए।" },
  "language": { "title": "भाषा चुनें", "en": "English", "bn": "বাংলা", "hi": "हिन्दी" },
  "months": {
    "long": { "m1": "जनवरी", "m2": "फ़रवरी", "m3": "मार्च", "m4": "अप्रैल", "m5": "मई", "m6": "जून", "m7": "जुलाई", "m8": "अगस्त", "m9": "सितंबर", "m10": "अक्टूबर", "m11": "नवंबर", "m12": "दिसंबर" },
    "short": { "m1": "जन", "m2": "फ़र", "m3": "मार्च", "m4": "अप्रै", "m5": "मई", "m6": "जून", "m7": "जुला", "m8": "अग", "m9": "सित", "m10": "अक्टू", "m11": "नव", "m12": "दिस" }
  },
  "weekdays": { "d0": "रवि", "d1": "सोम", "d2": "मंगल", "d3": "बुध", "d4": "गुरु", "d5": "शुक्र", "d6": "शनि", "none": "कोई नहीं" },
  "auth": {
    "login": {
      "title": "लॉगिन", "owner": "मालिक", "staff": "स्टाफ", "phone": "मोबाइल नंबर", "password": "पासवर्ड",
      "ownerPhone": "मालिक का मोबाइल नंबर", "pin": "पिन", "submit": "लॉगिन करें", "forgot": "पासवर्ड भूल गए?",
      "register": "चुकता में नए हैं? वेबसाइट पर रजिस्टर करें", "sessionEnded": "आप लॉगआउट हो गए हैं। फिर से लॉगिन करें।"
    },
    "error": {
      "invalidCredentials": "फ़ोन नंबर या पासवर्ड गलत है।",
      "passwordResetRequired": "पहले प्रगति बंधु वेबसाइट पर नया पासवर्ड सेट करें (Forgot password)।",
      "notSubscribed": "यह नंबर चुकता के लिए रजिस्टर नहीं है। वेबसाइट पर चुकता के लिए रजिस्टर करें।",
      "wrongPin": "पिन गलत है।",
      "tooManyAttempts": "बहुत बार गलत पिन। स्टाफ लॉगिन रुका है — मालिक से सेटिंग्स में खुलवाएँ, या बाद में कोशिश करें।",
      "ambiguousPin": "यह पिन दो जगह इस्तेमाल हो रहा है। मालिक से पिन बदलवाएँ।",
      "staffNotSubscribed": "मालिक का चुकता अकाउंट चालू नहीं है।",
      "network": "इंटरनेट नहीं है। फिर से कोशिश करें।",
      "unknown": "कुछ गलत हो गया। फिर से कोशिश करें।"
    }
  },
  "tabs": { "today": "आज", "workers": "कर्मचारी", "advances": "एडवांस", "settings": "सेटिंग्स" },
  "properties": {
    "title": "प्रॉपर्टी", "add": "प्रॉपर्टी जोड़ें", "edit": "प्रॉपर्टी सेटिंग्स", "name": "प्रॉपर्टी का नाम", "address": "पता (वैकल्पिक)",
    "archived": "आर्काइव की गई", "archive": "प्रॉपर्टी आर्काइव करें", "archiveConfirm": "इस प्रॉपर्टी का स्टाफ लॉगआउट हो जाएगा और पहुँच खो देगा। आगे बढ़ें?",
    "restore": "वापस लाएँ", "restoreNote": "वापस लाने के बाद हर स्टाफ के लिए नया पिन सेट करें, तभी वे लॉगिन कर पाएँगे।",
    "empty": "शुरू करने के लिए पहली प्रॉपर्टी जोड़ें।", "defaults": "कर्मचारियों की सेटिंग्स", "switch": "प्रॉपर्टी बदलें",
    "nameRequired": "प्रॉपर्टी का नाम लिखें।", "waitingForSync": "आपकी प्रॉपर्टी लोड हो रही हैं…", "choose": "एक प्रॉपर्टी चुनें"
  },
  "fields": { "payBasis": "वेतन का तरीका", "attendanceMode": "हाज़िरी", "shiftHours": "शिफ्ट के घंटे", "weeklyOff": "साप्ताहिक छुट्टी", "monthlyDivisor": "मासिक वेतन का दैनिक हिसाब", "shiftInvalid": "शिफ्ट के घंटे 0 से ज़्यादा और अधिकतम 24 होने चाहिए।" },
  "payBasis": { "hourly": "घंटे के हिसाब से", "daily": "दैनिक", "weekly": "साप्ताहिक", "monthly": "मासिक" },
  "rateLabel": { "hourly": "प्रति घंटा रेट (₹)", "daily": "प्रति दिन रेट (₹)", "weekly": "प्रति सप्ताह रेट (₹)", "monthly": "मासिक वेतन (₹)" },
  "rateSuffix": { "hourly": "/घंटा", "daily": "/दिन", "weekly": "/सप्ताह", "monthly": "/महीना" },
  "attendanceMode": { "day": "दिन के हिसाब से", "hours": "घंटे के हिसाब से" },
  "divisor": { "calendar": "महीने के कुल दिन", "26": "26 काम के दिन", "30": "30 दिन" },
  "today": {
    "title": "हाज़िरी", "hint": "अलग से न बताएँ तो सब हाज़िर माने जाएँगे।", "present": "हाज़िर", "halfDay": "आधा दिन", "absent": "गैरहाज़िर",
    "hours": "घंटे", "hoursValue": "{{hours}} घंटे", "hoursPrompt": "कितने घंटे काम किया", "hoursInvalid": "0 से 24 के बीच घंटे लिखें।",
    "weeklyOff": "साप्ताहिक छुट्टी", "selected": "{{count}} चुने गए", "markSelected": "चुने हुओं को लगाएँ", "clearSelection": "हटाएँ",
    "noWorkers": "अभी कोई कर्मचारी नहीं। कर्मचारी टैब में जोड़ें।", "selectHint": "कई कर्मचारी चुनने के लिए देर तक दबाएँ।"
  },
  "workers": { "add": "कर्मचारी जोड़ें", "due": "बाकी वेतन", "advance": "एडवांस", "overpaid": "ज़्यादा दिया", "showLeft": "छोड़ चुके कर्मचारी दिखाएँ", "left": "छोड़ दिया", "empty": "अभी कोई कर्मचारी नहीं। एक जोड़ें।" },
  "worker": {
    "due": "बाकी वेतन", "earned": "कमाई", "paid": "दिया गया", "advance": "बाकी एडवांस", "howCalculated": "हिसाब कैसे बना",
    "calendar": "हाज़िरी", "history": "पैसों का हिसाब", "correct": "सुधारें",
    "correctConfirm": "यह एंट्री रद्द होगी और कुल हिसाब से हट जाएगी। आगे बढ़ें?", "correction": "सुधार", "cancelled": "रद्द",
    "noHistory": "अभी कोई पैसों की एंट्री नहीं।", "joined": "जुड़े {{date}}", "leftOn": "छोड़ा {{date}}", "prevMonth": "पिछला महीना", "nextMonth": "अगला महीना",
    "notFound": "कर्मचारी नहीं मिला।"
  },
  "entryType": { "advance": "एडवांस", "repayment": "एडवांस वापसी", "writeoff": "माफ़", "payment": "वेतन भुगतान" },
  "mode": { "cash": "नकद", "upi": "UPI", "bank": "बैंक" },
  "workerForm": {
    "titleNew": "कर्मचारी जोड़ें", "titleEdit": "कर्मचारी की जानकारी बदलें", "name": "नाम", "phone": "फ़ोन (वैकल्पिक)", "joiningDate": "जुड़ने की तारीख",
    "overrides": "प्रॉपर्टी सेटिंग्स से अलग", "useDefault": "प्रॉपर्टी सेटिंग", "ownWeeklyOff": "अपनी साप्ताहिक छुट्टी",
    "hasLeft": "कर्मचारी छोड़ चुका है", "leftDate": "काम का आखिरी दिन",
    "nameRequired": "नाम लिखें।", "rateInvalid": "₹0 से ज़्यादा रकम लिखें।", "phoneInvalid": "10 अंकों का मोबाइल नंबर लिखें।",
    "leftBeforeJoin": "आखिरी दिन जुड़ने की तारीख से पहले नहीं हो सकता।"
  },
  "money": { "amount": "रकम (₹)", "date": "तारीख", "mode": "कैसे दिया", "note": "नोट", "noteRequired": "माफ़ी के लिए नोट ज़रूरी है।", "amountInvalid": "₹0 से ज़्यादा रकम लिखें।" },
  "advances": { "title": "बाकी एडवांस", "total": "कुल बाकी", "empty": "कोई एडवांस बाकी नहीं।" },
  "settings": {
    "property": "प्रॉपर्टी", "staff": "स्टाफ", "addStaff": "स्टाफ जोड़ें", "staffHelp": "स्टाफ आपके मोबाइल नंबर ({{phone}}) और अपने पिन से लॉगिन करेगा।",
    "unlock": "स्टाफ लॉगिन खोलें", "unlocked": "स्टाफ लॉगिन खोल दिया गया।", "language": "भाषा", "sync": "सिंक",
    "pending": "{{count}} सिंक के इंतज़ार में", "lastSync": "आखिरी सिंक {{time}}", "neverSynced": "अभी सिंक नहीं हुआ", "syncing": "सिंक हो रहा है…",
    "syncNow": "अभी सिंक करें", "issues": "{{count}} एंट्री सिंक नहीं हुईं", "logout": "लॉगआउट",
    "logoutConfirm": "इस फ़ोन की {{count}} एंट्री अभी सिंक नहीं हुईं। इसी फ़ोन पर फिर लॉगिन करने पर सिंक होंगी। लॉगआउट करें?",
    "loggedInAs": "{{name}} के रूप में लॉगिन", "ownerAccount": "मालिक {{phone}}"
  },
  "staff": {
    "titleNew": "स्टाफ जोड़ें", "titleEdit": "स्टाफ की जानकारी बदलें", "name": "नाम", "pin": "पिन (4–6 अंक)", "pinConfirm": "पिन दोबारा लिखें",
    "newPin": "नया पिन (न बदलना हो तो खाली छोड़ें)", "active": "लॉगिन कर सकता है", "inactive": "बंद किया गया",
    "error": {
      "nameRequired": "नाम लिखें।", "pinInvalid": "पिन 4–6 अंकों का होना चाहिए।", "pinMismatch": "दोनों पिन मेल नहीं खाते।",
      "pinInUse": "यह पिन कोई दूसरा स्टाफ इस्तेमाल कर रहा है।", "reactivateNeedsPin": "दोबारा चालू करने के लिए नया पिन दें।",
      "network": "इंटरनेट नहीं है। स्टाफ बदलने के लिए इंटरनेट चाहिए।", "sessionExpired": "फिर से लॉगिन करें।", "unknown": "सेव नहीं हो पाया। फिर से कोशिश करें।"
    }
  },
  "syncIssues": {
    "title": "जो एंट्री सिंक नहीं हुईं", "explain": "सर्वर ने ये बदलाव नहीं लिए। कारण ठीक करके फिर कोशिश करें, या इस फ़ोन से हटा दें।",
    "retry": "फिर कोशिश", "discard": "हटाएँ", "discardConfirm": "हटाई गई एंट्री इस फ़ोन से मिट जाएँगी। आगे बढ़ें?", "count": "{{count}} एंट्री",
    "empty": "सब सिंक हो गया।"
  },
  "tables": { "properties": "प्रॉपर्टी", "staff_users": "स्टाफ", "workers": "कर्मचारी", "attendance_entries": "हाज़िरी", "advance_entries": "एडवांस", "wage_payments": "वेतन" },
  "ledger": {
    "explain": {
      "hourly": "{{hours}} घंटे × {{rate}}",
      "daily": "{{days}} दिन × {{rate}}",
      "weekly": "{{days}} दिन × {{rate}} ÷ 7",
      "monthly": "{{month}}: {{base}} − {{deductionDays}} दिन × {{perDay}}",
      "monthlyPartial": "{{month}} ({{eligibleDays}} दिन): {{base}} − {{deductionDays}} दिन × {{perDay}}"
    }
  }
}
```

- [ ] **Step 6: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: all suites PASS (the i18n parity and no-empty-strings tests included), with no type errors.

- [ ] **Step 7: Commit**

```bash
git add mobile-chukta/src/i18n mobile-chukta/src/utils/format.ts mobile-chukta/src/domain/ledger.ts mobile-chukta/src/__tests__/format.test.ts mobile-chukta/src/__tests__/ledger.test.ts
git commit -m "feat(chukta): UI strings in en/bn/hi, date and explanation formatting, partial-month explanation"
```

---

### Task 8: View models (today rows, month grid, money history, worker ledgers)

**Files:**
- Create: `mobile-chukta/src/view/today.ts`, `mobile-chukta/src/view/monthGrid.ts`, `mobile-chukta/src/view/moneyHistory.ts`, `mobile-chukta/src/view/ledgerQueries.ts`
- Create: `mobile-chukta/src/__tests__/helpers/fixtures.ts`
- Test: `mobile-chukta/src/__tests__/view.test.ts`

**Interfaces:**
- Consumes:
  - `resolveSettings`, `effectiveAttendance`, `calculateWorkerLedger`, `dayCredit` (Task 7);
  - the repos `listWorkers`, `listAttendance`, `listAdvances`, `listPayments`.
- Produces:
  - `TodayRow = { worker: Worker; settings: ResolvedSettings; isOff: boolean; entry: AttendanceEntry | null }`;
  - `buildTodayRows(workers: Worker[], property: Property, entries: AttendanceEntry[], date: string): TodayRow[]`. It excludes workers not yet joined or already left on `date`;
  - `DayKind = 'outside' | 'future' | 'off' | 'working'`;
  - `DayCell = { date: string; day: number; kind: DayKind; entry: AttendanceEntry | null; credit: number | null }`;
  - `MonthGrid = { year: number; month: number; leadingBlanks: number; cells: DayCell[] }`;
  - `buildMonthGrid(i: { year: number; month: number; settings: ResolvedSettings; joiningDate: string; leftDate: string | null; today: string; attendance: AttendanceEntry[] }): MonthGrid`;
  - `shiftMonth(year: number, month: number, delta: number): { year: number; month: number }`;
  - `MoneyKind = 'advance' | 'repayment' | 'writeoff' | 'payment'`;
  - `HistoryItem = { id: string; table: 'advance_entries' | 'wage_payments'; kind: MoneyKind; amountPaise: number; date: string; mode: PaymentMode | null; note: string | null; createdAt: string; isVoid: boolean; isVoided: boolean; canCorrect: boolean }`;
  - `buildMoneyHistory(advances: AdvanceEntry[], payments: WagePayment[]): HistoryItem[]`, newest first;
  - `getWorkerLedger(db: SqlDb, worker: Worker, property: Property, today: string): Promise<LedgerResult>`;
  - `WorkerSummary = { worker: Worker; ledger: LedgerResult }`;
  - `listWorkerSummaries(db: SqlDb, property: Property, today: string, includeLeft?: boolean): Promise<WorkerSummary[]>`.

- [ ] **Step 1: Create the test fixtures**

```ts
// mobile-chukta/src/__tests__/helpers/fixtures.ts
import type { AdvanceEntry, AttendanceEntry, Property, WagePayment, Worker } from '../../domain/types';

export const property = (over: Partial<Property> = {}): Property => ({
  id: 'p1', shop_id: 'shop1', name: 'Main', address: null, is_active: 1, default_pay_basis: 'daily', default_attendance_mode: 'day',
  shift_hours: 8, weekly_off: 0, monthly_divisor: 'calendar', created_at: '2026-09-01T00:00:00Z', server_updated_at: null, ...over,
});

export const worker = (over: Partial<Worker> = {}): Worker => ({
  id: 'w1', property_id: 'p1', name: 'Ram', phone: null, pay_basis: 'daily', rate_paise: 50000, joining_date: '2026-09-01',
  status: 'active', left_date: null, attendance_mode: null, shift_hours: null, weekly_off_override: 0, weekly_off: null,
  monthly_divisor: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-01T00:00:00Z', server_updated_at: null, ...over,
});

let n = 0;
export const att = (date: string, status: AttendanceEntry['status'], over: Partial<AttendanceEntry> = {}): AttendanceEntry => ({
  id: `a${String(n++).padStart(4, '0')}`, property_id: 'p1', worker_id: 'w1', date, status, hours: null, note: null,
  created_by: 'u1', created_by_role: 'owner', created_at: `${date}T10:00:00Z`, server_updated_at: null, ...over,
});

export const adv = (id: string, over: Partial<AdvanceEntry> = {}): AdvanceEntry => ({
  id, property_id: 'p1', worker_id: 'w1', type: 'advance', amount_paise: 100000, date: '2026-09-02', mode: 'cash', note: null,
  voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-02T10:00:00Z', server_updated_at: null, ...over,
});

export const pay = (id: string, over: Partial<WagePayment> = {}): WagePayment => ({
  id, property_id: 'p1', worker_id: 'w1', amount_paise: 50000, date: '2026-09-05', mode: 'upi', note: null,
  voids_id: null, created_by: 'u1', created_by_role: 'owner', created_at: '2026-09-05T10:00:00Z', server_updated_at: null, ...over,
});
```

- [ ] **Step 2: Write the failing test**

```ts
// mobile-chukta/src/__tests__/view.test.ts
import { openTestDb } from '../db/testing/betterSqliteDb';
import { migrate } from '../db/schema';
import { upsertLocal } from '../repos/write';
import { buildTodayRows } from '../view/today';
import { buildMonthGrid, shiftMonth } from '../view/monthGrid';
import { buildMoneyHistory } from '../view/moneyHistory';
import { getWorkerLedger, listWorkerSummaries } from '../view/ledgerQueries';
import { resolveSettings } from '../domain/settings';
import { adv, att, pay, property, worker } from './helpers/fixtures';

// 2026-09-01 is a Tuesday; 2026-09-06 is a Sunday.

test('today rows: weekly off, latest entry wins, not-joined and left workers are hidden', () => {
  const ws = [
    worker({ id: 'w1' }),
    worker({ id: 'w2', joining_date: '2026-09-10' }),
    worker({ id: 'w3', status: 'left', left_date: '2026-09-02' }),
    worker({ id: 'w4', weekly_off_override: 1, weekly_off: 1 }),
  ];
  const entries = [
    att('2026-09-07', 'absent', { worker_id: 'w1', created_at: '2026-09-07T09:00:00Z' }),
    att('2026-09-07', 'present', { worker_id: 'w1', created_at: '2026-09-07T11:00:00Z' }),
  ];
  const rows = buildTodayRows(ws, property(), entries, '2026-09-07'); // Monday
  expect(rows.map((r) => [r.worker.id, r.isOff, r.entry?.status ?? null])).toEqual([['w1', false, 'present'], ['w4', true, null]]);
  expect(buildTodayRows([worker()], property(), [], '2026-09-06')[0].isOff).toBe(true);
});

test('today rows carry the resolved attendance mode (hourly forces hours)', () => {
  const rows = buildTodayRows([worker({ pay_basis: 'hourly' })], property(), [], '2026-09-07');
  expect(rows[0].settings.attendanceMode).toBe('hours');
});

test('month grid: leading blanks, outside / future / off / working cells with credit', () => {
  const g = buildMonthGrid({
    year: 2026, month: 9, settings: resolveSettings(worker(), property()), joiningDate: '2026-09-02', leftDate: null, today: '2026-09-08',
    attendance: [att('2026-09-03', 'absent'), att('2026-09-04', 'half_day'), att('2026-09-05', 'hours', { hours: 4 })],
  });
  expect(g.leadingBlanks).toBe(2);
  expect(g.cells).toHaveLength(30);
  const kind = (d: number) => g.cells[d - 1].kind;
  expect([kind(1), kind(2), kind(6), kind(9)]).toEqual(['outside', 'working', 'off', 'future']);
  expect(g.cells.slice(1, 5).map((c) => c.credit)).toEqual([1, 0, 0.5, 0.5]);
  expect(g.cells[2].entry?.status).toBe('absent');
});

test('shiftMonth wraps years', () => {
  expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
  expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
});

test('money history: newest first; voids flagged; only untouched entries can be corrected', () => {
  const items = buildMoneyHistory(
    [adv('a1'), adv('a2', { voids_id: 'a1', created_at: '2026-09-03T10:00:00Z' }), adv('a3', { type: 'repayment', date: '2026-09-06' })],
    [pay('p1')],
  );
  expect(items.map((i) => [i.id, i.kind, i.isVoid, i.isVoided, i.canCorrect])).toEqual([
    ['a3', 'repayment', false, false, true],
    ['p1', 'payment', false, false, true],
    ['a2', 'advance', true, false, false],
    ['a1', 'advance', false, true, false],
  ]);
});

async function seeded() {
  const db = openTestDb();
  await migrate(db);
  await upsertLocal(db, 'properties', property());
  await upsertLocal(db, 'workers', worker());
  await upsertLocal(db, 'workers', worker({ id: 'w2', name: 'Sita' }));
  await upsertLocal(db, 'attendance_entries', att('2026-09-03', 'absent'));
  await upsertLocal(db, 'attendance_entries', att('2026-09-08', 'absent')); // after "today": ignored
  await upsertLocal(db, 'advance_entries', adv('a1'));
  await upsertLocal(db, 'wage_payments', pay('p1'));
  return db;
}

test('worker ledger from SQLite: Sep 1–7, Sunday off, one absence → 5 days; minus payment; advance', async () => {
  const db = await seeded();
  const l = await getWorkerLedger(db, worker(), property(), '2026-09-07');
  expect(l).toMatchObject({ earnedPaise: 250000, paidPaise: 50000, wageDuePaise: 200000, advanceOutstandingPaise: 100000 });
});

test('summaries compute every worker from three batched queries', async () => {
  const db = await seeded();
  const s = await listWorkerSummaries(db, property(), '2026-09-07');
  expect(s.map((x) => [x.worker.name, x.ledger.wageDuePaise, x.ledger.advanceOutstandingPaise])).toEqual([
    ['Ram', 200000, 100000],
    ['Sita', 300000, 0],
  ]);
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/view.test.ts`
Expected: FAIL, "Cannot find module '../view/today'".

- [ ] **Step 4: Implement**

```ts
// mobile-chukta/src/view/today.ts
import { effectiveAttendance } from '../domain/attendance';
import { resolveSettings } from '../domain/settings';
import type { AttendanceEntry, Property, ResolvedSettings, Worker } from '../domain/types';
import { compareDates, weekday } from '../utils/dates';

export type TodayRow = { worker: Worker; settings: ResolvedSettings; isOff: boolean; entry: AttendanceEntry | null };

/** One row per worker employed on `date`, with that day's effective entry (latest wins). */
export function buildTodayRows(workers: Worker[], property: Property, entries: AttendanceEntry[], date: string): TodayRow[] {
  const byWorker = new Map<string, AttendanceEntry[]>();
  for (const e of entries) {
    if (e.date !== date) continue;
    const list = byWorker.get(e.worker_id) ?? [];
    list.push(e);
    byWorker.set(e.worker_id, list);
  }
  const rows: TodayRow[] = [];
  for (const worker of workers) {
    if (compareDates(date, worker.joining_date) < 0) continue;
    if (worker.left_date && compareDates(date, worker.left_date) > 0) continue;
    const settings = resolveSettings(worker, property);
    const list = byWorker.get(worker.id);
    rows.push({
      worker,
      settings,
      isOff: settings.weeklyOff !== null && weekday(date) === settings.weeklyOff,
      entry: list ? effectiveAttendance(list).get(date) ?? null : null,
    });
  }
  return rows;
}
```

```ts
// mobile-chukta/src/view/monthGrid.ts
import { effectiveAttendance } from '../domain/attendance';
import { dayCredit } from '../domain/ledger';
import type { AttendanceEntry, ResolvedSettings } from '../domain/types';
import { compareDates, daysInMonth, weekday } from '../utils/dates';

export type DayKind = 'outside' | 'future' | 'off' | 'working';
export type DayCell = { date: string; day: number; kind: DayKind; entry: AttendanceEntry | null; credit: number | null };
export type MonthGrid = { year: number; month: number; leadingBlanks: number; cells: DayCell[] };

const pad = (n: number) => n.toString().padStart(2, '0');

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

/** Sunday-first calendar for one worker and month. Credit uses the same rule as the wage calculation. */
export function buildMonthGrid(i: {
  year: number; month: number; settings: ResolvedSettings; joiningDate: string; leftDate: string | null; today: string; attendance: AttendanceEntry[];
}): MonthGrid {
  const byDate = effectiveAttendance(i.attendance);
  const shift = i.settings.shiftHours > 0 ? i.settings.shiftHours : 8;
  const cells: DayCell[] = [];
  for (let d = 1; d <= daysInMonth(i.year, i.month); d++) {
    const date = `${i.year}-${pad(i.month)}-${pad(d)}`;
    let kind: DayKind;
    if (compareDates(date, i.joiningDate) < 0 || (i.leftDate !== null && compareDates(date, i.leftDate) > 0)) kind = 'outside';
    else if (compareDates(date, i.today) > 0) kind = 'future';
    else if (i.settings.weeklyOff !== null && weekday(date) === i.settings.weeklyOff) kind = 'off';
    else kind = 'working';
    const entry = kind === 'working' ? byDate.get(date) ?? null : null;
    cells.push({ date, day: d, kind, entry, credit: kind === 'working' ? dayCredit(entry ?? undefined, shift) : null });
  }
  return { year: i.year, month: i.month, leadingBlanks: weekday(`${i.year}-${pad(i.month)}-01`), cells };
}
```

```ts
// mobile-chukta/src/view/moneyHistory.ts
import type { AdvanceEntry, PaymentMode, WagePayment } from '../domain/types';

export type MoneyKind = 'advance' | 'repayment' | 'writeoff' | 'payment';
export type HistoryItem = {
  id: string; table: 'advance_entries' | 'wage_payments'; kind: MoneyKind; amountPaise: number; date: string;
  mode: PaymentMode | null; note: string | null; createdAt: string;
  /** This row cancels another row. */
  isVoid: boolean;
  /** This row has been cancelled by a later row. */
  isVoided: boolean;
  canCorrect: boolean;
};

export function buildMoneyHistory(advances: AdvanceEntry[], payments: WagePayment[]): HistoryItem[] {
  const all = [...advances, ...payments];
  const voided = new Set(all.filter((r) => r.voids_id).map((r) => r.voids_id as string));
  const common = (r: AdvanceEntry | WagePayment) => {
    const isVoid = r.voids_id !== null;
    const isVoided = voided.has(r.id);
    return { id: r.id, amountPaise: r.amount_paise, date: r.date, mode: r.mode, note: r.note, createdAt: r.created_at, isVoid, isVoided, canCorrect: !isVoid && !isVoided };
  };
  const items: HistoryItem[] = [
    ...advances.map((a) => ({ ...common(a), table: 'advance_entries' as const, kind: a.type as MoneyKind })),
    ...payments.map((p) => ({ ...common(p), table: 'wage_payments' as const, kind: 'payment' as const })),
  ];
  return items.sort((a, b) =>
    (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)
    || Date.parse(b.createdAt) - Date.parse(a.createdAt)
    || (a.id < b.id ? 1 : -1));
}
```

```ts
// mobile-chukta/src/view/ledgerQueries.ts
import type { SqlDb } from '../db/sqlDb';
import { calculateWorkerLedger } from '../domain/ledger';
import { resolveSettings } from '../domain/settings';
import type { AdvanceEntry, AttendanceEntry, LedgerResult, Property, WagePayment, Worker } from '../domain/types';
import { listAttendance } from '../repos/attendance';
import { listAdvances, listPayments } from '../repos/money';
import { listWorkers } from '../repos/workers';

export type WorkerSummary = { worker: Worker; ledger: LedgerResult };

function ledgerFor(worker: Worker, property: Property, today: string, attendance: AttendanceEntry[], advances: AdvanceEntry[], payments: WagePayment[]) {
  return calculateWorkerLedger({
    settings: resolveSettings(worker, property), ratePaise: worker.rate_paise, joiningDate: worker.joining_date,
    leftDate: worker.left_date, today, attendance, advances, payments,
  });
}

export async function getWorkerLedger(db: SqlDb, worker: Worker, property: Property, today: string): Promise<LedgerResult> {
  const [attendance, advances, payments] = await Promise.all([
    listAttendance(db, worker.id, worker.joining_date, today), listAdvances(db, worker.id), listPayments(db, worker.id),
  ]);
  return ledgerFor(worker, property, today, attendance, advances, payments);
}

function groupByWorker<T extends { worker_id: string }>(rows: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const list = m.get(r.worker_id) ?? [];
    list.push(r);
    m.set(r.worker_id, list);
  }
  return m;
}

/** Balances for every worker of a property, from three queries (not one per worker). */
export async function listWorkerSummaries(db: SqlDb, property: Property, today: string, includeLeft = false): Promise<WorkerSummary[]> {
  const [workers, attendance, advances, payments] = await Promise.all([
    listWorkers(db, property.id, includeLeft),
    db.getAllAsync<AttendanceEntry>('select * from attendance_entries where property_id = ? and date <= ?', [property.id, today]),
    db.getAllAsync<AdvanceEntry>('select * from advance_entries where property_id = ?', [property.id]),
    db.getAllAsync<WagePayment>('select * from wage_payments where property_id = ?', [property.id]),
  ]);
  const att = groupByWorker(attendance);
  const adv = groupByWorker(advances);
  const pay = groupByWorker(payments);
  return workers.map((worker) => ({
    worker,
    ledger: ledgerFor(worker, property, today, att.get(worker.id) ?? [], adv.get(worker.id) ?? [], pay.get(worker.id) ?? []),
  }));
}
```

- [ ] **Step 5: Run the tests and the type check**

Run: `cd mobile-chukta && npx jest src/__tests__/view.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src/view mobile-chukta/src/__tests__/helpers/fixtures.ts mobile-chukta/src/__tests__/view.test.ts
git commit -m "feat(chukta): view models for today, month calendar, money history and worker balances"
```

---

### Task 9: Form validation (worker, money, staff, property)

**Files:**
- Create: `mobile-chukta/src/view/forms.ts`
- Test: `mobile-chukta/src/__tests__/forms.test.ts`

**Interfaces:**
- Consumes:
  - `rupeesToPaise` (1A);
  - `NewWorker`, `WorkerPatch` (1A repos);
  - `PropertySettingsPatch` (1A repos);
  - `MoneyKind` (Task 8).
- Produces (every error value is an i18n key defined in Task 7):
  - `FieldErrors = Record<string, string>`;
  - `Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors }`;
  - `WorkerFormValues`, `WorkerFormResult`, `validateWorkerForm(v): Validation<WorkerFormResult>`;
  - `toNewWorker(propertyId, r): NewWorker`, `toWorkerPatch(r): WorkerPatch`, `workerToFormValues(w: Worker): WorkerFormValues`;
  - `MoneyFormValues`, `validateMoneyForm(v): Validation<{ amountPaise: number; date: string; mode: PaymentMode | null; note: string | null }>`;
  - `StaffFormValues`, `validateStaffForm(v): Validation<{ name: string; pin: string | null }>`;
  - `PropertyFormValues`, `validatePropertyForm(v): Validation<Required<Omit<PropertySettingsPatch, 'is_active'>>>`, `propertyToFormValues(p: Property | null): PropertyFormValues`.

- [ ] **Step 1: Write the failing test**

```ts
// mobile-chukta/src/__tests__/forms.test.ts
import {
  propertyToFormValues, toNewWorker, toWorkerPatch, validateMoneyForm, validatePropertyForm, validateStaffForm, validateWorkerForm,
  workerToFormValues, type WorkerFormValues,
} from '../view/forms';
import { property, worker } from './helpers/fixtures';

const W: WorkerFormValues = {
  name: ' Ram ', phone: '', payBasis: 'daily', rate: '500', joiningDate: '2026-09-01', attendanceMode: null, shiftHours: '',
  weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null, hasLeft: false, leftDate: null,
};

test('worker form: valid input is normalised', () => {
  const r = validateWorkerForm(W);
  expect(r).toEqual({ ok: true, value: {
    name: 'Ram', phone: null, payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01', attendanceMode: null, shiftHours: null,
    weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null, leftDate: null,
  } });
});

test('worker form: errors are i18n keys per field', () => {
  const r = validateWorkerForm({ ...W, name: ' ', rate: '0', phone: '12345', shiftHours: '25', hasLeft: true, leftDate: '2026-08-01' });
  expect(r).toEqual({ ok: false, errors: {
    name: 'workerForm.nameRequired', rate: 'workerForm.rateInvalid', phone: 'workerForm.phoneInvalid',
    shiftHours: 'fields.shiftInvalid', leftDate: 'workerForm.leftBeforeJoin',
  } });
});

test('worker form: hourly forces hours; divisor only for monthly; weekly off only when overridden', () => {
  const r = validateWorkerForm({ ...W, payBasis: 'hourly', attendanceMode: 'day', monthlyDivisor: '26', weeklyOff: 3 });
  expect(r.ok && [r.value.attendanceMode, r.value.monthlyDivisor, r.value.weeklyOff]).toEqual(['hours', null, null]);
  const m = validateWorkerForm({ ...W, payBasis: 'monthly', monthlyDivisor: '26', weeklyOffOverride: true, weeklyOff: null });
  expect(m.ok && [m.value.monthlyDivisor, m.value.weeklyOffOverride, m.value.weeklyOff]).toEqual(['26', true, null]);
});

test('worker form maps to repo inputs', () => {
  const r = validateWorkerForm({ ...W, weeklyOffOverride: true, weeklyOff: 5, shiftHours: '7.5', hasLeft: true, leftDate: '2026-09-20' });
  if (!r.ok) throw new Error('expected ok');
  expect(toNewWorker('p1', r.value)).toEqual({
    propertyId: 'p1', name: 'Ram', phone: undefined, payBasis: 'daily', ratePaise: 50000, joiningDate: '2026-09-01',
    attendanceMode: undefined, shiftHours: 7.5, weeklyOff: 5, monthlyDivisor: undefined,
  });
  expect(toWorkerPatch(r.value)).toEqual({
    name: 'Ram', phone: null, pay_basis: 'daily', rate_paise: 50000, joining_date: '2026-09-01', attendance_mode: null, shift_hours: 7.5,
    weekly_off_override: 1, weekly_off: 5, monthly_divisor: null, status: 'left', left_date: '2026-09-20',
  });
});

test('workerToFormValues round-trips an existing worker', () => {
  const v = workerToFormValues(worker({ rate_paise: 55050, shift_hours: 9, status: 'left', left_date: '2026-09-20' }));
  expect(v).toMatchObject({ name: 'Ram', rate: '550.50', shiftHours: '9', hasLeft: true, leftDate: '2026-09-20' });
});

test('money form: amount required, write-off needs a note', () => {
  expect(validateMoneyForm({ kind: 'advance', amount: '1,000', date: '2026-09-07', mode: 'cash', note: '' }))
    .toEqual({ ok: true, value: { amountPaise: 100000, date: '2026-09-07', mode: 'cash', note: null } });
  expect(validateMoneyForm({ kind: 'writeoff', amount: 'x', date: '2026-09-07', mode: null, note: ' ' }))
    .toEqual({ ok: false, errors: { amount: 'money.amountInvalid', note: 'money.noteRequired' } });
});

test('staff form: PIN required when new, optional on edit, must match', () => {
  expect(validateStaffForm({ isNew: true, name: 'A', pin: '', pinConfirm: '' })).toEqual({ ok: false, errors: { pin: 'staff.error.pinInvalid' } });
  expect(validateStaffForm({ isNew: false, name: 'A', pin: '', pinConfirm: '' })).toEqual({ ok: true, value: { name: 'A', pin: null } });
  expect(validateStaffForm({ isNew: true, name: '', pin: '1234', pinConfirm: '1243' }))
    .toEqual({ ok: false, errors: { name: 'staff.error.nameRequired', pinConfirm: 'staff.error.pinMismatch' } });
  expect(validateStaffForm({ isNew: true, name: 'A', pin: '1234567', pinConfirm: '1234567' }).ok).toBe(false);
});

test('property form: name and shift hours validated; defaults come from the property', () => {
  const v = propertyToFormValues(property({ weekly_off: 5, shift_hours: 9 }));
  expect(v).toMatchObject({ name: 'Main', shiftHours: '9', weeklyOff: 5 });
  expect(validatePropertyForm(v)).toEqual({ ok: true, value: {
    name: 'Main', address: null, default_pay_basis: 'daily', default_attendance_mode: 'day', shift_hours: 9, weekly_off: 5, monthly_divisor: 'calendar',
  } });
  expect(validatePropertyForm({ ...propertyToFormValues(null), name: ' ', shiftHours: '0' }))
    .toEqual({ ok: false, errors: { name: 'properties.nameRequired', shiftHours: 'fields.shiftInvalid' } });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/forms.test.ts`
Expected: FAIL, "Cannot find module '../view/forms'".

- [ ] **Step 3: Implement**

```ts
// mobile-chukta/src/view/forms.ts
import type { AttendanceMode, MonthlyDivisor, PayBasis, PaymentMode, Property, Worker } from '../domain/types';
import type { PropertySettingsPatch } from '../repos/properties';
import type { NewWorker, WorkerPatch } from '../repos/workers';
import { compareDates } from '../utils/dates';
import { rupeesToPaise } from '../utils/money';
import type { MoneyKind } from './moneyHistory';

export type FieldErrors = Record<string, string>;
export type Validation<T> = { ok: true; value: T } | { ok: false; errors: FieldErrors };

const done = <T>(errors: FieldErrors, value: () => T): Validation<T> =>
  Object.keys(errors).length ? { ok: false, errors } : { ok: true, value: value() };

/** '' → null (use default); a number in (0, 24] with ≤2 decimals; anything else → undefined (invalid). */
function parseShift(s: string): number | null | undefined {
  const t = s.trim();
  if (!t) return null;
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) return undefined;
  const n = Number(t);
  return n > 0 && n <= 24 ? n : undefined;
}

const paiseToInput = (p: number) => (p % 100 === 0 ? String(p / 100) : (p / 100).toFixed(2));

// ---- worker ----
export type WorkerFormValues = {
  name: string; phone: string; payBasis: PayBasis; rate: string; joiningDate: string; attendanceMode: AttendanceMode | null;
  shiftHours: string; weeklyOffOverride: boolean; weeklyOff: number | null; monthlyDivisor: MonthlyDivisor | null;
  hasLeft: boolean; leftDate: string | null;
};
export type WorkerFormResult = {
  name: string; phone: string | null; payBasis: PayBasis; ratePaise: number; joiningDate: string; attendanceMode: AttendanceMode | null;
  shiftHours: number | null; weeklyOffOverride: boolean; weeklyOff: number | null; monthlyDivisor: MonthlyDivisor | null; leftDate: string | null;
};

export function validateWorkerForm(v: WorkerFormValues): Validation<WorkerFormResult> {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'workerForm.nameRequired';
  const ratePaise = rupeesToPaise(v.rate);
  if (ratePaise === null || ratePaise <= 0) errors.rate = 'workerForm.rateInvalid';
  const phone = v.phone.replace(/\D/g, '');
  if (phone && phone.length !== 10) errors.phone = 'workerForm.phoneInvalid';
  const shift = parseShift(v.shiftHours);
  if (shift === undefined) errors.shiftHours = 'fields.shiftInvalid';
  const leftDate = v.hasLeft ? v.leftDate : null;
  if (v.hasLeft && (!leftDate || compareDates(leftDate, v.joiningDate) < 0)) errors.leftDate = 'workerForm.leftBeforeJoin';
  return done(errors, () => ({
    name, phone: phone || null, payBasis: v.payBasis, ratePaise: ratePaise as number, joiningDate: v.joiningDate,
    attendanceMode: v.payBasis === 'hourly' ? 'hours' : v.attendanceMode, shiftHours: shift ?? null,
    weeklyOffOverride: v.weeklyOffOverride, weeklyOff: v.weeklyOffOverride ? v.weeklyOff : null,
    monthlyDivisor: v.payBasis === 'monthly' ? v.monthlyDivisor : null, leftDate,
  }));
}

export function toNewWorker(propertyId: string, r: WorkerFormResult): NewWorker {
  return {
    propertyId, name: r.name, phone: r.phone ?? undefined, payBasis: r.payBasis, ratePaise: r.ratePaise, joiningDate: r.joiningDate,
    attendanceMode: r.attendanceMode ?? undefined, shiftHours: r.shiftHours ?? undefined,
    weeklyOff: r.weeklyOffOverride ? r.weeklyOff : undefined, monthlyDivisor: r.monthlyDivisor ?? undefined,
  };
}

export function toWorkerPatch(r: WorkerFormResult): WorkerPatch {
  return {
    name: r.name, phone: r.phone, pay_basis: r.payBasis, rate_paise: r.ratePaise, joining_date: r.joiningDate,
    attendance_mode: r.attendanceMode, shift_hours: r.shiftHours, weekly_off_override: r.weeklyOffOverride ? 1 : 0,
    weekly_off: r.weeklyOff, monthly_divisor: r.monthlyDivisor, status: r.leftDate ? 'left' : 'active', left_date: r.leftDate,
  };
}

export function workerToFormValues(w: Worker): WorkerFormValues {
  return {
    name: w.name, phone: w.phone ?? '', payBasis: w.pay_basis, rate: paiseToInput(w.rate_paise), joiningDate: w.joining_date,
    attendanceMode: w.attendance_mode, shiftHours: w.shift_hours === null ? '' : String(w.shift_hours),
    weeklyOffOverride: w.weekly_off_override === 1, weeklyOff: w.weekly_off, monthlyDivisor: w.monthly_divisor,
    hasLeft: w.status === 'left', leftDate: w.left_date,
  };
}

// ---- money ----
export type MoneyFormValues = { kind: MoneyKind; amount: string; date: string; mode: PaymentMode | null; note: string };

export function validateMoneyForm(v: MoneyFormValues): Validation<{ amountPaise: number; date: string; mode: PaymentMode | null; note: string | null }> {
  const errors: FieldErrors = {};
  const amountPaise = rupeesToPaise(v.amount);
  if (amountPaise === null || amountPaise <= 0) errors.amount = 'money.amountInvalid';
  const note = v.note.trim();
  if (v.kind === 'writeoff' && !note) errors.note = 'money.noteRequired';
  return done(errors, () => ({ amountPaise: amountPaise as number, date: v.date, mode: v.mode, note: note || null }));
}

// ---- staff ----
export type StaffFormValues = { isNew: boolean; name: string; pin: string; pinConfirm: string };

export function validateStaffForm(v: StaffFormValues): Validation<{ name: string; pin: string | null }> {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'staff.error.nameRequired';
  const pin = v.pin.trim();
  if ((v.isNew || pin) && !/^\d{4,6}$/.test(pin)) errors.pin = 'staff.error.pinInvalid';
  else if (pin && pin !== v.pinConfirm.trim()) errors.pinConfirm = 'staff.error.pinMismatch';
  return done(errors, () => ({ name, pin: pin || null }));
}

// ---- property ----
export type PropertyFormValues = {
  name: string; address: string; defaultPayBasis: PayBasis; defaultAttendanceMode: AttendanceMode; shiftHours: string;
  weeklyOff: number | null; monthlyDivisor: MonthlyDivisor;
};

export function propertyToFormValues(p: Property | null): PropertyFormValues {
  return {
    name: p?.name ?? '', address: p?.address ?? '', defaultPayBasis: p?.default_pay_basis ?? 'daily',
    defaultAttendanceMode: p?.default_attendance_mode ?? 'day', shiftHours: String(p?.shift_hours ?? 8),
    weeklyOff: p ? p.weekly_off : 0, monthlyDivisor: p?.monthly_divisor ?? 'calendar',
  };
}

export function validatePropertyForm(v: PropertyFormValues): Validation<Required<Omit<PropertySettingsPatch, 'is_active'>>> {
  const errors: FieldErrors = {};
  const name = v.name.trim();
  if (!name) errors.name = 'properties.nameRequired';
  const shift = parseShift(v.shiftHours);
  if (shift === undefined || shift === null) errors.shiftHours = 'fields.shiftInvalid';
  return done(errors, () => ({
    name, address: v.address.trim() || null, default_pay_basis: v.defaultPayBasis, default_attendance_mode: v.defaultAttendanceMode,
    shift_hours: shift as number, weekly_off: v.weeklyOff, monthly_divisor: v.monthlyDivisor,
  }));
}
```

- [ ] **Step 4: Run the tests and the type check**

Run: `cd mobile-chukta && npx jest src/__tests__/forms.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src/view/forms.ts mobile-chukta/src/__tests__/forms.test.ts
git commit -m "feat(chukta): form validation for workers, money entries, staff and properties"
```

---
### Task 10: App shell (navigation, session, UI kit, Language, Login, basic Settings)

**Files:**
- Modify: `mobile-chukta/package.json` (via `npx expo install`), `mobile-chukta/jest.config.js`, `mobile-chukta/eas.json`, `mobile-chukta/App.tsx`
- Create: `mobile-chukta/jest.setup.ts`
- Create: `mobile-chukta/src/i18n/useT.ts`
- Create: `mobile-chukta/src/ui/theme.ts`, `mobile-chukta/src/ui/components.tsx`, `mobile-chukta/src/ui/DateField.tsx`, `mobile-chukta/src/ui/options.ts`
- Create: `mobile-chukta/src/app/services.ts`, `mobile-chukta/src/app/session.tsx`, `mobile-chukta/src/app/SessionProvider.tsx`, `mobile-chukta/src/app/routes.ts`, `mobile-chukta/src/app/navigation.tsx`, `mobile-chukta/src/app/AppRoot.tsx`
- Create: `mobile-chukta/src/screens/LanguageScreen.tsx`, `mobile-chukta/src/screens/LoginScreen.tsx`, `mobile-chukta/src/screens/SettingsScreen.tsx`
- Create: `mobile-chukta/src/__tests__/helpers/session.tsx`
- Test: `mobile-chukta/src/__tests__/login.test.tsx`, `mobile-chukta/src/__tests__/settings.test.tsx`

**Interfaces:**
- Consumes:
  - `createAuthDeps`, `createStaffApi` (Task 6);
  - `createSyncEngine`, `IDLE_STATUS` (Task 5);
  - `createSupabaseRemote`, `openChuktaDb`, `identityKey` (1A);
  - `formatDate`, `weekdayName`, `formatTime`, `Translate` (Task 7).
- Produces (later screen tasks rely on these exact names):
  - `useT(): Translate`;
  - UI kit: `Screen`, `Card`, `Section`, `Title`, `Label`, `Muted`, `ErrorText`, `Loading`, `Button`, `Field`, `Segmented`, `WeekdayPicker`, `Row`, `SwitchRow`, `DateField`, `colors`, `space`;
  - options: `PAY_BASES`, `ATTENDANCE_MODES`, `DIVISORS`, `PAYMENT_MODES`;
  - services: `authService`, `staffApi` (singletons);
  - `Session`, `SessionContext`, `useSession()`, `useLocalData(load, deps)`, `useCurrentProperty()`, `sessionToday(session)`;
  - `SessionProvider`, `LogoutReason`;
  - `RootStackParamList`, `TabParamList`, `useStackNav()`;
  - `SessionNavigator` (Tabs: only **Settings** for now; later tasks add tabs and routes at the marked places);
  - `SettingsScreen`, with markers `{/* SECTIONS */}` and `{/* SYNC-ISSUES */}` that later tasks replace;
  - test helpers: `makeSession(identity?, over?)`, `renderScreen(routeName, Component, session, params?)`, `OWNER`, `STAFF`, `ALL_ROUTES`.

- [ ] **Step 1: Install dependencies and configure Jest**

```bash
cd mobile-chukta
npx expo install @react-navigation/native @react-navigation/native-stack @react-navigation/bottom-tabs react-native-screens react-native-safe-area-context @react-native-community/datetimepicker @expo/vector-icons
npm install --save-dev @testing-library/react-native
```

Replace `mobile-chukta/jest.config.js` with:

```js
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.ts'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@react-navigation/.*|@supabase/.*|i18next|react-i18next))',
  ],
};
```

```ts
// mobile-chukta/jest.setup.ts
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-community/datetimepicker', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { __esModule: true, default: (props: object) => React.createElement(View, { testID: 'date-picker', ...props }) };
});
```

Add `"env"` to each of the three build profiles in `mobile-chukta/eas.json`. Copy the anon-key value exactly from `mobile-shopai/eas.json`: it is the public anon key, which ShopAI already commits.

```json
"env": {
  "EXPO_PUBLIC_SUPABASE_URL": "https://mhtqufyaxpunhenqropn.supabase.co",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<same value as mobile-shopai/eas.json>"
}
```

For local `npx expo start`: `cp .env.example .env` and paste the same anon key. `.env` is git-ignored; never commit it.

Run: `npx jest`
Expected: the existing suites still PASS.

- [ ] **Step 2: Create the translation hook, theme, options and UI kit**

```ts
// mobile-chukta/src/i18n/useT.ts
import { useTranslation } from 'react-i18next';
import type { Translate } from '../utils/format';

/** `t` narrowed to the plain (key, params) → string shape every screen uses. Re-renders on language change. */
export function useT(): Translate {
  const { t } = useTranslation();
  return t as unknown as Translate;
}
```

```ts
// mobile-chukta/src/ui/theme.ts
export const colors = {
  bg: '#F6F7F9', card: '#FFFFFF', text: '#111827', muted: '#6B7280', border: '#E5E7EB',
  primary: '#0F766E', primaryText: '#FFFFFF', primarySoft: '#CCFBF1',
  danger: '#B91C1C', dangerSoft: '#FEE2E2', warnSoft: '#FEF3C7', infoSoft: '#DBEAFE', offSoft: '#E5E7EB',
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = 10;
```

```ts
// mobile-chukta/src/ui/options.ts
import type { AttendanceMode, MonthlyDivisor, PayBasis, PaymentMode } from '../domain/types';

export const PAY_BASES: PayBasis[] = ['hourly', 'daily', 'weekly', 'monthly'];
export const ATTENDANCE_MODES: AttendanceMode[] = ['day', 'hours'];
export const DIVISORS: MonthlyDivisor[] = ['calendar', '26', '30'];
export const PAYMENT_MODES: PaymentMode[] = ['cash', 'upi', 'bank'];
```

```tsx
// mobile-chukta/src/ui/components.tsx
import type { ReactElement, ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View,
  type RefreshControlProps, type TextInputProps,
} from 'react-native';
import { useT } from '../i18n/useT';
import { weekdayName } from '../utils/format';
import { colors, radius, space } from './theme';

export function Screen({ children, refreshControl }: { children: ReactNode; refreshControl?: ReactElement<RefreshControlProps> }) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export const Title = ({ children, testID }: { children: ReactNode; testID?: string }) => <Text style={styles.title} testID={testID}>{children}</Text>;
export const Label = ({ children }: { children: ReactNode }) => <Text style={styles.label}>{children}</Text>;
export const Muted = ({ children, testID }: { children: ReactNode; testID?: string }) => <Text style={styles.muted} testID={testID}>{children}</Text>;

export function ErrorText({ children }: { children?: string | null }) {
  return children ? <Text style={styles.error} accessibilityRole="alert">{children}</Text> : null;
}

export function Loading() {
  return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
}

type ButtonKind = 'primary' | 'secondary' | 'danger';
export function Button({ title, onPress, kind = 'primary', disabled, loading, testID }: {
  title: string; onPress: () => void; kind?: ButtonKind; disabled?: boolean; loading?: boolean; testID?: string;
}) {
  const off = !!disabled || !!loading;
  const textColor = kind === 'primary' ? colors.primaryText : kind === 'danger' ? colors.danger : colors.primary;
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityState={{ disabled: off }} disabled={off} onPress={onPress}
      style={[styles.button, kind === 'primary' ? styles.buttonPrimary : styles.buttonOutline, off && styles.disabled]}>
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.buttonText, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, error, ...input }: TextInputProps & { label: string; error?: string | null }) {
  return (
    <View style={styles.field}>
      <Label>{label}</Label>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[styles.input, error ? styles.inputError : null]} {...input} />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Segmented<T extends string | number>({ options, value, onChange, testIDPrefix }: {
  options: { value: T; label: string }[]; value: T | null; onChange: (v: T) => void; testIDPrefix?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable key={String(o.value)} testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined} accessibilityRole="button"
            accessibilityState={{ selected: on }} onPress={() => onChange(o.value)} style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const NO_DAY = -1;
/** Weekly-off picker; "None" (no weekly off) is null. */
export function WeekdayPicker({ value, onChange, testIDPrefix = 'weekday' }: {
  value: number | null; onChange: (v: number | null) => void; testIDPrefix?: string;
}) {
  const t = useT();
  const options = [NO_DAY, 0, 1, 2, 3, 4, 5, 6].map((d) => ({ value: d, label: weekdayName(d === NO_DAY ? null : d, t) }));
  return <Segmented options={options} value={value ?? NO_DAY} onChange={(d) => onChange(d === NO_DAY ? null : d)} testIDPrefix={testIDPrefix} />;
}

export function Row({ title, subtitle, right, onPress, onLongPress, selected, testID }: {
  title: string; subtitle?: string; right?: ReactNode; onPress?: () => void; onLongPress?: () => void; selected?: boolean; testID?: string;
}) {
  const body = (
    <View style={[styles.row, selected && styles.rowSelected]}>
      <View style={styles.rowMain}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle ? <Text style={styles.muted}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  if (!onPress && !onLongPress) return <View testID={testID}>{body}</View>;
  return <Pressable testID={testID} accessibilityRole="button" onPress={onPress} onLongPress={onLongPress}>{body}</Pressable>;
}

export function SwitchRow({ label, value, onChange, testID }: { label: string; value: boolean; onChange: (v: boolean) => void; testID?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowTitle, styles.rowMain]}>{label}</Text>
      <Switch testID={testID} accessibilityLabel={label} value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { backgroundColor: colors.card, borderRadius: radius, padding: space.md, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  section: { gap: space.xs },
  sectionTitle: { fontSize: 13, fontWeight: '600', color: colors.muted, textTransform: 'uppercase' },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  label: { fontSize: 14, fontWeight: '600', color: colors.text },
  muted: { fontSize: 13, color: colors.muted },
  error: { fontSize: 13, color: colors.danger },
  button: { minHeight: 46, borderRadius: radius, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonOutline: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  buttonText: { fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  field: { gap: space.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.card, paddingHorizontal: space.md, minHeight: 46, fontSize: 16, color: colors.text },
  inputError: { borderColor: colors.danger },
  segmented: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  segment: { paddingVertical: space.sm, paddingHorizontal: space.md, borderRadius: radius, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  segmentOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  segmentText: { color: colors.text, fontSize: 14 },
  segmentTextOn: { color: colors.primaryText, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  rowSelected: { backgroundColor: colors.primarySoft, borderRadius: radius, paddingHorizontal: space.sm },
  rowMain: { flex: 1 },
  rowTitle: { fontSize: 16, color: colors.text },
});
```

```tsx
// mobile-chukta/src/ui/DateField.tsx
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/useT';
import { todayLocal } from '../utils/dates';
import { formatDate } from '../utils/format';
import { Label } from './components';
import { colors, radius, space } from './theme';

const toDate = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A YYYY-MM-DD value shown in the current language; opens the native date picker. */
export function DateField({ label, value, onChange, max, testID }: {
  label: string; value: string; onChange: (date: string) => void; max?: string; testID?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.wrap}>
      <Label>{label}</Label>
      <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={styles.input}>
        <Text style={styles.text}>{formatDate(value, t)}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker
          value={toDate(value)}
          mode="date"
          maximumDate={max ? toDate(max) : undefined}
          onChange={(e: DateTimePickerEvent, date?: Date) => {
            setOpen(false);
            if (e.type === 'set' && date) onChange(todayLocal(date));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius, backgroundColor: colors.card, paddingHorizontal: space.md, minHeight: 46, justifyContent: 'center' },
  text: { fontSize: 16, color: colors.text },
});
```

- [ ] **Step 3: Create services, session, provider, routes and navigation**

```ts
// mobile-chukta/src/app/services.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { createStaffApi } from '../api/staffApi';
import { createAuthDeps } from '../auth/authDeps';
import { createAuthService } from '../auth/authService';
import { supabase, SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase';

export const authService = createAuthService(createAuthDeps({
  client: supabase, storage: AsyncStorage, supabaseUrl: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, newId: () => Crypto.randomUUID(),
}));

export const staffApi = createStaffApi({
  supabaseUrl: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  accessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
});
```

```tsx
// mobile-chukta/src/app/session.tsx
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Identity } from '../auth/identity';
import type { SqlDb } from '../db/sqlDb';
import type { Property } from '../domain/types';
import type { RepoContext } from '../repos/context';
import { getProperty } from '../repos/properties';
import type { SyncStatus } from '../sync/engine';
import { todayLocal } from '../utils/dates';

export type Session = {
  identity: Identity;
  db: SqlDb;
  repo: RepoContext;
  /** Owner: the chosen property (null until chosen). Staff: always their own property. */
  propertyId: string | null;
  setPropertyId(id: string | null): Promise<void>;
  /** Bumped after every local write and every finished sync; screens re-read SQLite when it changes. */
  version: number;
  syncStatus: SyncStatus;
  runSync(): Promise<void>;
  /** Call after a local write: re-reads screens and schedules a sync. */
  afterWrite(): void;
  logout(): Promise<void>;
};

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}

export const sessionToday = (s: Session) => todayLocal(s.repo.now());

/** Loads data from SQLite and reloads whenever the session version or property changes (or `deps` change). */
export function useLocalData<T>(load: (s: Session) => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean; reload: () => void } {
  const session = useSession();
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setLoading(true);
    load(session).then(
      (d) => { if (live) { setData(d); setLoading(false); } },
      (e) => { if (live) setLoading(false); console.warn('useLocalData failed', e); },
    );
    return () => { live = false; };
    // `load` is an inline closure; its inputs are listed in deps by the caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.version, session.propertyId, session.db, tick, ...deps]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return { data, loading, reload };
}

export function useCurrentProperty(): { property: Property | null; loading: boolean } {
  const { data, loading } = useLocalData((s) => (s.propertyId ? getProperty(s.db, s.propertyId) : Promise.resolve(null)));
  return { property: data ?? null, loading };
}
```

```tsx
// mobile-chukta/src/app/SessionProvider.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as Crypto from 'expo-crypto';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { identityKey, type Identity } from '../auth/identity';
import { openChuktaDb } from '../db/openDb';
import type { SqlDb } from '../db/sqlDb';
import { supabase } from '../lib/supabase';
import { createSyncEngine, IDLE_STATUS, type SyncEngine, type SyncStatus } from '../sync/engine';
import { createSupabaseRemote } from '../sync/remote';
import { Loading } from '../ui/components';
import { authService } from './services';
import { SessionContext, type Session } from './session';

export type LogoutReason = 'user' | 'revoked';
const propertyKey = (i: Identity) => `chukta.property.${identityKey(i)}`;

export function SessionProvider({ identity, onLoggedOut, children }: {
  identity: Identity; onLoggedOut: (reason: LogoutReason) => void; children: ReactNode;
}) {
  const [ready, setReady] = useState<{ db: SqlDb; engine: SyncEngine } | null>(null);
  const [propertyId, setPropertyIdState] = useState<string | null>(identity.kind === 'staff' ? identity.propertyId : null);
  const [version, setVersion] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(IDLE_STATUS);
  const loggingOut = useRef(false);
  const onLoggedOutRef = useRef(onLoggedOut);
  onLoggedOutRef.current = onLoggedOut;

  useEffect(() => {
    let disposed = false;
    let engine: SyncEngine | null = null;
    const cleanups: (() => void)[] = [];
    (async () => {
      const db = await openChuktaDb(identityKey(identity));
      if (identity.kind === 'owner') {
        const saved = await AsyncStorage.getItem(propertyKey(identity));
        if (!disposed) setPropertyIdState(saved);
      }
      if (disposed) return;
      const e = createSyncEngine({
        db, remote: createSupabaseRemote(supabase), hasSession: async () => !!(await supabase.auth.getSession()).data.session,
      });
      engine = e;
      cleanups.push(e.subscribe((s) => {
        setSyncStatus(s);
        if (!s.running) setVersion((v) => v + 1);
      }));
      cleanups.push(NetInfo.addEventListener((s) => { if (s.isConnected) void e.run(); }));
      const appState = AppState.addEventListener('change', (s) => { if (s === 'active') void e.run(); });
      cleanups.push(() => appState.remove());
      // A revoked session (staff deactivated, PIN changed, property archived) fails its next refresh → SIGNED_OUT.
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === 'SIGNED_OUT' && !loggingOut.current) onLoggedOutRef.current('revoked');
      });
      cleanups.push(() => data.subscription.unsubscribe());
      setReady({ db, engine: e });
      void e.run();
    })().catch((err) => console.warn('session start failed', err));
    return () => {
      disposed = true;
      cleanups.forEach((c) => c());
      engine?.dispose();
    };
  }, [identity]);

  const setPropertyId = useCallback(async (id: string | null) => {
    if (identity.kind !== 'owner') return;
    if (id) await AsyncStorage.setItem(propertyKey(identity), id);
    else await AsyncStorage.removeItem(propertyKey(identity));
    setPropertyIdState(id);
  }, [identity]);

  const session = useMemo<Session | null>(() => {
    if (!ready) return null;
    const { db, engine } = ready;
    return {
      identity,
      db,
      repo: { db, userId: identity.userId, role: identity.kind, now: () => new Date(), newId: () => Crypto.randomUUID() },
      propertyId,
      setPropertyId,
      version,
      syncStatus,
      runSync: () => engine.run(),
      afterWrite: () => {
        setVersion((v) => v + 1);
        engine.runSoon();
      },
      logout: async () => {
        loggingOut.current = true;
        await authService.logout();
        onLoggedOutRef.current('user');
      },
    };
  }, [ready, identity, propertyId, setPropertyId, version, syncStatus]);

  if (!session) return <Loading />;
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
```

```ts
// mobile-chukta/src/app/routes.ts
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { MoneyKind } from '../view/moneyHistory';

export type RootStackParamList = {
  Tabs: undefined;
  Language: undefined;
  Properties: undefined;
  PropertyForm: { propertyId?: string } | undefined;
  WorkerDetail: { workerId: string };
  WorkerForm: { workerId?: string } | undefined;
  MoneyEntry: { workerId: string; kind: MoneyKind };
  StaffForm: { staffId?: string } | undefined;
  SyncIssues: undefined;
};
export type TabParamList = { Today: undefined; Workers: undefined; Advances: undefined; Settings: undefined };

/** Stack navigation from any screen (tab screens bubble stack routes up to the root stack). */
export const useStackNav = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();
```

```tsx
// mobile-chukta/src/app/navigation.tsx
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useT } from '../i18n/useT';
import { LanguageRoute } from '../screens/LanguageScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { colors } from '../ui/theme';
import type { RootStackParamList, TabParamList } from './routes';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: string; size: number }) => <Ionicons name={name} color={color} size={size} />;

function Tabs() {
  const t = useT();
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: colors.primary }}>
      {/* TABS */}
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline') }} />
    </Tab.Navigator>
  );
}

export function SessionNavigator() {
  const t = useT();
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="Tabs">
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen name="Language" component={LanguageRoute} options={{ title: t('language.title') }} />
        {/* ROUTES */}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

- [ ] **Step 4: Create the Language, Login and Settings screens and the app root**

```tsx
// mobile-chukta/src/screens/LanguageScreen.tsx
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setLanguage, type Language } from '../i18n';
import { useT } from '../i18n/useT';
import { Button, Screen, Title } from '../ui/components';
import { colors } from '../ui/theme';

const LANGUAGES: Language[] = ['en', 'bn', 'hi'];

export function LanguageScreen({ onChosen }: { onChosen: (lang: Language) => void | Promise<void> }) {
  const t = useT();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>{t('language.title')}</Title>
        {LANGUAGES.map((l) => (
          <Button key={l} kind="secondary" title={t(`language.${l}`)} onPress={() => void onChosen(l)} testID={`lang-${l}`} />
        ))}
      </Screen>
    </SafeAreaView>
  );
}

/** In-session route (Settings → Language). */
export function LanguageRoute() {
  const navigation = useNavigation();
  return <LanguageScreen onChosen={async (l) => { await setLanguage(l); navigation.goBack(); }} />;
}
```

```tsx
// mobile-chukta/src/screens/LoginScreen.tsx
import { useState } from 'react';
import { Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authService } from '../app/services';
import { AuthError, type AuthErrorKey } from '../auth/authService';
import type { Identity } from '../auth/identity';
import { FORGOT_PASSWORD_URL, REGISTER_URL } from '../config';
import { useT } from '../i18n/useT';
import { Button, ErrorText, Field, Muted, Screen, Segmented, Title } from '../ui/components';
import { colors } from '../ui/theme';

type Mode = 'owner' | 'staff';

export function LoginScreen({ notice, onLoggedIn }: { notice: string | null; onLoggedIn: (identity: Identity) => void }) {
  const t = useT();
  const [mode, setMode] = useState<Mode>('owner');
  const [phone, setPhone] = useState('');
  const [secret, setSecret] = useState('');
  const [error, setError] = useState<AuthErrorKey | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^\d{10}$/.test(phone) && (mode === 'owner' ? secret.length > 0 : /^\d{4,6}$/.test(secret));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const identity = mode === 'owner' ? await authService.loginOwner(phone, secret) : await authService.loginStaff(phone, secret);
      onLoggedIn(identity);
    } catch (e) {
      setError(e instanceof AuthError ? e.key : 'auth.error.unknown');
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <Screen>
        <Title>{t('common.appName')}</Title>
        {notice ? <Muted>{t(notice)}</Muted> : null}
        <Segmented
          options={[{ value: 'owner' as Mode, label: t('auth.login.owner') }, { value: 'staff' as Mode, label: t('auth.login.staff') }]}
          value={mode}
          onChange={(m) => { setMode(m); setSecret(''); setError(null); }}
          testIDPrefix="mode"
        />
        <Field label={t(mode === 'owner' ? 'auth.login.phone' : 'auth.login.ownerPhone')} value={phone}
          onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} keyboardType="phone-pad" testID="phone" />
        {mode === 'owner' ? (
          <Field label={t('auth.login.password')} value={secret} onChangeText={setSecret} secureTextEntry autoCapitalize="none" testID="secret" />
        ) : (
          <Field label={t('auth.login.pin')} value={secret} onChangeText={(v) => setSecret(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" secureTextEntry testID="secret" />
        )}
        <ErrorText>{error ? t(error) : null}</ErrorText>
        <Button title={t('auth.login.submit')} onPress={() => void submit()} disabled={!valid} loading={busy} testID="submit" />
        {mode === 'owner' ? (
          <>
            <Button kind="secondary" title={t('auth.login.forgot')} onPress={() => void Linking.openURL(FORGOT_PASSWORD_URL)} testID="forgot" />
            <Button kind="secondary" title={t('auth.login.register')} onPress={() => void Linking.openURL(REGISTER_URL)} testID="register" />
          </>
        ) : null}
      </Screen>
    </SafeAreaView>
  );
}
```

```tsx
// mobile-chukta/src/screens/SettingsScreen.tsx
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { useStackNav } from '../app/routes';
import { useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { Button, Muted, Row, Screen, Section } from '../ui/components';
import { formatTime } from '../utils/format';

export function SettingsScreen() {
  const t = useT();
  const { i18n } = useTranslation();
  const session = useSession();
  const navigation = useStackNav();
  const { identity, syncStatus } = session;

  const confirmLogout = () => {
    if (syncStatus.pending === 0) {
      void session.logout();
      return;
    }
    Alert.alert(t('settings.logout'), t('settings.logoutConfirm', { count: syncStatus.pending }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logout'), style: 'destructive', onPress: () => void session.logout() },
    ]);
  };
  const who = identity.kind === 'owner' ? t('settings.ownerAccount', { phone: identity.phone }) : identity.staffName;
  const syncLine = syncStatus.running
    ? t('settings.syncing')
    : syncStatus.lastSyncedAt ? t('settings.lastSync', { time: formatTime(syncStatus.lastSyncedAt) }) : t('settings.neverSynced');

  return (
    <Screen>
      <Muted>{t('settings.loggedInAs', { name: who })}</Muted>
      {/* SECTIONS */}
      <Section title={t('settings.sync')}>
        <Muted testID="sync-line">{syncLine}</Muted>
        {syncStatus.pending > 0 ? <Muted>{t('settings.pending', { count: syncStatus.pending })}</Muted> : null}
        {/* SYNC-ISSUES */}
        <Button kind="secondary" title={t('settings.syncNow')} onPress={() => void session.runSync()} loading={syncStatus.running} testID="sync-now" />
      </Section>
      <Section title={t('settings.language')}>
        <Row title={t(`language.${i18n.language}`)} onPress={() => navigation.navigate('Language')} testID="language" />
      </Section>
      <Button kind="danger" title={t('settings.logout')} onPress={confirmLogout} testID="logout" />
    </Screen>
  );
}
```

```tsx
// mobile-chukta/src/app/AppRoot.tsx
import { getLocales } from 'expo-localization';
import { useCallback, useEffect, useState } from 'react';
import type { Identity } from '../auth/identity';
import { getStoredLanguage, initI18n, setLanguage, type Language } from '../i18n';
import { LanguageScreen } from '../screens/LanguageScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { Loading } from '../ui/components';
import { SessionNavigator } from './navigation';
import { authService } from './services';
import { SessionProvider, type LogoutReason } from './SessionProvider';

function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return code === 'bn' || code === 'hi' ? code : 'en';
}

type Phase =
  | { name: 'boot' }
  | { name: 'language' }
  | { name: 'login'; notice: string | null }
  | { name: 'session'; identity: Identity };

export default function AppRoot() {
  const [phase, setPhase] = useState<Phase>({ name: 'boot' });

  const restore = useCallback(async () => {
    const identity = await authService.restore();
    setPhase(identity ? { name: 'session', identity } : { name: 'login', notice: null });
  }, []);

  useEffect(() => {
    (async () => {
      const lang = await getStoredLanguage();
      if (!lang) {
        await initI18n(deviceLanguage());
        setPhase({ name: 'language' });
        return;
      }
      await initI18n(lang);
      await restore();
    })().catch(() => setPhase({ name: 'login', notice: null }));
  }, [restore]);

  const onLoggedOut = useCallback((reason: LogoutReason) => {
    void (async () => {
      // A revoked session leaves the identity and stored tokens behind; clear them. A user logout already did.
      if (reason === 'revoked') await authService.logout();
      setPhase({ name: 'login', notice: reason === 'revoked' ? 'auth.login.sessionEnded' : null });
    })();
  }, []);

  switch (phase.name) {
    case 'boot':
      return <Loading />;
    case 'language':
      return <LanguageScreen onChosen={async (l) => { await setLanguage(l); await restore(); }} />;
    case 'login':
      return <LoginScreen notice={phase.notice} onLoggedIn={(identity) => setPhase({ name: 'session', identity })} />;
    case 'session':
      return (
        <SessionProvider key={phase.identity.userId} identity={phase.identity} onLoggedOut={onLoggedOut}>
          <SessionNavigator />
        </SessionProvider>
      );
  }
}
```

Replace `mobile-chukta/App.tsx` with:

```tsx
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppRoot from './src/app/AppRoot';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppRoot />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 5: Create the test helpers**

```tsx
// mobile-chukta/src/__tests__/helpers/session.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { render } from '@testing-library/react-native';
import type { ComponentType } from 'react';
import { Text } from 'react-native';
import type { RootStackParamList } from '../../app/routes';
import { SessionContext, type Session } from '../../app/session';
import type { Identity } from '../../auth/identity';
import { migrate } from '../../db/schema';
import { openTestDb } from '../../db/testing/betterSqliteDb';
import { IDLE_STATUS } from '../../sync/engine';

export const OWNER: Identity = { kind: 'owner', userId: 'u1', shopId: 'shop1', phone: '+919800000001' };
export const STAFF: Identity = { kind: 'staff', userId: 'u2', staffId: 'st1', staffName: 'Mgr', propertyId: 'p1', propertyName: 'Main' };

export const ALL_ROUTES: (keyof RootStackParamList)[] = [
  'Tabs', 'Language', 'Properties', 'PropertyForm', 'WorkerDetail', 'WorkerForm', 'MoneyEntry', 'StaffForm', 'SyncIssues',
];

/** A real SQLite-backed session (in memory) with jest.fn() side effects. "Today" is 2026-09-07 (a Monday). */
export async function makeSession(identity: Identity = OWNER, over: Partial<Session> = {}): Promise<Session> {
  const db = openTestDb();
  await migrate(db);
  let n = 0;
  return {
    identity,
    db,
    repo: {
      db, userId: identity.userId, role: identity.kind, now: () => new Date(2026, 8, 7, 10, 0),
      newId: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    },
    propertyId: identity.kind === 'staff' ? identity.propertyId : 'p1',
    setPropertyId: jest.fn(async () => {}),
    version: 0,
    syncStatus: IDLE_STATUS,
    runSync: jest.fn(async () => {}),
    afterWrite: jest.fn(),
    logout: jest.fn(async () => {}),
    ...over,
  };
}

function Blank({ route }: { route: { name: string } }) {
  return <Text testID="current-route">{route.name}</Text>;
}

/** Renders one screen under its real route name; every other route is a stub that shows its name (testID "current-route"). */
export function renderScreen(name: keyof RootStackParamList, Screen: ComponentType<any>, session: Session, params?: object) {
  const Stack = createNativeStackNavigator();
  const tree = (s: Session) => (
    <SessionContext.Provider value={s}>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={name}>
          {ALL_ROUTES.map((r) => (
            <Stack.Screen key={r} name={r} component={r === name ? Screen : Blank} initialParams={r === name ? params : undefined} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>
    </SessionContext.Provider>
  );
  const utils = render(tree(session));
  return { ...utils, rerenderWith: (s: Session) => utils.rerender(tree(s)) };
}
```

- [ ] **Step 6: Write the screen tests**

```tsx
// mobile-chukta/src/__tests__/login.test.tsx
jest.mock('../app/services', () => ({ authService: { loginOwner: jest.fn(), loginStaff: jest.fn() }, staffApi: {} }));

import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { authService } from '../app/services';
import { AuthError } from '../auth/authService';
import { initI18n } from '../i18n';
import { LoginScreen } from '../screens/LoginScreen';

const mocked = authService as jest.Mocked<typeof authService>;
beforeAll(() => initI18n('en'));
beforeEach(() => jest.clearAllMocks());

test('owner login hands the identity up', async () => {
  const identity = { kind: 'owner' as const, userId: 'u', shopId: 's', phone: '+919800000001' };
  mocked.loginOwner.mockResolvedValue(identity);
  const onLoggedIn = jest.fn();
  render(<LoginScreen notice={null} onLoggedIn={onLoggedIn} />);
  fireEvent.changeText(screen.getByTestId('phone'), '98000 00001');
  fireEvent.changeText(screen.getByTestId('secret'), 'secret1');
  fireEvent.press(screen.getByTestId('submit'));
  await waitFor(() => expect(onLoggedIn).toHaveBeenCalledWith(identity));
  expect(mocked.loginOwner).toHaveBeenCalledWith('9800000001', 'secret1');
});

test('staff mode sends the owner phone + digits-only PIN and shows the mapped error', async () => {
  mocked.loginStaff.mockRejectedValue(new AuthError('auth.error.tooManyAttempts'));
  render(<LoginScreen notice={null} onLoggedIn={jest.fn()} />);
  fireEvent.press(screen.getByTestId('mode-staff'));
  fireEvent.changeText(screen.getByTestId('phone'), '9800000001');
  fireEvent.changeText(screen.getByTestId('secret'), '48a21');
  fireEvent.press(screen.getByTestId('submit'));
  expect(await screen.findByText(/ask the owner to unlock it in Settings/)).toBeTruthy();
  expect(mocked.loginStaff).toHaveBeenCalledWith('9800000001', '4821');
  expect(screen.queryByTestId('register')).toBeNull();
});

test('shows the logout notice; submit disabled until the phone has 10 digits', () => {
  render(<LoginScreen notice="auth.login.sessionEnded" onLoggedIn={jest.fn()} />);
  expect(screen.getByText('You were logged out. Please log in again.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('phone'), '98000');
  fireEvent.changeText(screen.getByTestId('secret'), 'x');
  expect(screen.getByTestId('submit').props.accessibilityState.disabled).toBe(true);
});
```

```tsx
// mobile-chukta/src/__tests__/settings.test.tsx
// SettingsScreen gains a section that imports the Supabase-backed services (Task 15); keep tests off the network client.
jest.mock('../app/services', () => ({ authService: {}, staffApi: {} }));

import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { SettingsScreen } from '../screens/SettingsScreen';
import { IDLE_STATUS } from '../sync/engine';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

test('logout asks first when entries are still waiting to sync', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const s = await makeSession(OWNER, { syncStatus: { ...IDLE_STATUS, pending: 2 } });
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('logout'));
  expect(alert).toHaveBeenCalledWith('Log out', expect.stringContaining('2 entries'), expect.any(Array));
  expect(s.logout).not.toHaveBeenCalled();
});

test('logout goes straight through when nothing is pending; sync now runs a sync', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('sync-now'));
  expect(s.runSync).toHaveBeenCalled();
  fireEvent.press(screen.getByTestId('logout'));
  expect(s.logout).toHaveBeenCalled();
});

test('shows who is logged in and the last sync time', async () => {
  const s = await makeSession(STAFF, { syncStatus: { ...IDLE_STATUS, lastSyncedAt: new Date(2026, 8, 7, 9, 5).toISOString() } });
  renderScreen('Tabs', SettingsScreen, s);
  expect(await screen.findByText('Logged in as Mgr')).toBeTruthy();
  expect(screen.getByTestId('sync-line').props.children).toBe('Last synced 09:05');
});

test('language row opens the Language route', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('language'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('Language');
});
```

- [ ] **Step 7: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: all suites PASS, with no type errors.

If a navigation test fails with a `react-native-screens` native-module error, add `jest.mock('react-native-screens', () => ({ ...jest.requireActual('react-native-screens'), enableScreens: jest.fn() }));` to `jest.setup.ts` and re-run.

- [ ] **Step 8: Smoke-run the app**

Run: `cd mobile-chukta && npx expo start`, then open the app in Expo Go (SDK 54) on an Android phone. Every native module used here ships in Expo Go; the real dev build is made in Task 16.

Expected:
- the language screen appears on first launch;
- after choosing, the login screen appears;
- owner login with a real Chukta account shows the Settings tab and "Last synced HH:MM".

- [ ] **Step 9: Commit**

```bash
git add mobile-chukta/package.json mobile-chukta/package-lock.json mobile-chukta/jest.config.js mobile-chukta/jest.setup.ts mobile-chukta/eas.json mobile-chukta/App.tsx mobile-chukta/src/i18n/useT.ts mobile-chukta/src/ui mobile-chukta/src/app mobile-chukta/src/screens mobile-chukta/src/__tests__
git commit -m "feat(chukta): app shell with session, sync wiring, navigation, language and login screens"
```

---

### Task 11: Properties (switcher, create/edit defaults, archive/restore)

**Files:**
- Create: `mobile-chukta/src/screens/PropertiesScreen.tsx`, `mobile-chukta/src/screens/PropertyFormScreen.tsx`, `mobile-chukta/src/screens/settings/PropertySection.tsx`, `mobile-chukta/src/ui/RequireProperty.tsx`
- Modify: `mobile-chukta/src/app/navigation.tsx`, `mobile-chukta/src/screens/SettingsScreen.tsx`
- Test: `mobile-chukta/src/__tests__/properties.test.tsx`

**Interfaces:**
- Consumes:
  - `listAllProperties` (Task 6);
  - `createProperty`, `updatePropertySettings`, `getProperty` (1A);
  - `validatePropertyForm`, `propertyToFormValues` (Task 9);
  - the Task 10 kit.
- Produces:
  - `RequireProperty({ children: (p: Property) => ReactNode })`, used by the Today, Workers and Advances screens;
  - routes `Properties` and `PropertyForm`;
  - an owner with no chosen property starts on `Properties`, and exactly one active property is chosen automatically.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/properties.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { PropertiesScreen } from '../screens/PropertiesScreen';
import { PropertyFormScreen } from '../screens/PropertyFormScreen';
import { property } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen } from './helpers/session';

beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

test('owner picks a property from the list', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  await upsertLocal(s.db, 'properties', property({ id: 'p1', name: 'Hotel' }));
  await upsertLocal(s.db, 'properties', property({ id: 'p2', name: 'Farm' }));
  renderScreen('Properties', PropertiesScreen, s);
  fireEvent.press(await screen.findByTestId('property-p2'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalledWith('p2'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('Tabs');
});

test('a single active property is chosen automatically', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  await upsertLocal(s.db, 'properties', property({ id: 'p1' }));
  await upsertLocal(s.db, 'properties', property({ id: 'p9', name: 'Old', is_active: 0 }));
  renderScreen('Properties', PropertiesScreen, s);
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalledWith('p1'));
});

test('restoring an archived property warns about new staff PINs, then reactivates it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, message, buttons) => {
    expect(message).toMatch(/new PIN/);
    void buttons?.[1]?.onPress?.();
  });
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property({ id: 'p1' }));
  await upsertLocal(s.db, 'properties', property({ id: 'p9', name: 'Old', is_active: 0 }));
  renderScreen('Properties', PropertiesScreen, s);
  fireEvent.press(await screen.findByTestId('restore-p9'));
  await waitFor(async () => expect((await s.db.getFirstAsync<{ is_active: number }>("select is_active from properties where id = 'p9'"))?.is_active).toBe(1));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('new property: created with the chosen defaults and selected when it is the first', async () => {
  const s = await makeSession(OWNER, { propertyId: null });
  renderScreen('PropertyForm', PropertyFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'Hotel');
  fireEvent.press(screen.getByTestId('weekday-5'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalled());
  const row = await s.db.getFirstAsync<{ name: string; weekly_off: number; shop_id: string }>('select name, weekly_off, shop_id from properties');
  expect(row).toEqual({ name: 'Hotel', weekly_off: 5, shop_id: 'shop1' });
  const ops = await s.db.getAllAsync<{ op: string }>('select op from sync_queue order by seq');
  expect(ops.map((o) => o.op)).toEqual(['insert', 'update']);
});

test('property form shows validation errors', async () => {
  const s = await makeSession(OWNER);
  renderScreen('PropertyForm', PropertyFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('shift'), '0');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Enter a property name.')).toBeTruthy();
  expect(screen.getByText('Shift hours must be more than 0 and at most 24.')).toBeTruthy();
});

test('archiving the current property clears the selection and returns to Properties', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { void buttons?.[1]?.onPress?.(); });
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property({ id: 'p1' }));
  renderScreen('PropertyForm', PropertyFormScreen, s, { propertyId: 'p1' });
  fireEvent.press(await screen.findByTestId('archive'));
  await waitFor(() => expect(s.setPropertyId).toHaveBeenCalledWith(null));
  expect((await s.db.getFirstAsync<{ is_active: number }>("select is_active from properties where id = 'p1'"))?.is_active).toBe(0);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/properties.test.tsx`
Expected: FAIL, "Cannot find module '../screens/PropertiesScreen'".

- [ ] **Step 3: Implement**

```tsx
// mobile-chukta/src/ui/RequireProperty.tsx
import type { ReactNode } from 'react';
import { useStackNav } from '../app/routes';
import { useCurrentProperty, useSession } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { Button, Loading, Muted, Screen } from './components';

/** Renders children with the current property, or a prompt: the owner chooses one, staff wait for the first sync. */
export function RequireProperty({ children }: { children: (property: Property) => ReactNode }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { property, loading } = useCurrentProperty();
  if (property) return <>{children(property)}</>;
  if (loading) return <Loading />;
  const owner = session.identity.kind === 'owner';
  return (
    <Screen>
      <Muted>{owner ? t('properties.choose') : t('properties.waitingForSync')}</Muted>
      {owner ? <Button title={t('properties.switch')} onPress={() => navigation.navigate('Properties')} testID="choose-property" /> : null}
    </Screen>
  );
}
```

```tsx
// mobile-chukta/src/screens/PropertiesScreen.tsx
import { useCallback, useEffect } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { useStackNav } from '../app/routes';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { listAllProperties, updatePropertySettings } from '../repos/properties';
import { Button, Loading, Muted, Row, Screen, Section } from '../ui/components';

export function PropertiesScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { data } = useLocalData((s) => listAllProperties(s.db));
  const active = (data ?? []).filter((p) => p.is_active === 1);
  const archived = (data ?? []).filter((p) => p.is_active === 0);

  const choose = useCallback(async (id: string) => {
    await session.setPropertyId(id);
    navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
  }, [session, navigation]);

  const onlyId = active.length === 1 ? active[0].id : null;
  useEffect(() => {
    if (!session.propertyId && onlyId) void choose(onlyId);
  }, [session.propertyId, onlyId, choose]);

  const restore = (id: string) => Alert.alert(t('properties.restore'), t('properties.restoreNote'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('properties.restore'),
      onPress: async () => {
        await updatePropertySettings(session.repo, id, { is_active: 1 });
        session.afterWrite();
      },
    },
  ]);

  if (data === undefined) return <Loading />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      {data.length === 0 ? <Muted>{session.syncStatus.lastSyncedAt ? t('properties.empty') : t('properties.waitingForSync')}</Muted> : null}
      {active.map((p) => (
        <Row key={p.id} title={p.name} subtitle={p.address ?? undefined} selected={p.id === session.propertyId}
          onPress={() => void choose(p.id)} testID={`property-${p.id}`} />
      ))}
      <Button title={t('properties.add')} onPress={() => navigation.navigate('PropertyForm')} testID="add-property" />
      {archived.length > 0 ? (
        <Section title={t('properties.archived')}>
          {archived.map((p) => (
            <Row key={p.id} title={p.name}
              right={<Button kind="secondary" title={t('properties.restore')} onPress={() => restore(p.id)} testID={`restore-${p.id}`} />} />
          ))}
        </Section>
      ) : null}
    </Screen>
  );
}
```

```tsx
// mobile-chukta/src/screens/PropertyFormScreen.tsx
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useLayoutEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { createProperty, getProperty, updatePropertySettings } from '../repos/properties';
import { Button, Field, Label, Loading, Screen, Section, Segmented, WeekdayPicker } from '../ui/components';
import { ATTENDANCE_MODES, DIVISORS, PAY_BASES } from '../ui/options';
import { propertyToFormValues, validatePropertyForm, type FieldErrors, type PropertyFormValues } from '../view/forms';

export function PropertyFormScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'PropertyForm'>>();
  const editingId = params?.propertyId ?? null;
  const { data: existing } = useLocalData((s) => (editingId ? getProperty(s.db, editingId) : Promise.resolve(null)), [editingId]);
  const [values, setValues] = useState<PropertyFormValues | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (values === null && existing !== undefined) setValues(propertyToFormValues(existing));
  }, [existing, values]);
  useLayoutEffect(() => {
    navigation.setOptions({ title: t(editingId ? 'properties.edit' : 'properties.add') });
  }, [navigation, editingId, t]);

  if (!values) return <Loading />;
  const set = (patch: Partial<PropertyFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function save() {
    const r = validatePropertyForm(values!);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setBusy(true);
    if (editingId) {
      await updatePropertySettings(session.repo, editingId, r.value);
      session.afterWrite();
      navigation.goBack();
      return;
    }
    if (session.identity.kind !== 'owner') return;
    const p = await createProperty(session.repo, { shopId: session.identity.shopId, name: r.value.name, address: r.value.address ?? undefined });
    await updatePropertySettings(session.repo, p.id, r.value);
    session.afterWrite();
    if (!session.propertyId) {
      await session.setPropertyId(p.id);
      navigation.reset({ index: 0, routes: [{ name: 'Tabs' }] });
    } else {
      navigation.goBack();
    }
  }

  function archive() {
    Alert.alert(t('properties.archive'), t('properties.archiveConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('properties.archive'),
        style: 'destructive',
        onPress: async () => {
          await updatePropertySettings(session.repo, editingId as string, { is_active: 0 });
          session.afterWrite();
          if (session.propertyId === editingId) {
            await session.setPropertyId(null);
            navigation.reset({ index: 0, routes: [{ name: 'Properties' }] });
          } else {
            navigation.goBack();
          }
        },
      },
    ]);
  }

  return (
    <Screen>
      <Field label={t('properties.name')} value={values.name} onChangeText={(name) => set({ name })} error={err('name')} testID="name" />
      <Field label={t('properties.address')} value={values.address} onChangeText={(address) => set({ address })} testID="address" />
      <Section title={t('properties.defaults')}>
        <Label>{t('fields.payBasis')}</Label>
        <Segmented options={PAY_BASES.map((b) => ({ value: b, label: t(`payBasis.${b}`) }))} value={values.defaultPayBasis}
          onChange={(defaultPayBasis) => set({ defaultPayBasis })} testIDPrefix="basis" />
        <Label>{t('fields.attendanceMode')}</Label>
        <Segmented options={ATTENDANCE_MODES.map((m) => ({ value: m, label: t(`attendanceMode.${m}`) }))} value={values.defaultAttendanceMode}
          onChange={(defaultAttendanceMode) => set({ defaultAttendanceMode })} testIDPrefix="mode" />
        <Field label={t('fields.shiftHours')} value={values.shiftHours} onChangeText={(shiftHours) => set({ shiftHours })}
          keyboardType="decimal-pad" error={err('shiftHours')} testID="shift" />
        <Label>{t('fields.weeklyOff')}</Label>
        <WeekdayPicker value={values.weeklyOff} onChange={(weeklyOff) => set({ weeklyOff })} />
        <Label>{t('fields.monthlyDivisor')}</Label>
        <Segmented options={DIVISORS.map((d) => ({ value: d, label: t(`divisor.${d}`) }))} value={values.monthlyDivisor}
          onChange={(monthlyDivisor) => set({ monthlyDivisor })} testIDPrefix="divisor" />
      </Section>
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
      {editingId && existing?.is_active === 1 ? <Button kind="danger" title={t('properties.archive')} onPress={archive} testID="archive" /> : null}
    </Screen>
  );
}
```

```tsx
// mobile-chukta/src/screens/settings/PropertySection.tsx
import { useStackNav } from '../../app/routes';
import { useCurrentProperty, useSession } from '../../app/session';
import { useT } from '../../i18n/useT';
import { Row, Section } from '../../ui/components';

export function PropertySection() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { property } = useCurrentProperty();
  const fallback = session.identity.kind === 'staff' ? session.identity.propertyName : '—';
  return (
    <Section title={t('settings.property')}>
      <Row title={property?.name ?? fallback} subtitle={property?.address ?? undefined} />
      {session.identity.kind === 'owner' ? (
        <>
          {property ? <Row title={t('properties.edit')} onPress={() => navigation.navigate('PropertyForm', { propertyId: property.id })} testID="edit-property" /> : null}
          <Row title={t('properties.switch')} onPress={() => navigation.navigate('Properties')} testID="switch-property" />
        </>
      ) : null}
    </Section>
  );
}
```

`SettingsScreen.tsx`:
- Add `import { PropertySection } from './settings/PropertySection';`.
- Replace `{/* SECTIONS */}` with:

```tsx
      <PropertySection />
      {/* SECTIONS */}
```

`navigation.tsx`:
- Add the imports `import { PropertiesScreen } from '../screens/PropertiesScreen';`, `import { PropertyFormScreen } from '../screens/PropertyFormScreen';` and `import { useSession } from './session';`.
- In `SessionNavigator`, add `const session = useSession();` and change the navigator to `<Stack.Navigator initialRouteName={session.identity.kind === 'owner' && !session.propertyId ? 'Properties' : 'Tabs'}>`.
- Replace `{/* ROUTES */}` with:

```tsx
        <Stack.Screen name="Properties" component={PropertiesScreen} options={{ title: t('properties.title') }} />
        <Stack.Screen name="PropertyForm" component={PropertyFormScreen} />
        {/* ROUTES */}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): property switcher, property settings, archive and restore"
```

---

### Task 12: Today screen (exception-only attendance, bulk marking)

**Files:**
- Create: `mobile-chukta/src/screens/TodayScreen.tsx`
- Modify: `mobile-chukta/src/app/navigation.tsx` (the Today tab comes first)
- Test: `mobile-chukta/src/__tests__/today.test.tsx`

**Interfaces:**
- Consumes:
  - `buildTodayRows` (Task 8);
  - `listWorkers`, `markAttendance` (1A);
  - `listAttendanceForDate` (Task 6);
  - `RequireProperty` (Task 11), `DateField` (Task 10).
- **Behaviour:**
  - The date defaults to today, and future dates are not selectable.
  - **Day mode:** one row per worker, with a Present / Half day / Absent control whose value is the effective status (no entry = Present).
  - **Hours mode:** Present / Absent plus an hours field with its own save button.
  - Weekly-off rows show "Weekly off" and cannot be marked.
  - Long-press selects rows; the bulk bar applies one status to every selected worker.
  - Writing the same status the day already has is skipped (no new row).
- **testIDs:**
  - `row-<workerId>`, `status-<workerId>-<status>`;
  - `hours-<workerId>`, `hours-save-<workerId>`;
  - `bulk-<status>`, `bulk-clear`, `today-date`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/today.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { TodayScreen } from '../screens/TodayScreen';
import { att, property, worker } from './helpers/fixtures';
import { makeSession, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

async function seeded() {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w2', name: 'Sita', pay_basis: 'hourly' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w3', name: 'Off', weekly_off_override: 1, weekly_off: 1 })); // Monday off
  return s;
}
const rowsFor = (s: Awaited<ReturnType<typeof seeded>>, id: string) =>
  s.db.getAllAsync<{ status: string; hours: number | null; date: string; created_by_role: string }>(
    'select status, hours, date, created_by_role from attendance_entries where worker_id = ? order by created_at, id', [id]);

test('marking a worker absent writes one entry for today as staff', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('status-w1-absent'));
  await waitFor(async () => expect(await rowsFor(s, 'w1')).toEqual([{ status: 'absent', hours: null, date: '2026-09-07', created_by_role: 'staff' }]));
  expect(s.afterWrite).toHaveBeenCalled();
});

test('pressing the status the day already has writes nothing', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.press(await screen.findByTestId('status-w1-present'));
  await new Promise((r) => setTimeout(r, 20));
  expect(await rowsFor(s, 'w1')).toEqual([]);
});

test('hours mode: valid hours are saved, invalid hours show an error', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent.changeText(await screen.findByTestId('hours-w2'), '30');
  fireEvent.press(screen.getByTestId('hours-save-w2'));
  expect(await screen.findByText('Enter hours between 0 and 24.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('hours-w2'), '5.5');
  fireEvent.press(screen.getByTestId('hours-save-w2'));
  await waitFor(async () => expect((await rowsFor(s, 'w2')).map((r) => [r.status, r.hours])).toEqual([['hours', 5.5]]));
});

test('weekly-off workers show Weekly off and have no controls', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  expect(await screen.findByText('Weekly off')).toBeTruthy();
  expect(screen.queryByTestId('status-w3-absent')).toBeNull();
});

test('bulk: long-press to select, then mark all selected half day', async () => {
  const s = await seeded();
  renderScreen('Tabs', TodayScreen, s);
  fireEvent(await screen.findByTestId('row-w1'), 'longPress');
  fireEvent(screen.getByTestId('row-w2'), 'longPress');
  expect(screen.getByText('2 selected')).toBeTruthy();
  fireEvent.press(screen.getByTestId('bulk-half_day'));
  await waitFor(async () => {
    expect((await rowsFor(s, 'w1')).map((r) => r.status)).toEqual(['half_day']);
    expect((await rowsFor(s, 'w2')).map((r) => r.status)).toEqual(['half_day']);
  });
});

test('shows the effective status (latest entry wins) after a reload', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-07', 'absent', { worker_id: 'w1', created_at: '2026-09-07T08:00:00Z' }));
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-07', 'half_day', { worker_id: 'w1', created_at: '2026-09-07T09:00:00Z' }));
  renderScreen('Tabs', TodayScreen, s);
  await waitFor(() => expect(screen.getByTestId('status-w1-half_day').props.accessibilityState.selected).toBe(true));
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/today.test.tsx`
Expected: FAIL, "Cannot find module '../screens/TodayScreen'".

- [ ] **Step 3: Implement**

```tsx
// mobile-chukta/src/screens/TodayScreen.tsx
import { useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { AttendanceStatus, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listAttendanceForDate, markAttendance } from '../repos/attendance';
import { listWorkers } from '../repos/workers';
import { Button, Card, ErrorText, Field, Loading, Muted, Row, Screen, Segmented } from '../ui/components';
import { DateField } from '../ui/DateField';
import { RequireProperty } from '../ui/RequireProperty';
import { space } from '../ui/theme';
import { buildTodayRows, type TodayRow } from '../view/today';

const DAY_STATUSES: AttendanceStatus[] = ['present', 'half_day', 'absent'];
const HOURS_STATUSES: AttendanceStatus[] = ['present', 'absent'];
const STATUS_KEY: Record<AttendanceStatus, string> = { present: 'today.present', half_day: 'today.halfDay', absent: 'today.absent', hours: 'today.hours' };

function parseHours(s: string): number | null {
  const v = s.trim();
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(v)) return null;
  const n = Number(v);
  return n >= 0 && n <= 24 ? n : null;
}

export function TodayScreen() {
  return <RequireProperty>{(p) => <TodayBody property={p} />}</RequireProperty>;
}

function TodayBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const today = sessionToday(session);
  const [date, setDate] = useState(today);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: rows } = useLocalData(
    async (s) => buildTodayRows(await listWorkers(s.db, property.id, true), property, await listAttendanceForDate(s.db, property.id, date), date),
    [property, date],
  );

  async function mark(workerIds: string[], status: AttendanceStatus, hours?: number) {
    let wrote = false;
    for (const id of workerIds) {
      const row = rows?.find((r) => r.worker.id === id);
      if (!row || row.isOff) continue;
      const cur = row.entry;
      const same = cur ? cur.status === status && (status !== 'hours' || cur.hours === hours) : status === 'present';
      if (same) continue;
      await markAttendance(session.repo, { propertyId: property.id, workerId: id, date, status, hours });
      wrote = true;
    }
    setSelected(new Set());
    if (wrote) session.afterWrite();
  }

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  if (!rows) return <Loading />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      <DateField label={t('today.title')} value={date} max={today} onChange={(d) => { setDate(d); setSelected(new Set()); }} testID="today-date" />
      <Muted>{t('today.hint')}</Muted>
      {rows.length === 0 ? <Muted>{t('today.noWorkers')}</Muted> : <Muted>{t('today.selectHint')}</Muted>}
      {selected.size > 0 ? (
        <Card>
          <Muted>{t('today.selected', { count: selected.size })}</Muted>
          <Segmented options={DAY_STATUSES.map((st) => ({ value: st, label: t(STATUS_KEY[st]) }))} value={null}
            onChange={(st) => void mark([...selected], st)} testIDPrefix="bulk" />
          <Button kind="secondary" title={t('today.clearSelection')} onPress={() => setSelected(new Set())} testID="bulk-clear" />
        </Card>
      ) : null}
      {rows.map((row) => (
        <AttendanceRow key={row.worker.id} row={row} selected={selected.has(row.worker.id)} onToggle={() => toggle(row.worker.id)}
          onMark={(st, h) => void mark([row.worker.id], st, h)} />
      ))}
    </Screen>
  );
}

function AttendanceRow({ row, selected, onToggle, onMark }: {
  row: TodayRow; selected: boolean; onToggle: () => void; onMark: (status: AttendanceStatus, hours?: number) => void;
}) {
  const t = useT();
  const id = row.worker.id;
  const [hoursText, setHoursText] = useState(row.entry?.status === 'hours' ? String(row.entry.hours) : '');
  const [hoursError, setHoursError] = useState(false);
  const current: AttendanceStatus | null = row.entry ? row.entry.status : 'present';
  const hoursMode = row.settings.attendanceMode === 'hours';
  const subtitle = row.isOff
    ? t('today.weeklyOff')
    : row.entry?.status === 'hours' ? t('today.hoursValue', { hours: row.entry.hours }) : undefined;

  const saveHours = () => {
    const h = parseHours(hoursText);
    setHoursError(h === null);
    if (h !== null) onMark('hours', h);
  };

  return (
    <Card>
      <Row title={row.worker.name} subtitle={subtitle} selected={selected} onLongPress={row.isOff ? undefined : onToggle}
        onPress={selected ? onToggle : undefined} testID={`row-${id}`} />
      {row.isOff ? null : (
        <>
          <Segmented options={(hoursMode ? HOURS_STATUSES : DAY_STATUSES).map((st) => ({ value: st, label: t(STATUS_KEY[st]) }))}
            value={current === 'hours' ? null : current} onChange={(st) => onMark(st)} testIDPrefix={`status-${id}`} />
          {hoursMode ? (
            <View style={styles.hours}>
              <View style={styles.hoursInput}>
                <Field label={t('today.hoursPrompt')} value={hoursText} onChangeText={setHoursText} keyboardType="decimal-pad"
                  placeholder={String(row.settings.shiftHours)} testID={`hours-${id}`} />
              </View>
              <Button kind="secondary" title={t('common.save')} onPress={saveHours} testID={`hours-save-${id}`} />
            </View>
          ) : null}
          <ErrorText>{hoursError ? t('today.hoursInvalid') : null}</ErrorText>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hours: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  hoursInput: { flex: 1 },
});
```

`navigation.tsx`: add `import { TodayScreen } from '../screens/TodayScreen';` and replace `{/* TABS */}` with:

```tsx
      <Tab.Screen name="Today" component={TodayScreen} options={{ title: t('tabs.today'), tabBarIcon: icon('calendar-outline') }} />
      {/* TABS */}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): Today attendance screen with day/hours modes and bulk marking"
```

---

### Task 13: Workers list, worker detail and add/edit worker

**Files:**
- Create: `mobile-chukta/src/screens/WorkersScreen.tsx`, `mobile-chukta/src/screens/WorkerDetailScreen.tsx`, `mobile-chukta/src/screens/WorkerFormScreen.tsx`, `mobile-chukta/src/ui/MonthCalendar.tsx`
- Modify: `mobile-chukta/src/app/navigation.tsx` (the Workers tab after Today; routes `WorkerDetail` and `WorkerForm`)
- Test: `mobile-chukta/src/__tests__/workers.test.tsx`

**Interfaces:**
- Consumes:
  - `listWorkerSummaries`, `getWorkerLedger`, `buildMonthGrid`, `shiftMonth`, `buildMoneyHistory` (Task 8);
  - the form helpers from Task 9;
  - `explanationText`, `formatDate`, `formatMonth` (Task 7);
  - `voidAdvance`, `voidPayment`, `createWorker`, `updateWorker`, `getWorker` (1A).
- Produces:
  - the `WorkerDetailScreen` marker `{/* MONEY-ACTIONS */}` (Task 14 fills it);
  - **testIDs:**
    - `worker-<id>`, `add-worker`, `show-left`, `edit-worker`;
    - `due`, `explain-toggle`;
    - `month-prev`, `month-next`, `day-<date>`;
    - `correct-<entryId>`;
    - worker form fields `name`, `phone`, `rate`, `overrides`, `own-weekly-off`, `has-left`, `save`.
- **Correct** (void) is shown to owners only, and only on entries that are neither voids nor already voided.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/workers.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { WorkerDetailScreen } from '../screens/WorkerDetailScreen';
import { WorkerFormScreen } from '../screens/WorkerFormScreen';
import { WorkersScreen } from '../screens/WorkersScreen';
import { adv, att, pay, property, worker } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

async function seeded(identity = OWNER) {
  const s = await makeSession(identity);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w2', name: 'Gone', status: 'left', left_date: '2026-09-03' }));
  await upsertLocal(s.db, 'attendance_entries', att('2026-09-03', 'absent'));
  await upsertLocal(s.db, 'advance_entries', adv('a1'));
  await upsertLocal(s.db, 'wage_payments', pay('p1'));
  return s;
}

test('workers list shows wage due and advance; left workers only on request', async () => {
  const s = await seeded();
  renderScreen('Tabs', WorkersScreen, s);
  expect(await screen.findByText('Wage due ₹2,000')).toBeTruthy(); // 5 days × ₹500 − ₹500 paid
  expect(screen.getByText('Advance ₹1,000')).toBeTruthy();
  expect(screen.queryByTestId('worker-w2')).toBeNull();
  fireEvent(screen.getByTestId('show-left'), 'valueChange', true);
  expect(await screen.findByTestId('worker-w2')).toBeTruthy();
  fireEvent.press(screen.getByTestId('worker-w1'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('WorkerDetail');
});

test('worker detail: balances, explanation, calendar and history', async () => {
  const s = await seeded();
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  expect(await screen.findByTestId('due')).toHaveTextContent('₹2,000');
  fireEvent.press(screen.getByTestId('explain-toggle'));
  expect(screen.getByText('5 days × ₹500')).toBeTruthy();
  expect(screen.getByTestId('day-2026-09-03').props.accessibilityLabel).toMatch(/Absent/);
  // History rows (Task 14 adds buttons with the same labels, hence getAll).
  expect(screen.getAllByText('Advance').length).toBeGreaterThan(0);
  expect(screen.getAllByText('Wage payment').length).toBeGreaterThan(0);
});

test('owner corrects a payment: a void row is written and totals exclude it', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { void buttons?.[1]?.onPress?.(); });
  const s = await seeded();
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  fireEvent.press(await screen.findByTestId('correct-p1'));
  await waitFor(async () => {
    const rows = await s.db.getAllAsync<{ voids_id: string | null }>('select voids_id from wage_payments order by created_at');
    expect(rows.map((r) => r.voids_id)).toEqual([null, 'p1']);
  });
  expect(s.afterWrite).toHaveBeenCalled();
});

test('staff never see Correct', async () => {
  const s = await seeded(STAFF);
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  await screen.findByTestId('due');
  expect(screen.queryByTestId('correct-p1')).toBeNull();
});

test('add worker: validates, then writes a worker with property defaults as the base', async () => {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property({ default_pay_basis: 'monthly' }));
  renderScreen('WorkerForm', WorkerFormScreen, s);
  fireEvent.press(await screen.findByTestId('save'));
  expect(await screen.findByText('Enter a name.')).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('name'), 'Sita');
  fireEvent.changeText(screen.getByTestId('rate'), '15,000');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => {
    const w = await s.db.getFirstAsync<{ name: string; pay_basis: string; rate_paise: number; joining_date: string; weekly_off_override: number }>(
      'select name, pay_basis, rate_paise, joining_date, weekly_off_override from workers');
    expect(w).toEqual({ name: 'Sita', pay_basis: 'monthly', rate_paise: 1500000, joining_date: '2026-09-07', weekly_off_override: 0 });
  });
});

test('edit worker: mark as left sends an update patch', async () => {
  const s = await seeded();
  renderScreen('WorkerForm', WorkerFormScreen, s, { workerId: 'w1' });
  fireEvent(await screen.findByTestId('has-left'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => {
    const q = await s.db.getAllAsync<{ op: string; payload: string }>("select op, payload from sync_queue where op = 'update'");
    expect(JSON.parse(q[0].payload)).toMatchObject({ id: 'w1', status: 'left', left_date: '2026-09-07' });
  });
});
```

`toHaveTextContent` comes with `@testing-library/react-native` v12.4+/v13 matchers. If it is undefined, add `import '@testing-library/react-native/extend-expect';` as the first line of `jest.setup.ts`.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/workers.test.tsx`
Expected: FAIL, "Cannot find module '../screens/WorkerDetailScreen'".

- [ ] **Step 3: Implement the month calendar**

```tsx
// mobile-chukta/src/ui/MonthCalendar.tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useT } from '../i18n/useT';
import { formatMonth, weekdayName } from '../utils/format';
import type { DayCell, MonthGrid } from '../view/monthGrid';
import { colors, radius, space } from './theme';

function cellLabel(c: DayCell, t: (k: string, p?: Record<string, unknown>) => string): string {
  if (c.kind === 'off') return t('today.weeklyOff');
  if (c.kind !== 'working') return '';
  if (!c.entry || c.entry.status === 'present') return t('today.present');
  if (c.entry.status === 'hours') return t('today.hoursValue', { hours: c.entry.hours });
  return t(c.entry.status === 'absent' ? 'today.absent' : 'today.halfDay');
}

function cellColor(c: DayCell): string {
  if (c.kind === 'off') return colors.offSoft;
  if (c.kind !== 'working' || !c.entry) return colors.card;
  if (c.entry.status === 'absent') return colors.dangerSoft;
  if (c.entry.status === 'half_day') return colors.warnSoft;
  if (c.entry.status === 'hours') return colors.infoSoft;
  return colors.card;
}

export function MonthCalendar({ grid, onPrev, onNext }: { grid: MonthGrid; onPrev: () => void; onNext: () => void }) {
  const t = useT();
  const month = `${grid.year}-${String(grid.month).padStart(2, '0')}`;
  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={onPrev} accessibilityRole="button" accessibilityLabel={t('worker.prevMonth')} testID="month-prev"><Text style={styles.nav}>‹</Text></Pressable>
        <Text style={styles.title}>{formatMonth(month, t)}</Text>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={t('worker.nextMonth')} testID="month-next"><Text style={styles.nav}>›</Text></Pressable>
      </View>
      <View style={styles.grid}>
        {[0, 1, 2, 3, 4, 5, 6].map((d) => <Text key={`h${d}`} style={[styles.cell, styles.weekday]}>{weekdayName(d, t)}</Text>)}
        {Array.from({ length: grid.leadingBlanks }, (_, i) => <View key={`b${i}`} style={styles.cell} />)}
        {grid.cells.map((c) => (
          <View key={c.date} testID={`day-${c.date}`} accessibilityLabel={`${c.day} ${cellLabel(c, t)}`}
            style={[styles.cell, styles.day, { backgroundColor: cellColor(c) }, (c.kind === 'future' || c.kind === 'outside') && styles.faded]}>
            <Text style={styles.dayNum}>{c.day}</Text>
            {c.entry?.status === 'hours' ? <Text style={styles.small}>{c.entry.hours}h</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nav: { fontSize: 28, color: colors.primary, paddingHorizontal: space.md },
  title: { fontSize: 16, fontWeight: '600', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  weekday: { fontSize: 12, color: colors.muted, textAlign: 'center', aspectRatio: undefined, paddingVertical: space.xs },
  day: { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, borderRadius: radius / 2 },
  faded: { opacity: 0.35 },
  dayNum: { fontSize: 14, color: colors.text },
  small: { fontSize: 10, color: colors.muted },
});
```

- [ ] **Step 4: Implement the screens**

```tsx
// mobile-chukta/src/screens/WorkersScreen.tsx
import { useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { Button, Loading, Muted, Row, Screen, SwitchRow } from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { colors } from '../ui/theme';
import { formatRupees } from '../utils/money';
import { listWorkerSummaries } from '../view/ledgerQueries';

export function WorkersScreen() {
  return <RequireProperty>{(p) => <WorkersBody property={p} />}</RequireProperty>;
}

function WorkersBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const [showLeft, setShowLeft] = useState(false);
  const { data } = useLocalData((s) => listWorkerSummaries(s.db, property, sessionToday(s), showLeft), [property, showLeft]);
  if (!data) return <Loading />;
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      <Button title={t('workers.add')} onPress={() => navigation.navigate('WorkerForm')} testID="add-worker" />
      {data.length === 0 ? <Muted>{t('workers.empty')}</Muted> : null}
      {data.map(({ worker, ledger }) => {
        const due = ledger.wageDuePaise;
        return (
          <Row
            key={worker.id}
            testID={`worker-${worker.id}`}
            title={worker.status === 'left' ? `${worker.name} · ${t('workers.left')}` : worker.name}
            subtitle={`${formatRupees(worker.rate_paise)}${t(`rateSuffix.${worker.pay_basis}`)}`}
            onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })}
            right={
              <View style={styles.right}>
                <Text style={styles.due}>{due >= 0 ? `${t('workers.due')} ${formatRupees(due)}` : `${t('workers.overpaid')} ${formatRupees(-due)}`}</Text>
                {ledger.advanceOutstandingPaise > 0 ? <Text style={styles.adv}>{`${t('workers.advance')} ${formatRupees(ledger.advanceOutstandingPaise)}`}</Text> : null}
              </View>
            }
          />
        );
      })}
      <SwitchRow label={t('workers.showLeft')} value={showLeft} onChange={setShowLeft} testID="show-left" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  right: { alignItems: 'flex-end' },
  due: { fontSize: 15, fontWeight: '600', color: colors.text },
  adv: { fontSize: 13, color: colors.muted },
});
```

```tsx
// mobile-chukta/src/screens/WorkerDetailScreen.tsx
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useLayoutEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import { resolveSettings } from '../domain/settings';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { listAttendance } from '../repos/attendance';
import { listAdvances, listPayments, voidAdvance, voidPayment } from '../repos/money';
import { getWorker } from '../repos/workers';
import { Button, Card, Loading, Muted, Row, Screen, Section, Title } from '../ui/components';
import { MonthCalendar } from '../ui/MonthCalendar';
import { RequireProperty } from '../ui/RequireProperty';
import { colors, space } from '../ui/theme';
import { daysInMonth } from '../utils/dates';
import { explanationText, formatDate } from '../utils/format';
import { formatRupees } from '../utils/money';
import { getWorkerLedger } from '../view/ledgerQueries';
import { buildMoneyHistory, type HistoryItem } from '../view/moneyHistory';
import { buildMonthGrid, shiftMonth } from '../view/monthGrid';

const pad = (n: number) => n.toString().padStart(2, '0');

export function WorkerDetailScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'WorkerDetail'>>();
  return <RequireProperty>{(p) => <WorkerDetailBody property={p} workerId={params.workerId} />}</RequireProperty>;
}

function WorkerDetailBody({ property, workerId }: { property: Property; workerId: string }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const today = sessionToday(session);
  const [ym, setYm] = useState({ year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) });
  const [showExplain, setShowExplain] = useState(false);

  const { data } = useLocalData(async (s) => {
    const worker = await getWorker(s.db, workerId);
    if (!worker) return null;
    const from = `${ym.year}-${pad(ym.month)}-01`;
    const to = `${ym.year}-${pad(ym.month)}-${pad(daysInMonth(ym.year, ym.month))}`;
    const [ledger, attendance, advances, payments] = await Promise.all([
      getWorkerLedger(s.db, worker, property, today),
      listAttendance(s.db, worker.id, from, to),
      listAdvances(s.db, worker.id),
      listPayments(s.db, worker.id),
    ]);
    const grid = buildMonthGrid({
      year: ym.year, month: ym.month, settings: resolveSettings(worker, property), joiningDate: worker.joining_date,
      leftDate: worker.left_date, today, attendance,
    });
    return { worker, ledger, grid, history: buildMoneyHistory(advances, payments) };
  }, [property, workerId, ym.year, ym.month, today]);

  const worker = data?.worker ?? null;
  useLayoutEffect(() => {
    if (!worker) return;
    navigation.setOptions({
      title: worker.name,
      headerRight: () => (
        <Pressable testID="edit-worker" accessibilityRole="button" onPress={() => navigation.navigate('WorkerForm', { workerId })}>
          <Text style={styles.headerLink}>{t('common.edit')}</Text>
        </Pressable>
      ),
    });
  }, [worker, navigation, workerId, t]);

  const correct = (item: HistoryItem) => Alert.alert(t('worker.correct'), t('worker.correctConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('worker.correct'),
      style: 'destructive',
      onPress: async () => {
        if (item.table === 'advance_entries') await voidAdvance(session.repo, item.id);
        else await voidPayment(session.repo, item.id);
        session.afterWrite();
      },
    },
  ]);

  if (data === undefined) return <Loading />;
  if (data === null) return <Screen><Muted>{t('worker.notFound')}</Muted></Screen>;
  const { ledger, grid, history } = data;
  const due = ledger.wageDuePaise;
  const isOwner = session.identity.kind === 'owner';

  return (
    <Screen>
      <Card>
        <Muted>{due >= 0 ? t('worker.due') : t('workers.overpaid')}</Muted>
        <Title testID="due">{formatRupees(Math.abs(due))}</Title>
        <Muted>{`${t('worker.earned')} ${formatRupees(ledger.earnedPaise)} · ${t('worker.paid')} ${formatRupees(ledger.paidPaise)}`}</Muted>
        <Muted>{`${t('worker.advance')} ${formatRupees(ledger.advanceOutstandingPaise)}`}</Muted>
        <Muted>{t('worker.joined', { date: formatDate(data.worker.joining_date, t) })}</Muted>
        {data.worker.left_date ? <Muted>{t('worker.leftOn', { date: formatDate(data.worker.left_date, t) })}</Muted> : null}
        <Pressable onPress={() => setShowExplain(!showExplain)} accessibilityRole="button" testID="explain-toggle">
          <Text style={styles.link}>{t('worker.howCalculated')}</Text>
        </Pressable>
        {showExplain ? ledger.explanation.map((line, i) => <Text key={i} style={styles.explain}>{explanationText(line, t)}</Text>) : null}
      </Card>
      {/* MONEY-ACTIONS */}
      <Section title={t('worker.calendar')}>
        <MonthCalendar grid={grid} onPrev={() => setYm(shiftMonth(ym.year, ym.month, -1))} onNext={() => setYm(shiftMonth(ym.year, ym.month, 1))} />
      </Section>
      <Section title={t('worker.history')}>
        {history.length === 0 ? <Muted>{t('worker.noHistory')}</Muted> : null}
        {history.map((item) => (
          <Row
            key={item.id}
            title={t(`entryType.${item.kind}`)}
            subtitle={[
              formatDate(item.date, t),
              item.mode ? t(`mode.${item.mode}`) : null,
              item.isVoid ? t('worker.correction') : null,
              item.isVoided ? t('worker.cancelled') : null,
              item.note,
            ].filter(Boolean).join(' · ')}
            right={
              <View style={styles.historyRight}>
                <Text style={[styles.amount, (item.isVoided || item.isVoid) && styles.struck]}>{formatRupees(item.amountPaise)}</Text>
                {isOwner && item.canCorrect ? (
                  <Button kind="secondary" title={t('worker.correct')} onPress={() => correct(item)} testID={`correct-${item.id}`} />
                ) : null}
              </View>
            }
          />
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerLink: { color: colors.primary, fontSize: 16, fontWeight: '600' },
  link: { color: colors.primary, fontSize: 14, marginTop: space.xs },
  explain: { fontSize: 13, color: colors.text },
  historyRight: { alignItems: 'flex-end', gap: space.xs },
  amount: { fontSize: 15, fontWeight: '600', color: colors.text },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
});
```

```tsx
// mobile-chukta/src/screens/WorkerFormScreen.tsx
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useLayoutEffect, useState } from 'react';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { AttendanceMode, MonthlyDivisor, Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { createWorker, getWorker, updateWorker } from '../repos/workers';
import { Button, ErrorText, Field, Label, Loading, Screen, Section, Segmented, SwitchRow, WeekdayPicker } from '../ui/components';
import { DateField } from '../ui/DateField';
import { ATTENDANCE_MODES, DIVISORS, PAY_BASES } from '../ui/options';
import { RequireProperty } from '../ui/RequireProperty';
import {
  toNewWorker, toWorkerPatch, validateWorkerForm, workerToFormValues, type FieldErrors, type WorkerFormValues,
} from '../view/forms';

const DEFAULT = 'default';
const newWorkerValues = (p: Property, today: string): WorkerFormValues => ({
  name: '', phone: '', payBasis: p.default_pay_basis, rate: '', joiningDate: today, attendanceMode: null, shiftHours: '',
  weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null, hasLeft: false, leftDate: null,
});
const hasOverrides = (v: WorkerFormValues) => v.attendanceMode !== null || v.shiftHours !== '' || v.weeklyOffOverride || v.monthlyDivisor !== null;

export function WorkerFormScreen() {
  const { params } = useRoute<RouteProp<RootStackParamList, 'WorkerForm'>>();
  return <RequireProperty>{(p) => <WorkerFormBody property={p} workerId={params?.workerId ?? null} />}</RequireProperty>;
}

function WorkerFormBody({ property, workerId }: { property: Property; workerId: string | null }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const today = sessionToday(session);
  const { data: existing } = useLocalData((s) => (workerId ? getWorker(s.db, workerId) : Promise.resolve(null)), [workerId]);
  const [values, setValues] = useState<WorkerFormValues | null>(null);
  const [showOverrides, setShowOverrides] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (values !== null || existing === undefined) return;
    const v = existing ? workerToFormValues(existing) : newWorkerValues(property, today);
    setValues(v);
    setShowOverrides(hasOverrides(v));
  }, [existing, values, property, today]);
  useLayoutEffect(() => {
    navigation.setOptions({ title: t(workerId ? 'workerForm.titleEdit' : 'workerForm.titleNew') });
  }, [navigation, workerId, t]);

  if (!values) return <Loading />;
  const set = (patch: Partial<WorkerFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  const toggleOverrides = (on: boolean) => {
    setShowOverrides(on);
    if (!on) set({ attendanceMode: null, shiftHours: '', weeklyOffOverride: false, weeklyOff: null, monthlyDivisor: null });
  };

  async function save() {
    const r = validateWorkerForm(values!);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    setBusy(true);
    if (workerId) await updateWorker(session.repo, workerId, toWorkerPatch(r.value));
    else await createWorker(session.repo, toNewWorker(property.id, r.value));
    session.afterWrite();
    navigation.goBack();
  }

  const modeOptions = [
    { value: DEFAULT, label: `${t('workerForm.useDefault')} (${t(`attendanceMode.${property.default_attendance_mode}`)})` },
    ...ATTENDANCE_MODES.map((m) => ({ value: m as string, label: t(`attendanceMode.${m}`) })),
  ];
  const divisorOptions = [
    { value: DEFAULT, label: `${t('workerForm.useDefault')} (${t(`divisor.${property.monthly_divisor}`)})` },
    ...DIVISORS.map((d) => ({ value: d as string, label: t(`divisor.${d}`) })),
  ];

  return (
    <Screen>
      <Field label={t('workerForm.name')} value={values.name} onChangeText={(name) => set({ name })} error={err('name')} testID="name" />
      <Field label={t('workerForm.phone')} value={values.phone} onChangeText={(phone) => set({ phone: phone.replace(/\D/g, '').slice(0, 10) })}
        keyboardType="phone-pad" error={err('phone')} testID="phone" />
      <Label>{t('fields.payBasis')}</Label>
      <Segmented options={PAY_BASES.map((b) => ({ value: b, label: t(`payBasis.${b}`) }))} value={values.payBasis}
        onChange={(payBasis) => set({ payBasis })} testIDPrefix="basis" />
      <Field label={t(`rateLabel.${values.payBasis}`)} value={values.rate} onChangeText={(rate) => set({ rate })} keyboardType="decimal-pad"
        error={err('rate')} testID="rate" />
      <DateField label={t('workerForm.joiningDate')} value={values.joiningDate} onChange={(joiningDate) => set({ joiningDate })} testID="joining" />
      <SwitchRow label={t('workerForm.overrides')} value={showOverrides} onChange={toggleOverrides} testID="overrides" />
      {showOverrides ? (
        <Section title={t('workerForm.overrides')}>
          {values.payBasis !== 'hourly' ? (
            <>
              <Label>{t('fields.attendanceMode')}</Label>
              <Segmented options={modeOptions} value={values.attendanceMode ?? DEFAULT}
                onChange={(m) => set({ attendanceMode: m === DEFAULT ? null : (m as AttendanceMode) })} testIDPrefix="worker-mode" />
            </>
          ) : null}
          <Field label={t('fields.shiftHours')} value={values.shiftHours} onChangeText={(shiftHours) => set({ shiftHours })}
            placeholder={`${t('workerForm.useDefault')} (${property.shift_hours})`} keyboardType="decimal-pad" error={err('shiftHours')} testID="shift" />
          <SwitchRow label={t('workerForm.ownWeeklyOff')} value={values.weeklyOffOverride}
            onChange={(weeklyOffOverride) => set({ weeklyOffOverride, weeklyOff: weeklyOffOverride ? property.weekly_off : null })} testID="own-weekly-off" />
          {values.weeklyOffOverride ? <WeekdayPicker value={values.weeklyOff} onChange={(weeklyOff) => set({ weeklyOff })} /> : null}
          {values.payBasis === 'monthly' ? (
            <>
              <Label>{t('fields.monthlyDivisor')}</Label>
              <Segmented options={divisorOptions} value={values.monthlyDivisor ?? DEFAULT}
                onChange={(d) => set({ monthlyDivisor: d === DEFAULT ? null : (d as MonthlyDivisor) })} testIDPrefix="worker-divisor" />
            </>
          ) : null}
        </Section>
      ) : null}
      {workerId ? (
        <>
          <SwitchRow label={t('workerForm.hasLeft')} value={values.hasLeft}
            onChange={(hasLeft) => set({ hasLeft, leftDate: hasLeft ? values.leftDate ?? today : null })} testID="has-left" />
          {values.hasLeft && values.leftDate ? (
            <DateField label={t('workerForm.leftDate')} value={values.leftDate} max={today} onChange={(leftDate) => set({ leftDate })} testID="left-date" />
          ) : null}
          <ErrorText>{err('leftDate')}</ErrorText>
        </>
      ) : null}
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}
```

`navigation.tsx`:
- Add the imports for `WorkersScreen`, `WorkerDetailScreen` and `WorkerFormScreen`.
- Replace `{/* TABS */}` with:

```tsx
      <Tab.Screen name="Workers" component={WorkersScreen} options={{ title: t('tabs.workers'), tabBarIcon: icon('people-outline') }} />
      {/* TABS */}
```

- Replace `{/* ROUTES */}` with:

```tsx
        <Stack.Screen name="WorkerDetail" component={WorkerDetailScreen} />
        <Stack.Screen name="WorkerForm" component={WorkerFormScreen} />
        {/* ROUTES */}
```

- [ ] **Step 5: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): workers list, worker detail with calendar and corrections, add/edit worker"
```

---

### Task 14: Money entries and the Advances tab

**Files:**
- Create: `mobile-chukta/src/screens/MoneyEntryScreen.tsx`, `mobile-chukta/src/screens/AdvancesScreen.tsx`
- Modify: `mobile-chukta/src/screens/WorkerDetailScreen.tsx` (replace `{/* MONEY-ACTIONS */}`), `mobile-chukta/src/app/navigation.tsx`
- Test: `mobile-chukta/src/__tests__/money.test.tsx`

**Interfaces:**
- Consumes:
  - `validateMoneyForm` (Task 9);
  - `addAdvance`, `addPayment` (1A);
  - `listWorkerSummaries` (Task 8);
  - route `MoneyEntry: { workerId, kind: MoneyKind }`.
- Produces:
  - the Advances tab (between Workers and Settings) and route `MoneyEntry`;
  - worker-detail buttons `add-advance`, `add-repayment`, `add-writeoff`, `add-payment`, available to owner and staff;
  - money form testIDs `amount`, `note`, `mode-<mode>`, `save`; Advances testIDs `advances-total`, `advance-<workerId>`.

- [ ] **Step 1: Write the failing test**

```tsx
// mobile-chukta/src/__tests__/money.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { AdvancesScreen } from '../screens/AdvancesScreen';
import { MoneyEntryScreen } from '../screens/MoneyEntryScreen';
import { WorkerDetailScreen } from '../screens/WorkerDetailScreen';
import { adv, property, worker } from './helpers/fixtures';
import { makeSession, renderScreen, STAFF } from './helpers/session';

beforeAll(() => initI18n('en'));

async function seeded() {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  await upsertLocal(s.db, 'workers', worker({ id: 'w1', name: 'Ram' }));
  await upsertLocal(s.db, 'workers', worker({ id: 'w2', name: 'Sita' }));
  return s;
}

test('staff records an advance by UPI', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'advance' });
  fireEvent.changeText(await screen.findByTestId('amount'), '1,500.50');
  fireEvent.press(screen.getByTestId('mode-upi'));
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => {
    const r = await s.db.getFirstAsync('select type, amount_paise, mode, date, created_by_role from advance_entries');
    expect(r).toEqual({ type: 'advance', amount_paise: 150050, mode: 'upi', date: '2026-09-07', created_by_role: 'staff' });
  });
  expect(s.afterWrite).toHaveBeenCalled();
});

test('write-off requires a note', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w1', kind: 'writeoff' });
  fireEvent.changeText(await screen.findByTestId('amount'), '100');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('A note is required for a write-off.')).toBeTruthy();
  expect(await s.db.getAllAsync('select 1 from advance_entries')).toEqual([]);
});

test('a wage payment goes to wage_payments', async () => {
  const s = await seeded();
  renderScreen('MoneyEntry', MoneyEntryScreen, s, { workerId: 'w2', kind: 'payment' });
  fireEvent.changeText(await screen.findByTestId('amount'), '2000');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(async () => expect(await s.db.getFirstAsync('select amount_paise from wage_payments')).toEqual({ amount_paise: 200000 }));
});

test('worker detail offers all four money actions, including to staff', async () => {
  const s = await seeded();
  renderScreen('WorkerDetail', WorkerDetailScreen, s, { workerId: 'w1' });
  for (const k of ['advance', 'repayment', 'writeoff', 'payment']) expect(await screen.findByTestId(`add-${k}`)).toBeTruthy();
  fireEvent.press(screen.getByTestId('add-repayment'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('MoneyEntry');
});

test('advances tab lists outstanding advances, largest first, with the total', async () => {
  const s = await seeded();
  await upsertLocal(s.db, 'advance_entries', adv('a1', { worker_id: 'w1', amount_paise: 100000 }));
  await upsertLocal(s.db, 'advance_entries', adv('a2', { worker_id: 'w2', amount_paise: 300000 }));
  await upsertLocal(s.db, 'advance_entries', adv('a3', { worker_id: 'w2', type: 'repayment', amount_paise: 50000 }));
  renderScreen('Tabs', AdvancesScreen, s);
  expect(await screen.findByTestId('advances-total')).toHaveTextContent('₹3,500');
  const order = screen.getAllByTestId(/^advance-/).map((n) => n.props.testID);
  expect(order).toEqual(['advance-w2', 'advance-w1']);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd mobile-chukta && npx jest src/__tests__/money.test.tsx`
Expected: FAIL, "Cannot find module '../screens/AdvancesScreen'".

- [ ] **Step 3: Implement**

```tsx
// mobile-chukta/src/screens/MoneyEntryScreen.tsx
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useLayoutEffect, useState } from 'react';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { addAdvance, addPayment } from '../repos/money';
import { getWorker } from '../repos/workers';
import { Button, Field, Label, Loading, Muted, Screen, Segmented } from '../ui/components';
import { DateField } from '../ui/DateField';
import { PAYMENT_MODES } from '../ui/options';
import { validateMoneyForm, type FieldErrors, type MoneyFormValues } from '../view/forms';

export function MoneyEntryScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'MoneyEntry'>>();
  const today = sessionToday(session);
  const [values, setValues] = useState<MoneyFormValues>({ kind: params.kind, amount: '', date: today, mode: 'cash', note: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const { data: worker } = useLocalData((s) => getWorker(s.db, params.workerId), [params.workerId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: t(`entryType.${params.kind}`) });
  }, [navigation, params.kind, t]);

  if (worker === undefined) return <Loading />;
  const set = (patch: Partial<MoneyFormValues>) => setValues({ ...values, ...patch });
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function save() {
    const r = validateMoneyForm(values);
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    if (!worker) return;
    setBusy(true);
    const base = {
      propertyId: worker.property_id, workerId: worker.id, amountPaise: r.value.amountPaise, date: r.value.date,
      mode: r.value.mode ?? undefined, note: r.value.note ?? undefined,
    };
    if (params.kind === 'payment') await addPayment(session.repo, base);
    else await addAdvance(session.repo, { ...base, type: params.kind });
    session.afterWrite();
    navigation.goBack();
  }

  return (
    <Screen>
      {worker ? <Muted>{worker.name}</Muted> : null}
      <Field label={t('money.amount')} value={values.amount} onChangeText={(amount) => set({ amount })} keyboardType="decimal-pad"
        error={err('amount')} testID="amount" />
      <DateField label={t('money.date')} value={values.date} max={today} onChange={(date) => set({ date })} testID="money-date" />
      <Label>{t('money.mode')}</Label>
      <Segmented options={PAYMENT_MODES.map((m) => ({ value: m, label: t(`mode.${m}`) }))} value={values.mode}
        onChange={(mode) => set({ mode })} testIDPrefix="mode" />
      <Field label={t('money.note')} value={values.note} onChangeText={(note) => set({ note })} error={err('note')} testID="note" />
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}
```

```tsx
// mobile-chukta/src/screens/AdvancesScreen.tsx
import { RefreshControl } from 'react-native';
import { useStackNav } from '../app/routes';
import { sessionToday, useLocalData, useSession } from '../app/session';
import type { Property } from '../domain/types';
import { useT } from '../i18n/useT';
import { Card, Loading, Muted, Row, Screen, Title } from '../ui/components';
import { RequireProperty } from '../ui/RequireProperty';
import { formatRupees } from '../utils/money';
import { listWorkerSummaries } from '../view/ledgerQueries';

export function AdvancesScreen() {
  return <RequireProperty>{(p) => <AdvancesBody property={p} />}</RequireProperty>;
}

function AdvancesBody({ property }: { property: Property }) {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { data } = useLocalData(async (s) => (await listWorkerSummaries(s.db, property, sessionToday(s), true))
    .filter((x) => x.ledger.advanceOutstandingPaise !== 0)
    .sort((a, b) => b.ledger.advanceOutstandingPaise - a.ledger.advanceOutstandingPaise), [property]);
  if (!data) return <Loading />;
  const total = data.reduce((sum, x) => sum + x.ledger.advanceOutstandingPaise, 0);
  return (
    <Screen refreshControl={<RefreshControl refreshing={session.syncStatus.running} onRefresh={() => void session.runSync()} />}>
      <Card>
        <Muted>{t('advances.total')}</Muted>
        <Title testID="advances-total">{formatRupees(total)}</Title>
      </Card>
      {data.length === 0 ? <Muted>{t('advances.empty')}</Muted> : null}
      {data.map(({ worker, ledger }) => (
        <Row key={worker.id} testID={`advance-${worker.id}`} title={worker.name}
          right={<Title>{formatRupees(ledger.advanceOutstandingPaise)}</Title>}
          onPress={() => navigation.navigate('WorkerDetail', { workerId: worker.id })} />
      ))}
    </Screen>
  );
}
```

`WorkerDetailScreen.tsx`: replace `{/* MONEY-ACTIONS */}` with:

```tsx
      <View style={styles.actions}>
        {(['advance', 'repayment', 'writeoff', 'payment'] as const).map((kind) => (
          <View key={kind} style={styles.action}>
            <Button kind="secondary" title={t(`entryType.${kind}`)} onPress={() => navigation.navigate('MoneyEntry', { workerId, kind })} testID={`add-${kind}`} />
          </View>
        ))}
      </View>
```

and add to its `StyleSheet.create({...})`:

```ts
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  action: { flexGrow: 1, flexBasis: '45%' },
```

`navigation.tsx`:
- Add the imports for `MoneyEntryScreen` and `AdvancesScreen`.
- Replace `{/* TABS */}` with:

```tsx
      <Tab.Screen name="Advances" component={AdvancesScreen} options={{ title: t('tabs.advances'), tabBarIcon: icon('wallet-outline') }} />
      {/* TABS */}
```

- Replace `{/* ROUTES */}` with:

```tsx
        <Stack.Screen name="MoneyEntry" component={MoneyEntryScreen} />
        {/* ROUTES */}
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): advance, repayment, write-off and wage payment entry; advances tab"
```

---

### Task 15: Staff management, unlock, and "Entries that didn't sync"

**Files:**
- Create: `mobile-chukta/src/screens/settings/StaffSection.tsx`, `mobile-chukta/src/screens/StaffFormScreen.tsx`, `mobile-chukta/src/screens/SyncIssuesScreen.tsx`
- Modify: `mobile-chukta/src/repos/staff.ts` (add `getStaffUser`), `mobile-chukta/src/screens/SettingsScreen.tsx`, `mobile-chukta/src/app/navigation.tsx`
- Test: `mobile-chukta/src/__tests__/staff.test.tsx`, `mobile-chukta/src/__tests__/syncIssues.test.tsx`

**Interfaces:**
- Consumes:
  - `staffApi`, `StaffApiError` (Task 6 / Task 10 services);
  - `listStaff` (Task 6);
  - `listDeadGroups`, `requeueDead`, `discardDead` (Task 4);
  - `validateStaffForm` (Task 9).
- Produces:
  - `getStaffUser(db, id): Promise<StaffUser | null>`;
  - routes `StaffForm` and `SyncIssues`;
  - the Settings rows `sync-issues` (only when `syncStatus.dead > 0`), `unlock`, `add-staff`, `staff-<id>`.
- **Behaviour:**
  - Staff changes are made online through `staffApi`, followed by `session.runSync()` so that the `staff_users` row appears locally.
  - Reactivating requires a new PIN (checked on the client before the call, and enforced by the server).
  - The staff section is shown to owners only.

- [ ] **Step 1: Write the failing tests**

```tsx
// mobile-chukta/src/__tests__/staff.test.tsx
jest.mock('../app/services', () => ({
  authService: {},
  staffApi: { create: jest.fn(async () => {}), update: jest.fn(async () => {}), unlock: jest.fn(async () => {}) },
}));

import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { StaffApiError } from '../api/staffApi';
import { staffApi } from '../app/services';
import { initI18n } from '../i18n';
import { upsertLocal } from '../repos/write';
import { SettingsScreen } from '../screens/SettingsScreen';
import { StaffFormScreen } from '../screens/StaffFormScreen';
import { property } from './helpers/fixtures';
import { makeSession, OWNER, renderScreen, STAFF } from './helpers/session';

const api = staffApi as jest.Mocked<typeof staffApi>;
beforeAll(() => initI18n('en'));
beforeEach(() => jest.clearAllMocks());
afterEach(() => jest.restoreAllMocks());

async function ownerWithStaff() {
  const s = await makeSession(OWNER);
  await upsertLocal(s.db, 'properties', property());
  await s.db.runAsync(`insert into staff_users (id, property_id, name, auth_user_id, is_active, created_at) values
    ('11111111-1111-4111-8111-111111111111', 'p1', 'Mgr', 'a1', 1, 't'),
    ('22222222-2222-4222-8222-222222222222', 'p1', 'Old', 'a2', 0, 't')`);
  return s;
}

test('settings lists staff for owners, with help text and unlock', async () => {
  const s = await ownerWithStaff();
  renderScreen('Tabs', SettingsScreen, s);
  expect(await screen.findByText('Mgr')).toBeTruthy();
  expect(screen.getByText(/their own PIN/)).toBeTruthy();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  fireEvent.press(screen.getByTestId('unlock'));
  await waitFor(() => expect(alert).toHaveBeenCalledWith('Unlock staff login', 'Staff login unlocked.'));
  expect(api.unlock).toHaveBeenCalled();
});

test('staff users do not see the staff section', async () => {
  const s = await makeSession(STAFF);
  await upsertLocal(s.db, 'properties', property());
  renderScreen('Tabs', SettingsScreen, s);
  await screen.findByTestId('logout');
  expect(screen.queryByTestId('add-staff')).toBeNull();
});

test('add staff: validates, calls the API with the property, then syncs', async () => {
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'Cashier');
  fireEvent.changeText(screen.getByTestId('pin'), '4821');
  fireEvent.changeText(screen.getByTestId('pin-confirm'), '4812');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText("PINs don't match.")).toBeTruthy();
  fireEvent.changeText(screen.getByTestId('pin-confirm'), '4821');
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(api.create).toHaveBeenCalledWith({ propertyId: 'p1', name: 'Cashier', pin: '4821' }));
  expect(s.runSync).toHaveBeenCalled();
});

test('server errors are shown in the form', async () => {
  api.create.mockRejectedValueOnce(new StaffApiError('staff.error.pinInUse'));
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s);
  fireEvent.changeText(await screen.findByTestId('name'), 'X');
  fireEvent.changeText(screen.getByTestId('pin'), '1111');
  fireEvent.changeText(screen.getByTestId('pin-confirm'), '1111');
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Another staff member already uses this PIN.')).toBeTruthy();
});

test('reactivating needs a new PIN', async () => {
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s, { staffId: '22222222-2222-4222-8222-222222222222' });
  fireEvent(await screen.findByTestId('active'), 'valueChange', true);
  fireEvent.press(screen.getByTestId('save'));
  expect(await screen.findByText('Set a new PIN to reactivate.')).toBeTruthy();
  expect(api.update).not.toHaveBeenCalled();
});

test('deactivating sends only isActive false', async () => {
  const s = await ownerWithStaff();
  renderScreen('StaffForm', StaffFormScreen, s, { staffId: '11111111-1111-4111-8111-111111111111' });
  fireEvent(await screen.findByTestId('active'), 'valueChange', false);
  fireEvent.press(screen.getByTestId('save'));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith({ staffId: '11111111-1111-4111-8111-111111111111', isActive: false }));
});
```

```tsx
// mobile-chukta/src/__tests__/syncIssues.test.tsx
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { initI18n } from '../i18n';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SyncIssuesScreen } from '../screens/SyncIssuesScreen';
import { IDLE_STATUS } from '../sync/engine';
import { makeSession, OWNER, renderScreen } from './helpers/session';

jest.mock('../app/services', () => ({ authService: {}, staffApi: {} }));
beforeAll(() => initI18n('en'));
afterEach(() => jest.restoreAllMocks());

async function withDead() {
  const s = await makeSession(OWNER);
  for (const [table, id, err] of [['workers', 'w1', 'violates check'], ['attendance_entries', 'a1', 'violates check']]) {
    await s.db.runAsync("insert into sync_queue (table_name, row_id, op, payload, status, attempts, last_error, created_at) values (?, ?, 'insert', '{}', 'dead', 1, ?, 't')",
      [table, id, err]);
  }
  return s;
}

test('settings links to the issues screen when something is dead', async () => {
  const s = await makeSession(OWNER, { syncStatus: { ...IDLE_STATUS, dead: 2 } });
  renderScreen('Tabs', SettingsScreen, s);
  fireEvent.press(await screen.findByTestId('sync-issues'));
  expect((await screen.findByTestId('current-route')).props.children).toBe('SyncIssues');
});

test('no issues row when nothing is dead', async () => {
  const s = await makeSession(OWNER);
  renderScreen('Tabs', SettingsScreen, s);
  await screen.findByTestId('logout');
  expect(screen.queryByTestId('sync-issues')).toBeNull();
});

test('groups by error; retry puts rows back to pending and syncs', async () => {
  const s = await withDead();
  renderScreen('SyncIssues', SyncIssuesScreen, s);
  expect(await screen.findByText('violates check')).toBeTruthy();
  expect(screen.getByText('2 entries · Worker, Attendance')).toBeTruthy();
  fireEvent.press(screen.getByTestId('retry-0'));
  await waitFor(async () => expect(await s.db.getAllAsync("select 1 from sync_queue where status = 'pending'")).toHaveLength(2));
  expect(s.runSync).toHaveBeenCalled();
});

test('discard asks first, then removes the rows', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => { void buttons?.[1]?.onPress?.(); });
  const s = await withDead();
  renderScreen('SyncIssues', SyncIssuesScreen, s);
  fireEvent.press(await screen.findByTestId('discard-0'));
  await waitFor(async () => expect(await s.db.getAllAsync('select 1 from sync_queue')).toHaveLength(0));
  expect(s.afterWrite).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd mobile-chukta && npx jest src/__tests__/staff.test.tsx src/__tests__/syncIssues.test.tsx`
Expected: FAIL, because `StaffFormScreen` and `SyncIssuesScreen` are missing.

- [ ] **Step 3: Implement**

Append to `mobile-chukta/src/repos/staff.ts`:

```ts
export async function getStaffUser(db: SqlDb, id: string): Promise<StaffUser | null> {
  return db.getFirstAsync<StaffUser>('select * from staff_users where id = ?', [id]);
}
```

```tsx
// mobile-chukta/src/screens/settings/StaffSection.tsx
import { useState } from 'react';
import { Alert } from 'react-native';
import { StaffApiError } from '../../api/staffApi';
import { useStackNav } from '../../app/routes';
import { staffApi } from '../../app/services';
import { useLocalData, useSession } from '../../app/session';
import { useT } from '../../i18n/useT';
import { listStaff } from '../../repos/staff';
import { Button, Muted, Row, Section } from '../../ui/components';

export function StaffSection() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const [unlocking, setUnlocking] = useState(false);
  const { data } = useLocalData((s) => (s.propertyId ? listStaff(s.db, s.propertyId) : Promise.resolve([])));
  if (session.identity.kind !== 'owner' || !session.propertyId) return null;
  const phone = session.identity.phone;

  async function unlock() {
    setUnlocking(true);
    try {
      await staffApi.unlock();
      Alert.alert(t('settings.unlock'), t('settings.unlocked'));
    } catch (e) {
      Alert.alert(t('settings.unlock'), t(e instanceof StaffApiError ? e.key : 'staff.error.unknown'));
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <Section title={t('settings.staff')}>
      <Muted>{t('settings.staffHelp', { phone })}</Muted>
      {(data ?? []).map((st) => (
        <Row key={st.id} title={st.name} subtitle={st.is_active ? t('staff.active') : t('staff.inactive')}
          onPress={() => navigation.navigate('StaffForm', { staffId: st.id })} testID={`staff-${st.id}`} />
      ))}
      <Button kind="secondary" title={t('settings.addStaff')} onPress={() => navigation.navigate('StaffForm')} testID="add-staff" />
      <Button kind="secondary" title={t('settings.unlock')} onPress={() => void unlock()} loading={unlocking} testID="unlock" />
    </Section>
  );
}
```

```tsx
// mobile-chukta/src/screens/StaffFormScreen.tsx
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useEffect, useLayoutEffect, useState } from 'react';
import { StaffApiError, type StaffApiErrorKey } from '../api/staffApi';
import { useStackNav, type RootStackParamList } from '../app/routes';
import { staffApi } from '../app/services';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { getStaffUser } from '../repos/staff';
import { Button, ErrorText, Field, Loading, Muted, Screen, SwitchRow } from '../ui/components';
import { validateStaffForm, type FieldErrors } from '../view/forms';

export function StaffFormScreen() {
  const t = useT();
  const session = useSession();
  const navigation = useStackNav();
  const { params } = useRoute<RouteProp<RootStackParamList, 'StaffForm'>>();
  const staffId = params?.staffId ?? null;
  const { data: existing } = useLocalData((s) => (staffId ? getStaffUser(s.db, staffId) : Promise.resolve(null)), [staffId]);
  const [name, setName] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState<StaffApiErrorKey | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (name !== null || existing === undefined) return;
    setName(existing?.name ?? '');
    setActive(existing ? existing.is_active === 1 : true);
  }, [existing, name]);
  useLayoutEffect(() => {
    navigation.setOptions({ title: t(staffId ? 'staff.titleEdit' : 'staff.titleNew') });
  }, [navigation, staffId, t]);

  if (name === null) return <Loading />;
  const err = (k: string) => (errors[k] ? t(errors[k]) : null);

  async function save() {
    setApiError(null);
    const r = validateStaffForm({ isNew: !staffId, name: name ?? '', pin, pinConfirm });
    if (!r.ok) {
      setErrors(r.errors);
      return;
    }
    const reactivating = !!existing && existing.is_active === 0 && active;
    if (reactivating && !r.value.pin) {
      setErrors({ pin: 'staff.error.reactivateNeedsPin' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      if (!staffId) {
        await staffApi.create({ propertyId: session.propertyId as string, name: r.value.name, pin: r.value.pin as string });
      } else {
        const patch: { staffId: string; name?: string; pin?: string; isActive?: boolean } = { staffId };
        if (r.value.name !== existing?.name) patch.name = r.value.name;
        if (r.value.pin) patch.pin = r.value.pin;
        if (existing && (existing.is_active === 1) !== active) patch.isActive = active;
        if (Object.keys(patch).length > 1) await staffApi.update(patch);
      }
      await session.runSync();
      navigation.goBack();
    } catch (e) {
      setApiError(e instanceof StaffApiError ? e.key : 'staff.error.unknown');
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Muted>{t('common.needsInternet')}</Muted>
      <Field label={t('staff.name')} value={name} onChangeText={setName} error={err('name')} testID="name" />
      <Field label={t(staffId ? 'staff.newPin' : 'staff.pin')} value={pin} onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" secureTextEntry error={err('pin')} testID="pin" />
      <Field label={t('staff.pinConfirm')} value={pinConfirm} onChangeText={(v) => setPinConfirm(v.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad" secureTextEntry error={err('pinConfirm')} testID="pin-confirm" />
      {staffId ? <SwitchRow label={t('staff.active')} value={active} onChange={setActive} testID="active" /> : null}
      <ErrorText>{apiError ? t(apiError) : null}</ErrorText>
      <Button title={t('common.save')} onPress={() => void save()} loading={busy} testID="save" />
    </Screen>
  );
}
```

```tsx
// mobile-chukta/src/screens/SyncIssuesScreen.tsx
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalData, useSession } from '../app/session';
import { useT } from '../i18n/useT';
import { Button, Card, Loading, Muted, Screen } from '../ui/components';
import { colors, space } from '../ui/theme';
import { discardDead, listDeadGroups, requeueDead, type DeadGroup } from '../sync/deadLetters';

export function SyncIssuesScreen() {
  const t = useT();
  const session = useSession();
  const { data, reload } = useLocalData((s) => listDeadGroups(s.db));

  async function retry(g: DeadGroup) {
    await requeueDead(session.db, g.seqs);
    session.afterWrite();
    reload();
    void session.runSync();
  }

  const discard = (g: DeadGroup) => Alert.alert(t('syncIssues.discard'), t('syncIssues.discardConfirm'), [
    { text: t('common.cancel'), style: 'cancel' },
    {
      text: t('syncIssues.discard'),
      style: 'destructive',
      onPress: async () => {
        await discardDead(session.db, g.seqs);
        session.afterWrite();
        reload();
      },
    },
  ]);

  if (!data) return <Loading />;
  return (
    <Screen>
      <Muted>{data.length ? t('syncIssues.explain') : t('syncIssues.empty')}</Muted>
      {data.map((g, i) => (
        <Card key={g.error}>
          <Text style={styles.error}>{g.error}</Text>
          <Muted>{`${t('syncIssues.count', { count: g.count })} · ${g.tables.map((tb) => t(`tables.${tb}`)).join(', ')}`}</Muted>
          <View style={styles.actions}>
            <View style={styles.action}><Button title={t('syncIssues.retry')} onPress={() => void retry(g)} testID={`retry-${i}`} /></View>
            <View style={styles.action}><Button kind="danger" title={t('syncIssues.discard')} onPress={() => discard(g)} testID={`discard-${i}`} /></View>
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 14, color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm },
  action: { flex: 1 },
});
```

`SettingsScreen.tsx`:
- Add `import { StaffSection } from './settings/StaffSection';`.
- Replace `{/* SECTIONS */}` with `<StaffSection />`.
- Replace `{/* SYNC-ISSUES */}` with:

```tsx
        {syncStatus.dead > 0 ? (
          <Row title={t('settings.issues', { count: syncStatus.dead })} onPress={() => navigation.navigate('SyncIssues')} testID="sync-issues" />
        ) : null}
```

`navigation.tsx`:
- Add the imports for `StaffFormScreen` and `SyncIssuesScreen`.
- Replace `{/* ROUTES */}` with the lines below. Remove the `{/* TABS */}` marker, which is no longer needed.

```tsx
        <Stack.Screen name="StaffForm" component={StaffFormScreen} />
        <Stack.Screen name="SyncIssues" component={SyncIssuesScreen} options={{ title: t('syncIssues.title') }} />
```

- [ ] **Step 4: Run all tests and the type check**

Run: `cd mobile-chukta && npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile-chukta/src
git commit -m "feat(chukta): staff management with unlock, and the entries-that-didn't-sync screen"
```

---

### Task 16: Deploy and verify (with the user)

**Files:**
- Create: `docs/superpowers/notes/2026-10-01-chukta-phase1b-deploy.md`
- Scratch only, never committed: `<scratchpad>/chukta_1b_e2e.py`

The steps marked **(user)** are run by the user. Claude Code's auto mode blocks `supabase db push` and `supabase functions deploy`.

- [ ] **Step 1: (user) Push the migration and deploy the functions from the worktree**

```bash
cd <worktree>
supabase link --project-ref mhtqufyaxpunhenqropn   # once per worktree
supabase db push                                   # applies 20261001100000_chukta_admin_counts.sql
supabase functions deploy chukta-login-staff chukta-staff payments
```

Expected:
- `db push` lists exactly one new migration;
- each function is listed as deployed (`verify_jwt = false` comes from `supabase/config.toml`).

- [ ] **Step 2: Run pgTAP against the live DB**

Wrap and run `supabase/tests/database/chukta_admin_counts.test.sql`, then re-run `chukta_schema.test.sql`, `chukta_access.test.sql` and the Phase 0 hook test, using the same wrapper as 1A.
Expected: `5/5`, `13/13`, `26/26`, `17/17`, with no `not ok` lines.

- [ ] **Step 3: Throwaway backend E2E (creates and deletes its own data)**

Write `<scratchpad>/chukta_1b_e2e.py` using the same helper pattern as the 1A `chukta_e2e.py`:
- keys are loaded from `supabase projects api-keys` into memory and never printed;
- `req()` and `check()` are the same helpers;
- cleanup runs in `finally`.

The checks:

```python
# setup as in 1A: temp shop + owner auth user + chukta app_subscription (is_active true)
# 1. owner login (app=chukta) → property → staff via /chukta-staff/create (PIN 4821)
# 2. staff login → 200
# 3. PATCH app_subscriptions set is_active=false (service role) → staff login → 403 {"error":"not_subscribed"}
# 4. set is_active=true again → staff login → 200
# 5. 11 wrong PINs → 10×401 then 429; correct PIN → 429
# 6. POST /chukta-staff/unlock with the OWNER token → 200 {"ok":true}; correct PIN → 200
# 7. POST /chukta-staff/unlock with the STAFF token → 403
# 8. insert 2 workers (one 'left') via REST as owner → rpc admin_chukta_counts (service role) has this shop with (1, 1)
# 9. GET /functions/v1/payments/admin/shops needs an admin JWT: skip unless ADMIN creds are in env; the rpc check covers the data
# cleanup: delete shop (cascades chukta rows) + auth users; verify no residue
```

Run: `python3 <scratchpad>/chukta_1b_e2e.py`
Expected: `SUMMARY 9/9 passed` (or 8/8 if check 9 is skipped) and `CLEANUP ok`.

- [ ] **Step 4: Web**

Merging to `main` redeploys the site: `.github/workflows/deploy-web.yml` runs on changes under `web/**`. Before the merge, check locally with `cd web && npm run build && npm run preview` → `/Pragati_Bandhu_Git/chukta`.

After the merge, the user checks two cases on the live site with real phones:
- **(a)** a new number: OTP → details → done;
- **(b)** an existing ShopAI number: OTP → existing password → done.

Both then log in on the Chukta app.

- [ ] **Step 5: (user) Android dev build**

```bash
cd mobile-chukta
eas init             # creates the Chukta EAS project and writes extra.eas.projectId into app.json — commit that change
eas build --profile development --platform android
```

Install the build on two phones.

- [ ] **Step 6: Manual end-to-end (spec §11), recorded in the deploy note**

On an owner phone (A) and a staff phone (B), both on the same property:

1. On A: log in as the owner.
   - Create the property and set the weekly off.
   - Add 2 workers (one daily, one hourly) and one staff member with a PIN.
2. On B: staff login with the owner's phone and the PIN. The property is fixed, and both workers appear after the first sync.
3. Turn airplane mode on for both phones.
   - On A: mark worker 1 absent today and add an advance.
   - On B: mark worker 2 at 5 hours and add a wage payment.
4. Reconnect both phones and pull to refresh. Both phones show all four entries and the same balances.
5. On A: correct (void) B's payment. B's worker detail shows it struck through after a sync, and B has no Correct button.
6. On A: Settings → staff → deactivate B's staff member. Within about an hour at most (on B's next token refresh), or immediately on B's app restart, B returns to login with "You were logged out".
7. Six wrong PINs, then Unlock on A, then the correct PIN on B → login works.
   - Use 11 wrong PINs to hit the lockout; 6 only checks that nothing breaks early.
8. Language: switch A to বাংলা and B to हिन्दी. Every screen is translated, with no raw keys.

- [ ] **Step 7: Write the deploy note and commit**

`docs/superpowers/notes/2026-10-01-chukta-phase1b-deploy.md` records:
- what was pushed and deployed, with dates;
- the pgTAP counts;
- the E2E summary line;
- the manual checklist results (pass/fail per step);
- any follow-ups:
  - native-speaker review of the bn/hi strings (spec §12.2);
  - brand icon and splash (spec §12.3);
  - the Play Store release, which is the user's call.

```bash
git add docs/superpowers/notes/2026-10-01-chukta-phase1b-deploy.md mobile-chukta/app.json
git commit -m "docs: record Chukta Phase 1B deploy verification"
```

---

## Self-review notes (for the executor)

**Spec coverage:**
- §8 screens 1–10: Language, Login (T10); Property switcher (T11); Today (T12); Workers list, Worker detail, Add/Edit worker (T13); money entries plus Correct (T13/T14); Advances (T14); Settings (T10/T11/T15).
- §8 sessions: `setSession`, AppState refresh and the 3-second race live in `authService.restore` (1A) plus `authDeps` (T6). `SIGNED_OUT` → login is handled in `SessionProvider` and `AppRoot` (T10). Logout is local-scope (T6).
- §8 push/pull triggers: app start, reconnect, AppState active, after writes (debounced), and pull-to-refresh (T5/T10/T12–14).
- §8 dead-letter list: T4 + T15.
- §9 web signup: T3. Admin counts: T2.
- §10 error cases:
  - not subscribed → register link;
  - pre-Phase-0 account → forgot-password link;
  - wrong PIN / lockout;
  - staff deactivated → revoked → login;
  - dead rows listed.
- §11 tests: Jest for every view model, form, sync and screen; pgTAP for the admin function; Deno for the handlers; the manual E2E in T16.

**Marker edits:**
- `{/* TABS */}`, `{/* ROUTES */}` (navigation);
- `{/* SECTIONS */}`, `{/* SYNC-ISSUES */}` (settings);
- `{/* MONEY-ACTIONS */}` (worker detail).

Each is added in T10/T13 and replaced in later tasks; T15 removes the last `{/* TABS */}`. Final tab order: Today, Workers, Advances, Settings.
