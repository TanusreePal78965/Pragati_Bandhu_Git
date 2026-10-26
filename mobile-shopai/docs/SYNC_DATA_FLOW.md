# Sync Data Flow: SQLite → Supabase

## Architecture Overview

Pragati Bandhu uses a **local-first, offline-capable** sync architecture:

- All writes go to **SQLite immediately** (synchronous, always succeeds)
- A **sync queue** records pending changes
- A **background sync service** flushes the queue to Supabase when online and the user has opted in
- **Supabase Row Level Security (RLS)** enforces per-shop isolation on every table

This means the app is fully functional with no internet connection. Cloud sync is an opt-in backup, not a dependency.

---

## Consent Gate

Sync behaviour depends on whether the user chose "Cloud Backup" during shop setup:

| Feature | No Consent | With Consent |
|---------|-----------|--------------|
| Local SQLite writes | Always | Always |
| Sync queue accumulation | Always | Always |
| Flush on network reconnect | No | Yes |
| Flush on app foreground | No | Yes |
| Flush on startup | No | Yes |
| Manual "Sync Now" from Settings | Yes (explicit action) | Yes |
| Admin deactivation check | Always | Always |

---

## Entities & Sync Strategy

| SQLite Table | Supabase Table | Operations Synced | Scoped By |
|-------------|---------------|-------------------|-----------|
| `shop` | `shops` | INSERT, UPDATE | `id = phone` |
| `categories` | `categories` | INSERT, UPDATE, DELETE | `shop_id` |
| `brands` | `brands` | INSERT, UPDATE, DELETE | `shop_id` |
| `products` | `products` | INSERT, UPDATE, DELETE, DELTA (stock) | `shop_id` |
| `customers` | `customers` | INSERT, UPDATE, DELTA (udhar) | `shop_id` |
| `bills` | `bills` | INSERT only (immutable) | `shop_id` |
| `bill_items` | `bill_items` | INSERT only (via bills) | via parent bill RLS |
| `sales_log` | `sales_log` | INSERT only (via bills) | `shop_id` |
| `sync_queue` | — | Never synced (internal) | — |
| `suggestions_cache` | — | Never synced (local cache) | — |

---

## Schema Mapping

### Key Differences Between SQLite and Supabase

| Aspect | SQLite | Supabase | Handled By |
|--------|--------|----------|-----------|
| Table name for shop | `shop` (singular) | `shops` (plural) | `syncUpsert` / `syncDelete` map the name in `syncQueue.ts` |
| `shop_id` column | Not present (single-shop device) | Required on all tables except `bill_items` | `syncUpsert` (`getShopId`) injects from the stored session |
| Booleans | `INTEGER 0/1` | `BOOLEAN` | Postgres accepts 0/1 implicitly |
| Timestamps | `TEXT` via `datetime('now')` | `TIMESTAMPTZ` | Postgres parses ISO-8601 strings |
| Phone format | 10-digit (`9876543210`) | E.164 in auth (`+919876543210`) | RLS uses `right(auth.jwt() ->> 'phone', 10)` |
| `bill_items.shop_id` | Not present | Not present | RLS via parent `bills` row |

### SQLite Column → Supabase Column (shop table)

| SQLite (`shop`) | Supabase (`shops`) |
|----------------|-------------------|
| `id` | `id` (= 10-digit phone) |
| `shop_name` | `shop_name` |
| `owner_name` | `owner_name` |
| `phone` | `phone` |
| `whatsapp_number` | `whatsapp_number` |
| `business_category` | `business_category` |
| `ai_consent` (INTEGER) | `ai_consent` (BOOLEAN) |
| `is_active` (INTEGER) | `is_active` (BOOLEAN) |
| `created_at` (TEXT) | `created_at` (TIMESTAMPTZ) |

---

## Step-by-Step Data Flow

### 1. User Action → SQLite (Immediate)

```
User taps "Save Product"
        │
        ▼
insertProduct() ─── db.ts
        │
        ▼
db.runSync("INSERT INTO products ...")   ← SQLite write (sync, instant)
        │
        ▼
UI updates immediately (reads from SQLite)
        │
        ▼
addToSyncQueue('products', 'INSERT', id, fullPayload)
        │
        ▼
db.runSync("DELETE FROM sync_queue WHERE table_name=? AND data_id=?")
db.runSync("INSERT INTO sync_queue ...")   ← dedup + enqueue
```

The user never waits for the network. The local database is the source of truth.

### 2. Sync Queue Structure

```sql
sync_queue
├── id          INTEGER  -- autoincrement, FIFO order key
├── table_name  TEXT     -- 'products', 'customers', 'bills', 'shop', etc.
├── operation   TEXT     -- 'INSERT' | 'UPDATE' | 'DELETE' | 'DELTA'
├── data_id     TEXT     -- primary key of the record being synced
├── payload     TEXT     -- JSON string of full record data
├── attempts    INTEGER  -- permanent-failure counter (MAX_ATTEMPTS = 5)
├── next_attempt_at INTEGER -- epoch ms; flush skips the item until then (default 0)
├── last_error  TEXT     -- last permanent error message (max 500 chars)
└── created_at  TEXT     -- when the item was enqueued
```

**Deduplication rule:** Before inserting an INSERT/UPDATE/DELETE, the queue deletes any existing non-DELTA entry for the same `(table_name, data_id)`, so only the **latest** snapshot operation for a record is queued. The payload is a **full row snapshot**, except `shop` (merged, see Queue Errors below) and `DELTA` entries (see Stock and Udhar Deltas). `next_attempt_at` and `last_error` are added to existing databases by an `ALTER TABLE` migration in `sqlite.ts`.

**Legacy queue migration:** `initTables` runs `migrateLegacySyncQueue` once per database file (`PRAGMA user_version` 0 → 1). It re-labels queued `products` / `customers` `UPDATE` rows from older builds as `INSERT`. Those payloads are full rows with absolute `stock_quantity` / `udhar_balance`, and `UPDATE` upserts now strip those columns, so without this an upgraded device would silently drop the change. UPDATEs queued after the upgrade are never rewritten.

### 3. Flush Trigger → Supabase

A flush is triggered by any of:
- App comes to foreground (`AppState 'active'`) — consent users
- Network reconnects (`NetInfo isConnected = true`) — consent users
- App startup — consent users
- User taps "Sync Now" in Settings — all users (explicit action)

```
flushSyncQueue()  ─── syncQueue.ts
        │
        ├─ [flushingGeneration = generation]  ← mutex per sync generation
        │
        ├─ capture { generation, storedShopId }; after EVERY await below, if the
        │  generation was bumped (logout) or the stored shop id changed, return
        │  immediately without touching the queue
        │
        ├─ NetInfo.fetch() → offline? return early
        │
        ├─ conflict flag set, or verifyActiveDevice() != 'ok'? return (see Device Lock)
        │
        ├─ SELECT * FROM sync_queue WHERE attempts < 5 AND next_attempt_at <= now ORDER BY id ASC
        │
        └─ for each item:
                │
                ├─ operation = 'DELTA' with an earlier INSERT for the same row queued? skip (stays queued)
                │
                ├─ operation = 'DELTA'?
                │       └─ supabase.rpc('shopai_adjust_stock' | 'shopai_adjust_udhar', {..., p_delta, p_op_id})
                │
                ├─ operation = 'DELETE'?
                │       └─ supabase.from(table).delete().eq('id', dataId)
                │
                └─ operation = 'INSERT' | 'UPDATE'?
                        └─ syncUpsert(tableName, payload)
                                │
                                ├─ getShopId() ─ extracts phone from live JWT
                                │
                                ├─ products / categories / brands / customers:
                                │       supabase.from(table).upsert({...payload, shop_id}, {onConflict:'id'})
                                │
                                ├─ shop:
                                │       supabase.from('shops').update({shop_name, ...}).eq('id', uuid)
                                │
                                └─ bills (compound):
                                        supabase.from('bills').upsert({...bill, shop_id})
                                        supabase.from('bill_items').upsert(items)
                                        supabase.from('sales_log').upsert(salesLog.map(l => ({...l, shop_id})))
```

On success: `DELETE FROM sync_queue WHERE id = ?`
On failure: classified by `classifySyncError` (see Queue Errors and Backoff). Transient: item untouched, flush stops. Permanent: `attempts + 1`, `next_attempt_at` set, `last_error` stored, flush continues.

After 5 permanent failures the item is no longer fetched, but it stays in the table and is shown to the user as stuck (Retry button).

### 4. RLS Enforcement on Supabase

Every Supabase table has a single `owner_access` policy:

```sql
-- For tables with shop_id column:
USING (shop_id = right(auth.jwt() ->> 'phone', 10))

-- For shops (id IS the phone):
USING (id = right(auth.jwt() ->> 'phone', 10))

-- For bill_items (no shop_id — derived through parent):
USING (bill_id IN (SELECT id FROM bills WHERE shop_id = right(auth.jwt() ->> 'phone', 10)))
```

The JWT is attached automatically by the Supabase client on every request. Shop isolation is enforced server-side and cannot be bypassed from the mobile app.

---

## Bill Insert Flow (Most Complex Path)

Bills are the most critical write path because they touch 4 tables atomically:

```
NewBillScreen → insertBill(bill, items)   ─── db.ts
        │
        ▼
db.withTransactionSync(() => {
    INSERT INTO bills (...)                     ← 1. create bill
    for each item:
        INSERT INTO bill_items (...)            ← 2. line items
        UPDATE products SET stock_quantity - ?  ← 3. deduct stock (queues a stock DELTA)
        INSERT INTO sales_log (...)             ← 4. sales record
    if payment_mode = 'udhar':
        UPDATE customers SET udhar_balance + ?  ← 5. credit balance (queues an udhar DELTA)
})
        │
        ▼  (transaction committed — all or nothing)
        │
addToSyncQueue('bills', 'INSERT', billId, {
    bill: { id, customer_id, payment_mode, total_amount, ... },
    items: [{ id, bill_id, product_id, qty, unit_price, line_total }, ...],
    salesLog: [{ id, product_id, qty_sold, sale_amount }, ...]
})
        │
(the stock/udhar DELTAs are queued by withDelta inside the transaction;
 no full customer UPDATE is queued any more)
```

On sync, the bill payload is upserted across three Supabase tables sequentially. If any step fails, the entire queue item is retried as a unit.

---

## Admin Deactivation Check

This runs for **all users**, regardless of sync consent:

```
App foreground / startup
        │
        ▼
checkShopStatus(onDeactivated)
        │
        ├─ offline? return (silent)
        │
        ├─ getSession() → extract phone from JWT
        │
        ├─ supabase.from('shops').select('is_active').eq('id', phone).single()
        │
        ├─ is_active = false?
        │       ├─ setShopInfo({ ...info, isActive: false })   ← persist locally
        │       └─ onDeactivated()                              ← triggers ShopDeactivatedScreen
        │
        └─ is_active = true (or network error): no action
```

---

## Retry & Failure Modes

| Scenario | Behaviour |
|---------|-----------|
| Network offline during flush | `NetInfo.fetch()` returns false → skip entire flush, try next trigger |
| Transient error (offline, expired JWT, 401/408/429/5xx) | Item untouched, flush stops; next trigger retries. No attempt burned |
| Permanent error on one item (e.g. constraint violation) | `attempts + 1`, backoff, continue with remaining items |
| Item fails 5 times | Kept in `sync_queue` but not fetched; surfaced as stuck with a Retry button (not dropped) |
| App crashes mid-flush | Queue items not deleted until success; retried on next startup |
| Concurrent flush calls | per-generation mutex (`flushingGeneration`) — second call in the same session returns immediately |
| Session expired mid-flush | `JWT expired` / HTTP 401 is transient: flush stops without burning attempts; retried after token refresh |

---

## Auth & Session Flow

```
User enters phone number
        │
        ▼
POST /functions/v1/send-otp
        │   stores OTP hash in otp_tokens (5 min TTL)
        │   Fast2SMS hook delivers SMS
        │
User enters OTP
        │
        ▼
POST /functions/v1/verify-otp
        │   verifies hash, creates Supabase auth user if new
        │   returns { access_token, refresh_token }
        │
        ▼
supabase.auth session stored in AsyncStorage
        │
        ▼
All subsequent requests: JWT auto-attached by Supabase client
RLS policies extract phone: right(auth.jwt() ->> 'phone', 10)
```

---

## Restore Completeness

- `importFromJson` (`db/backup.ts`) now restores every column the app writes: `products.purchase_uom` / `units_per_pack`, `bills.discount_percent` / `discount_amount` / `discount_type`, and `bill_items.display_qty`. Missing values fall back to `null` / `0` / `'none'`.
- `restoreFromCloud` (`services/restoreService.ts`) pages every shop-scoped table with `fetchAllRows` (`services/paging.ts`): `order('id')` plus `.range(from, to)`, 1000 rows per page, stopping on a short page. This works around the PostgREST 1000-row cap that previously truncated large tables silently. `bill_items` are fetched in 100-bill-id chunks, each chunk also paged.

---

## Pull Safety and Delete Convergence

- **Pending rows are never overwritten.** Before and after fetching, `restoreFromCloud` snapshots `getPendingIds()` (every `sync_queue` row, any `attempts` value, including stuck ones). It also calls `beginPullTracking()` before the first fetch: while a tracker is active, `flushSyncQueue` records every row it syncs successfully, so a row queued **and** flushed during the fetch window (in neither snapshot, but possibly newer than the fetched cloud copy) is also protected. The union of the three sets goes to `importFromJson` as `pending`; the tracker is stopped in a `finally`. A row of `shop`, `categories`, `brands`, `products`, `customers` or `bills` (and the `bill_items` of a pending bill) in that set is skipped by the pull.
- **Delete convergence.** When the pull finishes with no `tableErrors`, `importFromJson` is called with `reconcile: true` and `reconcileOnly` = the local ids of `products`, `categories`, `brands` and `customers` snapshotted at pull start (`snapshotLocalIds`). Local rows that existed at pull start, are absent from the cloud result and are not pending are deleted; rows created locally during the fetch are never reconciled away. So a row deleted on device A disappears on device B at its next pull. `bills`, `bill_items` and the logs are append-only history and are never reconciled. If any table failed to load, nothing is deleted.

---

## Queue Errors and Backoff

- **Classification** (`classifySyncError`): *transient* = `TypeError` whose message matches a network failure (`network request failed`, `failed to fetch`, `load failed`, `network`, `timeout`, `aborted`), message containing `Network request failed` or `JWT expired`, PostgREST codes `PGRST301` / `PGRST000` / `PGRST002`, or HTTP status 401, 408, 429, or >= 500. Everything else (including a `TypeError` that is a programming bug) is *permanent*.
- **HTTP status** is not on postgrest-js `error`, so `throwIfError(res)` rethrows it as `Error` with `{...error, status}` for every Supabase call in the flush.
- **Transient**: the item is left untouched and the flush loop stops (the remaining items would fail the same way). No attempt is consumed.
- **Permanent**: `attempts + 1`, `last_error` stored (500 chars), `next_attempt_at = now + min(30s * 2^attempts, 1h)`. The loop continues with the next item.
- **Stuck items**: at `attempts >= MAX_ATTEMPTS (5)` the item is no longer fetched. `getStuckSyncCount()` feeds a "N changes could not sync - Retry" button on Home and Settings (consent users); `retryStuckSyncItems()` resets `attempts` and `next_attempt_at` to 0 and the screen flushes.
- **Shop payload merge**: shop updates are partial, so `addToSyncQueue('shop', ...)` merges all queued shop payloads for the id (oldest first) with the new one before replacing them. A later edit no longer drops fields of an earlier unsynced one.

---

## Device Lock

`services/deviceLock.ts` holds an in-memory conflict flag plus `verifyActiveDevice()`.

- `verifyActiveDevice()` reads `shops.active_device_id, ai_consent` and returns `'conflict'` only when `ai_consent` is true and a non-null `active_device_id` differs from this device; `'ok'` otherwise; `'unknown'` on offline, error or no row. `ok`/`conflict` results are cached 60s; `unknown` is never cached. It sets the conflict flag.
- `flushSyncQueue` returns early if the flag is set, and also when `verifyActiveDevice()` is not `'ok'` (conflict **or unknown**, retried on the next trigger). Background pulls (`pullIfStale`) and `autoRestoreIfEmpty` likewise run only when the flag is clear **and** `verifyActiveDevice()` returns `'ok'`.
- `checkShopStatus` stamps an unclaimed session conditionally: `update({ active_device_id }).eq('id', shop).is('active_device_id', null)`, so it never overwrites a device that claimed the session meanwhile.
- **Logout / shop switch**: `AuthContext.logout` calls `bumpSyncGeneration()`. An in-flight flush notices the new generation (or a changed stored shop id) after its next await and returns without writing or deleting queue rows, so shop A's rows never upload under shop B's session. `flushSyncQueue` never rejects (e.g. if the DB was closed), and the AppState/NetInfo handlers also swallow errors.
- `checkShopStatus` (foreground) calls `verifyActiveDevice({ maxAgeMs: 0 })` and raises the conflict screen via `markDeviceConflict(true)` (sets the flag and UI state together). Settings "enable cloud backup" is wired to the same callback.
- The `shop` update no longer writes `active_device_id`, so editing shop details can no longer steal the session from the active device.
- **`claimSession`** (Device Conflict screen "use this device"): update `shops.active_device_id` to this device; if that errors, stay on the conflict screen. On success clear the flag, then `restoreFromCloud()` once (take the other device's final state) and then `flushSyncQueue()`.
- **Known limits**: this is still client-enforced. The previous session's JWT stays valid, so a modified or offline client can still write; a device that was offline can write until its next successful check; and a cached `'ok'` leaves a stale-ok window of up to 60s. Real enforcement needs server-side session revocation.

---

## Login and DB Open

- `autoRestoreIfEmpty()` (`authService.ts`) runs on fresh login (`AuthContext.login`) and on session recovery: if not in conflict, consent is on, local `products` is empty and `verifyActiveDevice()` returns `'ok'`, it emits restore `start`, runs `restoreFromCloud()`, then `complete` (or `error` when the result is `success: false`). It does not block login.
- The `db` proxy in `sqlite.ts` now throws `Database not opened - call openUserDatabase first` instead of silently opening a `shopai_default.db`, so no user data can land in a shared default file.
- Cloud consent defaults to off (`EditShopScreen` no longer defaults `aiConsent` to true when no shop info exists).

---

## Stock and Udhar Deltas

`products.stock_quantity` and `customers.udhar_balance` no longer sync as absolute values (last write wins). They sync as `DELTA` queue items so two devices selling offline add up.

- **Queueing** (`db.ts`): `withDelta` reads the local value before and after the write and queues `{ delta: after - before, op_id }` (rounded to 4 decimals, skipped when 0). `addToSyncQueue` gives every DELTA a random uuid-shaped `op_id`. Local clamping `MAX(0, ...)` is therefore respected. Covers sales (`insertBill` stock deduction, now synced; before only udhar was), manual stock edits, udhar payments and udhar adjustments.
- **Flush**: `DELTA` calls RPC `shopai_adjust_stock(p_product_id text, p_delta numeric, p_op_id text)` or `shopai_adjust_udhar(p_customer_id text, p_delta numeric, p_op_id text)` (migration `supabase/migrations/20261026100000_shopai_stock_udhar_deltas.sql`). Both are `SECURITY INVOKER` (RLS scopes the row to the shop), clamp the result at `greatest(0, ...)`, and are granted to `authenticated` only. A DELTA without `op_id` fails permanently.
- **Idempotency**: each RPC first inserts `p_op_id` into `public.shopai_applied_deltas (op_id text primary key, shop_id uuid default jwt_shop_id(), applied_at)` with `on conflict do nothing`, and adjusts only if that insert added a row (`FOUND`). A re-send after a lost response is therefore a no-op. The table has RLS policy `shopai_owner_access` (`jwt_app() = 'shopai'` and own `shop_id`), no anon access, and `select, insert` for `authenticated`. Rows are never pruned (no cleanup yet).
- **Dedupe / promotion** (`addToSyncQueue`): a DELTA never dedupes anything (deltas are additive). An INSERT deletes all queued entries for the row including DELTAs, because its absolute snapshot already contains them. An UPDATE that finds a queued INSERT is promoted to INSERT so the first upload keeps the absolute stock/udhar. Other UPDATE/DELETE writes keep queued DELTAs.
- **UPDATE payloads strip** `stock_quantity` (products) and `udhar_balance` (customers); absolute values travel only on INSERT.
- **Ordering**: the flush skips a DELTA while an earlier INSERT for the same row is still queued (it would hit no cloud row, then be overwritten by the older snapshot). Skipped items stay queued.
- **DEPLOY ORDER**: apply the migration to the live Supabase project BEFORE shipping the app build that queues `DELTA`; otherwise the RPC does not exist and deltas fail.
- **Testing**: the pgTAP test `supabase/tests/database/shopai_deltas.test.sql` has NOT been run (no Docker available when written). Run `supabase test db` where Docker is available.
- **Known limits**: the server-side clamp makes deltas non-commutative if a backed-off delta is overtaken by a later one (e.g. -5 then +5 on a row at 3 ends at 5, +5 then -5 ends at 3); 4-decimal rounding; old app builds still send absolute stock/udhar and can overwrite delta-managed totals.

---

## Known Limitations & Design Decisions

| Limitation | Impact | Decision |
|-----------|--------|----------|
| Last-write-wins (no conflict resolution) | Two devices editing same product simultaneously will silently overwrite | Acceptable for single-owner small shops |
| No sync status indicator in UI | User can't see if data is pending sync | `getPendingSyncCount()` is available to build a badge |
| Items stop retrying after 5 permanent failures | Change stays local until the user taps Retry | Surfaced on Home/Settings via `getStuckSyncCount()`; Retry resets them |
| Bills are immutable | Cannot edit or cancel a bill after creation | Intentional: prevents audit trail tampering |
| `suggestions_cache` never purged | Grows unbounded | Not synced; stale entries affect AI suggestions only |
| `stock_quantity` / `udhar_balance` sync as deltas | Offline sales on two devices now add up | See Stock and Udhar Deltas for limits |
| No `updated_at` on categories/brands/customers in SQLite | Cannot detect stale sync items by timestamp | Queue deduplication provides equivalent safety |


---

## Manual verification checklist

Not executed as part of the audit-fix work (needs two physical devices or emulators). Run before release.

- [ ] Log in on devices A and B with the same shop. Sell the same product on both while offline, reconnect both: each shows `start - both sales`.
- [ ] Delete a product on A: it disappears on B after B's next pull.
- [ ] Edit the shop name on A while B holds the device lock: A is blocked (conflict) and B's lock is unchanged.
- [ ] On B, tap "use this device": B restores once, flushes, and A then shows the conflict screen at its next foreground.
- [ ] Force a permanent sync failure: after 5 attempts the Retry banner shows on Home/Settings; Retry clears it once the cause is fixed.
- [ ] Fresh install and login on an account with data (including more than 1000 bills): everything restores, including pack, discount and display quantity fields.
