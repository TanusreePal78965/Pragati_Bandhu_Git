# Chukta Phase 2D: Settlement & Payslips (Design)

**Date:** 2026-10-03
**Status:** Approved in brainstorming; awaiting review of this written spec
**Builds on:**
- Phase 1: `docs/superpowers/specs/2026-09-29-chukta-phase1-design.md`
- Phase 2A: `docs/superpowers/specs/2026-10-03-chukta-phase2a-calendar-extra-pay-design.md` (merged, migration live)

**Order:** Phase 2 is built as 2A calendar & extra pay (done) → **2D settlement & payslips** (this spec) → 2B paid leave → 2C piece-rate.

---

## 1. Goal

Give each worker regular **pay periods**. The owner can **settle** a finished period:
- see the period's pay;
- record what is paid now and how much advance is taken back;
- lock the period;
- produce a **payslip** that can be shared as an image (for example on WhatsApp).

Whatever is left over carries forward into the next period. Everything works offline, syncs like the rest of Chukta, and is available in English, Bengali and Hindi.

Today each worker has a single running balance since joining: earned − paid = wage due. Advances are tracked separately. 2D keeps that running balance and adds frozen per-period snapshots on top of it.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| S1 | Pay cycle | **Follows pay basis** by default. Monthly workers use the calendar month. Weekly, daily and hourly workers use a week ending on a set weekday (default Saturday). The property sets the default; a worker can override it. Monthly-paid workers are always settled by calendar month |
| S2 | What "settle" does | Shows the period's figures. The owner enters *paid now* and *advance recovered*. Saving records the payment and repayment, **locks** the period, and makes a payslip |
| S3 | Advance recovery | The owner chooses. The suggestion is the full outstanding advance, capped at the wage due. The owner can lower it to any amount, including 0. It is recorded as a repayment |
| S4 | Payslip | Viewed in the app, in the app's current language. **Shared as an image** through the share sheet |
| S5 | Permissions | **Only the owner** can settle and unlock. Staff can view and share payslips |
| S6 | Leftover | **Carry forward.** Any unpaid remainder, or any overpayment, becomes the next period's opening balance and is shown on the next payslip |
| S7 | Paydays | A **"Due for settlement"** list on the Workers tab (owner only). No phone notifications |
| S8 | Approach | Snapshot settlements on top of the existing running ledger. The ledger is not rewritten. Unlocking means voiding the settlement row |

## 3. Out of scope

- Paid leave (2B) and piece-rate (2C).
- PDF payslips and plain-text sharing (only the image is in scope).
- Payday notifications and reminders.
- Fixed per-worker advance instalments.
- Rate history with an effective date (B6). A period uses the worker's current rate, as everywhere else. The snapshot then freezes it.
- Settling part of a period, or settling a period before it ends. The one exception is a worker who has left (see §5.2).
- Editing a settlement. Corrections are made by unlocking and settling again.

## 4. Data model (schema `chukta`)

### 4.1 Pay-cycle settings

| Table | Column | Type | Notes |
|---|---|---|---|
| properties | `pay_cycle` | text not null default `'by_basis'` | `'by_basis'` \| `'weekly'` \| `'monthly'` |
| properties | `cycle_end_weekday` | smallint not null default 6 | 0 = Sunday … 6 = Saturday. The last day of a weekly period |
| workers | `pay_cycle` | text null | Per-worker override. null means use the property setting |
| workers | `cycle_end_weekday` | smallint null | Per-worker override. null means use the property setting |

Resolution (`resolveSettings` gains `payCycle` and `cycleEndWeekday`):
- **Monthly-paid worker:** always the calendar month. The cycle settings are ignored.
- **Otherwise:** the cycle is the worker's setting, or the property's, or `by_basis`. `by_basis` means weekly.
- **Week-end day:** the worker's setting, or the property's, or 6.

Permissions: these columns are **owner-only**.
- The property columns are covered by the existing owner-only update policy.
- For workers, extend the 2A trigger `chukta.guard_worker_pay_settings` with the two new columns. It must reject staff on both insert and update.

### 4.2 New table `settlements`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | Created on the phone |
| `property_id` | uuid not null → properties | |
| `worker_id` | uuid not null → workers | Must belong to `property_id` (consistency trigger) |
| `period_start` | date not null | |
| `period_end` | date not null | `period_end >= period_start` |
| `settled_on` | date not null | The day the owner settled |
| `pay_basis` | text not null | Snapshot |
| `rate_paise` | bigint not null | Snapshot |
| `opening_balance_paise` | bigint not null | Wage due carried in. Can be negative (overpaid) |
| `base_paise`, `offday_extra_paise`, `overtime_paise`, `bonus_paise`, `deduction_paise` | bigint not null | Earned breakdown for the period |
| `earned_paise` | bigint not null | Sum of the breakdown components (spec 2A §5.9) |
| `paid_in_period_paise` | bigint not null | Wage payments dated in the period that are **not** linked to this settlement |
| `paid_now_paise` | bigint not null ≥ 0 | |
| `advance_recovered_paise` | bigint not null ≥ 0 | |
| `advance_after_paise` | bigint not null | Advance outstanding after recovery |
| `closing_balance_paise` | bigint not null | `opening + earned − paid_in_period − paid_now`. Positive means owed to the worker; negative means overpaid |
| `summary` | jsonb not null | Attendance counts: `{present, half, absent, hoursTotal, daysOffPaid, daysOffUnpaid, offdayWorked, otHours}`. Also the explanation lines `[{key, params}]`. Stored as numbers and i18n keys only, never translated text |
| `note` | text null | |
| `voids_id` | uuid null → settlements | A void row unlocks the target. A void row copies the target's worker, property and period, with every amount 0 and `summary` `{}` |
| audit | `created_by`, `created_by_role`, `created_at`, `server_updated_at` | Same as the Phase 1 entry tables |

Indexes:
- `(worker_id, period_start)`;
- the sync cursor `(server_updated_at, id)`.

Triggers:
- `touch_server_updated_at`.
- `check_entry_consistency`: add `settlements` to its void-table list.
- `chukta.check_settlement_overlap`, BEFORE INSERT. For a non-void row, raise 23514 if an **active** settlement exists for the same worker whose period overlaps `[period_start, period_end]`. A settlement is active when it is not a void and no row voids it. Also raise 23514 if `period_start` isn't the day after the latest active settlement's `period_end`, or the worker's joining date when there is none. That makes settlements contiguous and in order.

### 4.3 Links from money rows

- `wage_payments.settlement_id` uuid null → settlements
- `advance_entries.settlement_id` uuid null → settlements. Used only for `type = 'repayment'`

These are set only by the settle action. They are not updatable: no update grant.

### 4.4 The lock

New trigger function `chukta.check_not_settled`. It runs BEFORE INSERT on `attendance_entries`, `overtime_entries`, `earning_adjustments`, `advance_entries`, `wage_payments` and `days_off`.

- **Worker rows:** raise **23514** (message `period is settled`) if the row's `date` falls inside an active settlement for `worker_id`. There is one exception: the row has a `settlement_id` that equals that same settlement's id.
- **`days_off`:** raise 23514 if the `date` falls inside an active settlement of **any** worker of `property_id`.
- **Void rows are not exempt.** Voiding an advance or payment dated inside a settled period also needs an unlock first.

Updates to `days_off` (rename, deactivate) for a settled date are also rejected by a BEFORE UPDATE trigger on `days_off`. That covers `is_active`, `portion` and `pay_rule` changes. A name-only change is allowed.

### 4.5 RLS summary

| Table | Select | Insert | Update | Delete |
|---|---|---|---|---|
| settlements | members of the property | **owner** only (`is_owner_of`), with `is_own_write` | none | none |
| pay-cycle columns | as their tables | owner (properties: existing policy; workers: guard trigger) | owner | none |
| `settlement_id` on money rows | as their tables | owner only when non-null (extend the insert policies, or add a trigger that rejects staff with a non-null `settlement_id`) | none | none |

A ShopAI-only token sees nothing, as before.

### 4.6 Phone side

Local SQLite **schema v4**:
- the new `settlements` table (`summary` stored as JSON text);
- the four new settings columns;
- `settlement_id` on `wage_payments` and `advance_entries`.

`SYNCED_TABLES`:
- `settlements` goes **before** `advance_entries` and `wage_payments`, so pull order respects the foreign keys.
- Push order follows the queue sequence. The settle action enqueues the settlement first.

The v4 migration also clears the pull cursors of `properties`, `workers`, `wage_payments` and `advance_entries`. That re-pulls them once, the same way as 2A I1.

## 5. Rules

### 5.1 Periods

For a worker with resolved cycle `C`:
- **Next period start** = the day after the latest **active** settlement's `period_end`, or `joining_date` when there is none.
- **Period end:**
  - monthly: the last day of the start's calendar month;
  - weekly: the first date ≥ start whose weekday is `cycle_end_weekday`.
- A period is **due** when `period_end < today` (in the session's local date).
- **Several due periods:** the due list and the Settle button always offer the **oldest** one. Periods are settled one at a time, in order.
- **A worker who has left:** the period containing `left_date` is due from `left_date` onward, and its `period_end` is cut to `left_date`. Nothing after `left_date` is ever due.
- **A cycle setting change:** it takes effect from the next period start, which is computed fresh, so periods stay back to back. The first period after a change may be shorter or longer than normal. For example, a weekly worker switched to monthly on the 10th gets a 10th → month-end period.

### 5.2 Figures for a period `[s, e]`

All figures come from the existing `calculateWorkerLedger`, which gains an optional `from` date. "Period ledger" below means that function run over `s..e`.

| Figure | How it's worked out |
|---|---|
| `opening_balance` | `wageDuePaise` from the ledger run from joining to `s − 1`. That means earned − all wage payments dated before `s`. 0 if `s` is the joining date |
| `base`, `offday_extra`, `overtime`, `bonus`, `deduction`, `earned` | From the period ledger, with dates limited to `max(s, joining)..min(e, left_date)` |
| `paid_in_period` | Sum of active wage payments dated in `[s, e]` |
| `wage_due_before_settle` | `opening + earned − paid_in_period` |
| `advance_outstanding` | Advance outstanding as of `e`: active advances minus repayments and write-offs dated ≤ `e` |

Rules for the calculation:
- **Bonus and deduction:** when `from` and an end date are given, only entries dated inside that range count. The opening-balance run likewise counts only entries dated ≤ `s − 1`. The all-time ledger (no `from`) is unchanged.
- **Monthly workers:** a full calendar-month period must equal the Phase 1 / 2A monthly result for that month exactly. A first month that starts on the joining date uses the existing partial-month rule.

### 5.3 Settle

**Inputs:**
- `advance_recovered` (default `min(advance_outstanding, max(wage_due_before_settle, 0))`). Must be ≥ 0 and ≤ `advance_outstanding`;
- `paid_now` (default `max(wage_due_before_settle − advance_recovered, 0)`). Must be ≥ 0;
- `mode` (cash, UPI or bank; required when `paid_now > 0`);
- `note`.

**Writes**, in one local transaction, enqueued in this order:
1. **The `settlements` row:**
   - `closing_balance = wage_due_before_settle − advance_recovered − paid_now`;
   - `advance_after = advance_outstanding − advance_recovered`.
2. **If `paid_now > 0`:** a `wage_payments` row with `amount = paid_now`, `date = e`, the chosen `mode`, `settlement_id`, and a note.
3. **If `advance_recovered > 0`:** an `advance_entries` row with `type = 'repayment'`, `amount = advance_recovered`, `date = e`, `mode = null`, `settlement_id`.

The recovered advance reduces the wage due in cash terms: it is paid out of wages. So `closing_balance` subtracts it. In the running ledger the repayment reduces the advance outstanding.

So that the running wage due stays consistent with the closing balance, **a settlement repayment also counts as a wage payment**. `calculateWorkerLedger` treats repayments that have a non-null `settlement_id` as paid wages (adding to `paidPaise`), as well as reducing the advance outstanding.

Example: wage due ₹5,000, advance ₹2,000, recover ₹2,000, pay ₹3,000 cash → closing balance 0, advance 0.

**Rules:**
- Owner only.
- The period must be the worker's oldest due period (§5.1).
- The repo re-checks overlap before writing.

### 5.4 Unlock

The owner confirms, and the app inserts a void row:
- `voids_id` = target;
- the target's worker, property and period;
- all amounts 0;
- `summary` `{}`.

The target becomes inactive:
- the period is no longer locked;
- it is due again;
- its payslip shows **"Unlocked"**.

The linked payment and repayment are **kept**, because that money really changed hands. When the period is settled again, they count in `paid_in_period` and in the recovered advance.

Only the **latest** active settlement of a worker can be unlocked. Unlock newer periods first.

### 5.5 Lock on the phone

`domain/lock.ts` `isSettled(settlements, workerId, date)`.

The repos refuse the following with a clear error (`period is settled`), mapped to the i18n message `settle.locked`:
- attendance, overtime, bonus or deduction, advance, payment and their voids;
- a day off when any worker of the property has that date settled.

The UI disables these actions up front.

## 6. Screens

- **Workers tab (owner only):**
  - A **"Due for settlement"** section at the top. Each row shows the worker, the period ("1–7 Sep"), and the wage due before settle.
  - Oldest periods come first, one row per worker (the oldest due period).
  - Tapping a row opens Settle.
- **Worker detail:**
  - Owner: a **Settle** button when a period is due, with the period as its label.
  - Everyone: a **Payslips** section listing settlements, newest first: period, paid now + recovered, and an "Unlocked" chip when voided. Tapping one opens the payslip.
  - The month calendar marks settled days with a small lock.
- **Settle screen (owner):**
  - The period header.
  - Explanation lines.
  - Opening balance (or "overpaid ₹X").
  - Paid during the period.
  - Wage due.
  - Advance outstanding.
  - Fields: Advance recovered, Paid now, Mode, Note.
  - Live preview: "Carries forward: owed ₹X / overpaid ₹X / settled in full".
  - **Settle** button with a confirm step. On success, opens the payslip.
- **Payslip screen:**
  - Shop name, property, worker, period, pay type and rate.
  - The attendance summary.
  - Earnings: base, day-off work, overtime, bonus.
  - Deductions: deduction entries, advance recovered.
  - Opening balance, paid during the period, paid now, carried forward, advance left.
  - Settled on (date).
  - **Share as image** (`react-native-view-shot` → `expo-sharing`).
  - Owner: **Unlock**, with a warning and a confirm step.
  - It always renders in the app's current language from the snapshot.
- **Today:**
  - For a worker whose period is settled on the chosen date, the row shows a "Settled" chip and its controls are disabled.
  - "Shop closed today" is blocked with a message if any worker's period is settled on that date.
  - Bulk marking skips settled rows.
- **Settings:**
  - The property form gains **"Pay cycle"**: by pay type / weekly / monthly, and "Week ends on" (a weekday picker).
  - The worker form's "Customize for this worker" gains the same two settings. Owner only, and hidden for monthly-paid workers.
- **Money entry / Holiday form:** saving inside a settled period shows `settle.locked` and offers no override.

All new strings are in `en.json`, `bn.json` and `hi.json`. Bengali uses Bengali digits in text.

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Paid now = 0 or recovered = 0 | No payment row or repayment row for that part. The settlement still locks |
| Opening balance already overpaid | Paid now defaults to 0. Carry-forward shows overpaid |
| Worker joins mid-period | The first period starts on the joining date |
| Worker has left | Final period up to `left_date`, due from `left_date`. Nothing after it |
| Rate changed before settling | The whole period uses the current rate (as today). The snapshot freezes it |
| Two owner phones settle the same period offline | The second settlement is refused by the server's overlap trigger. Its linked payment and repayment are refused by the foreign key or lock. All of them show on "entries that didn't sync". No duplicate money |
| Staff mark attendance offline for a date the owner settles meanwhile | The server refuses it (lock). It appears on "entries that didn't sync" |
| Holiday added to a settled date | Refused. Unlock first |
| Unlock, then settle again | The old slip stays marked "Unlocked". The new slip includes the earlier linked payments |
| Cycle setting changed | Applies from the next period start. Earlier settlements are unchanged |
| A weekly period spans two calendar months | Allowed. Weeks don't follow months |
| Worker with no attendance in the period | Earns per the existing rules (for example, a monthly worker with no absences gets the full month) |

## 8. Testing

- **pgTAP (run live using the 2A wrapper method):**
  - settlement permissions (owner can insert; staff can't; nobody can update or delete);
  - overlap and order trigger;
  - the lock on all six tables, including the exemption for linked payments and repayments, and void rows not being exempt;
  - the days_off update lock;
  - unlock frees the lock;
  - staff can't set `settlement_id`;
  - the pay-cycle guard for staff.
- **Jest, domain:**
  - cycles: month, week ending Saturday and Wednesday, mid-period join, leaving date, cycle change;
  - figures, in exact paise:
    - a monthly full month matches the all-time ledger;
    - a daily week with a holiday and overtime;
    - opening balance carried;
    - recovery capped;
    - overpaid opening;
  - closing balance;
  - repayments linked to a settlement count as paid wages;
  - the lock check.
- **Jest, repos:**
  - settle writes the rows in order with links;
  - zero parts are skipped;
  - non-owners are refused;
  - an out-of-order period is refused;
  - unlock;
  - every repo refuses settled dates.
- **Jest, views and screens:**
  - due list ordering;
  - Settle flow and preview;
  - payslip numbers;
  - unlock;
  - staff can view but not settle;
  - the Today "Settled" row;
  - pay-cycle settings.
- **Schema:** a real v3 → v4 upgrade with data, including the cursor reset.
- **Manual:**
  - settle a weekly worker and a monthly worker;
  - share a slip on WhatsApp;
  - unlock and settle again;
  - a staff offline conflict;
  - both phones show the same balances.
