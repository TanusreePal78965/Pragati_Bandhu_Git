# ShopAI Auth + Sync Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 15 multi-device login/sync defects found in the 2026-10-26 ShopAI audit so restore is lossless and complete, pulls never destroy pending local work, deletes and stock/udhar changes converge across devices, and the one-device lock actually holds.

**Architecture:** All app changes stay in `mobile-shopai/src` (db layer, `syncQueue`, `restoreService`, `syncService`, auth). One new Supabase migration adds server-side delta RPCs. Stock and udhar move from last-write-wins absolute values to queued deltas; deletes converge by reconciling against a complete pull; the device lock gets a shared module that gates every flush and pull.

**Tech Stack:** Expo 54 / React Native 0.81, expo-sqlite, supabase-js 2, Jest (`jest-expo`) + `better-sqlite3` for DB-layer tests (same setup as `mobile-chukta`), Postgres / pgTAP for the migration.

**Spec:** the audit findings in this conversation (2026-10-26); background in `mobile-shopai/docs/SYNC_DATA_FLOW.md` and `SYNC_AND_SUPABASE_ARCHITECTURE.md`. Finding numbers (#1-#14) are the audit's; #15 is new: sales never queue a stock deduction (`insertBill`, `finalizeDraft` in `db.ts` update `products.stock_quantity` locally with no sync entry, so the next pull resets local stock to the stale cloud value).

## Global Constraints

- No new runtime dependencies. Dev deps only: `jest`, `jest-expo ~54.0.18`, `@types/jest ^30`, `better-sqlite3 ^12.11.1`, `@types/better-sqlite3 ^9.6.0` (versions copied from `mobile-chukta/package.json`).
- All shop data stays scoped by RLS; new RPCs are `SECURITY INVOKER` so existing `shopai_owner_access` policies apply. No `anon` execute.
- SQLite schema changes are additive `ALTER TABLE ... ADD COLUMN` inside try/catch in `initTables` (existing pattern in `sqlite.ts`).
- Cloud migration must be applied **before** the new app build ships; old app builds must keep working against the migrated DB (new RPCs and columns only, nothing dropped).
- `MAX_ATTEMPTS = 5` stays the exhaustion threshold.
- Out of scope: server-side session revocation on device claim, login brute-force limits, replacing `Math.random` device ids (audit #13: collision risk negligible, intentionally not fixed).

## Review Focus

- Shop with exactly 1000 / 1001 / 2500 bills restores every row (page boundaries).
- Pull while a queued edit for the same row is mid-retry or exhausted must keep the local edit.
- Two devices selling the same product offline converge to `start - sumOfBothSales`, never below the clamp rule.
- Product created offline then edited before first flush still uploads its initial stock, pack columns and `track_stock`.
- Device that lost the lock reconnects after hours offline: nothing is flushed or pulled until the user re-claims.

---

### Task 0: Jest + SQLite test harness

**Files:**
- Create: `mobile-shopai/jest.config.js`, `mobile-shopai/jest.setup.ts`, `mobile-shopai/src/__tests__/helpers/testDb.ts`, `mobile-shopai/src/__tests__/harness.test.ts`
- Modify: `mobile-shopai/package.json` (script `"test": "jest"` + dev deps), `mobile-shopai/src/db/sqlite.ts` (export `initTables`)

**Interfaces:**
- Produces: `createTestDb(): TestDb` where `TestDb` has `runSync(sql, params?)`, `getAllSync(sql, params?)`, `getFirstSync(sql, params?) -> row | null`, `execSync(sql)`, `withTransactionSync(fn)`, `closeSync()`; backed by in-memory `better-sqlite3`, schema created by the exported `initTables(db)`. `mockSqliteModule(testDb)` helper that does `jest.doMock('../../db/sqlite', () => ({ __esModule: true, default: testDb, openUserDatabase: jest.fn(), closeUserDatabase: jest.fn() }))`.

- [ ] **Step 1:** Copy `jest.config.js` / `jest.setup.ts` shape from `mobile-chukta` (preset `jest-expo`, AsyncStorage + NetInfo mocks, same `transformIgnorePatterns`, `testMatch` for `__tests__`). Install dev deps.
- [ ] **Step 2: Failing test** `harness.test.ts`: `createTestDb()` has table `products`, `sync_queue`; inserting then `getFirstSync('SELECT COUNT(*) c FROM products')` returns `{ c: 1 }`; `withTransactionSync` rolls back when the callback throws.
- [ ] **Step 3:** Export `initTables` from `sqlite.ts`; implement `testDb.ts` adapter (`getFirstSync` returns `null` when no row, params passed spread to better-sqlite3).
- [ ] **Step 4:** Run `cd mobile-shopai && npx jest src/__tests__/harness.test.ts` → PASS.
- [ ] **Step 5: Commit** `test(shopai): add jest + in-memory sqlite harness`.

---

### Task 1: Lossless restore and bulk-upload columns (#1, #9)

**Files:**
- Modify: `mobile-shopai/src/db/backup.ts` (`importFromJson`), `mobile-shopai/src/db/db.ts` (`queueAllLocalData`)
- Test: `mobile-shopai/src/__tests__/backup.import.test.ts`

**Interfaces:**
- Consumes: Task 0 `createTestDb`, `mockSqliteModule`.
- Produces: no signature change. `importFromJson` additionally persists `products.purchase_uom`, `products.units_per_pack`, `bills.discount_percent`, `bills.discount_amount`, `bills.discount_type`, `bill_items.display_qty`. `queueAllLocalData` product query becomes `SELECT *` minus nothing (all local columns).

- [ ] **Step 1: Failing tests**: (a) import one product `{purchase_uom:'Box', units_per_pack:12, track_stock:0}` → local row has those values; (b) import bill `{discount_percent:10, discount_amount:50, discount_type:'percent'}` → persisted; (c) import bill_item `{display_qty:'2 Box'}` → persisted; (d) after `queueAllLocalData()` on a local product with `purchase_uom='Box'`, the queued payload JSON contains `purchase_uom`, `units_per_pack`, `track_stock`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Add the missing columns to the three `INSERT OR REPLACE` statements (defaults: `NULL`, `NULL`, `0`, `0`, `'none'`, `NULL`); change `queueAllLocalData` product select to `SELECT *`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `fix(shopai): restore and bulk upload keep pack, discount and display_qty columns`.

---

### Task 2: Paginated restore and delete (#2)

**Files:**
- Create: `mobile-shopai/src/services/paging.ts`
- Modify: `mobile-shopai/src/services/restoreService.ts` (`restoreFromCloud`, `fetchByIds`, `deleteFromCloud`)
- Test: `mobile-shopai/src/__tests__/paging.test.ts`, `mobile-shopai/src/__tests__/restoreService.pagination.test.ts`

**Interfaces:**
- Produces: `fetchAllRows<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>, pageSize = 1000): Promise<T[]>` — requests `[0, pageSize-1]`, `[pageSize, 2*pageSize-1]`, ... until a page returns fewer than `pageSize` rows; throws on `error`.

- [ ] **Step 1: Failing tests**: `fetchAllRows` with a fake source of 0, 999, 1000, 1001, 2500 rows returns all rows once each and makes `1, 1, 2, 2, 3` calls respectively; propagates an error from page 2. Restore test with mocked supabase returning 2500 `bills` rows and 100 bills' worth of 1500 `bill_items`: `importFromJson` receives all of them.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `fetchAllRows`. In `restoreFromCloud` wrap every `select('*').eq('shop_id', uuid)` as `.order('id').range(from, to)` through `fetchAllRows` (stable order is required for range paging); `fetchByIds` pages each 100-id chunk through `fetchAllRows` too (a chunk can hold >1000 items). In `deleteFromCloud` fetch bill ids through `fetchAllRows`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `fix(shopai): page restore/delete past PostgREST 1000-row cap`.

---

### Task 3: Pull protects pending edits and reconciles deletes (#3, #4)

**Files:**
- Modify: `mobile-shopai/src/db/syncQueue.ts` (add `getPendingIds`), `mobile-shopai/src/db/backup.ts` (`importFromJson`), `mobile-shopai/src/services/restoreService.ts` (pass options)
- Test: `mobile-shopai/src/__tests__/backup.reconcile.test.ts`

**Interfaces:**
- Consumes: Task 2 (a successful, fully paged pull).
- Produces:
  - `type PendingIds = Record<string, Set<string>>` and `getPendingIds(): PendingIds` in `syncQueue.ts` — every `sync_queue` row regardless of `attempts`, keyed by `table_name`, value = `data_id`s.
  - `importFromJson(data: BackupData, opts?: { pending?: PendingIds; reconcile?: boolean }): ImportSummary`. Rows whose id is in `pending[table]` are skipped (for bills, also skip that bill's items). When `reconcile` is true, local `products`, `categories`, `brands`, `customers` rows absent from `data` **and** absent from `pending` are deleted. Bills and logs are never reconciled.
  - `restoreFromCloud` passes `pending: getPendingIds()`, and `reconcile: true` only when `tableErrors` is empty.

- [ ] **Step 1: Failing tests**: (a) local product P with queued UPDATE, cloud copy differs → local row unchanged after import; (b) same with an exhausted entry (`attempts=5`) → unchanged; (c) local product Q not in cloud payload, nothing queued, `reconcile:true` → deleted; (d) same with a queued INSERT for Q → kept; (e) `reconcile:false` or a table error → nothing deleted; (f) bills never deleted.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement per the Interfaces block; run reconcile deletes inside the same `withTransactionSync`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Commit** `fix(shopai): pull keeps pending local edits and removes cloud-deleted rows`.

---

### Task 4: Robust queue (#7, #8, #12)

**Files:**
- Modify: `mobile-shopai/src/db/sqlite.ts` (columns `sync_queue.next_attempt_at INTEGER DEFAULT 0`, `sync_queue.last_error TEXT`), `mobile-shopai/src/db/syncQueue.ts`, `mobile-shopai/src/screens/home/HomeScreen.tsx`, `mobile-shopai/src/screens/settings/SettingsScreen.tsx`
- Test: `mobile-shopai/src/__tests__/syncQueue.test.ts`

**Interfaces:**
- Produces in `syncQueue.ts`:
  - `classifySyncError(e: unknown): 'transient' | 'permanent'` — transient: `TypeError`/message containing `Network request failed`, HTTP status 401, 408, 429, ≥500, PostgREST `PGRST301`, message `JWT expired`; everything else permanent.
  - `getStuckSyncCount(): number` — rows with `attempts >= MAX_ATTEMPTS`.
  - `retryStuckSyncItems(): void` — sets `attempts = 0, next_attempt_at = 0` on stuck rows.
  - `flushSyncQueue` behaviour: only rows with `attempts < MAX_ATTEMPTS AND next_attempt_at <= now`; transient error → leave row untouched and **stop the flush**; permanent → `attempts += 1`, `last_error`, `next_attempt_at = now + min(30s * 2^attempts, 1h)`, continue with the next row.
  - `addToSyncQueue`: for `table_name = 'shop'`, merge the new payload over any existing queued `shop` payload for the same id (`{...old, ...new}`) before replacing.

- [ ] **Step 1: Failing tests** (mock `supabase`, `NetInfo`, `getHasConsent`): transient failure leaves `attempts` at 0 and stops after the first row; permanent failure increments and sets a future `next_attempt_at`, and the second row is still attempted; row with future `next_attempt_at` is skipped; `getStuckSyncCount` counts exhausted rows and `retryStuckSyncItems` resets them; two `shop` updates `{shopName}` then `{whatsappNumber}` leave one queued payload containing both.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Add the two columns via additive `ALTER` in `initTables`.
- [ ] **Step 4:** UI: Home and Settings show a "N changes could not sync — Retry" row when `getStuckSyncCount() > 0` (retry calls `retryStuckSyncItems()` then `flushSyncQueue()`). Follow the existing `syncPendingCount` banner styling.
- [ ] **Step 5:** Run → PASS. Commit `fix(shopai): sync queue backoff, transient-vs-permanent errors, stuck items visible, shop payload merge`.

---

### Task 5: Hard device lock (#5)

**Files:**
- Create: `mobile-shopai/src/services/deviceLock.ts`
- Modify: `mobile-shopai/src/db/syncQueue.ts` (`flushSyncQueue`, `syncUpsert` case `'shop'`), `mobile-shopai/src/services/syncService.ts` (`checkShopStatus`, `pullIfStale`), `mobile-shopai/src/context/AuthContext.tsx` (`claimSession`)
- Test: `mobile-shopai/src/__tests__/deviceLock.test.ts`

**Interfaces:**
- Produces in `deviceLock.ts`:
  - `setDeviceConflict(v: boolean): void`, `isDeviceConflict(): boolean` (module flag, reset on logout).
  - `verifyActiveDevice(opts?: { maxAgeMs?: number }): Promise<'ok' | 'conflict' | 'unknown'>` — returns cached result if checked within `maxAgeMs` (default 60 000); otherwise reads `shops.active_device_id` + `ai_consent`; conflict only when `ai_consent` is true, an id is set, and it differs from this device; sets the flag; `'unknown'` on network error.
- Behaviour: `flushSyncQueue` returns immediately if `isDeviceConflict()`, and calls `verifyActiveDevice()` first (aborting on `'conflict'`; proceeding on `'unknown'` is **not** allowed, abort and retry later). `pullIfStale` and the NetInfo handler do nothing while the flag is set. The `'shop'` upsert no longer writes `active_device_id`. `claimSession` clears the flag **after** the Supabase update succeeds, then runs `restoreFromCloud()` once.

- [ ] **Step 1: Failing tests**: flush makes zero `supabase.from(...)` writes while `setDeviceConflict(true)`; flush on an expired cache with a mismatching `active_device_id` makes zero writes and sets the flag; `'shop'` upsert payload has no `active_device_id` key; `verifyActiveDevice` returns the cached value inside `maxAgeMs` without a second query.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; `checkShopStatus` uses `verifyActiveDevice({ maxAgeMs: 0 })` for its conflict decision and still stamps `active_device_id` when it is null.
- [ ] **Step 4:** Run → PASS. Commit `fix(shopai): conflict blocks flush/pull everywhere; shop edits no longer steal the session`.

---

### Task 6: Login, DB guard and consent defaults (#10, #11, #14, #9-callback)

**Files:**
- Modify: `mobile-shopai/src/services/authService.ts`, `mobile-shopai/src/context/AuthContext.tsx`, `mobile-shopai/src/db/sqlite.ts` (proxy), `mobile-shopai/src/screens/settings/EditShopScreen.tsx` (lines ~36, ~48), `mobile-shopai/src/screens/settings/SettingsScreen.tsx` (`handleEnableCloudBackup`)
- Test: `mobile-shopai/src/__tests__/authService.restore.test.ts`, `mobile-shopai/src/__tests__/sqlite.guard.test.ts`

**Interfaces:**
- Produces: `autoRestoreIfEmpty(): Promise<void>` in `authService.ts` — if `getHasConsent()` and `SELECT COUNT(*) FROM products` is 0, emits `'start'`, awaits `restoreFromCloud()`, emits `'complete'` or `'error'`. Used by `getStoredAuth` (replacing its inline block) and by `AuthContext.login` after `startSyncService`.
- `AuthContext` gains `markDeviceConflict(v: boolean): void` (sets `isDeviceConflict` and `setDeviceConflict`); `handleEnableCloudBackup` passes it as the conflict callback and calls `queueAllLocalData()` once.
- The `db` proxy throws `Error('Database not opened — call openUserDatabase first')` instead of opening `shopai_default.db`.
- `EditShopScreen` consent default is `false` (both `useState` and `info.aiConsent ?? false`).

- [ ] **Step 1: Failing tests**: `autoRestoreIfEmpty` calls `restoreFromCloud` when consent and empty; not when products exist; not without consent. Proxy access before `openUserDatabase` throws the message above.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Before enabling the guard run `grep -rn "from '../db/sqlite'\|from './sqlite'" mobile-shopai/src App.tsx` and confirm nothing reads the DB at import time or before login (`flushSyncQueue` is already session-gated).
- [ ] **Step 4:** Run → PASS. Commit `fix(shopai): restore on fresh login, forbid default DB, consent defaults off, wire conflict in settings`.

---

### Task 7: Stock and udhar as deltas (#6, #15)

**Files:**
- Create: `supabase/migrations/20261026100000_shopai_stock_udhar_deltas.sql`, `supabase/tests/database/shopai_deltas.test.sql`
- Modify: `mobile-shopai/src/db/syncQueue.ts` (`addToSyncQueue`, `syncItem`, `syncUpsert`), `mobile-shopai/src/db/db.ts` (`insertBill`, `finalizeDraft`, `updateProductStock`, `updateProduct`, `insertPurchaseLog` callers, `recordUdharPayment`, `updateCustomerUdhar`, `insertProductsBatch`)
- Test: `mobile-shopai/src/__tests__/syncQueue.delta.test.ts`, `mobile-shopai/src/__tests__/db.stockDelta.test.ts`

**Interfaces:**
- Produces (SQL, `SECURITY INVOKER`, `EXECUTE` revoked from `public`/`anon`, granted to `authenticated`; parameter types must match `products.id` / `customers.id` column types, check with `information_schema`):
  - `public.shopai_adjust_stock(p_product_id <products.id type>, p_delta numeric) returns void` — `UPDATE products SET stock_quantity = greatest(0, stock_quantity + p_delta), updated_at = now() WHERE id = p_product_id`.
  - `public.shopai_adjust_udhar(p_customer_id <customers.id type>, p_delta numeric) returns void` — same shape on `customers.udhar_balance`, clamped at 0.
- Produces (client): sync operation `'DELTA'` with payload `{ delta: number }` for tables `'products'` (stock) and `'customers'` (udhar), executed via `supabase.rpc(...)`.
  - `addToSyncQueue` dedupe never deletes `'DELTA'` rows, and a new `'UPDATE'` for a row whose queued op is `'INSERT'` is stored as `'INSERT'` (promotion), so first-upload data is never lost.
  - `syncUpsert` receives the operation: for `'UPDATE'` it strips `stock_quantity` (products) and `udhar_balance` (customers) from the payload; for `'INSERT'` it keeps them.
  - Every local write that changes stock or udhar computes `delta = after - before` from the actual local rows (so clamping is respected) and queues a `'DELTA'` entry inside the same transaction: `insertBill`, `finalizeDraft` (also clamp at 0 like `insertBill`), `updateProductStock`, `updateProduct` when `stock_quantity` is in `fields`, `recordUdharPayment`, `updateCustomerUdhar`.

- [ ] **Step 1: pgTAP test** `shopai_deltas.test.sql`: as a shopai JWT for shop A, `shopai_adjust_stock` on A's product changes stock by the delta and clamps at 0; calling it on shop B's product changes nothing (RLS); `anon` cannot execute. Mirror the setup in `shopai_rls_lockdown.test.sql`.
- [ ] **Step 2: Failing client tests**: (a) `insertBill` of qty 3 on a product with stock 10 leaves a queued `'DELTA' -3` for that product; (b) qty 15 on stock 10 (clamped) queues `-10`; (c) two sales queue two `'DELTA'` rows (not deduped); (d) product INSERT queued, then `updateProduct` name change → single queued `'INSERT'` whose payload has the new name and the current `stock_quantity`; (e) `'UPDATE'` upsert payload has no `stock_quantity`; (f) flush executes a delta via `rpc('shopai_adjust_stock', { p_product_id, p_delta })`; (g) a sale to a udhar customer queues a `'DELTA'` on `customers` equal to the bill total.
- [ ] **Step 3:** Run → FAIL. Write and apply the migration (local `supabase db reset` or the project's usual flow), run `supabase test db`.
- [ ] **Step 4:** Implement the client changes.
- [ ] **Step 5:** Run all jest tests → PASS. Commit migration and app separately: `feat(db): shopai stock/udhar delta RPCs`, then `fix(shopai): stock and udhar sync as deltas; sales now sync stock`.
- [ ] **Step 6:** Deploy order note in the commit/PR: apply the migration to the live project first, then build the app.

---

### Task 8: Docs and end-to-end check

**Files:**
- Modify: `mobile-shopai/docs/SYNC_DATA_FLOW.md` (queue states, delta ops, reconcile, device lock), `SYNC_AND_SUPABASE_ARCHITECTURE.md` (RPCs)

- [ ] **Step 1:** Update the docs for every behaviour change above (one short section per task).
- [ ] **Step 2:** `cd mobile-shopai && npx jest && npx tsc --noEmit` → all pass, no type errors.
- [ ] **Step 3:** Manual two-device run (physical or emulator pair): log in on A and B with the same shop; sell the same product on both while offline; reconnect → both show `start - both sales`. Delete a product on A → disappears on B after next pull. Edit shop name on A while B holds the lock → A is blocked, B's lock unchanged.
- [ ] **Step 4: Commit** `docs(shopai): sync data flow after audit fixes`.

---

## Self-review notes

- Coverage: #1,#9 → T1; #2 → T2; #3,#4 → T3; #7,#8,#12 → T4; #5 → T5; #10,#11,#14 and the settings conflict callback → T6; #6,#15 → T7; #13 explicitly excluded.
- Ordering: T3 depends on T2 (complete pull is what makes reconcile safe); T7 depends on T4 (`'DELTA'` handled by the new flush loop) and T1 (`SELECT *` payloads); T5 is independent.
- Known residual risk: a device that is offline and holds a stale lock can still write until its next `verifyActiveDevice`; true enforcement needs server-side session revocation (out of scope).
