# Chukta: Feature Plan

A digital khata for workers. One app where any shop, workshop, contractor or household records attendance exceptions, advances and payments for each worker, and always knows the correct amount due.

Priority tags used throughout: **[V1]** must be in the first launch, **[V2]** add once real shops are using it, **[Later]** only if users ask.

---

## 1. Product in one line

The owner always knows what each worker has earned, taken as advance and is still owed, and the worker can see the same numbers, so there is nothing left to argue about.

It should feel like the notebook the owner already keeps, not like HR software.

## 2. Who it is for

| Segment | Typical pay pattern | Main pain | What wins them |
|---|---|---|---|
| Garment shops | Monthly, some per-piece | Piece counts, festival advances | Piece entry, running advance balance |
| Hardware / retail shops | Monthly or daily | Absences, half-days, overtime | Zero-tap default attendance, auto salary |
| Small industries / workshops | Weekly | Weekly cash planning, advance recovery | Weekly settlement, cash-needed view |
| Contractors / daily labour | Daily wage, paid daily or weekly | Many workers, quick daily payments | Fast headcount, pay-now entries |
| Households | Monthly | Leaves, advances, "you didn't pay me" | Simple record both sides can see |

**Suggested lead segment:** small shops and workshops paying weekly or monthly. Households come along as a natural add-on with the same app.

## 3. Design principles (rules the app never breaks)

1. **Default is present.** Owners only record exceptions (absent, half-day). A normal day costs zero taps.
2. **Nothing is ever silently changed or deleted.** Corrections are new entries. Everything has a visible history.
3. **Money is always explainable.** Every amount on a slip shows how it was calculated.
4. **Advances are a core feature, not an add-on.** Running balance is always visible.
5. **Works with no internet.** Shops have poor connectivity; the app must never block on it.
6. **Owner's settings decide the rules.** The app gives sensible defaults but never forces a labour-law opinion on the owner.
7. **No HR vocabulary.** Words like "payroll", "CTC", "TDS" do not appear in V1.
8. **Five minutes to first use.** A new owner is marking attendance within five minutes of installing.
9. **Salaries are private.** Amounts are lockable and never visible to people who should not see them.
10. **Worker never needs to install anything** to see their own record.

## 4. Core concepts (keep these clear in the app)

- **Worker:** a person being tracked.
- **Pay basis (how they earn):** daily wage, weekly wage, monthly salary, or per-piece.
- **Pay cycle (how often they are settled):** daily, weekly or monthly. This is separate from pay basis. A daily-wage worker who is paid every Saturday has basis "daily" and cycle "weekly".
- **Exception:** an absence, half-day, overtime or extra-work entry. Days with no exception count as present.
- **Advance:** money given before it is earned.
- **Recovery:** the part of an advance deducted at settlement.
- **Payment:** money actually handed over (cash or UPI). Part payments are allowed.
- **Settlement:** the calculation for one pay cycle: earned, minus deductions, minus advance recovery, minus what has already been paid = due.
- **Slip:** the shareable summary of a settlement.

---

## 5. Feature list by module

### A. Setup and onboarding

| ID | Feature | Tag | Notes |
|---|---|---|---|
| A1 | Business type question ("What do you run?": shop, workshop, contractor, home) | V1 | Pre-fills sensible roles, pay cycles and holiday defaults |
| A2 | Business name and owner name | V1 | Appears on slips |
| A3 | Language choice on first screen (Bengali, Hindi, English) | V1 | Changeable anytime |
| A4 | Import workers from phone contacts | V1 | Saves typing; optional |
| A5 | Quick-add worker (only name and rate) | V1 | Everything else can be filled later |
| A6 | Sample data / demo mode | V2 | Lets an owner try it before entering real workers |
| A7 | Guided first-week checklist | V2 | "Add 3 workers, mark one absence, record one advance" |

### B. Workers

| ID | Feature | Tag | Notes |
|---|---|---|---|
| B1 | Worker profile: name, phone, role, photo (optional), joining date | V1 | Joining date limits which days count |
| B2 | Pay basis and rate per worker | V1 | Daily, weekly, monthly or per-piece |
| B3 | Pay cycle and payday per worker | V1 | Weekly: which weekday. Monthly: which date or month end |
| B4 | Weekly off per worker (one fixed day, or none) | V1 | Rotating offs are V2 |
| B5 | Monthly divisor choice (calendar days, 26 or 30) | V1 | The most common source of salary disputes, so make it explicit and print it on the slip |
| B6 | Rate change with effective date | V1 | Old settlements never change when the rate changes |
| B7 | Worker status: active, on notice, left | V1 | Left workers keep their history |
| B8 | Exit date and final settlement | V1 | See module J |
| B9 | Rejoin a former worker | V2 | Keeps history under one profile |
| B10 | Group workers by team, site or department | V2 | Useful for contractors and workshops |
| B11 | Add a one-day casual worker | V2 | Headcount labour, name and rate only |
| B12 | Rotating weekly offs | V2 | For shops that stagger staff |
| B13 | Worker documents (ID proof, agreement) | Later | Also raises data-protection duties, see module Q |
| B14 | Probation / trial period | Later | |

### C. Attendance (exception-based)

| ID | Feature | Tag | Notes |
|---|---|---|---|
| C1 | Default present from joining date until today | V1 | Future days are never counted |
| C2 | Mark absent or half-day in two taps (worker, then status) | V1 | |
| C3 | Mark several workers absent in one go | V1 | For days when a group is out |
| C4 | Calendar view per worker with colour-coded days | V1 | Green present, red absent, yellow half-day, grey off/holiday |
| C5 | Backdated entries allowed | V1 | With visible history (module O) |
| C6 | Daily confirm prompt: "Anyone absent today?" with a **No, all present** button | V1 | Records that the day was actually reviewed. Time is owner's choice |
| C7 | Unconfirmed-day warning on settlement screen | V1 | "4 days were never confirmed, review before paying" |
| C8 | Pre-settlement review: one screen showing each worker's calendar for the cycle | V1 | Owner confirms or fixes before money is calculated |
| C9 | Optional turn-off of the daily confirm prompt | V1 | Some owners will hate notifications |
| C10 | Absence reason note (sick, family, no information) | V1 | Optional free text or a few presets |
| C11 | "Absent without informing" flag | V2 | For owners who penalise it |
| C12 | Late-arrival marker with optional deduction rule | Later | |
| C13 | Hours-based attendance (worked 4 hours = half-day) | Later | Only if daily-wage users ask |
| C14 | Selfie or face check-in, location check-in | Later | Adds cost and privacy load, not needed to win the first users |

### D. Holidays, weekly offs and closures

| ID | Feature | Tag | Notes |
|---|---|---|---|
| D1 | Holiday calendar with regional festival presets (Durga Puja, Poila Boishakh, Eid, Diwali, Holi, national holidays) | V1 | Fully editable; small shops rarely follow the official list |
| D2 | Per-holiday behaviour: paid or unpaid, by pay basis | V1 | Defaults in the table below |
| D3 | One-tap "Shop closed today" for surprise closures (bandh, rain, power cut) | V1 | Applies to everyone; owner picks paid or unpaid |
| D4 | Half-day closure | V1 | |
| D5 | Worked on a holiday or weekly off: one tap to mark | V1 | Paid as an extra day or at a higher rate, owner's choice |
| D6 | Override any holiday rule per worker | V2 | |
| D7 | Bengali calendar dates and months | Later | Only if local owners think in that calendar |

**Default pay rules (owner can change each one):**

| Situation | Monthly salary | Weekly wage | Daily wage |
|---|---|---|---|
| Weekly off | Paid | Paid | Not paid |
| Festival holiday | Paid | Paid | Not paid |
| Unexpected closure | Paid | Owner chooses | Not paid |

### E. Leaves

Leave is **off by default**. In most small shops, absent simply means deduction. Owners who want a leave system switch it on.

| ID | Feature | Tag | Notes |
|---|---|---|---|
| E1 | Paid-leave quota per worker: per month or per year | V1 | Owner sets the number (for example 1 a month, or 12 a year) |
| E2 | Auto-classification: an absence uses paid leave if balance exists, otherwise unpaid | V1 | Owner can flip it in one tap |
| E3 | Half-day leave uses 0.5 of the balance | V1 | |
| E4 | Carry-forward: yes or no | V1 | |
| E5 | Reset rule: calendar year, financial year or joining anniversary | V1 | |
| E6 | Worker sees their leave balance | V1 | Via the worker link, see module K |
| E7 | Leave requests from workers | Later | Most small workers will simply phone the owner |
| E8 | Separate sick leave | Later | Two leave types confuse most small shops |
| E9 | Rule: skipping the days around a holiday also loses the holiday pay | Later | Expect requests, skip for now |

### F. Overtime and extra work

| ID | Feature | Tag | Notes |
|---|---|---|---|
| F1 | Overtime entry in hours per worker per day | V1 | |
| F2 | Overtime rate: fixed per hour, or a multiple (1x, 1.5x, 2x) of the worker's hourly rate | V1 | Hourly rate derived from day rate and shift length (owner sets shift hours) |
| F3 | Extra day on a holiday or weekly off | V1 | Same as D5 |
| F4 | Bonus entry (festival bonus, incentive, tip) with a note | V1 | |
| F5 | Other deduction entry (fine, damage) with a mandatory reason | V2 | Reason is compulsory to reduce disputes |

### G. Piece-rate work (garments and small industry)

| ID | Feature | Tag | Notes |
|---|---|---|---|
| G1 | Item list with rate per piece (shirt, trouser, bag) | V1 | |
| G2 | Daily piece entry per worker per item | V1 | |
| G3 | Enter pieces for several workers in one screen | V1 | Owners batch this at the end of the day |
| G4 | Rate change with effective date | V1 | Old entries keep the old rate |
| G5 | Base pay plus piece incentive combination | V2 | |
| G6 | Rejected or returned pieces reduce count | V2 | Needs a clear owner-visible reason |
| G7 | Worker confirms daily piece count via link | V2 | Piece counts are the big dispute in this segment |

### H. Advances

| ID | Feature | Tag | Notes |
|---|---|---|---|
| H1 | Record an advance with date, amount, mode and optional reason | V1 | |
| H2 | Running advance balance per worker, always visible | V1 | |
| H3 | Recovery plan: fixed amount per cycle, or manual at each settlement | V1 | |
| H4 | Recovery never makes net pay negative | V1 | The unrecovered part carries to the next cycle |
| H5 | Owner can skip a cycle's recovery in one tap | V1 | Festival months, illness |
| H6 | Worker repays an advance in cash outside settlement | V1 | Reduces the balance |
| H7 | Write off or forgive an advance (fully or partly) | V1 | Needs a note; shows in history |
| H8 | Advance limit warning ("already 60% of this month's earnings") | V2 | Owner sets the limit |
| H9 | Festival advance planner ("Durga Puja in 3 weeks: who usually asks for an advance?") | V2 | Based on the owner's own past entries |
| H10 | Advance requests from workers | Later | |

### I. Payments

| ID | Feature | Tag | Notes |
|---|---|---|---|
| I1 | Record a payment: amount, date, mode (cash, UPI, bank), note | V1 | |
| I2 | Part payments, with balance still due | V1 | |
| I3 | Mid-cycle payments ("draw against wages") | V1 | Very common for daily-wage workers paid weekly |
| I4 | "Pay today's wage" quick action for daily workers | V1 | One tap, amount prefilled |
| I5 | Mark a settlement as fully paid | V1 | |
| I6 | Overpayment handling (paid more than due) | V1 | Treated as an advance automatically, with a prompt to confirm |
| I7 | Cash needed forecast: "You need about Rs X on Saturday" | V2 | Sums due amounts for the coming payday |
| I8 | Pay by UPI from inside the app | Later | Regulatory and support load; recording is enough at first |

### J. Settlement and slips

**Settlement flow (V1):** pick cycle, review attendance, review advances, add any bonus or deduction, confirm, record payment, share slip. The cycle is then locked.

| ID | Feature | Tag | Notes |
|---|---|---|---|
| J1 | Automatic settlement for any pay cycle | V1 | Earned, overtime, bonus, deductions, advance recovery, paid, due |
| J2 | Slip shows the formula in plain words | V1 | "26 days at Rs 400, divisor 30" and so on |
| J3 | Slip shows advance balance after this settlement | V1 | |
| J4 | Share slip as an image or PDF on WhatsApp | V1 | |
| J5 | Cycle lock after confirmation | V1 | Later corrections appear as an adjustment in the next cycle, never as a change to a closed one |
| J6 | Final settlement when a worker leaves | V1 | Dues, extra days, outstanding advance netted; option to write off or keep as owed |
| J7 | Settle several workers at once (weekly batch) | V1 | Owners settle everyone on payday |
| J8 | Worker acknowledgement ("Received Rs X") via link | V2 | The strongest dispute-stopper |
| J9 | Custom slip branding (logo, shop name, footer message) | V2 | Free plan carries a small "Made with Chukta" footer |
| J10 | Year-end summary per worker | V2 | |

### K. Worker view and sharing

| ID | Feature | Tag | Notes |
|---|---|---|---|
| K1 | Read-only link sent over WhatsApp, no install, no login | V2 | Shows calendar, leave balance, advance balance, dues, past slips |
| K2 | Link in the worker's language | V2 | Set per worker |
| K3 | Owner controls what the worker sees (for example hide other workers, hide notes) | V2 | |
| K4 | Revoke or regenerate a link | V2 | Needed when a phone changes hands |
| K5 | Worker can flag an entry as wrong ("I was present on the 12th") | V2 | Owner sees a flag and resolves it |
| K6 | Share plain-text or image summary on WhatsApp without the link | V1 | The V1 stand-in until K1 exists |

### L. Reminders

| ID | Feature | Tag | Notes |
|---|---|---|---|
| L1 | Daily confirm prompt | V1 | See C6 |
| L2 | Payday reminder with amount due | V1 | |
| L3 | Pending advance reminder | V2 | |
| L4 | Unsettled cycle reminder | V2 | "Last week is still not settled" |
| L5 | Festival coming: advance and bonus planning | V2 | |
| L6 | All reminders individually switchable | V1 | |

### M. Reports

| ID | Feature | Tag | Notes |
|---|---|---|---|
| M1 | Monthly summary for all workers: earned, paid, due | V1 | |
| M2 | Worker statement: full ledger for any date range | V1 | Shareable |
| M3 | Advances outstanding across all workers | V1 | "Who owes me what" |
| M4 | Attendance summary per worker per month | V1 | |
| M5 | Total cash paid out this month | V2 | |
| M6 | Yearly overview | V2 | |
| M7 | Export to Excel or CSV for the accountant | V2 | |
| M8 | Cost trends (payroll cost per month) | Later | |

### N. Multiple users and businesses

| ID | Feature | Tag | Notes |
|---|---|---|---|
| N1 | Single owner, single business | V1 | |
| N2 | Second owner phone (spouse, partner) sees the same data | V2 | |
| N3 | Manager role: can mark attendance and piece counts, cannot see salaries or advances | V2 | Common for shops with a floor manager |
| N4 | Accountant role: view and export only | V2 | |
| N5 | Multiple businesses or sites under one account | V2 | Shop plus home, or several sites |
| N6 | Manager entries need owner approval | Later | |

### O. Trust and audit

| ID | Feature | Tag | Notes |
|---|---|---|---|
| O1 | Every entry stores who made it and when | V1 | |
| O2 | Corrections are new entries; the original stays visible, struck through | V1 | |
| O3 | Change history per worker | V1 | |
| O4 | Undo the last action within a few seconds | V1 | For mis-taps |
| O5 | Backdated edits are marked as backdated | V1 | Owners will backdate, workers will notice |
| O6 | Locked cycles cannot be edited | V1 | See J5 |

### P. Language and usability

| ID | Feature | Tag | Notes |
|---|---|---|---|
| P1 | Bengali, Hindi, English across the whole flow, not just labels | V1 | Includes slips and reminders |
| P2 | Large tap targets, icons alongside words | V1 | Many owners are not comfortable reading long text |
| P3 | Indian number formatting (lakhs) and rupee symbol | V1 | |
| P4 | Light, small app that runs on low-end phones | V1 | |
| P5 | Voice input for notes | Later | |
| P6 | More regional languages | Later | |

### Q. Data safety and privacy

| ID | Feature | Tag | Notes |
|---|---|---|---|
| Q1 | Works fully offline | V1 | |
| Q2 | Automatic cloud backup when online | V1 | Owners lose phones; "I lost all my data" is the fastest way to lose trust |
| Q3 | Restore on a new phone by phone-number verification | V1 | |
| Q4 | Export everything (PDF or CSV) at any time | V1 | Owner owns the data |
| Q5 | App lock (PIN or fingerprint) | V1 | Salaries are sensitive, and phones get shared at home and in shops |
| Q6 | Hide amounts on the home screen | V2 | For a phone used near workers |
| Q7 | Collect minimum worker personal data; get consent before sharing a link | V1 | Before storing ID documents, check India's data-protection rules |
| Q8 | Delete a worker's data or the whole account on request | V1 | |
| Q9 | Not a compliance product: slips carry a note that they are a record and not a legal document | V1 | PF, ESI and minimum-wage compliance are out of scope until owners ask |

### R. Account and plans

| ID | Feature | Tag | Notes |
|---|---|---|---|
| R1 | Free plan: 2 to 3 workers, basic attendance and one settlement view | V1 | |
| R2 | Paid yearly plan: more workers, slips, reports, reminders | V1 | Charge for month-end settlement and history, not for marking attendance |
| R3 | Pay by UPI subscription | V1 | The payment method your users already trust |
| R4 | Free trial of paid features for the first month | V2 | |
| R5 | Referral reward (free months for bringing another shop) | V2 | Fits how these owners already recommend things |

---

## 6. Edge-case register (what the app must do)

| # | Situation | Expected behaviour |
|---|---|---|
| 1 | Owner forgets to mark an absence | Daily prompt, unconfirmed-day warning, pre-settlement review |
| 2 | Worker joins mid-cycle | Pay only from joining date |
| 3 | Worker leaves mid-cycle | Final settlement covers only days worked |
| 4 | Worker takes an advance larger than earnings | Allowed with a warning; balance carries forward |
| 5 | Recovery would push net pay below zero | Recover what fits, carry the rest |
| 6 | Owner pays more than due | Excess becomes an advance, owner confirms |
| 7 | Owner pays less than due | Balance stays due and shows on the next cycle |
| 8 | Owner edits a past day after settlement | Blocked; appears as an adjustment in the next cycle |
| 9 | Worker disputes an entry | Shown in history with who entered it and when; flag flow in V2 |
| 10 | Holiday falls on a weekly off | Counted once, not twice |
| 11 | Paid holiday between two absences | Owner setting; default keeps it paid |
| 12 | Half-day on a weekly off or holiday | Treated as worked half a day on an off-day, paid as extra |
| 13 | Rate changes mid-month | Days before the effective date at the old rate, after it at the new rate |
| 14 | Piece rate changes mid-week | Old entries stay at the old rate |
| 15 | Owner deletes a worker by mistake | Worker is archived, never truly deleted, and can be restored |
| 16 | Phone lost or changed | Restore by phone-number verification |
| 17 | Two people (owner and spouse) edit the same day | Both entries kept, the later one shown as a correction |
| 18 | Worker asks for money the same day they were absent | Advance is independent of attendance |
| 19 | Worker leaves owing an advance | Final settlement shows it; owner writes off or keeps as owed |
| 20 | Month with 28, 30 or 31 days | The chosen divisor rule applies and is printed on the slip |
| 21 | Owner runs a shop and a home | Separate businesses with separate workers (V2) |
| 22 | Worker has two roles or two rates (day shift and night shift) | Not supported in V1; note it and watch how often it is asked for |
| 23 | Daily-wage worker paid weekly with mid-week draws | Draws are payments; the weekly settlement nets them |
| 24 | Owner changes a worker's pay basis (daily to monthly) | Takes effect from a chosen date; old cycles unchanged |
| 25 | Owner wants to see who was absent on a festival day | Report M4 filtered by date |

## 7. Screens (V1 only)

1. **Home / Today:** who is absent, "Shop closed today", daily confirm, quick add advance and payment
2. **Workers list:** status, today's attendance, balance due
3. **Worker profile:** calendar, ledger, advances, settings
4. **Add / edit worker**
5. **Mark exceptions:** absent, half-day, overtime, extra day
6. **Piece entry:** batch entry for several workers
7. **Advance and payment entry**
8. **Settlement review:** calendar review, advances, bonus or deduction, formula
9. **Slip and share**
10. **Holidays and weekly offs**
11. **Reports:** monthly summary, worker statement, advances outstanding
12. **Settings:** language, rules, reminders, backup, app lock, plan

## 8. Deliberately not in V1

- Face, selfie or location attendance
- Worker documents and ID storage
- PF, ESI and other compliance
- Pay-by-UPI from inside the app
- Manager and accountant roles, multiple businesses
- Worker link (V1 uses WhatsApp slip images; V2 adds the link)
- Leave requests and advance requests from workers
- Shift patterns and rotating offs

Each of these adds cost, support load or legal duties. None is needed to prove that owners will use and pay for the core.

## 9. Where it can win

- Weekly and daily pay cycles, which many payroll tools treat as an afterthought
- Advances as a first-class feature
- Piece-rate work for garments and workshops
- The whole flow in Bengali, Hindi and English
- Exception-only attendance: nothing to do on a normal day
- Simple enough that an owner is productive in five minutes

**Reality check:** PagarBook and SalaryBox already serve this category. Feature count is not your edge. Local fit, simplicity and on-the-ground distribution are. I have not verified their current pricing, features or download numbers, so check both apps yourself before finalising positioning.

## 10. Pricing sketch (untested, needs validation)

- **Free:** 2 to 3 workers, attendance and a basic settlement view
- **Paid, yearly:** more workers, slips, reports, reminders, backup history
- Households and small shops probably sit at the low end; workshops with many workers at the high end. Do not fix numbers until owners tell you what they would pay.

## 11. Assumptions to test before building

These are my assumptions, not facts. Test each with 15 to 20 owners in your area.

| Assumption | How to test |
|---|---|
| Owners currently use a notebook or memory and hit disputes about attendance or advances | Ask how they record it today and when the last dispute happened |
| Exception-only attendance feels natural | Show a paper mockup of the two-tap flow |
| Weekly and daily settlement matter more than monthly in your area | Ask how each worker is paid |
| Advances are frequent enough to justify making them a core feature | Ask how many workers took an advance last month |
| Owners will pay for month-end settlement and history | Ask what they would pay per year, then whether they would pay it today |
| Owners will share slips on WhatsApp | Ask if they message workers today |
| Bengali-first flow matters | Show Bengali and English versions, watch which they reach for |

**Suggested go / no-go check (my suggestion, not data-backed):** run it manually with about 20 shops for 4 weeks (a shared sheet plus WhatsApp reminders). If most are still recording in week 4 and several say yes to paying, build. If retention fails, no feature list will fix it.

## 12. Open decisions for you

1. **Lead segment:** shops and workshops first, or daily-labour and contractors first?
2. **Daily-wage workers on holidays:** unpaid by default (my suggestion). Right for your area?
3. **Paid leave:** off by default, owner switches on. Agree?
4. **Weekly off:** one fixed day per worker in V1, rotating in V2. Enough?
5. **Monthly divisor default:** calendar days, 26 or 30? What do local owners use?
6. **Daily confirm prompt:** on by default, or off by default and owners opt in?
7. **Worker link in V1 or V2?** It is the strongest dispute-stopper, but it adds work. My suggestion is V2 with WhatsApp slip images in V1.
8. **Name:** decided, **Chukta** (see section 14). The checks listed there are still open.

## 13. Risks

- **Crowded category.** Differentiate on local fit, not features.
- **Low revenue per user.** Yearly prices in this segment are small, so organic growth through owner groups and referrals matters more than paid ads.
- **Daily habit.** Exception-only attendance helps, but the daily prompt must not become annoying.
- **Trust in a new app with money data.** Backup, export and app lock must ship in V1.
- **Support load.** Cash-economy users will ask you to fix wrong entries. The correction-with-history model is your answer, so make it obvious.
- **Compliance drift.** Owners may treat slips as legal records. Keep the disclaimer and stay out of PF, ESI and minimum-wage advice until you have researched them.

## 14. Name and store listing

**Brand:** Chukta. In Hindi and Urdu it means settled or paid in full, and it is the standard phrase for squaring accounts. Marathi, Nepali and Kannada also use the word. Bengali uses the sibling verb *chukano* (হিসাব চুকানো, to settle an account). Gujarati and Punjabi use related verbs of the same root.

**Chosen listing phrase:** Chukta: Worker Pay, Advance & Wage Diary

**Character limits:** app store titles are short (about 30 characters on Google Play and the App Store, as far as I know; confirm in the console). The full phrase is longer than that, so plan the listing like this:

| Field | Draft |
|---|---|
| Store title | Chukta: Worker Pay & Advance |
| Short description | Wage diary for daily, weekly and monthly pay. Advances, settlement, works offline. |
| Full description | Use "worker pay", "advance" and "wage diary" naturally, since those are the phrases owners search |

**Tagline idea:** "Baki se Chukta" (from due to settled). Strongest in Hindi and Nepali. Bengali needs its own wording.

**Checks still open before committing:**
1. Search the Play Store and App Store for Chukta and near spellings
2. Check the .in and .com domains
3. Run a trademark search on the India IP portal
4. Ask a Bengali speaker how the name should be written in Bengali script, and whether it reads too close to চুক্তি (contract)
5. Say the name aloud to about 10 owners and ask them to type it from memory
6. Watch for mishearing as *chook* (mistake) in Hindi and Marathi

**Names rejected and why:** Haazri (at least seven live apps on the same word, in many spellings), WorkerPay (one letter from the established Workpay payroll brand, and "Pay" implies money movement the app does not do).
