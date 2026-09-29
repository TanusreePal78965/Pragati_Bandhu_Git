# Chukta Phase 1A — Deploy Verification (2026-09-29)

Project `mhtqufyaxpunhenqropn` (PG 17). Branch `chukta-phase1a`.

## Migrations
- `20260930100000_chukta_schema.sql` and `20260930100100_chukta_access.sql` were pushed by the user. **A ShopAI owner login worked straight after the push**, so the hook change is safe for ShopAI.
- The live pgTAP run caught a bug in `check_entry_consistency`: it read `new.voids_id` on `attendance_entries`, which raised 42703 on every attendance insert. Fixed by `20260930100200_chukta_fix_consistency_trigger.sql` (nested IF), which was pushed before any client used the table.
- Hosted Postgres refuses `SET ROLE supabase_auth_admin` (42501), so those two pgTAP checks were dropped. The hook grants are covered by `token_hook` and by the live staff login below.
- `chukta` added to Exposed schemas; `notify pgrst, 'reload schema'` run.

## pgTAP (live, via a scratch wrapper that rolls back)
| File | Result |
|---|---|
| chukta_schema.test.sql | 13/13 |
| chukta_access.test.sql | 26/26 (finish() silent) |
| token_hook.test.sql (Phase 0) | 17/17 |

## Functions
`chukta-staff` and `chukta-login-staff` deployed (v1, `verify_jwt=false`).

Smoke tests:
- unknown phone → 401 `wrong_pin`;
- bad JSON → 400 `invalid_json`;
- `chukta-staff` without auth → 401;
- anon REST on `chukta` → `permission denied for schema chukta`.

## End to end (throwaway shop, all data deleted afterwards; cleanup verified)
All 24 checks passed:
- **Owner:** login with `app=chukta` returns the right claims (`app=chukta`, `shop_id`, no `app_role`), and the owner creates a property through REST.
- **Staff accounts:**
  - staff create works, and a duplicate PIN in the shop returns 409;
  - staff login returns 200 with claims `app=chukta`, `app_role=staff`, `property_id`.
- **Supabase Auth rate limits:** the same staff member logging in twice within 60 s returns 200 (generateLink frequency is fine), and a burst of 5 staff logins all returned 200.
- **Data:**
  - staff insert with `ignore-duplicates` works, and retrying it is an idempotent no-op;
  - the owner can PATCH a worker created by staff (column grants), and PATCHing `created_by` returns 403;
  - staff can record an `hours` attendance entry (trigger fix confirmed);
  - pulled types are correct: boolean, numeric 7.5, integer paise; the server timestamp `…567794+00:00` parses with JS `Date.parse`;
  - the pull cursor or-filter returns 200 when encoded as supabase-js does. The script's first attempt sent a raw `+` and got 22007; that was the script's fault, and it was confirmed separately.
- **Lockout:** 10 wrong PINs return 401 and the 11th returns 429; the correct PIN is refused while locked (429); `clear_pin_attempts` unlocks it.
- **Archive:** archiving the property makes the staff refresh fail (400), and staff login then returns 401.

## Open items carried to Plan 1B
The list is in the SDD ledger rulings:
- dead-letter UI and requeue;
- narrowing the PGRST retry rule or capping attempts;
- an owner unlock for staff login;
- one sync at a time, and backoff;
- the staff entitlement check;
- the divisor-30 partial-month sign-off;
- the eligibleDays and lockout copy.
