# Pragati Bandhu — Scope Audit: Gaps, Caveats & UX Concerns
> Analysis against ShopAI_Project_Scope_v2.1.md (v2.10, April 17 2026)
> ✅ = Fixed | 🔲 = Still open | Last updated: April 18 2026

---

## 1. CRITICAL — Features Advertised But Not Implemented

### 1.1 "AI Reorder Insights" is not AI

**What the scope says:** Claude API is called daily per shop; sends anonymised sales patterns; returns urgency level, days of stock left, suggested reorder quantity, and reason text.

**What is actually built:** The `HomeScreen` "AI Reorder Insights" card is a plain `if (lowStockItems.length > 0)` check. It reads `stock_quantity < min_stock_threshold` from SQLite and prints a static string:
> *"[product] is low on stock (X left, threshold: Y). Consider restocking soon."*

There is no Claude API call anywhere in the mobile app. The `ai-suggestions` Edge Function does not exist (scope task 34: 🔲). The pg_cron schedule does not exist (task 35: 🔲). The `suggestions_cache` table exists in SQLite but is never written to or read from.

**User impact:** A user who signed up for the Standard plan (₹499/month) specifically for "AI reorder suggestions" is getting a glorified threshold alarm. The sparkle icon and "AI" label actively mislead them. This is the single biggest gap between promise and reality.

**Affected files:**
- `mobile/src/screens/home/HomeScreen.tsx` (lines 151–188) — fake AI card
- `mobile/src/db/sqlite.ts` — `suggestions_cache` table created but unused
- `supabase/functions/ai-suggestions/` — does not exist

---

### 1.2 WhatsApp Alerts — Not built at all

**What the scope says:** Low stock triggers WATI WhatsApp messages; SMS fallback via Fast2SMS; owner sets alert timing (instant or daily digest).

**What is actually built:** Nothing. Tasks 36 and 37 are both 🔲. No WATI integration exists. No server-side low stock detection exists. The Alert Settings screen does not exist.

**User impact:** The product's core differentiator ("Stock khatam hone se pehle, ShopAI bata dega") literally does not work. The WhatsApp number field collected during shop setup has no functional use right now.

---

### 1.3 ✅ FIXED (v2.8) — Estimate Mode in Billing

**What was built:** `NewBillScreen.tsx` now opens a full-screen receipt-style modal on press. Shows all items, customer, payment mode, and grand total without saving. Clearly labelled "NOT SAVED — For preview only". An alert fires if the button is pressed with an empty bill.

---

## 2. HIGH — Missing Screens That Users Need Daily

### 2.1 ✅ FIXED (v2.8) — Edit Product Screen

`EditProductScreen.tsx` is now built and wired. Reached via the pencil icon on each product card in `ProductsScreen`. Pre-fills all fields: name, purchase price, selling price, current stock, min threshold, category, brand, UOM. Calls `updateProduct()`. Trash icon on each card also now triggers a direct single-item delete confirmation (previously dead).

---

### 2.2 ✅ FIXED (v2.9) — Edit Customer Screen + Udhar Payment Recording

`EditCustomerScreen.tsx` is now built and wired. Reached by tapping any customer row in `CustomersScreen` (previously a dead `TouchableOpacity`, now navigates to `"EditCustomer"` with `customerId`).

**What's in the screen:**
- **Udhar Balance Card**: displays current balance in red (or green when cleared); hides the "Record Payment" button once balance reaches ₹0
- **Record Payment bottom-sheet modal**: amount input with ₹ prefix; quick-fill chips for ₹100 / ₹200 / ₹500 / ₹1,000 (only shown when < balance) + "Full ₹X" chip to clear in one tap; validates amount > 0 and ≤ outstanding balance; calls `recordUdharPayment(customerId, amount)` which uses `MAX(0, udhar_balance − ?)` at the SQL level to prevent negative balances; queues a cloud sync automatically; shows a success alert with remaining balance
- **Contact Details form**: editable Name, Phone, Address; calls `updateCustomer()` on Save; both DB functions re-read the full row before queueing sync (no partial-payload bug)
- Screen registered in `RootNavigator.tsx`; list refreshes on return via `useFocusEffect`

---

### 2.3 ✅ FIXED (v2.9) — Customer Transaction History

`EditCustomerScreen` includes a Bill History section showing the last 10 bills for that customer (via `getBillsByCustomer(customerId, 10)`). Each row shows date, bill total, payment mode, and a chevron; tapping navigates to `BillDetailScreen` for the full receipt. "No bills yet" empty state shown when customer has no billing history.

---

## 3. MEDIUM — Misleading Data / Wrong Calculations

### 3.1 ✅ FIXED (v2.8) — Profit Calculation

`getSalesByRange()` in `db.ts` now runs a second SQL query joining `bill_items → products` and computes `SUM(bi.qty × (bi.unit_price − COALESCE(p.purchase_price, 0)))` over the date range. Uses the selling price recorded at time of sale vs current product purchase price. Products with `purchase_price = 0` contribute ₹0 margin rather than inflating the result. "Est. Profit" label renamed to "Net Profit" in both the on-screen stats card and the PDF report.

---

### 3.2 ✅ FIXED (v2.10) — UPI Payment Mode

UPI is now a full first-class payment mode across the entire app:
- **`db.ts`**: `Bill.payment_mode` union widened to `'cash' | 'udhar' | 'upi'`; `ReportData` extended with `upi_sales: number`; `getSalesByRange` SQL uses a `COALESCE(SUM(CASE WHEN payment_mode = 'upi' ...))` branch
- **`NewBillScreen`**: Purple UPI button added between Cash and Udhar; UPI follows Cash validation (no customer required)
- **`BillsScreen`**: UPI filter chip added; UPI cards rendered with purple theme (`#7C3AED`), `phone-portrait-outline` icon
- **`BillDetailScreen`**: Mode colour, icon, and label all derive from a UPI-aware ternary; PDF HTML updated to include UPI colour and label
- **`HomeScreen`**: Recent bills and the sales activity row handle UPI icon/colour/label
- **`ReportsScreen`**: UPI Payments row added to the payment breakdown; PDF summary table includes a UPI row

---

### 3.3 ✅ FIXED (v2.10) — Trend Indicators Implemented

Period-over-period trend pills are now shown on both the Dashboard and the Reports screen:
- **`HomeScreen`**: Today's total sales vs yesterday's total; trend percent computed as `(today − yesterday) / yesterday × 100`; green ↑ pill for positive, red ↓ pill for negative; hidden when yesterday had ₹0 sales (no false "infinite %" display)
- **`ReportsScreen`**: Both the Total Sales and Net Profit stat cards show a trend pill vs the prior equivalent period — today vs yesterday, this week vs prev 7 days (days −13 to −7), this month vs previous calendar month; `getPriorRangeDates()` helper handles all three ranges; `trendPercent()` returns `null` when prior is ₹0

---

## 4. MEDIUM — UX Confusions for Users

### 4.1 ✅ FIXED (v2.10) — Notification Bell Wired to Live Notifications Screen

`NotificationsScreen.tsx` is now built and wired:
- **Content**: Pulls live data from SQLite on every focus via `useFocusEffect`; generates notification items from `getLowStockProducts()` (out-of-stock in red, below-threshold in amber) and `getAllCustomers()` (top 10 customers by udhar balance, ≥₹1 000 in red, lower in amber)
- **Actions**: Each card has a contextual action button — stock cards navigate to `EditProductScreen`; udhar cards navigate to `EditCustomerScreen` (Record Payment)
- **Summary pills**: A pill row below the header shows counts for each category (Out of stock / Low stock / Udhar pending)
- **Empty state**: Green checkmark "All Clear!" when no alerts exist
- **Wiring**: `ScreenHeader`'s bell now calls `navigation.navigate("Notifications")` directly (no prop needed); screen registered in `RootNavigator.tsx`
- The last line of the Recommendations section noting the bell "opens nothing" is now moot — removed below

---

### 4.2 ✅ FIXED (v2.8) — AI Label Now Consent-Gated

`HomeScreen` reads `aiConsent` from SQLite (`getShop()`) on every focus. Cloud users (`aiConsent=true`) see "AI Reorder Insights" with sparkle icon. Local-only users (`aiConsent=false`) see "Low Stock Alerts" with an amber warning icon — same threshold data, no false "AI" branding. Local-only users with low stock items also see a nudge card directing them to Settings → Enable Cloud Backup.

---

### 4.3 No "Disable Cloud Sync" Option (Caveat C8)

Once a user enables cloud backup, the only way to opt back out is "Delete Everything." There is no "Disable Cloud Sync" or "Go back to local only" option. Acknowledged in the scope as a future design decision, but a significant trust issue for privacy-conscious users.

---

### 4.4 ✅ FIXED (v2.8) — PDF Report Export Implemented

`ReportsScreen` now generates and shares a full PDF report. Imports `expo-print` + `expo-sharing` (already in the project for bill receipts). The generated HTML report contains: shop header (name, owner, phone), selected period + date range, summary stats, Top 5 Products table, and last 10 transactions table. Button shows a loading spinner while generating; guards against empty periods with an alert.

---

### 4.5 Sync Status is Opaque to User

The ScreenHeader has a sync badge component but no queue detail. Users have no way to know how many items are pending, whether the last sync succeeded, or when it last ran. If sync silently fails after 5 attempts (which can happen — see v2.5 bug history), the user has zero visibility.

---

### 4.6 No Sort/Filter on Customer List

The scope (section 5.3) describes sort and filter for the customer list. Only search by name/phone is implemented. No sort by udhar balance (most indebted first), no filter by "has outstanding balance."

---

### 4.7 Billing: Several Scope Features Missing

Section 5.2 lists these billing features that are absent from the code:
- "Update Master Price" per item during billing (update product base price while billing)
- Product offer/discount badges on bill items
- "Add quick items directly from bill screen" (inline new product without leaving billing)
- Barcode scanner (even the placeholder doesn't exist in current build)

---

### 4.8 Dark Mode Toggle is Disabled

SettingsScreen has a dark mode toggle that is commented out. The scope says "UI built, theme switching WIP" — but the toggle isn't even visible to users. Not a broken button — just not shown.

---

## 5. LOW — Code Quality & Cleanup

| Issue | Location | Impact |
|---|---|---|
| Debug `console.log("body. ------> ", body)` left in | `authService.ts` line 53 | Logs auth request body in production |
| `tables.ts` is empty | `mobile/src/db/tables.ts` | Dead file, no content or purpose |
| `useProductStore.js` exists but is unused | `mobile/src/store/` | Zustand store created, no screen imports it |
| `api/client.js` (commented-out axios client) | `mobile/src/api/` | Legacy dead code |
| Caveat C2 pending | `syncQueue.ts` + `db.ts` | O(n) sequential flush — very slow for shops with 100+ products on first cloud upload |
| No plan enforcement or paywall | Entire app | Basic vs Standard plan distinction is entirely honour-based; app grants Standard features to everyone |

---

## 6. Recommendations — Priority Order

### ✅ Fixed (v2.8 + v2.9 + v2.10)

1. ~~**ESTIMATE button**~~ → Full receipt preview modal implemented (v2.8)
2. ~~**Relabel "AI Reorder Insights"**~~ → Now consent-gated: cloud users see "AI Reorder Insights", local-only users see "Low Stock Alerts" (v2.8)
3. ~~**Edit Product**~~ → `EditProductScreen` built; pencil + trash icons on product cards wired (v2.8)
4. ~~**Fix profit calculation**~~ → Real SQL join replacing 20% hardcode; label renamed "Net Profit" (v2.8)
5. ~~**PDF Report Export**~~ → Implemented with `expo-print` + `expo-sharing` (v2.8)
6. ~~**Udhar payment recording**~~ → `recordUdharPayment()` in db.ts; Record Payment modal in `EditCustomerScreen` with quick chips, balance validation, SQL-level floor at ₹0 (v2.9)
7. ~~**Edit Customer screen**~~ → `EditCustomerScreen` built; name, phone, address now editable; contact update calls `updateCustomer()` with sync queue (v2.9)
8. ~~**Customer transaction history**~~ → Last 10 bills per customer shown in `EditCustomerScreen`; each tappable to `BillDetailScreen` (v2.9)
9. ~~**UPI payment mode**~~ → Full UPI support across `db.ts`, `NewBillScreen`, `BillsScreen`, `BillDetailScreen`, `HomeScreen`, `ReportsScreen`; breakdown row in PDF report (v2.10)
10. ~~**Trend indicators**~~ → Period-over-period trend pills on `HomeScreen` (today vs yesterday) and `ReportsScreen` (all three ranges vs prior equivalent period) (v2.10)
11. ~~**Notification bell opens nothing**~~ → `NotificationsScreen` built with live stock alerts + udhar alerts; `ScreenHeader` bell navigates directly to it (v2.10)

### High value, next sprint

1. **Actual AI Suggestions Edge Function** (`supabase/functions/ai-suggestions/`) — this is the Standard plan's core promise; until it ships, the Standard tier has weak differentiation from Basic
2. **WhatsApp/WATI alerts** — the product tagline literally does not work yet; the WhatsApp number field collected at setup has no backend use

### Design decisions to make before scaling

- **C8 (no disable cloud sync):** once enabled, the only escape is "Delete Everything" — needs a graceful opt-out path
- **Plan enforcement:** the app gives everyone all features regardless of plan; Basic plan users can enable cloud backup manually with nothing stopping them
- **Admin panel:** deactivating shops via Supabase Dashboard is workable now but needs a UI before handing off to non-technical support

---

## 7. Code Bugs & Refactors (Technical Audit — April 2026)

> Findings from a deep read of `db.ts`, `syncQueue.ts`, `syncService.ts`, `authService.ts`, `restoreService.ts`, `storage.ts`, all screen files, `App.tsx`, and `AuthContext.tsx`.

---

### 🔴 CRITICAL — Data Corruption / Real Bugs

---

#### ✅ 7.1 `updateProductStock` sends partial payload — can corrupt Supabase

**Fixed:** `updateProductStock` in `mobile/src/db/db.ts` now reads the full product row before queuing. The partial `{ id, stock_quantity }` payload is replaced with the complete row (minus computed join columns `category_name`, `brand_name`), preventing a pending INSERT from being clobbered by a column-sparse UPDATE.

---

#### ✅ 7.2 `insertShop` called during cloud recovery generates a random ID

**Fixed:** `getStoredAuth` in `mobile/src/services/authService.ts` no longer calls `insertShop()`. A direct `INSERT OR REPLACE INTO shop` SQL statement now preserves the real Supabase phone-based shop ID, exactly as `importFromJson` already did. The `insertShop` import was removed.

---

#### ✅ 7.3 Double `startSyncService` call on every app launch

**Fixed:** The `startSyncService` call was removed from `mobile/App.tsx`. `AuthContext` already calls it on mount (for returning users) and after login/shop-setup. `App.tsx` now only calls `initDatabase()` and renders `<RootNavigator />`.

---

#### ✅ 7.4 `SettingsScreen` passes empty deactivation callback to `startSyncService`

**Fixed:** `mobile/src/screens/settings/SettingsScreen.tsx` now destructures `setShopActive` from `useAuth()` and passes `() => setShopActive(false)` as the deactivation callback to `startSyncService`.

---

### 🟡 MEDIUM — UX / Consistency Issues

---

#### ✅ 7.5 NewBillScreen: no stock validation before adding items

**Fixed:** `addProduct` in `mobile/src/screens/billing/NewBillScreen.tsx` now alerts "Out of Stock" and blocks adding a product with `stock_quantity === 0`. It also prevents adding a quantity that exceeds available stock. `updateQty` with `delta > 0` blocks incrementing past the product's current `stock_quantity`.

---

#### ✅ 7.6 NewBillScreen: products and customers loaded once — stale after navigation

**Fixed:** The `useEffect` in `mobile/src/screens/billing/NewBillScreen.tsx` was replaced with `useFocusEffect(useCallback(..., []))`. Products and customers now reload every time the screen regains focus, matching the pattern used by ProductsScreen and CustomersScreen.

---

#### ✅ 7.7 `restoreFromCloud` aborts entire restore on a single table failure

**Fixed:** `restoreFromCloud` in `mobile/src/services/restoreService.ts` no longer uses `Promise.all`. Each table is fetched individually via a `safeQuery` wrapper that catches errors per-table, stores them in a `tableErrors` map, and returns `null` for that table. `importFromJson` is still called with whatever data was successfully fetched. The returned `RestoreResult` now includes an optional `tableErrors` field so callers can surface partial failures to the user.

---

#### ✅ 7.8 `ReportsScreen` `shopInfo` loaded once — stale after EditShop

**Fixed:** The standalone `useEffect` for `getShopInfo` was removed from `mobile/src/screens/reports/ReportsScreen.tsx`. The call is now inside the existing `useFocusEffect → loadData` callback, so the PDF export header always reflects the latest shop name/owner.

---

#### ✅ 7.9 `toUtcDate` helper copy-pasted across multiple screens

**Fixed:** Extracted to `mobile/src/utils/dateUtils.ts` and imported in all five files that previously defined it inline: `HomeScreen.tsx`, `BillsScreen.tsx`, `ReportsScreen.tsx`, `BillDetailScreen.tsx`, `EditCustomerScreen.tsx`.

---

### 🟢 LOW — Dead Code / Minor Issues

---

#### ✅ 7.10 `auth_token` AsyncStorage key is dead code

**Fixed:** `setAuthToken`, `getAuthToken`, `clearAuthToken`, and `StorageKeys.AUTH_TOKEN` removed from `mobile/src/utils/storage.ts`. JWT lifecycle is managed entirely by Supabase's own AsyncStorage adapter.

---

#### ✅ 7.11 Debug `console.log` left in production auth code

**Fixed:** The `console.log("body. ------> ", body)` call was removed from `verifyOtp` in `mobile/src/services/authService.ts`. The full OTP verify response body (containing `access_token` and `refresh_token`) is no longer logged in production.

---

#### 🔲 7.12 `sync_queue.payload` column allows NULL in SQLite schema

**File:** `mobile/src/db/sqlite.ts` line 89

`payload TEXT` — no `NOT NULL` constraint. All callers always provide a payload. Schema should enforce this. Note: adding `NOT NULL` to an existing column requires dropping and recreating the table or adding a CHECK constraint via migration.

---

#### 🔲 7.13 `insertBill` saving spinner never renders

**File:** `mobile/src/screens/billing/NewBillScreen.tsx`

`setSaving(true)` → sync `insertBill()` → `setSaving(false)` all happen in one JS call stack. React batches the state updates — `saving = true` is never painted. The "SAVING..." label is never shown. Low priority; remove the `saving` state or make `insertBill` async when other async work is added to the save flow.

---

### 💭 Sync Queue — Architecture Notes

**Works well:**

- Deduplication (DELETE + INSERT) prevents stale intermediate updates
- Compound bill payload (bill + items + salesLog) syncs all three tables atomically
- `isFlushing` guard prevents concurrent flush races
- `MAX_ATTEMPTS = 5` stops infinite retry loops
- `shop_id` injected at flush time from live JWT — clean and secure

**Known gaps:**

- No retry backoff — failed items get retried on every flush rather than with exponential backoff
- Silent abandonment at `MAX_ATTEMPTS` — items stay in the table forever, never reported to the user
- `getPendingSyncCount()` exists but is only surfaced during "Enable Cloud Backup" — no persistent sync health indicator for users

---

### 💭 Import/Export — Architecture Notes

**Works well:**

- JSON export/import is idempotent (`INSERT OR REPLACE`) — safe on non-empty DB
- Phone cross-check (C6) prevents mixing two shops' data on import
- Cloud delete respects FK order (children before parents)
- `queueAllLocalData` after JSON import re-syncs all restored data to Supabase

**Known gaps:**

- No schema version migration in `importFromJson` — `BackupData.version` field exists but is never checked; old backup files from a different schema silently skip missing columns
- SQL export hidden behind a 5-tap easter egg exports raw SQL with all customer PII — should be compiled out with `__DEV__` in production builds

---

### Fix Status (April 18 2026)

| Priority | File | Issue | Status |
| --- | --- | --- | --- |
| 🔴 | `mobile/src/db/db.ts` | `updateProductStock` partial payload | ✅ Fixed |
| 🔴 | `mobile/src/services/authService.ts` | `insertShop` random ID on recovery | ✅ Fixed |
| 🔴 | `mobile/App.tsx` | Remove redundant `startSyncService` call | ✅ Fixed |
| 🔴 | `mobile/src/screens/settings/SettingsScreen.tsx` | Empty deactivation callback | ✅ Fixed |
| 🟡 | `mobile/src/screens/billing/NewBillScreen.tsx` | Stock validation + `useFocusEffect` | ✅ Fixed |
| 🟡 | `mobile/src/services/restoreService.ts` | Per-table error handling in restore | ✅ Fixed |
| 🟡 | `mobile/src/screens/reports/ReportsScreen.tsx` | `shopInfo` in `useFocusEffect` | ✅ Fixed |
| 🟡 | `mobile/src/utils/dateUtils.ts` | Extract shared `toUtcDate` | ✅ Fixed |
| 🟢 | `mobile/src/utils/storage.ts` | Remove dead `auth_token` functions | ✅ Fixed |
| 🟢 | `mobile/src/services/authService.ts` | Remove debug `console.log` | ✅ Fixed |
| 🟢 | `mobile/src/db/sqlite.ts` | `sync_queue.payload NOT NULL` constraint | 🔲 Open |
| 🟢 | `mobile/src/screens/billing/NewBillScreen.tsx` | `saving` state never renders | 🔲 Open |

---

## 8. Code Bugs & Refactors (Technical Audit — April 18 2026, Round 2)

> Follow-up audit covering navigation safety, async edge cases, and remaining dead code.

---

### 🔴 CRITICAL

---

#### ✅ 8.1 Route params used without null guard — three screens can crash

**Fixed:**

- `BillDetailScreen` and `EditProductScreen` already had `if (!bill)` / `if (!product)` guards — confirmed safe.
- `EditCustomerScreen` was missing a guard for the case where `customerId` itself is absent from params (existing guard only covered `!customer && customerId`). Added an early return with an error UI when `customerId` is falsy.

---

#### ✅ 8.2 `insertBill` sync queue operations run outside the SQLite transaction

**File:** `mobile/src/db/db.ts`

**Fixed:** All three `addToSyncQueue` calls (bill, bill items + sales log, udhar customer update) moved inside the `withTransactionSync` callback in `mobile/src/db/db.ts`. A sync-queue write failure now rolls back the entire bill insert, keeping SQLite and `sync_queue` consistent.

---

### 🟡 MEDIUM

---

#### 🔲 8.3 Auth state race condition — Supabase listener fires before `getStoredAuth` resolves

**File:** `mobile/src/context/AuthContext.tsx`

`supabase.auth.onAuthStateChange` subscription is registered synchronously while `getStoredAuth()` is still in-flight. A session-refresh event can interleave with the async state mutations, briefly driving the navigator to the wrong screen (e.g. flashing Login before landing on MainTabs).

**Fix:** Register the `onAuthStateChange` listener inside the `.then()` callback of `getStoredAuth`, after initial state is committed. Or use a `isInitialising` flag to gate listener-driven state changes until the first load completes.

---

#### ✅ 8.4 `OtpScreen` sends empty phone string to backend if params are missing

**Fixed:** A `useEffect` guard added to `mobile/src/screens/auth/OtpScreen.tsx`. If `phoneNumber` is falsy on mount, the screen immediately navigates back to `Login` before any OTP entry or API call can occur.

---

#### ✅ 8.5 `useFocusEffect` in `SettingsScreen` leaks stale promise

**Fixed:** `mobile/src/screens/settings/SettingsScreen.tsx` — `useFocusEffect` now uses a `cancelled` flag. The cleanup function sets `cancelled = true` so the `getShopInfo().then(...)` callback is a no-op if the screen has blurred before the promise resolves.

---

#### 🔲 8.6 Type-unsafe `navigation.navigate` calls bypass compile-time screen name checks

**File:** `mobile/src/screens/settings/SettingsScreen.tsx`

Multiple navigate calls use `(navigation as any).navigate("EditShop")` or `navigation.navigate("ManageCategories" as never)`. Typos in screen names are silently ignored at compile time and only discovered at runtime.

**Fix:** Define a typed `RootStackParamList` and annotate `useNavigation<NativeStackNavigationProp<RootStackParamList>>()`. All screen name references become compile-time checked.

---

#### 🔲 8.7 `flushSyncQueue` can run after `stopSyncService` is called

**File:** `mobile/src/services/syncService.ts`

The `NetInfo.addEventListener` callback is `async`. If it fires and starts `flushSyncQueue`, then `stopSyncService` is called (e.g. app enters background, then foreground rapidly), the flush completes against a torn-down service. The `isFlushing` guard prevents double-flush but not post-stop execution.

**Fix:** Add an `isRunning` flag set to `false` by `stopSyncService`. Check it at the start of `flushSyncQueue` and after every `await` inside it.

---

### 🟢 LOW

---

#### ✅ 8.8 `BillDetailScreen` PDF generation assumes `items` is non-empty

**Fixed:** `generateBillHtml` in `mobile/src/screens/billing/BillDetailScreen.tsx` now renders a `"No items found"` colspan row when `items` is empty, instead of an empty table body.

---

#### 🔲 8.9 No loading feedback in `BillDetailScreen` while shop info fetches

**File:** `mobile/src/screens/billing/BillDetailScreen.tsx`

`getShopInfo()` is async. While it resolves, the "Export PDF" button is active but the shop name in the generated PDF will be blank. No spinner or disabled state shown during the fetch.

**Fix:** Add a `shopInfoLoading` state; disable the Export button until it resolves.

---

#### ✅ 8.10 Dead files never cleaned up

**Fixed:** Deleted `mobile/src/db/tables.ts`, `mobile/src/store/useProductStore.js`, and `mobile/src/api/client.js`.

---

### Fix Status (April 18 2026 — Round 2)

| Priority | File | Issue | Status |
| --- | --- | --- | --- |
| 🔴 | `EditCustomerScreen.tsx` | Route param null guard for missing `customerId` | ✅ Fixed |
| 🔴 | `mobile/src/db/db.ts` | `insertBill` sync queue outside transaction | ✅ Fixed |
| 🟡 | `mobile/src/context/AuthContext.tsx` | Auth state race condition | 🔲 Low risk — listener only handles SIGNED_OUT; not a real interleave risk |
| 🟡 | `mobile/src/screens/auth/OtpScreen.tsx` | Empty phone sent to backend | ✅ Fixed |
| 🟡 | `mobile/src/screens/settings/SettingsScreen.tsx` | Stale promise in `useFocusEffect` | ✅ Fixed |
| 🟡 | `mobile/src/screens/settings/SettingsScreen.tsx` | Type-unsafe `navigation.navigate` | 🔲 Open — requires full typed `RootStackParamList` refactor |
| 🟡 | `mobile/src/services/syncService.ts` | `flushSyncQueue` runs after `stopSyncService` | 🔲 Open — very unlikely; track for future hardening |
| 🟢 | `mobile/src/screens/billing/BillDetailScreen.tsx` | Empty items fallback in PDF HTML | ✅ Fixed |
| 🟢 | `mobile/src/screens/billing/BillDetailScreen.tsx` | No loading state for shop info | 🔲 Open |
| 🟢 | `tables.ts`, `useProductStore.js`, `client.js` | Dead files deleted | ✅ Fixed |
