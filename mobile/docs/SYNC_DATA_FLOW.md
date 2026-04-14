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
| `products` | `products` | INSERT, UPDATE, DELETE | `shop_id` |
| `customers` | `customers` | INSERT, UPDATE | `shop_id` |
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
| Table name for shop | `shop` (singular) | `shops` (plural) | `syncQueue.ts:169` maps name |
| `shop_id` column | Not present (single-shop device) | Required on all tables except `bill_items` | `syncQueue.ts:108` injects from JWT |
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
insertProduct() ─── db.ts:306
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
├── operation   TEXT     -- 'INSERT' | 'UPDATE' | 'DELETE'
├── data_id     TEXT     -- primary key of the record being synced
├── payload     TEXT     -- JSON string of full record data
├── attempts    INTEGER  -- retry counter (max 5)
└── created_at  TEXT     -- when the item was enqueued
```

**Deduplication rule:** Before inserting, the queue deletes any existing entry for the same `(table_name, data_id)`. This means only the **latest** operation for a given record is ever in the queue at one time. The payload is always a **full row snapshot** (not a diff), ensuring safe upserts.

### 3. Flush Trigger → Supabase

A flush is triggered by any of:
- App comes to foreground (`AppState 'active'`) — consent users
- Network reconnects (`NetInfo isConnected = true`) — consent users
- App startup — consent users
- User taps "Sync Now" in Settings — all users (explicit action)

```
flushSyncQueue()  ─── syncQueue.ts:50
        │
        ├─ [isFlushing = true]  ← mutex prevents concurrent runs
        │
        ├─ NetInfo.fetch() → offline? return early
        │
        ├─ SELECT * FROM sync_queue WHERE attempts < 5 ORDER BY id ASC
        │
        └─ for each item:
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
                                │       supabase.from('shops').upsert({id:phone, shop_name, ...}, {onConflict:'id'})
                                │
                                └─ bills (compound):
                                        supabase.from('bills').upsert({...bill, shop_id})
                                        supabase.from('bill_items').upsert(items)
                                        supabase.from('sales_log').upsert(salesLog.map(l => ({...l, shop_id})))
```

On success: `DELETE FROM sync_queue WHERE id = ?`
On failure: `UPDATE sync_queue SET attempts = attempts + 1 WHERE id = ?`

After 5 failures, the item is no longer fetched (filtered out by `attempts < 5`).

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
NewBillScreen → insertBill(bill, items)   ─── db.ts:436
        │
        ▼
db.withTransactionSync(() => {
    INSERT INTO bills (...)                     ← 1. create bill
    for each item:
        INSERT INTO bill_items (...)            ← 2. line items
        UPDATE products SET stock_quantity - ?  ← 3. deduct stock
        INSERT INTO sales_log (...)             ← 4. sales record
    if payment_mode = 'udhar':
        UPDATE customers SET udhar_balance + ?  ← 5. credit balance
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
if payment_mode = 'udhar':
    re-read customer row from SQLite
    addToSyncQueue('customers', 'UPDATE', customerId, fullCustomerRow)
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
| Single item fails (e.g. Supabase error) | `attempts + 1`, continue flushing remaining items |
| Item fails 5 times | Filtered out of future flushes, effectively dropped |
| App crashes mid-flush | Queue items not deleted until success; retried on next startup |
| Concurrent flush calls | `isFlushing` mutex — second call returns immediately |
| Session expired mid-flush | `getShopId()` throws → item fails, attempts increment; auto-refresh may recover next flush |

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

## Known Limitations & Design Decisions

| Limitation | Impact | Decision |
|-----------|--------|----------|
| Last-write-wins (no conflict resolution) | Two devices editing same product simultaneously will silently overwrite | Acceptable for single-owner small shops |
| No sync status indicator in UI | User can't see if data is pending sync | `getPendingSyncCount()` is available to build a badge |
| Items dropped after 5 failed attempts | Persistent sync errors lose data silently | Log to console; consider user notification in future |
| Bills are immutable | Cannot edit or cancel a bill after creation | Intentional: prevents audit trail tampering |
| `suggestions_cache` never purged | Grows unbounded | Not synced; stale entries affect AI suggestions only |
| `stock_quantity` in Supabase reflects sync time | Manual stock correction needed if offline deductions diverge | Upsert with absolute value on manual stock edit |
| No `updated_at` on categories/brands/customers in SQLite | Cannot detect stale sync items by timestamp | Queue deduplication provides equivalent safety |
