# Sync Queue & Supabase Architecture

> Context document for developers and AI assistants.  
> Source of truth: the actual source files — check them when in doubt.

---

## 1. High-Level Data Flow

```text
User Action (add product, create bill, edit shop, etc.)
       │
       ▼
 SQLite (offline-first write — always immediate)
       │
       ▼
 sync_queue table (SQLite) — row added via addToSyncQueue()
       │
       ▼ triggered by: app foreground / network reconnect / explicit flush
 flushSyncQueue()
       │
       ▼
 Supabase (PostgREST upsert / delete)
```

**Key principle:** The app never writes directly to Supabase from UI code. All mutations go to SQLite first, then async to Supabase via the queue. This means the app works fully offline — data syncs when connectivity returns.

---

## 2. The sync_queue Table (SQLite)

```sql
CREATE TABLE sync_queue (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name  TEXT NOT NULL,
  operation   TEXT NOT NULL,   -- 'INSERT' | 'UPDATE' | 'DELETE' | 'DELTA'
  data_id     TEXT NOT NULL,   -- the row's primary key in the target table
  payload     TEXT NOT NULL,   -- JSON blob sent to Supabase
  attempts    INTEGER DEFAULT 0,
  next_attempt_at INTEGER DEFAULT 0,  -- epoch ms; skipped by flush until then
  last_error  TEXT                    -- last permanent error (500 chars)
);
```

**Deduplication rule:** Before queueing an INSERT/UPDATE/DELETE, any existing non-`DELTA` row with the same `(table_name, data_id)` is deleted first, so only the latest snapshot of a record is queued. `DELTA` rows are additive and never deduped; an INSERT (or an UPDATE promoted to INSERT because an INSERT was still queued) deletes them too, since its absolute snapshot already contains them. `shop` payloads are merged with earlier queued ones instead of replaced.

**Legacy queue migration:** `initTables` (`sqlite.ts`) runs `migrateLegacySyncQueue` once per DB file (`PRAGMA user_version` 0 → 1): queued `products`/`customers` `UPDATE` rows from older builds (full rows with absolute stock/udhar) become `INSERT`, so the stripped-UPDATE rule does not drop their stock/udhar. UPDATEs queued after the upgrade are untouched.

**Errors and attempts:** `MAX_ATTEMPTS = 5`. `classifySyncError` splits errors into transient (network `TypeError`, `JWT expired`, PGRST301/000/002, HTTP 401/408/429/5xx; flush stops, no attempt burned) and permanent (`attempts + 1`, `next_attempt_at = now + min(30s * 2^attempts, 1h)`, `last_error` saved). HTTP status is carried through `throwIfError`. At 5 attempts the item stays in the table but is not fetched; `getStuckSyncCount()` / `retryStuckSyncItems()` drive a Retry button on Home and Settings. A fresh `addToSyncQueue()` for the same row replaces a stuck snapshot entry.

**Concurrent flush guard:** a per-generation flag (`flushingGeneration`) prevents two simultaneous flushes (e.g. NetInfo + AppState events firing together); a flush left over from a previous session cannot block the next one.

**Generation guard:** `flushSyncQueue` captures the sync generation and stored shop id at start and re-checks both after every await; if `bumpSyncGeneration()` ran (called by `AuthContext.logout`) or the stored shop id changed, it returns without touching the queue. It never rejects to callers (errors such as a closed DB are logged).

---

## 3. Sync Queue — Table Payload Shapes

| `table_name` | Operation | Payload shape |
| --- | --- | --- |
| `shop` | INSERT / UPDATE | `{ shopName, ownerName, category, whatsappNumber, aiConsent, phone? }` |
| `categories` | INSERT / UPDATE | `{ id, name, icon, icon_color }` |
| `brands` | INSERT / UPDATE | `{ id, name, color }` |
| `products` | INSERT / UPDATE | Full product row (all columns except `category_name`, `brand_name`); UPDATE omits `stock_quantity` |
| `products` / `customers` | DELTA | `{ delta, op_id }` — change to `stock_quantity` / `udhar_balance`; `op_id` is a unique uuid-shaped id for idempotency |
| `customers` | INSERT / UPDATE | Full customer row (UPDATE omits `udhar_balance`) |
| `bills` | INSERT | `{ bill: {...}, items: [...], salesLog: [...] }` — compound payload, 3 tables |
| `sales_log` | INSERT | Full sales_log row |
| Any table | DELETE | `{ id }` |

> **Bills are always INSERT** — bills are immutable once created. No bill UPDATE or bill DELETE flows exist.

---

## 4. flushSyncQueue() — How Sync Happens

**File:** [mobile-shopai/src/db/syncQueue.ts](mobile-shopai/src/db/syncQueue.ts)

1. Returns if the device-conflict flag is set; checks network via `NetInfo.fetch()` — skips if offline; then `verifyActiveDevice()` must be `'ok'` (60s cache; `'conflict'` or `'unknown'` aborts).
2. Loads queue items with `attempts < 5 AND next_attempt_at <= now`, ordered by `id ASC` (oldest first).
3. For each item:
   - A `DELTA` is skipped while an earlier `INSERT` for the same row is still queued.
   - Calls `syncItem()` → `syncUpsert()`, `syncDelta()` or `syncDelete()`.
   - On success: records the row for any active pull tracker (`beginPullTracking`), then deletes it from `sync_queue`.
   - On failure: transient stops the flush untouched; permanent increments `attempts` and sets backoff (see section 2).
4. `shop_id` (10-digit phone) is injected automatically from the live Supabase session — not stored in the payload.

**`bill_items` special case:** `bill_items` has no `shop_id` column — RLS access is derived through the parent `bills` row. Upserted without `shop_id`.

---

## 5. When Does Flush Run?

| Trigger | Condition |
| --- | --- |
| App comes to foreground (`AppState = 'active'`) | Always (for all consent users) |
| Network reconnects (`NetInfo` event) | Consent users only |
| App startup (inside `startSyncService`) | Consent users only |
| Explicit call after `EditShopScreen` save | Always (direct `flushSyncQueue()` call) |

> **Consent gate:** `getHasConsent()` (AsyncStorage `has_consent` key) gates data sync. Non-consent users never run `flushSyncQueue()` except the explicit post-save call in EditShopScreen.

---

## 6. startSyncService() — Full Lifecycle

**File:** [mobile-shopai/src/services/syncService.ts](mobile-shopai/src/services/syncService.ts)

```text
startSyncService(onDeactivated)
  │
  ├─ stopSyncService()  ← clean up any prior listeners first
  │
  ├─ checkShopStatus(onDeactivated)  ← admin is_active check (ALL users, no consent gate)
  │
  ├─ AppState listener (ALL users)
  │     on 'active':
  │       checkShopStatus(onDeactivated)
  │       if hasConsent → flushSyncQueue()
  │
  ├─ if !hasConsent → RETURN (no further data sync setup)
  │
  ├─ NetInfo listener (consent users only)
  │     on isConnected → flushSyncQueue()
  │
  └─ flushSyncQueue()  ← immediate startup flush
```

`startSyncService` is called from:

- `AuthContext` on mount (if shop is already setup)
- `AuthContext.login()` after OTP (if shop already exists)
- `AuthContext.completeSetup()` after first shop creation

---

## 7. checkShopStatus() — Admin Deactivation Check

**File:** [mobile-shopai/src/services/syncService.ts](mobile-shopai/src/services/syncService.ts)

Runs for **all users** regardless of consent. Queries Supabase directly (not via queue):

```typescript
supabase.from('shops').select('is_active').eq('id', phone).single()
```

If `is_active === false`:

1. Persists `isActive: false` into AsyncStorage (`shop_info` key).
2. Calls `onDeactivated()` callback → sets `isShopActive = false` in AuthContext → RootNavigator shows `ShopDeactivatedScreen`.

Runs on:

- `startSyncService()` startup
- Every `AppState 'active'` event (app comes to foreground)

---

## 8. All Supabase Calls — Catalog

### Authentication (Edge Functions)

| Call | File | When |
| --- | --- | --- |
| `POST /functions/v1/send-otp` | [authService.ts](mobile-shopai/src/services/authService.ts):24 | User submits phone number on login screen |
| `POST /functions/v1/verify-otp` | [authService.ts](mobile-shopai/src/services/authService.ts):43 | User submits OTP code |
| `supabase.auth.setSession()` | [authService.ts](mobile-shopai/src/services/authService.ts):56 | After OTP verified — stores JWT in AsyncStorage |
| `supabase.auth.getSession()` | [authService.ts](mobile-shopai/src/services/authService.ts):78 | App mount, to check if user is already logged in |
| `supabase.auth.signOut()` | [authService.ts](mobile-shopai/src/services/authService.ts):148 | User taps logout |
| `supabase.auth.onAuthStateChange()` | [AuthContext.tsx](mobile-shopai/src/context/AuthContext.tsx):77 | Always listening — catches token refresh / remote sign-out |

### Shop Recovery on Login

| Call | File | When |
| --- | --- | --- |
| `supabase.from('shops').select('...')` | [authService.ts](mobile-shopai/src/services/authService.ts):93 | If JWT valid but no local shop info — recovers shop to AsyncStorage + SQLite |

### Admin Status Check

| Call | File | When |
| --- | --- | --- |
| `supabase.from('shops').select('is_active').eq('id', phone)` | [syncService.ts](mobile-shopai/src/services/syncService.ts):24 | On startup + every app foreground |

### Data Sync (Flush Queue → Supabase)

| Supabase Call | File | Tables |
| --- | --- | --- |
| `supabase.from(table).upsert({ ...payload, shop_id })` | [syncQueue.ts](mobile-shopai/src/db/syncQueue.ts):119 | `products`, `categories`, `brands`, `customers`, `sales_log` |
| `supabase.from('shops').update(...)` | [syncQueue.ts](mobile-shopai/src/db/syncQueue.ts) | `shops` — excludes `is_active` and never writes `active_device_id` |
| `supabase.rpc('shopai_adjust_stock', { p_product_id, p_delta, p_op_id })` | [syncQueue.ts](mobile-shopai/src/db/syncQueue.ts) `syncDelta` | `products.stock_quantity` — `DELTA` ops |
| `supabase.rpc('shopai_adjust_udhar', { p_customer_id, p_delta, p_op_id })` | [syncQueue.ts](mobile-shopai/src/db/syncQueue.ts) `syncDelta` | `customers.udhar_balance` — `DELTA` ops |

**Delta RPCs** (migration `supabase/migrations/20261026100000_shopai_stock_udhar_deltas.sql`): `shopai_adjust_stock(p_product_id text, p_delta numeric, p_op_id text)` and `shopai_adjust_udhar(p_customer_id text, p_delta numeric, p_op_id text)` are `SECURITY INVOKER` (the caller's RLS scopes the row to its shop), set `value = greatest(0, coalesce(value, 0) + p_delta)`, and are executable by `authenticated` only. They are idempotent: each first inserts `p_op_id` into `public.shopai_applied_deltas (op_id text primary key, shop_id uuid default jwt_shop_id(), applied_at timestamptz)` `on conflict do nothing` and adjusts only when that insert added a row, so a retry after a lost response is a no-op. That table has RLS (`shopai_owner_access`: `jwt_app() = 'shopai'` and own `shop_id`), no anon access, `select, insert` for `authenticated`; rows are not pruned. **Deploy order:** apply the migration to the live project BEFORE shipping the app build that queues `DELTA`. The pgTAP test `supabase/tests/database/shopai_deltas.test.sql` has not been run (no Docker); run `supabase test db`. Limits: the clamp makes deltas non-commutative if a backed-off delta is overtaken; deltas are rounded to 4 decimals; old app builds still send absolute stock/udhar.
| `supabase.from('bills').upsert(...)` | [syncQueue.ts](mobile-shopai/src/db/syncQueue.ts):152 | `bills` + `bill_items` + `sales_log` (compound) |
| `supabase.from(table).delete().eq('id', dataId)` | [syncQueue.ts](mobile-shopai/src/db/syncQueue.ts):179 | Any table — triggered by DELETE operations |

### Cloud Restore (restoreService.ts)

Called when: user grants consent on a fresh install with existing cloud data (auto-restore), or user manually triggers restore from SettingsScreen.

| Call | Tables fetched |
| --- | --- |
| `supabase.from('shops').select('*').eq('id', phone)` | Shop info |
| `supabase.from('categories/brands/products/customers/bills/sales_log/purchase_log').select('*').eq('shop_id', phone).order('id').range(from, to)` | All data tables, paged 1000 rows at a time (PostgREST `max_rows` cap) |
| `supabase.from('shops').select('active_device_id, ai_consent')` | `verifyActiveDevice()` — device lock check |
| `supabase.from('bill_items').select('*').in('bill_id', [...])` | Bill items (chunked, 100 IDs per request) |

### Cloud Delete (restoreService.ts)

Called when: user switches from cloud to local consent and opts to delete cloud data.

Deletes in FK-safe order: `sales_log` → `bill_items` → `bills` → `customers` → `products` → `brands` → `categories` → `shops`.

---

## 9. RLS (Row Level Security) — How shop_id Works

All Supabase tables (except `shops` and `bill_items`) require `shop_id = right(auth.jwt() ->> 'phone', 10)`.

- **`shop_id` is never stored locally** — it's injected at flush time by `getShopId()` which reads `supabase.auth.getSession()`.
- **`shops` table** uses `id = right(auth.jwt() ->> 'phone', 10)` instead of `shop_id`.
- **`bill_items`** has no `shop_id` — RLS is enforced through the parent `bills` row.
- **`is_active`** is excluded from all user-side upserts (shop POST only sets the editable fields). Admin sets it directly in Supabase dashboard or admin API.

---

## 10. AsyncStorage Keys

| Key (`StorageKeys.*`) | Type | Purpose |
| --- | --- | --- |
| `has_consent` | `boolean` | Whether user has given cloud/AI consent — gates `flushSyncQueue()` |
| `shop_info` | `StoredShopInfo` JSON | Fast read of shop name, owner, category, aiConsent, isActive — no SQLite needed |
| `last_sync` | `string` (ISO date) | Last successful sync timestamp (informational) |
| `auth_token` | `string` | Legacy key — JWT is now managed by Supabase AsyncStorage adapter |

**`StoredShopInfo` shape:**

```typescript
{
  shopName: string;
  ownerName: string;
  phone?: string;
  category?: string;
  whatsappNumber?: string;
  aiConsent?: boolean;
  isActive?: boolean;   // written when checkShopStatus detects deactivation
}
```

---

## 11. Shop Data — Two-Stage Read

| Stage | Source | Speed | When used |
| --- | --- | --- | --- |
| 1 (fast) | AsyncStorage `shop_info` | Instant | UI display (SettingsScreen, EditShopScreen) |
| 2 (authoritative) | SQLite `shop` table | Fast (sync) | getShop() in db.ts — used when full row needed |
| 3 (live) | Supabase `shops` table | Network | checkShopStatus() admin check + cloud restore |

---

## 12. Cloud Restore — Deep Dive

Cloud restore is the **only path where Supabase writes into SQLite**. Everything else is SQLite → Supabase.

### Two Modes

| Mode | Trigger | Who initiates |
| --- | --- | --- |
| **Auto-restore** | Login on fresh install when JWT is valid + `ai_consent = true` + local `products` table is empty | `getStoredAuth()` in authService.ts |
| **Manual restore** | User taps "Restore from Cloud" in Settings → Data & Backup | `handleRestoreFromCloud()` in SettingsScreen.tsx |

---

### Auto-Restore Flow (fresh install / data wipe)

```text
App launch → getStoredAuth()
  │
  ├─ supabase.auth.getSession()  → JWT found (returning user)
  │
  ├─ getShopInfo() from AsyncStorage  → null (data wiped)
  │
  ├─ supabase.from('shops').select(...)  → shop row found
  │     ↓
  │   setShopInfo() → AsyncStorage updated
  │   setHasConsent() → AsyncStorage updated
  │   insertShop() → SQLite shop row written
  │
  ├─ if aiConsent = true AND products table is empty:
  │     emitRestoreEvent('start')   ← shows "Restoring from cloud…" banner in RootNavigator
  │     restoreFromCloud()          ← runs NON-BLOCKING (no await)
  │       → emitRestoreEvent('complete' | 'error') when done
  │
  └─ returns { isAuthenticated: true, isShopSetup: true }
       → user goes straight to MainTabs (not ShopSetup)
       → banner shows while data loads in background
```

**Key detail:** `restoreFromCloud()` is called without `await` — the user lands on the home screen immediately and sees their data appear as it loads. The `isAutoRestoring` flag in AuthContext drives the banner.

---

### Manual Restore Flow

```text
SettingsScreen → "Restore from Cloud" button
  │
  ├─ Alert confirmation
  │
  ├─ setIsRestoring(true)  ← shows spinner in UI
  │
  ├─ restoreFromCloud()  ← awaited (blocking)
  │
  ├─ setIsRestoring(false)
  │
  └─ Alert with summary: "Restored: X products, Y customers, Z bills..."
```

---

### What restoreFromCloud() Does

**File:** [mobile-shopai/src/services/restoreService.ts](mobile-shopai/src/services/restoreService.ts)

```text
restoreFromCloud()
  │
  ├─ supabase.auth.getSession()  → get phone (shop id)
  │
  ├─ beginPullTracking()  ← records every row flushed during the fetch (stopped in finally)
  ├─ getPendingIds() snapshot (all sync_queue rows, any attempts)
  ├─ snapshotLocalIds()  ← products/categories/brands/customers ids at pull start
  │
  ├─ Sequential fetch, per-table errors collected in tableErrors:
  │     shops          → .select(<granted columns>).eq('id', phone)
  │     categories, brands, products, customers, bills, sales_log, purchase_log
  │                    → fetchAllRows: .eq('shop_id', phone).order('id').range(from, to), 1000/page
  │
  ├─ bill_items  → chunked fetch (100 bill IDs per request — PostgREST URL limit)
  │
  ├─ Data transformations before writing to SQLite:
  │     • Strip shop_id from all rows (not stored in SQLite)
  │     • Normalise bill_date TIMESTAMPTZ → ISO 8601 UTC string (SQLite date queries)
  │     • Map shop row columns → SQLite shape (snake_case, ai_consent as 0/1)
  │
  └─ importFromJson(backup, { pending: before ∪ after ∪ flushed-during-pull,
                               reconcile: no tableErrors, reconcileOnly: ids at pull start })
        → SQLite INSERT OR REPLACE (single transaction)
        → returns ImportSummary { categories, brands, products, customers, bills, billItems, salesLog }
```

---

### importFromJson() — How Data Lands in SQLite

**File:** [mobile-shopai/src/db/backup.ts](mobile-shopai/src/db/backup.ts)

- Runs inside a single `db.withTransactionSync()` — all-or-nothing.
- Uses `INSERT OR REPLACE` on every row — **idempotent**. Safe to run on a non-empty DB. Existing rows with the same `id` are replaced with the cloud version, except rows with any queued `sync_queue` entry (see below). New rows are added.
- Does NOT touch `sync_queue` or `suggestions_cache`.
- Does NOT call `addToSyncQueue()` — restored rows don't need to be re-pushed to Supabase.
- Restores pack columns (`purchase_uom`, `units_per_pack`), bill discount columns (`discount_percent/amount/type`) and `bill_items.display_qty`.
- **Pending rows are skipped:** rows whose `(table, id)` has any `sync_queue` entry (any `attempts`) are never overwritten (shop, categories, brands, products, customers, bills; bill_items follow their bill).
- **Delete convergence:** with `reconcile: true` (a pull with no `tableErrors`), local products/categories/brands/customers missing from the cloud and not pending are deleted — only among the ids in `reconcileOnly` (rows that existed when the pull began), so rows created during the fetch survive. Bills, bill_items and logs are never reconciled.
- **Device lock:** background pulls (`pullIfStale`) and `autoRestoreIfEmpty` run only when the conflict flag is clear and `verifyActiveDevice()` returns `'ok'`; `checkShopStatus` stamps an unclaimed session only via `.is('active_device_id', null)`; `claimSession` clears the flag, restores once, then flushes. `services/deviceLock.ts` + `verifyActiveDevice` (60s cache) gate flush; shop updates no longer write `active_device_id`. Still client-enforced: the old session's JWT stays valid and a stale-ok window of up to 60s exists.
- **Fresh login:** `autoRestoreIfEmpty()` restores when consent is on and local `products` is empty. The `db` proxy throws before `openUserDatabase`, and consent defaults to off.

---

### Cloud Delete Flow

Triggered when user turns off cloud consent and confirms "Delete my cloud data".

```text
deleteFromCloud()
  │
  ├─ Deletes in FK-safe order (children before parents):
  │     1. sales_log      (DELETE WHERE shop_id = phone)
  │     2. bill_items     (DELETE WHERE bill_id IN [...] — chunked)
  │     3. bills          (DELETE WHERE shop_id = phone)
  │     4. customers      (DELETE WHERE shop_id = phone)
  │     5. products       (DELETE WHERE shop_id = phone)
  │     6. brands         (DELETE WHERE shop_id = phone)
  │     7. categories     (DELETE WHERE shop_id = phone)
  │     8. shops          (DELETE WHERE id = phone)
  │
  └─ Partial failure: continues on error per table, returns tableErrors map
       → user sees which tables failed and can retry
```

---

### Restore vs Sync Queue — Key Difference

| | Cloud Restore | Sync Queue Flush |
| --- | --- | --- |
| Direction | Supabase → SQLite | SQLite → Supabase |
| When | Fresh install / manual | Foreground / network / explicit |
| Strategy | `INSERT OR REPLACE` (merge; cloud pull skips rows with queued sync entries and reconciles deletes only after a fully successful pull) | `upsert` (overwrite by id) |
| Blocking? | Auto: non-blocking. Manual: blocking with spinner | Non-blocking (background) |
| Triggers `addToSyncQueue`? | No | N/A (it is the queue flush) |
| Consent required? | Auto-restore: yes (`ai_consent = true`). Manual: user must be cloud user | Yes |

---

## 13. Local Backup & Restore (JSON + SQL)

These are **offline backup** features — no Supabase involved. All data comes from and goes to SQLite directly.

### JSON Export

**Trigger:** Settings → Data & Backup → Export Backup  
**File:** [mobile-shopai/src/db/backup.ts](mobile-shopai/src/db/backup.ts) → `exportAsJson()`

```text
exportAsJson()
  │
  ├─ Reads all SQLite tables:
  │     shop, categories, brands, products,
  │     customers, bills, bill_items, sales_log
  │
  └─ Returns BackupData { version, exportedAt, shop, categories, ... }
       → written to device cache as pragati_bandhu_backup_YYYYMMDD.json
       → shared via expo-sharing (file picker / share sheet)
```

**Notes:**

- Does NOT include `sync_queue` or `suggestions_cache` (internal only).
- Privacy alert shown before sharing — file contains customer PII.

---

### JSON Import

**Trigger:** Settings → Data & Backup → Import Backup (pick a `.json` file)  
**File:** [mobile-shopai/src/db/backup.ts](mobile-shopai/src/db/backup.ts) → `importFromJson()`

```text
handleImportJson()
  │
  ├─ DocumentPicker → pick .json or .plain-text file
  ├─ JSON.parse + validate (version + exportedAt must exist)
  ├─ Phone cross-check (C6):
  │     if backup.shop.phone ≠ logged-in phone → warn user before proceeding
  │
  └─ proceedWithImport(parsed)
        │
        ├─ importFromJson(parsed)  → INSERT OR REPLACE into SQLite (single transaction); called with no opts, so no pending-skip and no reconcile (those apply only to cloud pulls)
        │
        └─ if aiConsent = true:
              queueAllLocalData()   ← re-queues every SQLite row as upserts
              flushSyncQueue()      ← immediately pushes to Supabase
                                      (cancels any stale DELETE entries for same IDs)
```

**Key behaviour:** For cloud users, imported data is immediately synced to Supabase so the cloud reflects the restored state. For offline users, data stays local only.

---

### SQL Export (Debug Mode)

**Trigger:** Tap version number 5 times in Settings → "Export Local Data" button appears  
**File:** [mobile-shopai/src/db/db.ts](mobile-shopai/src/db/db.ts) → `exportAsSql(shopId)`

Generates `INSERT INTO ... ON CONFLICT (id) DO NOTHING` statements for all tables, injectable into the Supabase SQL Editor. Used for manual data recovery / debugging only.

---

### Enable Cloud Backup (Offline → Cloud Switch)

**Trigger:** Settings → Data & Backup → "Enable Cloud Backup" (shown only when `aiConsent = false`)

```text
handleEnableCloudBackup()
  │
  ├─ updateShop({ aiConsent: true })      ← SQLite + addToSyncQueue
  ├─ setShopInfo({ aiConsent: true })     ← AsyncStorage
  ├─ setHasConsent(true)                  ← AsyncStorage
  │
  ├─ queueAllLocalData()   ← queues every existing SQLite row as upserts
  ├─ getPendingSyncCount() ← shows "Uploading N items…" text in UI (C10)
  │
  └─ startSyncService()   ← flushes queue + starts listeners
```

This is the one-time migration from offline-only to cloud-backed mode. All historical data gets pushed to Supabase in this single flow.

---

### Delete All Data

**Trigger:** Settings → Danger Zone → Delete All Data

Two variants depending on consent status:

| User type | Options |
| --- | --- |
| Offline (no consent) | "Delete Local Only" — `clearAllLocalData()` + logout |
| Cloud user | "Local Only" — same as above; OR "Local + Cloud" — `deleteFromCloud()` first, then local delete + logout |

**`clearAllLocalData()`** deletes every row from every SQLite table (preserves schema). Order: `bill_items` → `sales_log` → `bills` → `customers` → `products` → `brands` → `categories` → `suggestions_cache` → `sync_queue` → `shop`.

After any delete-all: `clearShopInfo()` + `setHasConsent(false)` + `logout()` → user lands on login screen.

---

### Full Backup/Restore Feature Matrix

| Feature | Source | Destination | Consent required | File |
| --- | --- | --- | --- | --- |
| JSON Export | SQLite | Device file | No | backup.ts `exportAsJson` |
| JSON Import | Device file | SQLite (+ Supabase if consent) | No (sync only if consent) | backup.ts `importFromJson` |
| SQL Export | SQLite | Clipboard/share | No (debug only) | db.ts `exportAsSql` |
| Cloud Restore (manual) | Supabase | SQLite | Yes (cloud user) | restoreService.ts `restoreFromCloud` |
| Cloud Restore (auto) | Supabase | SQLite | Yes (`ai_consent = true`) | authService.ts → restoreService.ts |
| Enable Cloud Backup | SQLite | Supabase (via queue) | Grants consent | SettingsScreen `handleEnableCloudBackup` |
| Delete Local | SQLite | — (delete) | No | backup.ts `clearAllLocalData` |
| Delete Local + Cloud | SQLite + Supabase | — (delete) | Yes | restoreService.ts `deleteFromCloud` |

---

## 14. Key File Map

| File | Role |
| --- | --- |
| [mobile-shopai/src/db/syncQueue.ts](mobile-shopai/src/db/syncQueue.ts) | `addToSyncQueue`, `flushSyncQueue`, `getPendingSyncCount` |
| [mobile-shopai/src/db/db.ts](mobile-shopai/src/db/db.ts) | All SQLite reads/writes + `addToSyncQueue` calls for every mutation |
| [mobile-shopai/src/db/backup.ts](mobile-shopai/src/db/backup.ts) | `exportAsJson`, `importFromJson`, `clearAllLocalData` |
| [mobile-shopai/src/services/syncService.ts](mobile-shopai/src/services/syncService.ts) | `startSyncService`, `stopSyncService`, `checkShopStatus` |
| [mobile-shopai/src/services/authService.ts](mobile-shopai/src/services/authService.ts) | OTP send/verify, `getStoredAuth` (with shop recovery) |
| [mobile-shopai/src/services/restoreService.ts](mobile-shopai/src/services/restoreService.ts) | `restoreFromCloud`, `deleteFromCloud` |
| [mobile-shopai/src/context/AuthContext.tsx](mobile-shopai/src/context/AuthContext.tsx) | `isAuthenticated`, `isShopSetup`, `isShopActive`, `isAutoRestoring` state |
| [mobile-shopai/src/utils/storage.ts](mobile-shopai/src/utils/storage.ts) | AsyncStorage typed wrappers |
| [mobile-shopai/src/db/sqlite.ts](mobile-shopai/src/db/sqlite.ts) | SQLite schema, `is_active` migration |

---

## 15. Common Gotchas

**Q: I added a write but Supabase isn't updating.**  
A: Check that `addToSyncQueue()` is called in `db.ts`. Then check that `flushSyncQueue()` is called (happens on foreground/network, or call it explicitly). For shop edits, `EditShopScreen` calls `flushSyncQueue()` explicitly after save.

**Q: User gets ShopSetup screen after OTP on an existing account.**  
A: `AuthContext.login()` calls `getStoredAuth()` which queries Supabase for the shop if AsyncStorage is empty. Ensure `await login(phone)` is used (not sync call) and the JWT is in AsyncStorage before `getStoredAuth()` runs.

**Q: Admin deactivation isn't being detected.**  
A: `checkShopStatus()` must run before the `if (!hasConsent) return` guard in `startSyncService`. It's consent-independent.

**Q: `is_active` was set false in Supabase but app still works.**  
A: The app only checks on startup and foreground. Backgrounding and reopening the app will trigger `checkShopStatus` via AppState listener.

**Q: Bill items aren't syncing / `bill_items` 404.**  
A: `bill_items` upsert uses no `shop_id`. RLS derives access via the parent bill. Ensure `bills` upsert succeeds first (sequential in `syncUpsert`).
