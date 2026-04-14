# ShopAI (Pragati Bandhu) — Shop Management with AI Reorder Suggestions
### Project Scope Document v2.3 | April 2026

---

## 1. Project Overview

**Pragati Bandhu** (formerly ShopAI) is a mobile application built for small Indian retail shops that helps owners manage their entire shop — inventory tracking, billing & invoicing, customer credit (udhar) management, business reports, and AI-powered reorder suggestions — all via a simple Android app and WhatsApp alerts.

The core problem it solves: small shop owners in tier-2 and tier-3 Indian towns lose money every day because they run out of stock unexpectedly, over-order and waste capital, lose track of customer credit (udhar), and lack visibility into their business performance. No affordable, simple tool exists for them today.

> **Tagline:** *"Stock khatam hone se pehle, ShopAI bata dega."*
> (Before stock runs out, ShopAI will tell you.)

---

## 2. Target Users

| Business Type | Fit | Reason |
|---|---|---|
| Medical / chemist store | Best | Medicines expire, 100s of SKUs, high stakes |
| Kirana / grocery shop | Best | Daily sales, many products, low tech adoption |
| Stationery / book shop | Best | Seasonal demand spikes |
| Hardware store | Good | Many variants, manual tracking painful |
| Salon / beauty shop | Good | Predictable product usage per service |
| Clothing / textile shop | Good | Size + colour variant tracking |
| Restaurant / dhaba | Niche | Daily ingredient stock, habit harder to build |
| Coaching center | Niche | Books + stationery, smaller scale |

**Primary geographic target:** Tier-2 and tier-3 towns in West Bengal and North India — starting with Kāliyāganj and surrounding district.

---

## 3. The Problem

- Shop owners manually track stock in notebooks or memory
- They run out of fast-moving items and lose sales
- They over-order slow-moving items and tie up cash
- They lose track of customer udhar (credit) and outstanding payments
- They have no visibility into sales trends, profit margins, or top-selling products
- No affordable tool exists — existing solutions cost ₹2,000–10,000/month, far beyond reach
- Shop owners are comfortable with WhatsApp but not with complex software

---

## 4. The Solution

A simple Android app where the shopkeeper:
1. Adds products with pricing, categories, and brands
2. Creates bills for customers with cash/udhar payment modes
3. Tracks customer credit (udhar) balances
4. Gets WhatsApp alerts when stock drops low
5. Views business reports with sales breakdown and top products
6. Gets AI-generated reorder suggestions based on sales history

Everything runs on shared infrastructure — one backend serving multiple shops — keeping costs as low as ₹110–340 per shop per month at scale.

---

## 5. Core Features — v1 Scope

### 5.1 Product & Inventory Management
- Add new products (name, category, brand, unit of measurement, opening stock)
- Set purchase price and selling price per product
- Update stock quantity after deliveries arrive (individual or bulk)
- Set minimum stock threshold per product
- View full product list with current stock levels and stock status indicators
- Filter products by category using horizontal chip selector
- Search products by name or category
- Bulk select products for batch operations (stock update, category change, delete)
- Manage product categories (add, edit, delete) with custom icons and colours
- Manage product brands (add, edit, delete) with logo support

### 5.2 Billing & Invoicing
- Create bills for walk-in or registered customers
- Search products or scan barcode to add items to bill
- Adjust item quantities with +/- controls
- View per-item price, unit, and line totals
- Payment mode selection: Cash or Udhar (Credit)
- Customer details section showing name, phone, and current udhar balance
- "Update Master Price" option per item during billing
- Product offer/discount badges on bill items
- Add quick items directly from bill screen
- Estimate mode (preview without finalising)
- Save & Checkout to finalise the bill
- Grand total and total items summary in sticky footer
- Share PDF receipt with customers via WhatsApp/Email (v2.7)

### 5.3 Customer & Udhar (Credit) Management
- Customer list with avatar initials, phone numbers, and last transaction time
- Total outstanding udhar summary card with trend indicator
- Search customers by name or phone number
- Sort and filter customer list
- Add new customers with: name, phone, initial udhar balance, address
- View individual customer udhar balance
- Link customers to bills for automatic udhar tracking

### 5.4 AI Reorder Suggestions (Claude API)
- Triggered once daily via cron job (batched across all shops) or on-demand by owner
- Sends anonymised last 14-day sales patterns to Claude API — no product names or shop identity included
- Claude returns: urgency level, days of stock left, suggested reorder quantity, short reason
- Displayed as an inline insights card on the dashboard with urgency badge
- Dedicated AI Suggestions screen planned (currently teaser card only on dashboard)
- Only triggered when user has given data sharing consent
- Suggestions batched to keep API costs minimal (~₹15–40/month per shop)

### 5.5 Business Reports & Analytics
- Time range selector: Today, This Week, This Month
- Total Sales and Net Profit summary stats
- Detailed breakdown by payment type: Cash Sales, UPI Sales, Pending Udhar, Expenses
- Top Selling Products ranking with quantities and revenue
- Download PDF Report export

### 5.6 Low Stock Alerts — WhatsApp
- Low stock detection runs locally on device — works even without internet
- WhatsApp/SMS alerts sent via cloud only when consent is given and internet is available
- Sent via shared WATI account (cost split across all shops)
- SMS fallback via Fast2SMS for shops without WhatsApp
- Owner sets alert timing: instant or daily morning digest
- Alert settings screen planned (not yet built)

### 5.7 Offline Support & Data Sync

ShopAI is designed to work fully offline and sync when internet is available. This is critical for shop owners in areas with unreliable connectivity.

#### Local storage (on device)
- `expo-sqlite` stores all transactional data: products, sales_log, suggestions_cache, sync_queue
- `@react-native-async-storage/async-storage` stores key-value flags: consent setting, auth token, plan type *(Note: originally planned as `react-native-mmkv` but replaced — MMKV v4.3+ requires a native build and is incompatible with Expo Go)*
- All user actions write to SQLite first — the app is always responsive regardless of connectivity

#### Sync queue mechanism
Every write appends a row to a local `sync_queue` table with fields: table name, row ID, operation (insert/update/delete), payload (JSON), and synced status. When internet is available and consent is given, a background processor flushes all unsynced rows as a batch POST to the backend, then marks them as synced.

#### Sync flow
1. User action → write to SQLite + append to sync_queue
2. NetInfo check: if offline, queue stays; retry automatically when online
3. Privacy gate check: if `consent = false`, queue stays local — no cloud sync, no Claude, no WATI
4. If online + consent = true: flush sync_queue → **direct Supabase client** (no backend middleman) — RLS enforces shop isolation
5. Daily cron job (pg_cron or Edge Function schedule) then triggers Claude API for that shop's suggestions

### 5.8 Privacy & Data Consent

ShopAI gives shop owners full control over their data. This is presented clearly during onboarding, not buried in a legal wall.

#### Consent flag
A single boolean (`aiConsent`) stored in AsyncStorage controls two behaviours: whether the sync queue flushes operational data to cloud, and whether Claude API is called for AI suggestions. **Shop registration always syncs regardless of consent** — needed for admin visibility and account recovery. WATI alerts (future) will also require consent since they depend on customer data being in the cloud.

#### What works without consent (local-only mode)
- Full stock tracking, product, category, and brand management
- Billing and invoicing
- Customer and udhar management
- Business reports (local data only)
- Local low-stock detection (`stock < threshold` computed on device)
- Suggestions cache from last sync (if they previously consented)
- **Shop registration always syncs** (name, owner, phone) — needed for account recovery and admin visibility regardless of consent choice

#### What requires consent (`aiConsent = true`)

- Cloud backup of products, categories, brands, customers, bills, and sales history
- AI reorder suggestions (Claude API)
- WhatsApp and SMS alerts (require customer data in cloud)

#### Onboarding consent screen

Presented during shop setup as two clear radio-card options:

- **"Cloud Backup + AI Features"** — Products, sales & customers backed up online. AI reorder suggestions included. (Recommended)
- **"This Phone Only"** — All data stays on this device. No cloud backup, no AI features.

Privacy info box: *"Your privacy is important. We never share your shop's location or name with third parties."*

Users who decline can still use the Basic plan (₹299/month) for local-only tracking. The consent screen maps naturally to the plan selection step.

#### Data sent to Claude API (anonymised)
When consent is given, only statistical patterns are sent — never product names, shop names, or location:

```js
{ avg_daily_sales: 10.2, current_stock: 8, min_threshold: 10, trend: "declining", days_left: 0 }
```

---

## 6. App Screens — v1

### 6.1 Auth Flow
| Screen | Purpose |
|---|---|
| Login | Phone number entry (+91), OTP-based authentication, Bengali/English tagline, feature highlights (Works Offline, Easy Billing, Track Udhar) |
| OTP Verification | 6-digit OTP input with auto-submit, resend timer |
| Shop Setup | Shop name, owner name, business category, WhatsApp number, AI consent selection (radio cards) |

### 6.2 Main Tab Screens (Bottom Tab Navigator — floating pill style)
| Tab | Screen | Purpose |
|---|---|---|
| Home | Dashboard | Today's total sales (₹ value + trend %), low stock attention card with restock action, quick actions (Create New Bill, Inventory, Customers), inline AI Reorder Insights card, recent activity feed (bills, stock updates) |
| Inventory | Products | Product list with stock status indicators, category filter chips, search, bulk select with multi-action overlay (Stock / Category / Delete), FAB to add product |
| Customers | Customers | Customer list with initials, phone, last transaction, total outstanding udhar summary card with trend, search, sort/filter, FAB to add customer |
| Reports | Business Reports | Time range selector, total sales & net profit, breakdown by payment type, top selling products, PDF export |
| Settings | Settings | User profile with "Edit Profile" → EditShopScreen, language selector, dark mode toggle, notification settings, business info (shop name, category, WhatsApp, cloud backup status badge), manage categories, manage brands, help center, privacy policy, terms of service, app version, logout |

### 6.3 Stack Screens (navigated from tabs)
| Screen | Reached From | Purpose |
|---|---|---|
| New Bill | Home → "Create New Bill" | Full billing flow: product search + barcode scan, customer details, payment mode (Cash/Udhar), item list with quantity controls, offer badges, estimate/checkout |
| Add Product | Inventory → FAB | Product form: name, category chips, brand chips, purchase price, selling price, initial stock, UOM chips, stock alert info |
| Add Customer | Customers → FAB | Customer form: name, phone, initial udhar balance, address |
| Manage Categories | Settings | Category list with icons, product counts, edit/delete per category, search, FAB to add |
| Add Category | Manage Categories → FAB | New category with name, icon, and colour theme |
| Manage Brands | Settings | Brand list with logos, product counts, edit/delete, search, FAB to add |
| Add Brand | Manage Brands → FAB | New brand entry |
| Bills (All Transactions) | Reports → "View All Transactions" | Full paginated bill list with search by customer name and filter chips (All / Cash / Udhar); shows running total of filtered bills |
| Bill Detail | Bills list row or Reports recent transaction row | Receipt-style view: payment mode badge, total, date/time, customer, itemised list, grand total. Includes **PDF share option** (v2.7). |
| Edit Shop | Settings → "Edit Profile" | Edit shop name, owner name, category, WhatsApp number, and AI consent; confirmation alerts on consent change; saves to AsyncStorage + SQLite + immediately flushes to backend |
| Shop Deactivated | Auto (admin control) | Blocking screen shown when `is_active = false`; prevents app access; shows support contact and logout button |

---

## 7. Folder Structure

Monorepo with three top-level directories. `backend/` is kept for reference but no longer deployed. `supabase/` contains Edge Functions and DB migrations deployed to Supabase. The `mobile/` directory builds via Expo EAS.

```
shopai/
├── backend/                 # Legacy Express — kept for reference, not deployed
│   ├── src/
│   │   ├── config/          # supabase.js, claude.js
│   │   ├── routes/          # products, sales, suggestions, alerts
│   │   ├── middleware/      # auth.js (JWT), errorHandler.js
│   │   └── jobs/            # dailySuggestions.js (cron, not yet built)
│   └── railway.toml
├── supabase/                # Supabase Edge Functions + DB migrations
│   ├── functions/
│   │   ├── send-sms/        # Legacy Fast2SMS hook (kept, not used)
│   │   ├── send-otp/        # Custom OTP sender — generates OTP, stores in otp_tokens, calls Fast2SMS
│   │   ├── verify-otp/      # Custom OTP verifier — validates, creates user, returns signed JWT
│   │   └── ai-suggestions/  # Claude API reorder suggestions (future)
│   └── migrations/
│       ├── 001_rls_policies.sql
│       └── otp_tokens + get_user_id_by_phone helper
├── MIGRATION.md             # Migration guide: Express → Supabase-only
└── mobile/
    ├── src/
    │   ├── api/             # client.js — commented out (legacy axios client)
    │   ├── lib/             # supabase.ts — Supabase client singleton
    │   ├── screens/
    │   │   ├── auth/        # LoginScreen, OtpScreen, ShopSetupScreen, ShopDeactivatedScreen
    │   │   ├── home/        # HomeScreen (Dashboard)
    │   │   ├── products/    # ProductsScreen, AddProductScreen
    │   │   ├── billing/     # NewBillScreen, BillsScreen, BillDetailScreen
    │   │   ├── customers/   # CustomersScreen, AddCustomerScreen
    │   │   ├── reports/     # ReportsScreen
    │   │   └── settings/    # SettingsScreen, EditShopScreen, ManageCategoriesScreen, AddCategoryScreen, ManageBrandsScreen, AddBrandScreen
    │   ├── components/
    │   │   ├── common/      # ScreenHeader, PrimaryButton, TextInputField
    │   │   ├── products/    # ProductCard, UpdateStockModal, UpdateCategoryModal
    │   │   └── home/        # SummaryCard
    │   ├── store/           # Zustand: useProductStore
    │   ├── db/              # SQLite schema setup, sync queue processor, backup engine
    │   ├── navigation/      # RootNavigator, AuthNavigator, BottomTabNavigator
    │   ├── services/        # authService, syncService, restoreService
    │   ├── theme/           # colors, spacing, typography
    │   └── utils/           # storage (AsyncStorage helpers), restoreEvents (event emitter)
    └── App.tsx
```

---

## 8. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile app | React Native + Expo (TypeScript) | Cross-platform, developer's strength |
| Navigation | React Navigation v6 (Bottom Tabs + Stack) | Industry standard |
| State management | Zustand | Lightweight, simple |
| Local DB | expo-sqlite | Offline-first storage, sync queue |
| Local prefs | @react-native-async-storage/async-storage | Key-value: consent flag, auth token *(MMKV replaced — incompatible with Expo Go)* |
| Connectivity | @react-native-community/netinfo | Online/offline detection for sync |
| File backup | expo-file-system/legacy + expo-sharing + expo-document-picker | JSON export/import for offline backup; legacy API used for SDK 54 compatibility |
| Icons | @expo/vector-icons (Ionicons, MaterialCommunityIcons) | Rich icon set |
| Backend | Supabase Edge Functions (Deno) | Replaces Express — no server to host or pay for |
| Database | Supabase (PostgreSQL) | Free tier, auth built-in, realtime |
| Auth | Custom OTP Edge Functions (`send-otp` + `verify-otp`) | Bypasses Supabase Phone Auth hook (network restriction); OTP stored in `otp_tokens` table; JWT signed with project secret and set via `supabase.auth.setSession()` |
| AI engine | Anthropic Claude API | Reorder suggestions via Edge Function (consent-gated) |
| WhatsApp alerts | WATI (shared account) | Cost split across shops |
| SMS OTP | Fast2SMS | ₹0.25–0.50 per OTP; called directly from `send-otp` Edge Function (Fast2SMS bypass active during dev — OTP readable from `otp_tokens` table in Supabase Dashboard) |
| Hosting | Supabase (free tier) | No Railway — Edge Functions run on Deno Deploy (India PoPs) |

---

## 9. Database Schema

### 9.1 Supabase (cloud)

> **Note:** IDs are `TEXT` (not uuid) — generated on mobile via `genId()` (timestamp + random base36). This allows offline-first row creation without a round-trip to the server.

```sql
-- Shops (always synced — required for admin visibility and account recovery)
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT UNIQUE NOT NULL,
  whatsapp_number TEXT,
  business_category TEXT,
  ai_consent BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- admin-controlled; false = blocks app access
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categories (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  icon TEXT,
  icon_color TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brands (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  color TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  category_id TEXT,
  brand_id TEXT,
  purchase_price NUMERIC DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_threshold INTEGER DEFAULT 5,
  uom TEXT DEFAULT 'Pcs',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Customers (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  udhar_balance NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  customer_id TEXT,
  customer_name TEXT,
  payment_mode TEXT DEFAULT 'cash',
  total_amount NUMERIC NOT NULL,
  total_items INTEGER NOT NULL,
  bill_date TIMESTAMPTZ DEFAULT NOW()
);

-- Bill items (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS bill_items (
  id TEXT PRIMARY KEY,
  bill_id TEXT NOT NULL REFERENCES bills(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL
);

-- Daily sales log — input for Claude AI suggestions (synced only if aiConsent = true)
CREATE TABLE IF NOT EXISTS sales_log (
  id TEXT PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  qty_sold INTEGER NOT NULL,
  sale_amount NUMERIC NOT NULL,
  sold_date DATE DEFAULT CURRENT_DATE
);

-- AI suggestion log (future — populated by dailySuggestions cron job)
-- CREATE TABLE IF NOT EXISTS suggestions_log (
--   id TEXT PRIMARY KEY,
--   shop_id TEXT NOT NULL REFERENCES shops(id),
--   product_id TEXT NOT NULL,
--   urgency TEXT,
--   days_left INTEGER,
--   suggested_qty INTEGER,
--   reason TEXT,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );
```

### 9.2 SQLite (local, on device)

```sql
-- Mirror of cloud tables (same structure as Supabase)
CREATE TABLE IF NOT EXISTS products ( ...same columns... );
CREATE TABLE IF NOT EXISTS categories ( ...same columns... );
CREATE TABLE IF NOT EXISTS brands ( ...same columns... );
CREATE TABLE IF NOT EXISTS customers ( ...same columns... );
CREATE TABLE IF NOT EXISTS bills ( ...same columns... );
CREATE TABLE IF NOT EXISTS bill_items ( ...same columns... );
CREATE TABLE IF NOT EXISTS sales_log ( ...same columns... );
CREATE TABLE IF NOT EXISTS suggestions_cache ( ...same columns... );

-- Shop (local mirror — is_active added via ALTER TABLE migration for existing installs)
CREATE TABLE IF NOT EXISTS shop (
  id TEXT PRIMARY KEY NOT NULL,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  whatsapp_number TEXT,
  business_category TEXT,
  ai_consent INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,   -- mirrors Supabase is_active; updated by sync on foreground
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sync queue (local only, never synced to cloud)
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  data_id TEXT NOT NULL,
  operation TEXT NOT NULL,   -- INSERT | UPDATE | DELETE
  payload TEXT,              -- JSON of the row data
  attempts INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 10. Pricing Model

### 10.1 Shared infrastructure costs

> **Hosting cost is now ₹0** — migrated from Railway (₹500/month) to Supabase-only (free tier). Edge Functions and DB included in Supabase free plan up to ~500K calls/month.

| Shops | WATI | Claude API | Hosting | Total cost | Per shop cost |
|---|---|---|---|---|---|
| 5 shops | ₹1,500 | ₹200 | ₹0 | ₹1,700 | ₹340 |
| 10 shops | ₹1,500 | ₹400 | ₹0 | ₹1,900 | ₹190 |
| 20 shops | ₹1,500 | ₹800 | ₹0 | ₹2,300 | ₹115 |
| 50 shops | ₹3,000 | ₹2,000 | ₹0 | ₹5,000 | ₹100 |

> Claude API cost assumes `consent_given = true` for ~80% of shops. Local-only users (consent = false) incur zero Claude API cost and improve per-shop margin on the Basic plan.

### 10.2 Customer pricing

| Plan | Monthly | What's included |
|---|---|---|
| Basic | ₹299/month | Stock tracking + billing + customer/udhar management + local low-stock detection + SMS alerts (no cloud sync, no AI) |
| Standard | ₹499/month | Everything + cloud backup + WhatsApp alerts + AI suggestions + business reports |
| Setup fee | ₹500–1,000 | One-time, on-site setup and onboarding |

### 10.3 Early adopter offer (first 10 shops)
> ₹2,000 one-time → lifetime free use
> Goal: Get real users, real feedback, ₹20,000 upfront cash to fund the build.

---

## 11. Revenue Projection

| Shops | Avg ₹400/month | Running cost | Monthly profit |
|---|---|---|---|
| 10 shops | ₹4,000 | ₹1,900 | ₹2,100 |
| 25 shops | ₹10,000 | ₹3,500 | ₹6,500 |
| 50 shops | ₹20,000 | ₹5,500 | ₹14,500 |
| 100 shops | ₹40,000 | ₹9,000 | ₹31,000 |

---

## 12. Build Timeline

| Weekend | Focus | Deliverable |
|---|---|---|
| Weekend 1 | Foundation | Expo setup, SQLite schema + sync_queue, Supabase schema, product/category/brand management screens, OTP auth, MMKV consent flag, shop setup screen |
| Weekend 2 | Core features | Billing & invoicing screen, customer & udhar management, offline sync processor, Claude AI integration (consent-gated), dashboard with AI insights card, local low-stock detection |
| Weekend 3 | Polish + alerts | Business reports screen, WATI WhatsApp alerts, alert settings screen, PDF export, UI polish, Railway deploy, real device testing |

---

## 13. UI & Design Decisions

| Decision | Detail |
|---|---|
| Bottom navigation | Floating pill-style tab bar (5 tabs: Home, Inventory, Customers, Reports, Settings) |
| Design system | Custom theme tokens: `colors.ts`, `spacing.ts`, `typography.ts` |
| Reusable components | `ScreenHeader` (branding + sync badge + notifications), `PrimaryButton`, `TextInputField`, `ProductCard`, `UpdateStockModal`, `UpdateCategoryModal`, `SummaryCard` |
| Language support | Bengali tagline on login screen ("আপনার দোকানের বন্ধু"), Hinglish consent cards. Full i18n planned for v3. |
| Dark mode | Toggle in settings (UI built, theme switching WIP) |

---

## 14. Implementation Progress Tracker

> **Legend:** 🔲 Not Started &nbsp;|&nbsp; 🔄 In Progress &nbsp;|&nbsp; ✅ Done
>
> **Last updated:** April 14, 2026 — v2.7

---

### 14.1 Mobile — Wire Screens to SQLite (local data)

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Products → SQLite | ✅ | ProductsScreen + AddProductScreen wired; `useFocusEffect` refreshes list on nav return |
| 2 | Categories → SQLite | ✅ | ManageCategoriesScreen + AddCategoryScreen wired; icons encoded as `"Ionicons:cart"` in DB |
| 3 | Brands → SQLite | ✅ | ManageBrandsScreen + AddBrandScreen wired |
| 4 | Link categories + brands to Add Product form | ✅ | Category + brand chip selectors pull live from SQLite |
| 5 | Customers → SQLite | ✅ | CustomersScreen + AddCustomerScreen wired; udhar balance tracked |
| 6 | Bills → SQLite | ✅ | NewBillScreen uses atomic `withTransactionSync`: inserts bill + items, deducts stock, updates udhar balance |
| 7 | Sales log → SQLite | ✅ | `sales_log` row written per product on every bill checkout |
| 8 | Reports → SQLite | ✅ | ReportsScreen queries real `getTodaySales`, `getSalesByRange`, `getTopProducts`; also shows last 10 transactions |
| 9 | Dashboard → SQLite | ✅ | HomeScreen: today's sales, low-stock count, recent bills from real SQLite queries via `useFocusEffect` |
| 10 | Low stock detection (local) | ✅ | `getLowStockProducts()` computes `stock < min_threshold` on device; shown as attention card on HomeScreen |

---

### 14.2 Mobile — Sync Layer

| # | Task | Status | Notes |
|---|---|---|---|
| 11 | `authService.ts` | ✅ | **Migrated to custom Edge Functions.** `sendOtp` → calls `send-otp` Edge Function (generates OTP, stores plain + hash in `otp_tokens`, calls Fast2SMS). `verifyOtp` → calls `verify-otp` Edge Function (validates OTP, creates/gets Supabase user, signs JWT, returns session); session stored via `supabase.auth.setSession()`. `getStoredAuth` → `supabase.auth.getSession()`. `logout` → `supabase.auth.signOut()`. **v2.5:** Auto-restore trigger added — on fresh install with valid session + cloud consent + empty SQLite, `restoreFromCloud()` fires automatically in background. |
| 12 | `client.js` — axios client | ✅ | **Commented out** — no longer used. Replaced by `mobile/src/lib/supabase.ts` (Supabase client singleton with AsyncStorage session persistence and auto token refresh). |
| 13 | `syncQueue.ts` — flush logic | ✅ | **Migrated to direct Supabase calls.** `ROUTE_MAP` + axios removed; each table dispatched via `supabase.from(table).upsert()` / `.delete()`; bills upsert three tables sequentially (bills → bill_items → sales_log); max 5 retry attempts unchanged. RLS enforces shop isolation automatically. **v2.5 bug fixes:** (a) `isFlushing` mutex added — prevents concurrent flush from NetInfo + AppState firing simultaneously; (b) `sales_log` added as standalone `syncUpsert` case so individual entries can be queued outside compound bill payload. |
| 14 | `syncService.ts` — listeners | ✅ | **Migrated.** `checkShopStatus()` now queries `supabase.from('shops').select('is_active').single()` directly instead of `GET /api/shops/me`. All other logic unchanged (AppState + NetInfo listeners, consent gate). **v2.5 bug fixes:** (a) `stopSyncService()` called at top of `startSyncService()` — prevents AppState/NetInfo listener leaks on double-start; (b) explicit `.eq('id', phone)` filter added to `checkShopStatus` — no longer relies solely on RLS for scoping; (c) missing `await` added to both `startSyncService()` call sites in `AuthContext`; (d) `completeSetup()` now calls `startSyncService()` — sync was never started after first-time shop creation. |
| 15 | `@supabase/supabase-js` added | ✅ | Installed via `npx expo install @supabase/supabase-js` |
| 15a | Sync correctness audit — critical bugs fixed | ✅ | **v2.5.** Full audit of SQLite→Supabase data consistency. Four critical/high bugs fixed in `db.ts`: (1) `updateCustomerUdhar` was sending `{udhar_delta}` — a non-existent Supabase column — causing all udhar balance syncs to fail silently and exhaust retry attempts. Fixed: re-reads full customer row and queues absolute balance. (2) `insertBill` with `payment_mode='udhar'` updated local SQLite balance but never queued a customer sync — remote `udhar_balance` was permanently stuck at customer creation value. Fixed: re-reads customer row after transaction and enqueues `customers UPDATE`. (3) `updateProduct` queued only the changed fields (partial payload); `addToSyncQueue` deduplication removes the prior INSERT entry — on first sync after offline edit, Supabase upserted with defaults (₹0 prices, null category). Fixed: re-reads full product row before queuing. (4) `queueAllLocalData()` added — reads every SQLite row and re-enqueues as upserts; used by Enable Cloud Backup and Import Backup flows to ensure Supabase stays in sync. |

---

### 14.3 Backend → Supabase Migration

> Express backend replaced by direct Supabase client + Edge Functions. `backend/` directory kept for reference but not deployed.

| # | Task | Status | Notes |
|---|---|---|---|
| 16 | `middleware/auth.js` | ~~✅~~ | **Replaced by Supabase RLS.** Row-level security policies on all tables enforce shop isolation via `auth.jwt() ->> 'phone'`. No custom JWT middleware needed. |
| 17 | `routes/auth.js` | ~~✅~~ | **Replaced by Supabase Phone Auth + `send-sms` Edge Function hook.** Supabase generates OTP; hook calls Fast2SMS. Custom in-memory OTP store removed. |
| 18 | `routes/shops.js` | ~~✅~~ | **Replaced by direct `supabase.from('shops')` calls** from mobile. `is_active` read directly from Supabase in `syncService`. |
| 19–23 | `routes/products|categories|brands|customers|sales.js` | ~~✅~~ | **Replaced by direct Supabase upsert/delete** in `syncQueue.ts`. |
| 24 | `supabase/functions/send-sms/index.ts` | ✅ | Legacy hook (kept). Was intended as Supabase Phone Auth Send SMS Hook but hook configuration blocked by `api.supabase.com` network error. Replaced by custom `send-otp` Edge Function. |
| 24a | `supabase/functions/send-otp/index.ts` | ✅ | **New.** Custom OTP sender. Generates 6-digit OTP, stores plain text + SHA-256 hash + expiry in `otp_tokens` table, calls Fast2SMS directly. No JWT required (`verify_jwt: false`). Dev mode: Fast2SMS bypassed — OTP readable from `otp_tokens.otp` in Supabase Dashboard. |
| 24b | `supabase/functions/verify-otp/index.ts` | ✅ | **New.** Custom OTP verifier. Validates OTP against `otp_tokens.otp`, creates/gets Supabase user via Admin API (`createUser` + `get_user_id_by_phone` SQL helper), signs 30-day HS256 JWT using `JWT_SECRET` Edge Function secret. Returns `{ access_token, refresh_token }`. OTP consumed only after JWT signing succeeds. |
| 25 | `supabase/migrations/001_rls_policies.sql` | ✅ | **Applied.** RLS on all 8 tables. Uses `right(auth.jwt() ->> 'phone', 10)` to match E.164 phone to 10-digit shop_id. |
| 25a | `otp_tokens` table + helpers migration | ✅ | **Applied.** `otp_tokens (phone PK, otp TEXT, otp_hash TEXT, expires_at TIMESTAMPTZ)` with RLS. `get_user_id_by_phone(phone_number TEXT)` SQL helper (SECURITY DEFINER) queries `auth.users`, matches both `+91XXXXXXXXXX` and `91XXXXXXXXXX` formats. |

---

### 14.4 Mobile — Auth Flow

| # | Task | Status | Notes |
|---|---|---|---|
| 26 | `mobile/src/lib/supabase.ts` | ✅ | **New.** Supabase client singleton. Configured with `AsyncStorage` for session persistence, `autoRefreshToken: false` (custom JWT — no GoTrue refresh endpoint), `detectSessionInUrl: false`. |
| 27 | `AuthContext.tsx` | ✅ | **Updated.** `login()` now runs `getStoredAuth()` first and batches all state updates in one render to eliminate ShopSetup flash for returning users. `supabase.auth.onAuthStateChange` listener for reactive sign-out. `logout()` calls `supabase.auth.signOut()`. |
| 28 | `RootNavigator.tsx` — auth guard | ✅ | Shows `ActivityIndicator` while `!isReady`; 4-way guard: Auth → ShopSetup → ShopDeactivated → MainTabs |
| 29 | `LoginScreen.tsx` | ✅ | **Updated.** `sendOtp()` now returns `void` (no `__dev_otp`). Navigation no longer passes `devOtp` param. 10-digit validation + loading/error states unchanged. |
| 30 | `OtpScreen.tsx` | ✅ | **Updated.** `devOtp` auto-fill + auto-verify `useEffect` removed. `devOtp` branch in `handleResendOtp` removed. `autoFocus` simplified. All 6-box OTP UI, resend timer, and 30s countdown unchanged. Dev testing: use Supabase Dashboard → Auth → Logs to see OTP, or configure test phone with fixed OTP `000000`. |
| 31 | `AuthNavigator.tsx` | ✅ | **Updated.** `devOtp?: string` removed from `Otp` route params type. |
| 32 | `ShopSetupScreen.tsx` | ✅ | Saves consent + shop info to AsyncStorage + SQLite; upserts shop via `syncQueue` → Supabase directly; calls `completeSetup()` |
| 33 | Logout — `SettingsScreen.tsx` | ✅ | Confirmation alert; calls `logout()` (Supabase `signOut()` + clears shop info); `AuthContext` flips → RootNavigator re-renders to Auth stack |

---

### 14.5 Edge Functions — AI & Alerts

| # | Task | Status | Notes |
|---|---|---|---|
| 34 | `supabase/functions/ai-suggestions/index.ts` | 🔲 | Deno Edge Function: sales_log → Claude API → return suggestions; replaces planned `jobs/dailySuggestions.js` |
| 35 | AI suggestions schedule (pg_cron) | 🔲 | Supabase pg_cron to trigger `ai-suggestions` Edge Function daily per shop |
| 36 | WATI WhatsApp alerts | 🔲 | Edge Function or pg_cron: low stock → WATI API call |
| 37 | Server-side low stock detection | 🔲 | Query `products` where `stock_quantity <= min_stock_threshold` → trigger WATI alert |

---

### 14.6 Mobile — Fetch from Cloud

| # | Task | Status | Notes |
|---|---|---|---|
| 38 | AI suggestions → dashboard | 🔲 | Call `ai-suggestions` Edge Function, cache in SQLite, display card |
| 39 | Settings screen — real data | ✅ | Loads shop name/owner/category/WhatsApp/aiConsent from AsyncStorage; cloud backup status badge; uses `useFocusEffect` to refresh after EditShop returns |

---

### 14.7 Additional Screens Built (beyond original v1 scope)

| Item | Status | Notes |
|---|---|---|
| Bills / All Transactions screen | ✅ | `BillsScreen`: search by customer name, filter by All/Cash/Udhar, running total of filtered bills, empty state |
| Bill Detail screen | ✅ | `BillDetailScreen`: receipt-style view with payment badge, itemised list, grand total; reached from ReportsScreen or BillsScreen |
| Recent Transactions section in Reports | ✅ | Last 10 bills shown in ReportsScreen; each row tappable → BillDetail; "View All" button → BillsScreen |
| Edit Shop screen | ✅ | `EditShopScreen`: edit shop name, owner name, category, WhatsApp, and AI consent; confirmation alerts on consent toggle; saves to AsyncStorage + SQLite + immediately flushes sync queue to backend |
| Shop Deactivated screen | ✅ | `ShopDeactivatedScreen`: blocking fullscreen shown when admin sets `is_active = false`; shows support contact + logout; detected via `checkShopStatus()` on every app foreground |

---

### 14.8 Data Backup & Recovery

| # | Task | Status | Notes |
|---|---|---|---|
| 40 | `db/backup.ts` — local backup engine | ✅ | **New.** Three functions: `exportAsJson()` reads all SQLite tables into a typed `BackupData` object (version, exportedAt, shop, categories, brands, products, customers, bills, billItems, salesLog). `importFromJson()` uses `INSERT OR REPLACE` inside a single transaction — idempotent, safe on non-empty DB. `clearAllLocalData()` `DELETE FROM` every table in one transaction (schema preserved). |
| 41 | `services/restoreService.ts` — cloud restore | ✅ | **New.** `restoreFromCloud()` fetches all 8 Supabase tables in parallel (scoped by RLS), strips `shop_id` to match SQLite schema, calls `importFromJson()`. Returns `{success, summary, error}`. `deleteFromCloud()` deletes all shop rows from Supabase in FK-safe order (children before parents). **v2.6 caveat fixes:** (C3) `bill_items` IN-clause chunked to 100 IDs per request via `fetchByIds`/`deleteByIds` helpers — handles shops with 1k+ bills. (C7) `deleteFromCloud` now collects per-table errors and continues instead of aborting on first failure; returns descriptive error listing which tables failed. (C9) Bills fetched from Supabase pass through `normaliseBills()` which converts TIMESTAMPTZ to plain ISO UTC text via `new Date(bill_date).toISOString()` before writing to SQLite. |
| 42 | Export Backup (.json) | ✅ | Settings → DATA & BACKUP → "Export Backup (.json)". Calls `exportAsJson()`, writes to `FileSystem.cacheDirectory`, shares via `Sharing.shareAsync()` (iOS Files / Android share sheet). Filename: `pragati_bandhu_backup_YYYYMMDD.json`. **v2.6 (C5):** Privacy-warning Alert added before share sheet opens — informs user the file contains sensitive customer data. |
| 43 | Import from Backup | ✅ | Settings → DATA & BACKUP → "Import from Backup". `DocumentPicker.getDocumentAsync()` → `FileSystem.readAsStringAsync()` → validate `version` + `exportedAt` → confirmation alert with row counts → `importFromJson()`. For cloud users: also calls `queueAllLocalData()` + `flushSyncQueue()` so Supabase reflects restored state and stale DELETE queue entries are cancelled. **v2.6 (C4):** DocumentPicker now accepts `["application/json", "text/plain"]` — fixes Android file managers that label `.json` as plain text. **(C6):** After parsing, `backupPhone` is compared to `currentPhone`; mismatched shops get a destructive-style "Import Anyway" warning. |
| 44 | Restore from Cloud (manual) | ✅ | Settings → DATA & BACKUP → "Restore from Cloud" (cloud consent users only). Confirmation alert → `restoreFromCloud()` with spinner → success alert showing row counts per table. |
| 45 | Delete All Data / Fresh Start | ✅ | Settings → DATA & BACKUP → "Delete All Data" (red). **Offline users:** single confirm → `clearAllLocalData()` + `clearShopInfo()` + `setHasConsent(false)` + `logout()`. **Cloud users:** two-button alert — "Delete Local Only" (keeps cloud backup, same flow as offline) or "Delete Everything" (second confirm → `deleteFromCloud()` first, then local wipe + logout). |
| 46 | Enable Cloud Backup (offline→cloud switch) | ✅ | Settings → DATA & BACKUP → "Enable Cloud Backup" (shown only when `aiConsent=false`). Updates `ai_consent=1` in SQLite + AsyncStorage + `setHasConsent(true)` → `queueAllLocalData()` → `startSyncService()`. All historical local data uploaded to Supabase in one shot. Button replaced by "Restore from Cloud" after consent is set. **v2.6 (C12):** Removed redundant `flushSyncQueue()` call after `startSyncService()` — `startSyncService` already flushes internally when consent is detected. **(C10):** Button label now shows item count while uploading (e.g. "Uploading 87 items…") instead of a generic spinner. |
| 47 | Auto-restore on reinstall | ✅ | `authService.ts:getStoredAuth()` — after recovering shop from Supabase on a fresh install, if `aiConsent=true` and local products table is empty, `restoreFromCloud()` fires non-blocking in background. Data populates on home screen without manual action. **v2.6 (C11):** `authService` now emits `'start'`/`'complete'`/`'error'` events via `utils/restoreEvents.ts`. `AuthContext` subscribes and exposes `isAutoRestoring: boolean`. `RootNavigator` renders a blue "Restoring your data from cloud…" banner with spinner while restore is in progress. |
| 48 | `mobile/docs/SYNC_DATA_FLOW.md` | ✅ | **New.** Comprehensive reference: architecture overview, consent gate table, all entities + sync strategies, SQLite→Supabase schema mapping, step-by-step data flow diagrams (user action → queue → flush → RLS → Supabase), bill insert compound flow, admin deactivation check flow, retry/failure mode table, auth/session flow, known limitations. |
| 49 | Packages added: expo-file-system, expo-document-picker, expo-sharing | ✅ | Installed via `npx expo install`. Uses `expo-file-system/legacy` for SDK 54 compatibility (`cacheDirectory`, `writeAsStringAsync`, `readAsStringAsync`). |

**Known caveats / pending fixes:**

| # | Issue | Severity | Status |
|---|---|---|---|
| C1 | Auto-restore runs concurrently — new writes during restore could theoretically conflict with `INSERT OR REPLACE` | High | ✅ Addressed — risk is negligible in practice (restore only triggers when local SQLite is empty, so there is nothing to overwrite); `isAutoRestoring` banner (C11) communicates the in-progress state to the user |
| C2 | `queueAllLocalData` + sequential flush is O(n) API calls — slow for large shops (100+ products) | High | 🔲 Pending — batched upsert per table requires significant refactor of `flushSyncQueue` |
| C3 | `bill_items` restore used `.in('bill_id', billIds)` — query-string overflow for shops with 100+ bills | High | ✅ Fixed — `fetchByIds` / `deleteByIds` helpers chunk the IN clause to 100 IDs per request |
| C4 | `DocumentPicker` MIME filter excluded valid JSON files on Android (`text/plain` label) | High | ✅ Fixed — picker now accepts `["application/json", "text/plain"]` |
| C5 | Export file contained unencrypted customer data with no user warning | High | ✅ Fixed — privacy-warning Alert shown before share sheet opens |
| C6 | No validation that imported backup belonged to this shop — could silently mix data | Medium | ✅ Fixed — `backupPhone` vs `currentPhone` check; mismatched backup requires explicit "Import Anyway" confirmation |
| C7 | Partial `deleteFromCloud` failure aborted mid-way and left Supabase in inconsistent state | Medium | ✅ Fixed — `deleteFromCloud` now collects per-table errors, continues through all tables, and returns a descriptive summary of what failed |
| C8 | No "Disable Cloud Sync" option after enabling — only escape is "Delete Everything" | Medium | Design decision — future |
| C9 | `bill_date` from Supabase (`TIMESTAMPTZ`) vs SQLite (`TEXT`) format mismatch after restore | Medium | ✅ Fixed — `normaliseBills()` converts via `new Date(bill_date).toISOString()` before writing to SQLite |
| C10 | No progress indicator during large upload (Enable Cloud Backup) | Low | ✅ Fixed — button label shows item count while uploading: "Uploading 87 items…" |
| C11 | No user notification during background auto-restore | Low | ✅ Fixed — `restoreEvents.ts` emitter + `isAutoRestoring` in `AuthContext` + blue banner in `RootNavigator` |
| C12 | Double `flushSyncQueue()` on Enable Cloud Backup (harmless no-op but misleading) | Low | ✅ Fixed — redundant explicit call removed; `startSyncService` handles the flush internally |

---

### 14.10 Future Screens (UI not yet built)

| Item | Status | Notes |
|---|---|---|
| Dedicated AI Suggestions screen | 🔲 | Currently only a teaser card on dashboard |
| Alert Settings screen | 🔲 | WhatsApp number, alert prefs, consent toggle |
| Sync status detail on dashboard | 🔲 | ScreenHeader has sync badge, but no queue detail |
| Edit Product screen | 🔲 | Tap product → pre-filled form to update price, stock threshold, category |
| Edit Customer screen | 🔲 | Tap customer → pre-filled form; record udhar payments |
| Udhar payment recording | 🔲 | Mark partial or full udhar payment against a customer |
| Admin panel / API | 🔲 | Endpoint to toggle `is_active` on a shop; currently done directly in Supabase dashboard |

---

## 15. Future Scope — v2 and Beyond

| Feature | Version | Notes |
|---|---|---|
| Barcode scanner (functional) | v2 | UI placeholder exists in billing; needs camera integration |
| Expiry date tracking | v2 | Critical for medical stores |
| Multi-shop support | v2 | One owner, multiple locations |
| Supplier contact integration | v2 | One-tap WhatsApp to supplier from suggestion |
| Unit variants | v2 | Loose vs packet, sizes, colours |
| UPI payment tracking | v2 | Payment mode split in reports (UI exists, needs backend) |
| Offline mode (full) | v2 | Already partially built in v1 via sync queue |
| Salon — usage per service | v3 | Track product consumed per customer |
| Restaurant — daily ingredient reset | v3 | Perishable stock management |
| Hindi / Bengali language UI (full i18n) | v3 | Bengali tagline already present; full localisation pending |

---

## 16. Go-To-Market Strategy

**Phase 1 — Local vertical focus**
Target one business type in Kāliyāganj first (recommended: medical stores or kirana shops). One happy client refers others — they all know each other and face identical problems.

**Phase 2 — Word of mouth + YouTube**
Document the build and first client onboarding as a YouTube video in Hinglish. Positions the developer as the local AI tech expert. Inbound leads follow.

**Phase 3 — Expand verticals**
Add small customisations per vertical (expiry dates for medical, variants for clothing) and charge slightly higher setup fees while reusing 90% of the codebase.

---

## 17. Competitive Advantage

- Only solution built specifically for small-town Indian shops at Bharat pricing
- Full shop management — inventory, billing, customer credit — in one app
- WhatsApp-native alerts — no new app habit required for shop owners
- Works fully offline — reliable even in areas with poor internet connectivity
- AI suggestions in simple Hindi/English — not technical jargon
- Privacy-first: Basic plan users never share any data, building trust before upsell
- Developer is local — can do on-site setup and support, building trust

---

## 18. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Shops don't enter sales daily | Billing flow makes it natural — every sale = one bill; send daily WhatsApp reminder |
| Claude API costs spike | Batch suggestions once/day; gate behind consent; Basic plan users never hit Claude |
| WATI cost too high early | Start with SMS (Fast2SMS) for first 5 shops |
| Shop owner loses phone | Cloud sync (for consent users) — data restore instantly; local-only users accept the risk |
| Shop owner refuses data sharing | Basic plan still generates ₹299/month revenue with zero Claude cost — better margin |
| Competition from bigger apps | Price, offline support, full billing+CRM, and local presence are the moat |
| Connectivity issues in small towns | Full offline-first architecture with automatic sync when online |

---

---

## 19. Changelog

### v2.7 — April 14, 2026

**Digital Receipts & PDF Sharing (`BillDetailScreen.tsx`)**
- **New Feature: PDF Receipt Generation.** Added `expo-print` to generate professional, styled receipts from HTML.
- **Header Branding:** Receipts automatically pull Shop Name, Owner Name, and Phone from settings to appear at the header.
- **Native Sharing:** Integrated with `expo-sharing` to allow one-tap sharing to WhatsApp, Email, or Files via the OS share sheet.
- **UI Update:** Share icon added to the top-right header of `BillDetailScreen`.

---

### v2.6 — April 14, 2026

**Caveat fixes — data integrity, resilience, and UX (restoreService.ts, SettingsScreen.tsx, authService.ts, AuthContext.tsx, RootNavigator.tsx)**

- **C3 fixed:** `bill_items` restore and delete now chunk the Supabase IN clause to 100 IDs per request via `fetchByIds` / `deleteByIds` helpers — prevents query-string overflow for shops with many bills.
- **C7 fixed:** `deleteFromCloud` no longer aborts on first error. Collects per-table errors in a `tableErrors` map, continues through all 8 tables, and returns a clear error message listing which tables failed.
- **C9 fixed:** Bills fetched from Supabase pass through `normaliseBills()` which converts `TIMESTAMPTZ` (e.g. `2024-01-01T12:00:00+05:30`) to plain ISO UTC text before writing to SQLite — prevents date query mismatches.
- **C4 fixed:** `DocumentPicker.getDocumentAsync` now accepts `["application/json", "text/plain"]` — fixes Android file managers that label `.json` files as `text/plain`.
- **C5 fixed:** Export Backup now shows a privacy-warning Alert before opening the share sheet, informing the user that the file contains sensitive customer data.
- **C6 fixed:** On import, the backup's shop phone is compared to the logged-in user's phone. If they differ, a destructive "Import Anyway" confirmation is required before proceeding — prevents accidental cross-shop data mixing.
- **C10 fixed:** Enable Cloud Backup button label dynamically shows item count during upload (e.g. "Uploading 87 items…") so the user can see that work is happening.
- **C12 fixed:** Removed redundant `flushSyncQueue()` call from `handleEnableCloudBackup` — `startSyncService()` already flushes the queue internally when consent is detected.
- **C11 fixed:** Background auto-restore now shows a non-intrusive blue banner. New `utils/restoreEvents.ts` (minimal single-subscriber event emitter) decouples `authService` from `AuthContext`. `authService` emits `'start'` / `'complete'` / `'error'` events; `AuthContext` subscribes and exposes `isAutoRestoring: boolean`; `RootNavigator` renders "Restoring your data from cloud…" banner with spinner while true.
- **C1 addressed:** True data race is negligible — auto-restore only fires when local SQLite is empty (products count = 0), so there is no existing data for `INSERT OR REPLACE` to overwrite. The C11 banner communicates in-progress state to the user.
- **C2 still pending:** Batched table-level upsert (replacing O(n) sequential flush for `queueAllLocalData`) requires a significant `flushSyncQueue` refactor — deferred.

---

### v2.5 — April 14, 2026

**Sync service audit & critical bug fixes (`db.ts`, `syncQueue.ts`, `syncService.ts`, `AuthContext.tsx`)**
- **Bug (Critical): `updateCustomerUdhar` was sending `{id, udhar_delta}` to Supabase** — `udhar_delta` column doesn't exist; every sync attempt threw a Postgres error, was retried 5× and silently dropped. Customer `udhar_balance` was never updated in Supabase. Fixed: re-reads full customer row from SQLite and queues absolute balance.
- **Bug (Critical): `insertBill` with `payment_mode='udhar'` never synced customer balance** — SQLite transaction updated the balance but nothing was queued for Supabase. Remote balance permanently stuck at customer creation value (0). Fixed: after transaction, re-reads customer row and enqueues `customers UPDATE`.
- **Bug (High): `updateProduct` queued only changed fields (partial payload)** — `addToSyncQueue` deduplication removes the prior INSERT entry; on first sync after offline edit, Supabase upserted with ₹0 prices and null category. Fixed: re-reads full product row before queuing.
- **Bug (High): No concurrent flush guard** — NetInfo fires immediately on subscription AND explicit startup `flushSyncQueue()` call ran concurrently. Added `isFlushing` mutex.
- **Bug (High): `startSyncService()` not awaited** in both `AuthContext` call sites — errors silently swallowed. Fixed.
- **Bug (Medium): Listener leak in `startSyncService`** — if called twice (e.g. login → completeSetup), AppState/NetInfo subscriptions were duplicated. Fixed: `stopSyncService()` called at top of `startSyncService`.
- **Bug (Medium): `checkShopStatus` no explicit `.eq()` filter** — relied solely on RLS to scope to correct shop. Added `.eq('id', phone)`.
- **Bug (Medium): `completeSetup()` never started sync service** — after first-time shop creation, sync didn't start until next foreground/login. Fixed.
- **`sales_log` added as standalone `syncUpsert` case** — previously only synced as part of compound bill payload; now individual entries can be queued independently.
- **`queueAllLocalData()` added to `db.ts`** — re-queues every SQLite row as upserts; cancels stale DELETE entries via deduplication.

**Data Backup & Recovery feature (`db/backup.ts`, `services/restoreService.ts`, `SettingsScreen.tsx`)**
- **New: `mobile/src/db/backup.ts`** — `exportAsJson()`, `importFromJson()` (INSERT OR REPLACE, transactional, idempotent), `clearAllLocalData()`.
- **New: `mobile/src/services/restoreService.ts`** — `restoreFromCloud()` (parallel fetch of all 8 Supabase tables → import into SQLite), `deleteFromCloud()` (FK-safe sequential delete).
- **Settings → new DATA & BACKUP section** with five actions:
  - *Enable Cloud Backup* (offline users only) — updates consent, queues all local data, starts sync service, flushes.
  - *Restore from Cloud* (cloud users only) — pulls all Supabase data back to SQLite with row-count summary.
  - *Export Backup (.json)* — writes `pragati_bandhu_backup_YYYYMMDD.json` to cache and shares via OS share sheet.
  - *Import from Backup* — picks `.json` file, shows preview with row counts, merges via `importFromJson()`; for cloud users also re-queues everything and flushes.
  - *Delete All Data* — offline: single confirm → wipe + logout; cloud: two-choice alert (local only vs local + cloud).
- **Auto-restore on reinstall** — `authService.ts:getStoredAuth()` detects fresh install (valid session, no local data, consent on) and calls `restoreFromCloud()` non-blocking.
- **New: `mobile/docs/SYNC_DATA_FLOW.md`** — comprehensive data flow documentation.
- **Packages added:** `expo-file-system`, `expo-document-picker`, `expo-sharing`.

**Risks identified (in-progress fixes):** auto-restore race condition, sequential flush performance for large shops, `bill_items` IN-clause limit on restore, Android DocumentPicker MIME type, unencrypted export file, no shop ownership validation on import, `bill_date` format mismatch after cloud restore.

---

### v2.4 — 12th April 2026

- **`aiConsent` scope clarified**: Single flag controls two things — (1) cloud sync of operational data and (2) Claude AI suggestions. Shop registration always syncs regardless of consent for admin visibility and account recovery.
- **ShopSetupScreen consent cards rewritten**: Card 1 now reads "Cloud Backup + AI Features" (cloud-upload icon) with subtitle explaining data backup. Card 2 reads "This Phone Only" with subtitle clarifying no cloud, no AI. Info box updated to explain shop registration is always saved.
- **§5.8 Privacy & Data Consent updated** in project scope: consent flag description corrected, "What works without consent" lists shop registration as always-on, "What requires consent" explicitly lists data backup + AI + alerts, onboarding card labels updated to match UI.

### v2.4 — April 12, 2026

- **Edit Shop screen built** (`EditShopScreen.tsx`): edit shop name, owner name, category, WhatsApp, and AI consent from Settings; confirmation alerts on consent toggle; save flow: AsyncStorage → SQLite → `flushSyncQueue()` (immediate, not deferred); registered in `RootNavigator` as `"EditShop"` stack screen
- **Settings screen updated**: "Edit Profile" wired to `EditShopScreen`; `useEffect` replaced with `useFocusEffect` so shop info refreshes on return; Cloud Backup status badge added to BUSINESS INFO section
- **`updateShop()` added to `db.ts`**: updates shop row in SQLite and calls `addToSyncQueue('shop', 'UPDATE', ...)` — shop info changes now flow through the sync queue like all other entities
- **`is_active` admin control implemented end-to-end**:
  - Supabase: `is_active BOOLEAN NOT NULL DEFAULT TRUE` column added via migration
  - SQLite: `is_active INTEGER DEFAULT 1` added to shop table; `ALTER TABLE` migration handles existing installs
  - `ShopInfo` and `StoredShopInfo` types extended with `isActive?: boolean`
  - `getShop()` now returns `id` and `isActive`; `StoredShopInfo` carries `isActive`
  - `AuthContext` gains `isShopActive` state + `setShopActive()` method; on mount reads last-known value from AsyncStorage (instant blocking on reopen, defaults `true` for backwards compatibility)
  - `ShopDeactivatedScreen` built: fullscreen blocking screen with support contact and logout button
  - `RootNavigator` updated to 4-way guard: Auth → ShopSetup → ShopDeactivated → MainTabs
  - `App.tsx` refactored into `AppContent` (inside `AuthProvider`) so `setShopActive` can be passed as a callback to `startSyncService`
- **Bug fixed — deactivation check was consent-gated**: `checkShopStatus()` was inside `if (!hasConsent) return`, so "This Device Only" users never got the admin deactivation check. Fixed: deactivation check now runs first for all users; only data sync remains consent-gated
- **Bug fixed — shop updates never reached backend**: `updateShop()` only queued items in SQLite; `flushSyncQueue()` was never called after save so the queue sat idle until the next app foreground/network event. Fixed: `EditShopScreen.handleSave` now calls `flushSyncQueue()` immediately after `updateShop()`
- **`routes/shops.js` updated**: `POST /` now excludes `is_active` from upsert (admin-only field); `GET /me` endpoint added — returns full shop record including `is_active` for mobile deactivation checks

### v2.3 — April 2026

- **OTP-based authentication fully implemented** (tasks 25–30 in §14.4): phone → OTP → JWT → `AuthContext` → `RootNavigator` guard; dev-mode auto-fills and auto-verifies OTP from `__dev_otp` response field
- **Full backend API layer complete** (tasks 16–24 in §14.3): `auth.js`, `middleware/auth.js`, `shops.js`, `products.js`, `categories.js`, `brands.js`, `customers.js`, `sales.js` — all mounted and working; `shop_id` always derived from JWT, never from request body
- **Logout wired** in `SettingsScreen`: confirmation alert → clears JWT + shop info from AsyncStorage → `AuthContext` flips → instant navigation back to Auth stack; no backend call needed
- **Cloud sync stack complete** (tasks 11–15 in §14.2): `syncQueue.ts` dispatches via `ROUTE_MAP`, max 5 retries; `syncService.ts` listens on AppState + NetInfo; consent-gated; `App.tsx` starts service on mount
- **Supabase connected**: real credentials set in `backend/.env`; `supabase.js` uses Proxy pattern for graceful startup with placeholder credentials
- **Physical device fix**: `EXPO_PUBLIC_API_URL` env var added; `10.0.2.2` (emulator alias) replaced with LAN IP for physical phone testing
- **`ShopSetupScreen` wired end-to-end**: saves to AsyncStorage + SQLite + fires non-fatal POST `/api/shops` for AI consent users
- **Progress tracker restructured**: §14.3 expanded with categories/brands routes; new §14.4 (Auth Flow); §14.5–14.8 renumbered

### v2.2 — April 2026
- **All Phase 1 SQLite wiring complete** (tasks 1–10 in §14.1): all screens read/write live data from local SQLite, no mock data remains
- **`react-native-mmkv` replaced with `@react-native-async-storage/async-storage`** — MMKV v4.3+ requires a native build and crashes in Expo Go; AsyncStorage is fully compatible
- **`expo-dev-client` removed** — was causing an unresolvable Intent error on `expo start --android`; not needed for Expo Go workflow
- **Critical bug fixed**: `initDatabase()` was exported from `src/db/sqlite.ts` but never called; all table-creation DDL was silently skipped on every launch. Fixed by adding `useEffect(() => { initDatabase(); }, [])` in `App.tsx`
- **New screens added beyond original scope**:
  - `BillsScreen` — all transactions list with search + payment-mode filter
  - `BillDetailScreen` — receipt-style itemised bill view
  - Both registered in `RootNavigator.tsx`
- **ReportsScreen enhanced**: new "Recent Transactions" section (last 10 bills, each tappable) and "View All Transactions" navigation button
- **`src/db/db.ts` additions**: `getAllBills()`, `getBillItems(billId)`, `getRecentBills(n)`, `getTodaySales()`, `getSalesByRange()`, `getTopProducts()`
- **Tech stack table updated**: MMKV → AsyncStorage entry corrected in §8

### v2.1 — April 2026
- Initial scope document with full feature spec, DB schema, pricing model, and build timeline

---

*Document prepared: April 2026*
*Version: 2.7 — Reflects Digital Receipts (PDF Share), Sync Audit, Data Backup & Recovery*
