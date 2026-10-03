# Chukta Phase 2A — Calendar & Extra Pay — Design

**Date:** 2026-10-03
**Status:** Approved in brainstorming, pending written-spec review
**Builds on:** `docs/superpowers/specs/2026-09-29-chukta-phase1-design.md` (Phase 1, shipped)
**Product source:** `Chukta-Worker-Pay-Advance-&-Wage-Diary-feature-plan.md` §5 D, F (and edge cases 10, 12)

Phase 2 is split into four pieces, built in this order: **2A calendar & extra pay** (this spec) → 2D settlement & payslips → 2B paid leave → 2C piece-rate.

---

## 1. Goal

Make the wage calculation reflect the days and extras a real shop deals with every week:
- holidays and unexpected closures (full or half day), paid or unpaid by pay basis;
- work done on a day off, paid as extra;
- overtime;
- bonuses and deductions.

All of it must work offline, sync like Phase 1 data, and be available in English, Bengali and Hindi.

## 2. Decisions

| # | Decision | Choice |
|---|---|---|
| A1 | Holiday source | The owner adds each holiday (pick a suggested festival name or type one). No shipped dated calendar |
| A2 | Holiday pay | Follows pay basis by default (monthly and weekly paid; daily and hourly unpaid). Each holiday can override to *paid for everyone* or *unpaid for everyone* |
| A3 | Closures | One "days off" calendar with `kind` = holiday or closure. A one-tap "Shop closed today" on the Today screen adds a closure |
| A4 | Work on a day off | Paid as extra: work credit × day rate × multiplier (1×, 1.5×, 2×). Property default with a per-worker override. The owner can type a custom amount on any single entry instead |
| A5 | Overtime rate | Mode is either *multiplier* (× hourly base) or *fixed* ₹/hr. Property default with a per-worker override. The owner can type a custom amount on any single entry |
| A6 | Overtime entry | By-hours workers: hours above the shift count as overtime automatically. Anyone: an explicit "+ Overtime" entry. An explicit entry replaces the automatic figure for that date |
| A7 | Bonus and deduction | Both included. A deduction requires a reason. A bonus note is optional |
| A8 | Permissions | Staff may add a closure, mark work on a day off and enter overtime hours. Owner only: holiday calendar, editing days off, custom amounts, bonus and deduction, pay settings |
| A9 | Data approach | New focused tables plus settings columns. Work on a day off reuses the existing attendance statuses |

## 3. Out of scope

- Settlement cycles and slips (2D); paid leave (2B); piece-rate (2C).
- A shipped festival calendar with dates, and Bengali calendar dates (D7).
- Per-worker holiday overrides (D6). Per-worker *extra-pay rate* overrides are in scope; per-worker *holiday* overrides are not.
- The rule that skipping the days around a holiday loses holiday pay (E9).
- Rate history with an effective date (B6). A rate change still applies from joining, as in Phase 1.

## 4. Data model (schema `chukta`)

Common columns as in Phase 1: `id uuid pk` (client-generated), `property_id`, `created_by`, `created_by_role ('owner','staff')`, `created_at` (client time), `server_updated_at` (trigger-stamped sync cursor). Nothing is ever hard-deleted.

### 4.1 New table `days_off`

| Column | Type | Rule |
|---|---|---|
| `date` | date | |
| `name` | text | Required, non-empty |
| `kind` | text | `'holiday'` \| `'closure'` |
| `portion` | text | `'full'` \| `'half'` |
| `pay_rule` | text | `'by_basis'` \| `'all_paid'` \| `'all_unpaid'`, default `by_basis` |
| `is_active` | bool | Default true. Deactivate instead of delete |

- **Effective entry for a date** = the active row with the greatest `(created_at, id)`. Several rows on one date are allowed (two phones offline), so sync never fails on them.
- **Updatable columns** (owner only): `name`, `kind`, `portion`, `pay_rule`, `is_active`.
- **Staff** may insert only rows with `kind = 'closure'`, and cannot update.

### 4.2 New table `overtime_entries`

| Column | Type | Rule |
|---|---|---|
| `worker_id` | uuid | Same property as the row (consistency trigger, as in Phase 1) |
| `date` | date | |
| `hours` | numeric(4,2) | 0 ≤ hours ≤ 16. 0 clears overtime for that date |
| `custom_amount_paise` | bigint null | ≥ 0. Must be null on staff-written rows |
| `note` | text null | |

- Append-only, like attendance. The effective entry per `(worker_id, date)` is the greatest `(created_at, id)`.

### 4.3 New table `earning_adjustments`

| Column | Type | Rule |
|---|---|---|
| `worker_id` | uuid | Same property |
| `type` | text | `'bonus'` \| `'deduction'` |
| `amount_paise` | bigint | > 0 |
| `date` | date | |
| `note` | text null | Required (non-empty) when `type = 'deduction'` and the row is not a void |
| `voids_id` | uuid null | Correction by void, same rules as `advance_entries` (same worker, cannot void a void) |

- Owner: select and insert (including voids). Staff: select only.

### 4.4 Changes to existing tables

- `attendance_entries`: add `custom_amount_paise bigint null` (≥ 0). It's only meaningful when the date is a day off for the worker. It must be null on staff-written rows.
- `properties`: add
  - `offday_multiplier numeric(3,2) not null default 1`, check between 1 and 3;
  - `ot_mode text not null default 'multiplier'`, check in `('multiplier','fixed')`;
  - `ot_multiplier numeric(3,2) not null default 1`, check between 1 and 3;
  - `ot_rate_paise bigint null`, check > 0;
  - check: `ot_mode <> 'fixed' or ot_rate_paise is not null`.
- `workers`: add nullable overrides `offday_multiplier`, `ot_mode`, `ot_multiplier`, `ot_rate_paise`, with the same checks. Null means "use the property default". A worker whose resolved `ot_mode` is `fixed` must resolve to a non-null `ot_rate_paise`. This is enforced in the app form; the ledger falls back to multiplier 1 if it is ever missing.
- Column grants: the new property and worker columns are added to the UPDATE grants and to the app's `UPDATABLE_COLUMNS`.

### 4.5 RLS summary

| Table | Owner | Staff |
|---|---|---|
| `days_off` | select / insert / update | select; insert only `kind='closure'` |
| `overtime_entries` | select / insert | select / insert, with `custom_amount_paise` null |
| `earning_adjustments` | select / insert (including voids) | select only |
| `attendance_entries` (new column) | may set `custom_amount_paise` | must leave it null |

As in Phase 1: no DELETE anywhere, `anon` gets nothing, and ShopAI tokens (`app='shopai'`) get nothing.

### 4.6 Phone side

- `days_off`, `overtime_entries` and `earning_adjustments` join `SYNCED_TABLES` with their column lists.
- The local SQLite schema moves to **version 3**: the new tables, the new columns, and indexes on `(property_id, date)` for `days_off` and `(worker_id, date)` for `overtime_entries` and `earning_adjustments`.
- Existing rows are unchanged. Every existing wage figure is identical until a day off, overtime or adjustment is added.

## 5. Wage calculation (`calculateWorkerLedger`)

### 5.1 Inputs

The Phase 1 inputs, plus:
- the property's effective `days_off` rows;
- the worker's effective overtime entries;
- the worker's earning adjustments;
- the resolved extra-pay settings: `offdayMultiplier`, `otMode`, `otMultiplier`, `otRatePaise`. Resolution is worker override, else property default, in `resolveSettings`.

### 5.2 Rates

- **Day rate:**
  - daily: `rate`;
  - weekly: `rate / 7`;
  - monthly: `rate / divisor` for that calendar month (same divisor as Phase 1);
  - hourly: `rate × shiftHours`.
- **Hourly base** = day rate / shiftHours. For hourly workers this is `rate`.

### 5.3 Day classification

For each date in `joining_date .. min(today, left_date)`:

1. Find the **day-off source**: the worker's weekly off, and/or the property's effective `days_off` row for that date.
2. If neither applies → a **working day**, Phase 1 rules unchanged (plus overtime, 5.6).
3. **Paid?**
   - The weekly off is paid by basis, as in Phase 1: monthly and weekly yes, daily and hourly no.
   - A `days_off` row with `by_basis` uses the same basis rule; `all_paid` and `all_unpaid` override it.
   - If both a weekly off and a `days_off` row apply, the day **counts once** and is **paid if either says paid** (edge case 10).
4. **Portion:**
   - The weekly off is always full.
   - A `days_off` row has its own portion.
   - If both apply, the day is full.

### 5.4 Full day off

- **Paid:**
  - monthly: no deduction (credit 1);
  - weekly: credit 1;
  - daily: credit 1 × rate;
  - hourly: shiftHours × rate.
- **Unpaid:**
  - monthly: deducted like an absence (1 day × perDay);
  - daily, weekly and hourly: nothing.
- Attendance on that date means **work on a day off**, see 5.5.

### 5.5 Work on a day off (full day off only)

The **work credit** comes from the effective attendance entry:
- `present` → 1;
- `half_day` → 0.5;
- `hours` → min(h / shift, 1);
- `absent` or no entry → 0.

**Extra** = `custom_amount_paise` if set on that attendance entry; otherwise `workCredit × dayRate × offdayMultiplier`. This is added on top of any off-pay from 5.4. It covers edge case 12 (half a day on an off-day is paid as extra).

### 5.6 Half day off

The day = an off half plus a work half:
- **off half:** 0.5 if paid, 0 if unpaid. Monthly: an unpaid off half deducts 0.5 × perDay;
- **work half** from attendance:
  - `present` or no entry → 0.5;
  - `half_day` → 0.5;
  - `absent` → 0;
  - `hours` → min(h / shift, 0.5).

  Monthly deductions follow: 0.5 − workHalf is deducted, like a partial absence.
- No day-off extra applies on a half day off.

### 5.7 Overtime

For each date:
- **OT hours:**
  - if an effective `overtime_entries` row exists for the date, use its `hours`;
  - otherwise, if the effective attendance is `hours` with h > shift, OT = h − shift (the work credit stays capped as in Phase 1).
- **OT pay:**
  - `custom_amount_paise` if set on the overtime entry;
  - otherwise `otMode = multiplier` pays `otHours × hourlyBase × otMultiplier`;
  - `otMode = fixed` pays `otHours × otRatePaise`.
- Overtime is allowed on day-off dates too, from an explicit entry or from hours above the shift.

### 5.8 Adjustments

Using `activeMoneyRows` (excludes voids and voided rows): `bonusPaise` = Σ bonus and `deductionPaise` = Σ deduction.

### 5.9 Outputs

All values are paise, rounded half-up once at the end, as in Phase 1:
- `basePaise`: the Phase 1 earned figure, now including days-off pay;
- `offdayExtraPaise`;
- `overtimePaise`;
- `bonusPaise`;
- `deductionPaise`;
- `earnedPaise = base + offdayExtra + overtime + bonus − deduction`;
- `paidPaise`, `wageDuePaise = earned − paid`, `advanceOutstandingPaise`: unchanged.
- `explanation`: Phase 1 lines plus one plain-words line per non-zero component. For example:
  - "2 holidays (paid)";
  - "1 day worked on a day off × ₹500 × 1.5";
  - "3 OT hours × ₹62.50 × 1.5";
  - "Bonus ₹500";
  - "Deduction ₹200".

  All are localized.

**Invariant kept:** a full month with no absences, no unpaid days off and no extras still equals exactly the monthly salary.

## 6. Screens

- **Today**
  - **"Shop closed today"** button (owner and staff): full or half day, a reason (suggestions: bandh, rain, power cut, or free text), confirm. It adds a `closure` with `pay_rule = by_basis`.
  - When the selected date is a day off, a banner shows the name and kind, and each worker row offers **"Worked"** (full or half) instead of present or absent. It writes an attendance entry. An owner may add a custom amount.
  - Each worker row gets **"+ Overtime"**: an hours field for owner and staff, plus a custom-amount field for the owner.
  - By-hours rows show "incl. Nh OT" when hours exceed the shift.
- **Settings → Holidays** (owner)
  - A list (upcoming first, then past).
  - **Add holiday:** a suggested-name picker or free text, date, full or half day, and pay rule.
  - Tap an entry to edit it or deactivate it.
- **Property settings** (owner): a new **"Extra pay"** section with the day-off multiplier (1× / 1.5× / 2×), overtime mode, and the multiplier or ₹/hr.
- **Add/Edit worker** (owner): the "Customize for this worker" card gains the same four extra-pay overrides.
- **Worker detail**
  - The explanation shows the new lines.
  - New owner actions **Bonus** and **Deduction** (amount, date, note; reason required for a deduction).
  - Both appear in the money history and are correctable by void.
  - The month calendar marks holidays, closures, work on a day off, and overtime.
- All new strings are in `en.json`, `bn.json` and `hi.json`.

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Holiday added after attendance was already marked that day | Day-off rules apply; a "present" becomes work on a day off. Visible on the calendar; the owner can correct it |
| Two closures for one date (offline) | Both sync; the latest active entry wins |
| Holiday on a weekly off | Counted once; paid if either rule pays |
| Explicit overtime and hours above the shift on the same date | The explicit entry wins; never double-counted |
| Fixed overtime mode with no rate | The form blocks saving and the server check rejects it; the ledger falls back to 1× |
| Deduction larger than earned | Allowed; wage due goes negative ("overpaid") |
| Day off before joining or after leaving | Ignored |
| Holiday deactivated | Drops out of the calculation on the next read |
| An old app version reading new data | Unknown columns and tables are ignored; no crash |

## 8. Testing

- **pgTAP:**
  - constraints (kinds, portions, hours range, deduction note, fixed-mode rate, void rules);
  - RLS matrix: owner, other shop's owner, staff of this or another property, ShopAI token, anon;
  - staff rejected for holidays, edits, custom amounts, and bonus or deduction.
- **Jest — ledger:** every rule in §5, including:
  - paid and unpaid holidays per pay basis;
  - all_paid and all_unpaid overrides;
  - half-day closure with each attendance status;
  - a holiday on a weekly off counted once;
  - work on a day off at 1×, 1.5× and with a custom amount;
  - automatic and explicit overtime and their precedence;
  - fixed and multiplier overtime;
  - monthly overtime using that month's perDay;
  - bonus, deduction and voids;
  - the full-month invariant;
  - Phase 1 cases unchanged.
- **Jest — other:**
  - repos for the new tables;
  - `resolveSettings` overrides;
  - local schema v2→v3 upgrade;
  - pull and push round-trip for the new tables;
  - screen tests for Shop closed today, Worked on a day off, + Overtime, the holiday list and form, the bonus and deduction forms;
  - owner-only actions hidden for staff;
  - i18n parity.
- **Manual:** an owner and a staff phone on one property. A closure entered offline, a holiday added, work on a day off, overtime both ways, and a bonus and deduction. Both phones show the same balances after syncing.
