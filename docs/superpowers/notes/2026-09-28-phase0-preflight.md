# Phase 0 Pre-flight Findings (Task 0)

Run 2026-09-29 against project `mhtqufyaxpunhenqropn` (PragatiDBIndia, ap-south-1). Supabase CLI 2.118.0, Deno 2.9.7.

| Check | Result |
|---|---|
| Postgres version | **17.6** (the plan assumed 15; the migrations use nothing version-specific) |
| Migration history | Local and remote match through `20260823143000`. Pending: `20260928100000`, `20260928100100`, `20260928100200` |
| Public tables | `app_settings, bill_items, bills, brands, categories, customers, payments, products, purchase_log, sales_log, shops`. **No drift**: `draft_bills`, `udhar_payments`, `notifications` and `login_events` do not exist |
| `shop_id` column type | `uuid` on every table (bills, brands, categories, customers, payments, products, purchase_log, sales_log) |
| Duplicate phones | None |
| Shops | 4. All need a password reset after deploy |
| Permissive policies | `owner_access USING(true)` on all ShopAI tables and `shops`; `Admin write app_settings` (ALL, true) and `Public read app_settings`. The lockdown migration replaces all of them except the app_settings read |
| Function secrets | `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`, `FIREBASE_PROJECT_ID` are set. `SUPABASE_JWKS` is present, so asymmetric signing keys may be active; recheck before building Chukta staff tokens |
| Synthetic email | Hosted admin `createUser` accepts `s-…@accounts.pragatibandhu.internal`. The test user was deleted |
| `AUTH_EMAIL_DOMAIN` | Set to `accounts.pragatibandhu.internal` |
| Dry-run push | Would push exactly the 3 Phase 0 migrations |
| Backup | JSON of the 4 `shops` rows (including the dropped columns) saved locally, outside the repo, before the push |

Side notes:
- Mobile `login_events` inserts and the admin `reset-data` deletes (`draft_bills`, `udhar_payments`, `notifications`) target tables that don't exist. These calls were already failing silently before Phase 0, and nothing in Phase 0 changes that.
- The config warning `[inbucket] is deprecated, use [local_smtp]` is cosmetic.
