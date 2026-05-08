# Pragati Bandhu — Project Reference

> **Version:** 3.0 | **Last updated:** May 2026
> **Tagline:** *"Stock khatam hone se pehle, ShopAI bata dega."*

---

## 1. What It Is

Pragati Bandhu is an offline-first Android app for small Indian retail shops. It covers the full shop lifecycle:

- **Inventory** — products, categories, brands, stock levels, low-stock alerts
- **Billing** — itemised bills, cash / udhar payment modes, PDF receipts
- **Udhar (credit)** — per-customer credit tracking, payment recording, transaction history
- **Reports** — sales, profit, top products, PDF export
- **AI Suggestions** — Claude API reorder suggestions (consent-gated, cloud users only)
- **Cloud Backup** — offline-first SQLite + sync-to-Supabase when online and consented

**Primary market:** Tier-2 / tier-3 Indian towns. Launch target: Kāliyāganj, West Bengal.

**Business types:** Medical / chemist (best fit), kirana, stationery, hardware, salon, clothing.

---

## 2. Core Architecture

### 2.1 Offline-First Design

Every user action writes to local SQLite first. The app is always responsive regardless of connectivity. Cloud sync happens in the background — never blocking the UI.

```
User action
    ↓
SQLite (local write, instant)
    ↓
sync_queue (row appended)
    ↓ (background, when online + consent)
Supabase (upsert via RLS)
```

### 2.2 Consent Gate

A single boolean `aiConsent` controls cloud behaviour. Two modes:

| Mode | `aiConsent` | What syncs | Cloud features |
|---|---|---|---|
| **Local Only** | `false` | Shop registration only | None |
| **Cloud + AI** | `true` | All data | Backup, AI suggestions, WhatsApp alerts |

Shop registration (name, phone, owner) **always syncs** regardless of consent — required for admin control and account recovery.

### 2.3 Single Active Session (Multi-Device)

Cloud users only. One device holds the active session at a time via `active_device_id` in the `shops` table.

```
Device 2 logs in
    → verifyOtp updates active_device_id in Supabase to Device 2's ID
    → Device 1 foregrounds
    → checkShopStatus detects mismatch
    → DeviceConflictScreen shown on Device 1
    → "Use on This Device" updates active_device_id back to Device 1
```

Offline users (`aiConsent = false`) are never affected — no `active_device_id` check runs.

---

## 3. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile | React Native + Expo (TypeScript) | EAS build for Android |
| Navigation | React Navigation v6 | Bottom Tabs + Stack |
| State | Zustand | `useProductStore` |
| Local DB | expo-sqlite | All transactional data |
| Local prefs | @react-native-async-storage | Consent flag, session, device ID |
| Connectivity | @react-native-community/netinfo | Sync trigger on reconnect |
| File ops | expo-file-system/legacy + expo-sharing + expo-document-picker | Backup export/import; legacy API for SDK 54 compat |
| Icons | @expo/vector-icons (Ionicons, MaterialCommunityIcons) | |
| Cloud DB | Supabase (PostgreSQL) | Free tier; RLS enforces shop isolation |
| Backend | Supabase Edge Functions (Deno) | No server — runs on Deno Deploy (India PoPs) |
| Auth | Custom OTP Edge Functions | `send-otp` + `verify-otp`; JWT signed with project secret |
| OTP delivery | Fast2SMS | ₹0.25–0.50/OTP; dev bypass available via Supabase Dashboard |
| AI | Anthropic Claude API | Reorder suggestions, consent-gated |
| WhatsApp | WATI (shared account) | Planned — not yet live |
| PDF | expo-print + expo-sharing | Bills and reports |

---

## 4. Database Schema

### 4.1 Supabase (Cloud)

> IDs are `TEXT` generated on-device: `Date.now().toString(36) + random`. Allows offline row creation without a server round-trip.

```sql
-- Always synced (regardless of consent)
CREATE TABLE shops (
  id                TEXT PRIMARY KEY,       -- 10-digit phone number
  shop_name         TEXT NOT NULL,
  owner_name        TEXT NOT NULL,
  phone             TEXT UNIQUE NOT NULL,
  whatsapp_number   TEXT,
  business_category TEXT,
  ai_consent        BOOLEAN DEFAULT FALSE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,  -- admin kill switch
  active_device_id  TEXT,                           -- single-session enforcement
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Synced only when aiConsent = true
CREATE TABLE categories (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL, icon TEXT, icon_color TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE brands (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL, color TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL, category_id TEXT, brand_id TEXT,
  purchase_price NUMERIC DEFAULT 0, selling_price NUMERIC DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0, min_stock_threshold INTEGER DEFAULT 5,
  uom TEXT DEFAULT 'Pcs',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE customers (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL, phone TEXT, address TEXT,
  udhar_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bills (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
  customer_id TEXT, customer_name TEXT,
  payment_mode TEXT DEFAULT 'cash',
  total_amount NUMERIC NOT NULL, total_items INTEGER NOT NULL,
  bill_date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE bill_items (
  id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES bills(id),
  product_id TEXT NOT NULL, product_name TEXT NOT NULL,
  qty INTEGER NOT NULL, unit_price NUMERIC NOT NULL, line_total NUMERIC NOT NULL
);

CREATE TABLE sales_log (
  id TEXT PRIMARY KEY, shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT NOT NULL, product_name TEXT NOT NULL,
  qty_sold INTEGER NOT NULL, sale_amount NUMERIC NOT NULL,
  sold_date DATE DEFAULT CURRENT_DATE
);

-- Login activity (v3.0)
CREATE TABLE login_events (
  id           BIGSERIAL PRIMARY KEY,
  shop_id      TEXT NOT NULL,
  device_id    TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);

-- Future: AI suggestion log (commented out — not yet built)
-- CREATE TABLE suggestions_log ( ... );
```

**RLS policy pattern** (all tables):
```sql
-- shop_id = right(auth.jwt() ->> 'phone', 10)
-- Strips +91 from E.164 phone to match 10-digit shop ID
```

**Applied migrations:**
| Migration | What |
|---|---|
| `001_rls_policies.sql` | RLS on all 8 tables |
| `otp_tokens` migration | OTP storage + `get_user_id_by_phone()` SQL helper |
| `add_active_device_id_to_shops` | `active_device_id TEXT` column |
| `create_login_events` | `login_events` table + RLS |

### 4.2 SQLite (On-Device)

Mirrors all cloud tables. Additional local-only tables:

```sql
CREATE TABLE shop (
  id TEXT PRIMARY KEY, shop_name TEXT, owner_name TEXT, phone TEXT,
  whatsapp_number TEXT, business_category TEXT,
  ai_consent INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,    -- mirrors Supabase; checked on foreground
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  data_id TEXT NOT NULL,
  operation TEXT NOT NULL,        -- INSERT | UPDATE | DELETE
  payload TEXT,                   -- full row JSON
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE suggestions_cache ( ... );  -- AI suggestions local cache
```

> `device_id` lives in AsyncStorage only, not SQLite — it is device-local metadata, not shop data.

---

## 5. Auth Flow

```
LoginScreen → phone input (10-digit)
    ↓ sendOtp()
send-otp Edge Function
    → generates 6-digit OTP
    → stores plain + SHA-256 hash + expiry in otp_tokens table
    → calls Fast2SMS (bypassed in dev — OTP readable from Supabase Dashboard)
    ↓
OtpScreen → 6-box input, 30s resend timer
    ↓ verifyOtp()
verify-otp Edge Function
    → validates OTP hash, checks expiry
    → creates/gets auth.users record via Admin API
    → signs 30-day HS256 JWT (JWT_SECRET env var)
    → returns { access_token, refresh_token }
    ↓
supabase.auth.setSession() → session persisted in AsyncStorage
    ↓ (fire-and-forget, parallel)
shops UPDATE active_device_id = thisDeviceId
login_events INSERT { shop_id, device_id }
    ↓
getStoredAuth()
    → if returning user: read shop from Supabase, restore to SQLite
    → if aiConsent + empty local DB: restoreFromCloud() in background
    ↓
RootNavigator guard (5-way)
```

**RootNavigator guard order:**
```
!isAuthenticated       → AuthNavigator (Login + OTP)
!isShopSetup           → ShopSetupScreen
!isShopActive          → ShopDeactivatedScreen  (admin kill switch)
isDeviceConflict       → DeviceConflictScreen   (session claimed elsewhere)
else                   → MainTabs (full app)
```

---

## 6. Sync Architecture

### 6.1 Sync Queue

Every write goes through `addToSyncQueue()` in `db.ts`. The queue stores the full row payload (not a delta). On flush, each item is upserted via `supabase.from(table).upsert(payload, { onConflict: 'id' })`.

**Deduplication:** Before inserting, any existing entry for the same `(table_name, data_id)` is deleted — so only the latest state of a row ever waits in queue.

**Retry limit:** 5 attempts per item. Exhausted items stay in queue but are skipped on flush.

**Bills:** Compound payload `{ bill, items, salesLog }` — upserts across 3 tables sequentially.

### 6.2 Flush Triggers

| Trigger | Condition |
|---|---|
| App foreground (`AppState 'active'`) | All users — deactivation check; consent users — flush queue |
| Network reconnect (NetInfo) | Consent users only |
| Startup | Consent users — flush immediately after `startSyncService()` |
| `flushSyncQueue()` direct call | After shop edits (`EditShopScreen`), after cloud backup enable |

**Mutex:** `isFlushing` boolean prevents concurrent flushes from NetInfo + AppState firing simultaneously.

### 6.3 Shop Sync Special Cases

- `active_device_id` is always stamped in the shop upsert payload (from `getOrCreateDeviceId()`)
- `is_active` is **never** written from mobile — admin-only column
- `shops` row syncs even when `aiConsent = false`

### 6.4 Restore Flow (Cloud → SQLite)

`restoreFromCloud()` in `restoreService.ts`:
1. Fetches all 8 tables in parallel, scoped by RLS
2. `bill_items` chunked at 100 IDs per request (PostgREST IN-clause limit)
3. `bill_date` normalised from TIMESTAMPTZ → plain ISO 8601 UTC before SQLite write
4. `importFromJson()` uses `INSERT OR REPLACE` in a single transaction — idempotent, safe on non-empty DB

---

## 7. Edge Functions

| Function | Purpose | Auth required |
|---|---|---|
| `send-otp` | Generates OTP, stores hash in `otp_tokens`, calls Fast2SMS | No (`verify_jwt: false`) |
| `verify-otp` | Validates OTP, creates/gets user, returns signed JWT | No |
| `send-sms` | Legacy Fast2SMS hook — kept, not used | — |
| `ai-suggestions` | Claude API reorder suggestions | Planned — not built |

---

## 8. Screens Inventory

### Auth Screens

| Screen | File | Purpose |
|---|---|---|
| Login | `auth/LoginScreen.tsx` | Phone input, OTP request |
| OTP Verification | `auth/OtpScreen.tsx` | 6-box input, 30s resend timer |
| Shop Setup | `auth/ShopSetupScreen.tsx` | Shop name, owner, category, WhatsApp, consent choice |
| Shop Deactivated | `auth/ShopDeactivatedScreen.tsx` | Blocking; admin kill switch; logout only |
| Device Conflict | `auth/DeviceConflictScreen.tsx` | Blocking; session claimed by another device; "Use on This Device" |

### Main Tabs (Bottom Navigator)

| Tab | Screen | File |
|---|---|---|
| Home | Dashboard | `home/HomeScreen.tsx` |
| Inventory | Products | `products/ProductsScreen.tsx` |
| Customers | Customers | `customers/CustomersScreen.tsx` |
| Reports | Business Reports | `reports/ReportsScreen.tsx` |
| Settings | Settings | `settings/SettingsScreen.tsx` |

### Stack Screens

| Screen | File | Reached From |
|---|---|---|
| New Bill | `billing/NewBillScreen.tsx` | Home → "Create New Bill" |
| Bills (All Transactions) | `billing/BillsScreen.tsx` | Reports → "View All" |
| Bill Detail | `billing/BillDetailScreen.tsx` | BillsScreen row / Reports recent row |
| Add Product | `products/AddProductScreen.tsx` | Inventory FAB |
| Edit Product | `products/EditProductScreen.tsx` | Product card pencil icon |
| Add Customer | `customers/AddCustomerScreen.tsx` | Customers FAB |
| Edit Customer | `customers/EditCustomerScreen.tsx` | Customer row tap |
| Edit Shop | `settings/EditShopScreen.tsx` | Settings → Edit Profile |
| Manage Categories | `settings/ManageCategoriesScreen.tsx` | Settings |
| Add Category | `settings/AddCategoryScreen.tsx` | Manage Categories FAB |
| Manage Brands | `settings/ManageBrandsScreen.tsx` | Settings |
| Add Brand | `settings/AddBrandScreen.tsx` | Manage Brands FAB |
| Help Center | `settings/HelpCenterScreen.tsx` | Settings |
| Privacy Policy | `settings/PrivacyPolicyScreen.tsx` | Settings |
| Terms of Service | `settings/TermsOfServiceScreen.tsx` | Settings |
| App Features | `settings/AppFeaturesScreen.tsx` | Settings |
| Notifications | `notifications/NotificationsScreen.tsx` | Header bell icon |

---

## 9. Key Feature Details

### 9.1 Billing

- Product search + add to bill; quantity +/- controls
- Payment mode: Cash or Udhar (credit)
- Udhar bills auto-update `customers.udhar_balance` in SQLite + queue sync
- **Estimate mode:** Full-screen receipt preview without saving
- **Checkout:** Atomic `withTransactionSync` — inserts bill + items, deducts stock, updates udhar balance in one SQLite transaction
- `sales_log` row written per product per bill (AI suggestion input)
- PDF receipt generation + share via OS share sheet (`expo-print` + `expo-sharing`)

### 9.2 Customer & Udhar

- Customer list with avatar initials, phone, last transaction, udhar balance
- **Edit Customer screen:** udhar balance card (red when owed, green when cleared)
- **Record Payment:** amount input + quick chips (₹100/200/500/1000 + "Full ₹X"); clamps at ₹0 via `MAX(0, udhar_balance - ?)` SQL
- Bill History: last 10 bills per customer, each tapping to BillDetail

### 9.3 Reports

- Time range: Today / This Week / This Month
- Net Profit: real SQL join `SUM(qty × (unit_price − purchase_price))` across bill_items → products
- Top 5 products by quantity + revenue
- Last 10 transactions (tappable → BillDetail)
- PDF report: full HTML report with shop header, stats, top products, recent transactions

### 9.4 Dashboard (HomeScreen)

- Today's sales (₹ value + trend %)
- Low stock attention card → `getLowStockProducts()` (`stock < min_threshold` on device)
- AI consent gate:
  - `aiConsent = true` → "AI Reorder Insights" with sparkle icon
  - `aiConsent = false` → "Low Stock Alerts" with amber warning icon + upgrade nudge
- Recent bills feed (last 5)

### 9.5 Data Backup & Recovery

| Action | Who | What |
|---|---|---|
| Export Backup (.json) | All users | Full SQLite → JSON; privacy warning before share |
| Import from Backup | All users | JSON → SQLite via `INSERT OR REPLACE`; cross-shop phone check |
| Restore from Cloud | Cloud users | Supabase → SQLite; chunked bill_items; bill_date normalised |
| Enable Cloud Backup | Offline users | Sets consent → queues all local data → starts sync |
| Delete All Data | All users | Offline: wipe + logout. Cloud: choice of local-only or full cloud wipe |
| Auto-restore on reinstall | Cloud users | Fires non-blocking after fresh install with valid session + empty SQLite |

### 9.6 Admin Controls

| Control | Mechanism |
|---|---|
| Deactivate shop | Set `is_active = false` in Supabase Dashboard → `ShopDeactivatedScreen` shown on next foreground |
| View login history | Query `login_events` in Supabase Dashboard |
| Reset active device | Set `active_device_id = NULL` in Supabase Dashboard → both devices get conflict screen |

---

## 10. File Structure

```
Pragati_Bandhu/
├── ShopAI_Project_Scope_v2.1.md     # Full project scope + changelog
├── PRAGATI_BANDHU_REFERENCE.md      # This file
├── supabase/
│   ├── functions/
│   │   ├── send-otp/                # OTP generation + Fast2SMS
│   │   ├── verify-otp/              # OTP validation + JWT signing
│   │   └── send-sms/                # Legacy hook (unused)
│   └── migrations/
│       ├── 001_rls_policies.sql
│       └── (applied via MCP tool — see scope doc §14.3)
├── backend/                         # Legacy Express — not deployed, kept for reference
└── mobile/
    ├── app.json
    ├── App.tsx
    └── src/
        ├── lib/
        │   └── supabase.ts          # Supabase client singleton (AsyncStorage session)
        ├── context/
        │   └── AuthContext.tsx      # isAuthenticated, isShopSetup, isShopActive,
        │                            # isDeviceConflict, isAutoRestoring, claimSession()
        ├── navigation/
        │   ├── RootNavigator.tsx    # 5-way guard
        │   ├── AuthNavigator.tsx
        │   └── BottomTabNavigator.tsx
        ├── screens/
        │   ├── auth/                # LoginScreen, OtpScreen, ShopSetupScreen,
        │   │                        # ShopDeactivatedScreen, DeviceConflictScreen
        │   ├── home/                # HomeScreen
        │   ├── products/            # ProductsScreen, AddProductScreen, EditProductScreen
        │   ├── billing/             # NewBillScreen, BillsScreen, BillDetailScreen
        │   ├── customers/           # CustomersScreen, AddCustomerScreen, EditCustomerScreen
        │   ├── reports/             # ReportsScreen
        │   ├── settings/            # SettingsScreen, EditShopScreen, ManageCategoriesScreen,
        │   │                        # AddCategoryScreen, ManageBrandsScreen, AddBrandScreen,
        │   │                        # EditShopScreen, HelpCenterScreen, PrivacyPolicyScreen,
        │   │                        # TermsOfServiceScreen, AppFeaturesScreen
        │   └── notifications/       # NotificationsScreen
        ├── db/
        │   ├── sqlite.ts            # DB init + schema DDL
        │   ├── db.ts                # All SQL helpers (CRUD + sync queue calls)
        │   ├── syncQueue.ts         # addToSyncQueue(), flushSyncQueue(), getPendingSyncCount()
        │   └── backup.ts            # exportAsJson(), importFromJson(), clearAllLocalData()
        ├── services/
        │   ├── authService.ts       # sendOtp(), verifyOtp(), getStoredAuth(), logout()
        │   ├── syncService.ts       # startSyncService(), stopSyncService(), checkShopStatus()
        │   └── restoreService.ts    # restoreFromCloud(), deleteFromCloud()
        ├── components/
        │   ├── common/              # ScreenHeader, PrimaryButton, TextInputField
        │   ├── products/            # ProductCard, UpdateStockModal, UpdateCategoryModal
        │   └── home/                # SummaryCard
        ├── store/
        │   └── useProductStore.ts   # Zustand product store
        ├── theme/
        │   ├── colors.ts
        │   ├── spacing.ts
        │   └── typography.ts
        └── utils/
            ├── storage.ts           # AsyncStorage helpers + getOrCreateDeviceId()
            ├── restoreEvents.ts     # Event emitter for auto-restore lifecycle
            └── dateUtils.ts
```

---

## 11. What's Built vs Pending

### Built ✅

| Area | Detail |
|---|---|
| Auth | OTP login, JWT session, auto-restore on reinstall |
| Products | Full CRUD, category/brand chips, stock threshold, bulk ops |
| Categories | CRUD with icon + colour picker |
| Brands | CRUD |
| Billing | New bill, estimate mode, PDF receipt, bill history, bill detail |
| Customers | CRUD, udhar tracking, payment recording, transaction history |
| Reports | Sales, profit, top products, PDF export |
| Dashboard | Live stats, low-stock card, AI consent gate |
| Settings | Edit profile, manage categories/brands, data backup section |
| Data Backup | Export JSON, import JSON, restore from cloud, enable cloud, delete all |
| Cloud Sync | Sync queue, flush on foreground/reconnect, 5-retry logic |
| Admin Controls | `is_active` kill switch, device session management |
| Multi-device | Single active session, DeviceConflictScreen, claim session |
| Login Tracking | `login_events` table, fire-and-forget insert on every login |
| Offline Support | Full offline operation; sync queue drains when online |
| PDF | Bill receipts + full business reports |

### Pending 🔲

| Feature | Notes |
|---|---|
| AI Suggestions Edge Function | `supabase/functions/ai-suggestions/` — not built |
| AI Suggestions screen | Dashboard shows teaser card only |
| pg_cron for daily suggestions | Supabase scheduler |
| WATI WhatsApp alerts | Low stock + udhar reminders |
| Barcode scanner | UI placeholder in billing — needs camera |
| Alert Settings screen | WhatsApp number, alert prefs |
| Admin panel | Currently done via Supabase Dashboard directly |
| C2 fix: batched upsert | `queueAllLocalData` is O(n) API calls — slow for large shops |

---

## 12. Pricing

| Plan | Price | What's included |
|---|---|---|
| Basic | ₹299/month | Local only — inventory, billing, udhar, local low-stock detection |
| Standard | ₹499/month | Everything + cloud backup, AI suggestions, WhatsApp alerts |
| Setup fee | ₹500–1,000 | One-time on-site setup |
| Early adopter | ₹2,000 one-time | Lifetime free — first 10 shops |

**Infrastructure cost at scale:**

| Shops | WATI | Claude API | Hosting | Total | Per shop |
|---|---|---|---|---|---|
| 10 | ₹1,500 | ₹400 | ₹0 | ₹1,900 | ₹190 |
| 25 | ₹1,500 | ₹1,000 | ₹0 | ₹2,500 | ₹100 |
| 50 | ₹3,000 | ₹2,000 | ₹0 | ₹5,000 | ₹100 |

Hosting is ₹0 — Supabase free tier handles Edge Functions + DB up to ~500K calls/month.

---

## 13. Key Design Decisions & Constraints

| Decision | Reason |
|---|---|
| Expo Go compatible (no native modules) | Faster dev cycle; MMKV dropped for AsyncStorage |
| `expo-file-system/legacy` API | SDK 54 compatibility |
| TEXT IDs (not UUID) | Generated on-device; enables offline row creation |
| 30-day JWT, `autoRefreshToken: false` | Custom JWT — no GoTrue refresh endpoint |
| Single `aiConsent` flag for all cloud features | Simplicity; one consent covers backup + AI + alerts |
| Full row re-read before sync queue | Prevents partial-payload corruption on upsert |
| Upsert (not insert) everywhere | Safe on retry; idempotent sync |
| `active_device_id` not in SQLite | Device-local metadata, not shop data; excluded from backups |
| `login_events` fire-and-forget | Non-blocking; login flow unaffected if insert fails |
| OTP via Edge Function (not Supabase Phone Auth) | Supabase Phone Auth hook blocked by `api.supabase.com` network restriction |
| `right(auth.jwt() ->> 'phone', 10)` in RLS | Strips +91 from E.164 to match 10-digit shop_id |
