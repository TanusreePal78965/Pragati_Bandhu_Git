# Migration: Express Backend → Supabase-Only

## Context
Replace the Express.js backend with Supabase-only architecture:
- **Auth:** Keep phone OTP via Fast2SMS — wired through Supabase Phone Auth using a "Send SMS Hook" (Edge Function). Same UX for users.
- **CRUD sync:** Mobile calls Supabase directly instead of Express routes. RLS policies enforce shop isolation.
- **Claude AI:** Future `ai-suggestions` Edge Function (not blocking).
- **Cost:** Free tier covers early stage. No server to pay for or maintain.

---

## OTP Flow — Before vs After

**Before (Express):**
```
Mobile → POST /api/auth/send-otp → Express → Fast2SMS API
Mobile → POST /api/auth/verify-otp → Express (checks in-memory Map) → returns custom JWT
Mobile stores JWT manually in AsyncStorage
```

**After (Supabase):**
```
Mobile → supabase.auth.signInWithOtp({ phone: '+91XXXXXXXXXX' })
       → Supabase Auth generates OTP
       → triggers send-sms Edge Function hook
       → Edge Function calls Fast2SMS API → SMS delivered ✓

Mobile → supabase.auth.verifyOtp({ phone, token, type: 'sms' })
       → Supabase returns session { access_token, refresh_token }
       → Supabase client auto-persists session in AsyncStorage ✓
```

**What stays the same:** 6-box OTP UI, resend timer, 30s countdown, phone input screen — all UI unchanged.

**Dev testing:** Supabase never returns OTP to the client. Use:
- Supabase Dashboard → Authentication → Logs to see the OTP, OR
- Set a test phone number with fixed OTP `000000` in Supabase Auth settings (Authentication → Phone)

---

## Phase 1 — Supabase Edge Function (Fast2SMS Hook)

**File: `supabase/functions/send-sms/index.ts`**

Supabase Dashboard setup (manual steps):
1. Authentication → Providers → Phone → Enable
2. Authentication → Hooks → Send SMS Hook → point to `send-sms` function URL
3. Edge Functions → Secrets → add `FAST2SMS_API_KEY`

Deploy:
```bash
supabase functions deploy send-sms
```

---

## Phase 2 — RLS Policies

**File: `supabase/migrations/001_rls_policies.sql`**

Apply via Supabase Dashboard → SQL Editor, or:
```bash
supabase db push
```

Supabase Phone Auth stores phone as E.164 (`+919876543210`). `shop_id` is 10-digit. RLS uses `right(auth.jwt() ->> 'phone', 10)` to strip `+91`.

---

## Phase 3 — Mobile Changes

Install dependency:
```bash
cd mobile && npx expo install @supabase/supabase-js
```

Update `mobile/.env.local`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Files changed:
| Action | File |
|---|---|
| Create | `mobile/src/lib/supabase.ts` |
| Rewrite | `mobile/src/services/authService.ts` |
| Rewrite | `mobile/src/db/syncQueue.ts` |
| Update | `mobile/src/screens/auth/LoginScreen.tsx` |
| Update | `mobile/src/screens/auth/OtpScreen.tsx` |
| Update | `mobile/src/navigation/AuthNavigator.tsx` |
| Update | `mobile/src/context/AuthContext.tsx` |
| Update | `mobile/src/services/syncService.ts` |
| Comment out | `mobile/src/api/client.js` |

---

## Phase 4 — Cleanup

- `mobile/src/api/client.js` — commented out (kept for reference)
- `backend/` — kept (not deleted)

---

## Verification Checklist
- [ ] Enter phone → SMS received via Fast2SMS
- [ ] Enter OTP → session stored → correct screen (new: ShopSetup / returning: MainTabs)
- [ ] Kill and reopen app → still logged in (Supabase auto-refresh)
- [ ] Add product → appears in Supabase `products` table with correct `shop_id`
- [ ] Two shops cannot read each other's data (RLS)
- [ ] Admin sets `is_active = false` → app blocks on next foreground
