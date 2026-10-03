# Chukta Phase 2D — deploy

## What changes for people using the app
- Each worker now has pay periods: monthly-paid workers by calendar month; everyone else weekly (the week ends on Saturday unless changed in Settings → Pay cycle).
- The owner settles a finished period from Workers → "Due for settlement" or from the worker's page. Settling records the payment and any
  advance taken back, locks the period, and makes a payslip that can be shared as a picture.
- Nothing can be added or changed inside a settled period (attendance, overtime, money, holidays) until the owner unlocks it.
- Advance taken back at settlement also counts as wages paid (it is paid out of wages).
- Staff can view and share payslips but cannot settle or unlock.

## Known limits
- A settlement uses the data on the owner's phone at the moment of settling. Pull down to refresh on the Settle screen first.
  Staff entries for that week that reach the server later than that are refused and show up on "entries that didn't sync".
  Entries that arrived before the owner's last refresh are included.
- A worker who has left is due for the final settlement from the day after the leaving date.
- Numbers on the payslip use 0-9 digits; month names follow the app language.

## Steps
1. `supabase db push` (applies `20261005100000_chukta_phase2d.sql`). Claude runs it only after you approve.
2. Run the database checks on the live database (no Docker needed; they use the rollback wrapper, so nothing stays in the database). Claude runs these only after you approve:
   - `chukta_phase2d.test.sql` (expect 36/36).
   - Re-run `chukta_phase2a`, `chukta_schema`, `chukta_access` (edited in this phase, void dates) and `chukta_admin_counts`.
3. Rebuild the app (new native libraries: view-shot, sharing): `cd mobile-chukta && npx expo run:android` (local `.env` needed) or an EAS build.
4. Update every phone. On first sync each phone re-downloads properties, workers, payments and advances once.

## Two-phone check
- Owner: Workers shows "Due for settlement" for last week. Open it, take back part of an advance, pay the rest, Settle → payslip opens.
- Share the payslip on WhatsApp; the picture shows the figures in the app's language (try বাংলা and हिन्दी).
- Staff phone: after sync, Today shows "Settled" for those dates; trying to add an advance dated in that week shows the locked message.
- Staff phone offline: mark attendance for a date the owner then settles; reconnect → the entry appears on "entries that didn't sync".
- Owner: Unlock the payslip → it shows "Unlocked"; edit an entry in that week; settle again → new payslip includes the earlier payment.
- Owner: Settings → Pay cycle → Every month; the next period after the last settlement runs to the month end.
