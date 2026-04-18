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
  operation   TEXT NOT NULL,   -- 'INSERT' | 'UPDATE' | 'DELETE'
  data_id     TEXT NOT NULL,   -- the row's primary key in the target table
  payload     TEXT NOT NULL,   -- JSON blob sent to Supabase
  attempts    INTEGER DEFAULT 0
);
```

**Deduplication rule:** Before every `INSERT` into `sync_queue`, any existing row with the same `(table_name, data_id)` is deleted first. This means only the latest version of a record is ever queued — no stale intermediate updates.

**Max attempts:** `MAX_ATTEMPTS = 5`. Items that fail 5 times are silently skipped (not deleted — they stay in the table). A fresh `addToSyncQueue()` call resets the counter by deleting and re-inserting.

**Concurrent flush guard:** `isFlushing` flag prevents two simultaneous flushes (e.g. NetInfo + AppState events firing together).

---

## 3. Sync Queue — Table Payload Shapes

| `table_name` | Operation | Payload shape |
| --- | --- | --- |
| `shop` | INSERT / UPDATE | `{ shopName, ownerName, category, whatsappNumber, aiConsent, phone? }` |
| `categories` | INSERT / UPDATE | `{ id, name, icon, icon_color }` |
| `brands` | INSERT / UPDATE | `{ id, name, color }` |
| `products` | INSERT / UPDATE | Full product row (all columns except `category_name`, `brand_name`) |
| `customers` | INSERT / UPDATE | Full customer row |
| `bills` | INSERT | `{ bill: {...}, items: [...], salesLog: [...] }` — compound payload, 3 tables |
| `sales_log` | INSERT | Full sales_log row |
| Any table | DELETE | `{ id }` |

> **Bills are always INSERT** — bills are immutable once created. No bill UPDATE or bill DELETE flows exist.

---

## 4. flushSyncQueue() — How Sync Happens

**File:** [mobile/src/db/syncQueue.ts](mobile/src/db/syncQueue.ts)

1. Checks network connectivity via `NetInfo.fetch()` — skips if offline.
2. Loads all queue items with `attempts < 5`, ordered by `id ASC` (oldest first).
3. For each item:
   - Calls `syncItem()` → `syncUpsert()` or `syncDelete()`.
   - On success: deletes the row from `sync_queue`.
   - On failure: increments `attempts` counter.
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

**File:** [mobile/src/services/syncService.ts](mobile/src/services/syncService.ts)

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

**File:** [mobile/src/services/syncService.ts](mobile/src/services/syncService.ts)

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
| `POST /functions/v1/send-otp` | [authService.ts](mobile/src/services/authService.ts):24 | User submits phone number on login screen |
| `POST /functions/v1/verify-otp` | [authService.ts](mobile/src/services/authService.ts):43 | User submits OTP code |
| `supabase.auth.setSession()` | [authService.ts](mobile/src/services/authService.ts):56 | After OTP verified — stores JWT in AsyncStorage |
| `supabase.auth.getSession()` | [authService.ts](mobile/src/services/authService.ts):78 | App mount, to check if user is already logged in |
| `supabase.auth.signOut()` | [authService.ts](mobile/src/services/authService.ts):148 | User taps logout |
| `supabase.auth.onAuthStateChange()` | [AuthContext.tsx](mobile/src/context/AuthContext.tsx):77 | Always listening — catches token refresh / remote sign-out |

### Shop Recovery on Login

| Call | File | When |
| --- | --- | --- |
| `supabase.from('shops').select('...')` | [authService.ts](mobile/src/services/authService.ts):93 | If JWT valid but no local shop info — recovers shop to AsyncStorage + SQLite |

### Admin Status Check

| Call | File | When |
| --- | --- | --- |
| `supabase.from('shops').select('is_active').eq('id', phone)` | [syncService.ts](mobile/src/services/syncService.ts):24 | On startup + every app foreground |

### Data Sync (Flush Queue → Supabase)

| Supabase Call | File | Tables |
| --- | --- | --- |
| `supabase.from(table).upsert({ ...payload, shop_id })` | [syncQueue.ts](mobile/src/db/syncQueue.ts):119 | `products`, `categories`, `brands`, `customers`, `sales_log` |
| `supabase.from('shops').upsert(...)` | [syncQueue.ts](mobile/src/db/syncQueue.ts):129 | `shops` — excludes `is_active` (admin-only field) |
| `supabase.from('bills').upsert(...)` | [syncQueue.ts](mobile/src/db/syncQueue.ts):152 | `bills` + `bill_items` + `sales_log` (compound) |
| `supabase.from(table).delete().eq('id', dataId)` | [syncQueue.ts](mobile/src/db/syncQueue.ts):179 | Any table — triggered by DELETE operations |

### Cloud Restore (restoreService.ts)

Called when: user grants consent on a fresh install with existing cloud data (auto-restore), or user manually triggers restore from SettingsScreen.

| Call | Tables fetched |
| --- | --- |
| `supabase.from('shops').select('*').eq('id', phone)` | Shop info |
| `supabase.from('categories/brands/products/customers/bills/sales_log').select('*').eq('shop_id', phone)` | All data tables |
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

**File:** [mobile/src/services/restoreService.ts](mobile/src/services/restoreService.ts)

```text
restoreFromCloud()
  │
  ├─ supabase.auth.getSession()  → get phone (shop id)
  │
  ├─ Parallel fetch (Promise.all):
  │     shops          → .select('*').eq('id', phone)
  │     categories     → .select('*').eq('shop_id', phone)
  │     brands         → .select('*').eq('shop_id', phone)
  │     products       → .select('*').eq('shop_id', phone)
  │     customers      → .select('*').eq('shop_id', phone)
  │     bills          → .select('*').eq('shop_id', phone)
  │     sales_log      → .select('*').eq('shop_id', phone)
  │
  ├─ bill_items  → chunked fetch (100 bill IDs per request — PostgREST URL limit)
  │
  ├─ Data transformations before writing to SQLite:
  │     • Strip shop_id from all rows (not stored in SQLite)
  │     • Normalise bill_date TIMESTAMPTZ → ISO 8601 UTC string (SQLite date queries)
  │     • Map shop row columns → SQLite shape (snake_case, ai_consent as 0/1)
  │
  └─ importFromJson(backup)  → SQLite INSERT OR REPLACE (single transaction)
        → returns ImportSummary { categories, brands, products, customers, bills, billItems, salesLog }
```

---

### importFromJson() — How Data Lands in SQLite

**File:** [mobile/src/db/backup.ts](mobile/src/db/backup.ts)

- Runs inside a single `db.withTransactionSync()` — all-or-nothing.
- Uses `INSERT OR REPLACE` on every row — **idempotent**. Safe to run on a non-empty DB. Existing rows with the same `id` are replaced with the cloud version. New rows are added.
- Does NOT touch `sync_queue` or `suggestions_cache`.
- Does NOT call `addToSyncQueue()` — restored rows don't need to be re-pushed to Supabase.

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
| Strategy | `INSERT OR REPLACE` (merge) | `upsert` (overwrite by id) |
| Blocking? | Auto: non-blocking. Manual: blocking with spinner | Non-blocking (background) |
| Triggers `addToSyncQueue`? | No | N/A (it is the queue flush) |
| Consent required? | Auto-restore: yes (`ai_consent = true`). Manual: user must be cloud user | Yes |

---

## 13. Local Backup & Restore (JSON + SQL)

These are **offline backup** features — no Supabase involved. All data comes from and goes to SQLite directly.

### JSON Export

**Trigger:** Settings → Data & Backup → Export Backup  
**File:** [mobile/src/db/backup.ts](mobile/src/db/backup.ts) → `exportAsJson()`

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
**File:** [mobile/src/db/backup.ts](mobile/src/db/backup.ts) → `importFromJson()`

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
        ├─ importFromJson(parsed)  → INSERT OR REPLACE into SQLite (single transaction)
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
**File:** [mobile/src/db/db.ts](mobile/src/db/db.ts) → `exportAsSql(shopId)`

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
| [mobile/src/db/syncQueue.ts](mobile/src/db/syncQueue.ts) | `addToSyncQueue`, `flushSyncQueue`, `getPendingSyncCount` |
| [mobile/src/db/db.ts](mobile/src/db/db.ts) | All SQLite reads/writes + `addToSyncQueue` calls for every mutation |
| [mobile/src/db/backup.ts](mobile/src/db/backup.ts) | `exportAsJson`, `importFromJson`, `clearAllLocalData` |
| [mobile/src/services/syncService.ts](mobile/src/services/syncService.ts) | `startSyncService`, `stopSyncService`, `checkShopStatus` |
| [mobile/src/services/authService.ts](mobile/src/services/authService.ts) | OTP send/verify, `getStoredAuth` (with shop recovery) |
| [mobile/src/services/restoreService.ts](mobile/src/services/restoreService.ts) | `restoreFromCloud`, `deleteFromCloud` |
| [mobile/src/context/AuthContext.tsx](mobile/src/context/AuthContext.tsx) | `isAuthenticated`, `isShopSetup`, `isShopActive`, `isAutoRestoring` state |
| [mobile/src/utils/storage.ts](mobile/src/utils/storage.ts) | AsyncStorage typed wrappers |
| [mobile/src/db/sqlite.ts](mobile/src/db/sqlite.ts) | SQLite schema, `is_active` migration |

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
