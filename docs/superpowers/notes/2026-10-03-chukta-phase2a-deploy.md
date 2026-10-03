# Chukta Phase 2A — deploy

## Behaviour changes for existing data

Read this first. Some numbers in the app can change after the update.

- Attendance already marked on a worker's weekly off day is now paid as work on a day off, at 1x by default. Before, it was ignored for daily and hourly workers.
- By-hours entries above the shift now pay automatic overtime, at 1x by default. Before, they were capped at the shift.
- Because of the two points above, existing balances can go up after the update.
- Staff can no longer set a worker's extra-pay settings. Staff closures always use "as per pay type".
- If staff re-mark a day-off row, the owner's custom amount is dropped, because the newest entry wins.

## Steps

1. `supabase db push` — applies `20261004100000_chukta_phase2a.sql`.
2. Run pgTAP: `supabase test db` (or the scratch tapwrap flow; un-wrap bare `select` lines that call void-returning helpers).
   Expect `chukta_phase2a.test.sql` 33/33 plus all earlier suites green.
3. Rebuild the app: `cd mobile-chukta && npx expo run:android` (local `.env` must exist) or an EAS build.
4. Two-phone check (owner phone + staff phone, same property):
   - Owner: Settings › Holidays › add "Durga Puja" for today, full, by pay type. Staff phone pulls it; Today shows the banner.
   - Staff: on a normal day tap "Shop closed today" › Rain › Mark closed. Owner phone pulls it.
   - Staff: mark one worker "Worked" on the holiday. Owner: set a custom ₹ amount for another worker's day-off work.
   - Staff: "+ Overtime" 2 h on a working day. Owner: worker detail shows "2 overtime hours: ₹…".
   - Owner: Bonus ₹500, Deduction ₹200 with reason; correct the bonus. Earned updates; staff phone cannot see Bonus/Deduction buttons.
   - Owner: Property › Extra pay › Fixed ₹60/h; one worker overrides to 1.5×. Ledger lines match.
   - Staff: edit a worker's name. This must still work, and Extra pay must not be shown to staff.
   - Airplane mode on the staff phone, mark overtime, reconnect — the row syncs, no sync issues.
5. Languages: switch to বাংলা and हिन्दी; check the Today banner, Holidays screen and explanation lines.
