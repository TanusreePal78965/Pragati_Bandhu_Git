# Phase 0 — Gated Deploy Checklist

Run together with the user. Code is on branch `phase0-shared-auth`. **Do not merge to `main` until step 7**: a merge to `main` auto-deploys the web app (`.github/workflows/deploy-web.yml`), and the web app needs the new functions.

Project ref: `mhtqufyaxpunhenqropn`.

## 1. Tooling and preflight (plan Task 0)
- [ ] `brew install supabase/tap/supabase`, then `supabase login`, then `supabase link --project-ref mhtqufyaxpunhenqropn`.
- [ ] `supabase migration list --linked`: local and remote must match up to `20260823143000`.
- [ ] Run the Task 0 read-only SQL (tables with `shop_id` and their types, duplicate phones, shop count). Stop if there are duplicate phones.
- [ ] Dashboard → JWT Keys: record whether the legacy HS256 secret is still active. The functions use `SUPABASE_ANON_KEY`, and Chukta staff tokens depend on HS256.
- [ ] Secrets are set: `FIREBASE_PROJECT_ID`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET`. `payments` now fails closed when any admin secret is missing.
- [ ] `supabase secrets set AUTH_EMAIL_DOMAIN=accounts.pragatibandhu.internal`, or a domain you own if admin `createUser` rejects `.internal` (plan Task 0 step 5).

## 2. Database
- [ ] `supabase db push --linked --dry-run`. Expect exactly the three `20260928100*` migrations.
- [ ] `supabase db push --linked`.
- [ ] `supabase test db --linked`, or `--db-url` if your CLI rejects `--linked`. All three files must pass (10 + 17 + 16 assertions).
  - The permissive-policy assertion also checks **live** tables. If it fails, list the offending policies and write a follow-up migration.

## 3. Auth settings (Dashboard)
- [ ] Authentication → Hooks → Customize Access Token → enable `public.custom_access_token_hook`.
- [ ] Authentication → Sign In / Providers: **disable signups** (email and phone). `admin.createUser` keeps working.

## 4. Functions
- [ ] `supabase functions deploy login register reset-password payments --use-api`. `config.toml` sets `verify_jwt = false` for all four.
- [ ] `supabase functions delete register-shop`.

## 5. Smoke tests
- [ ] The anon REST call `rest/v1/products?select=id&limit=1` returns permission denied.
- [ ] Login with an existing (pre-Phase-0) shop returns `password_reset_required`.
- [ ] `/payments/lookup` works, and an admin page loads (proves `verify_jwt=false` on `payments`).
- [ ] After a reset-password, the old refresh token is rejected. This proves `postgres` can delete `auth.sessions` on hosted.
- [ ] Send a burst of about 40 logins to check for GoTrue per-IP throttling. All sign-ins come from edge-function IPs. If throttled, raise the Auth rate limits and plan a per-phone attempt limit.

## 6. End to end (dev build of ShopAI 1.1.0 + web)
- [ ] Use web Forgot password on an existing shop, then log in on ShopAI. Existing data restores.
- [ ] Create a product and make a sale. Both sync with the right `shop_id`.
- [ ] Log out and log back in. Also check offline after the token expires: the app stays signed in.
- [ ] Register a new number on the web, then log in.
- [ ] Admin: the shops list shows plans and the Chukta badge; settings save works; approving a payment extends `app_subscriptions`.

## 7. Release
- [ ] Merge `phase0-shared-auth` into `main`. This auto-deploys the web app.
- [ ] `cd mobile-shopai && eas build -p android --profile production`.
