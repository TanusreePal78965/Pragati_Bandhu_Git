# ShopAI (Pragati Bandhu) — Shop Management with AI Reorder Suggestions
### Project Scope Document v3.5 | May 2026

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
| Device Conflict | Auto (session claim) | Blocking screen shown when another device claims the active session (`active_device_id` mismatch); "Use on This Device" re-claims session; cloud users only |

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
    │   │   ├── auth/        # LoginScreen, OtpScreen, ShopSetupScreen, ShopDeactivatedScreen, DeviceConflictScreen
    │   │   ├── home/        # HomeScreen (Dashboard)
    │   │   ├── products/    # ProductsScreen, AddProductScreen
    │   │   ├── billing/     # NewBillScreen, BillsScreen, BillDetailScreen
    │   │   ├── customers/   # CustomersScreen, AddCustomerScreen
    │   │   ├── reports/     # ReportsScreen
    │   │   └── settings/    # SettingsScreen, EditShopScreen, ManageCategoriesScreen, AddCategoryScreen, ManageBrandsScreen, AddBrandScreen
    │   ├── components/
    │   │   ├── common/      # ScreenHeader, PrimaryButton, TextInputField
    │   │   ├── products/    # ProductCard, UpdateStockModal, UpdateCategoryModal, UomSelector
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
  is_active BOOLEAN NOT NULL DEFAULT TRUE,      -- admin-controlled; false = blocks app access
  active_device_id TEXT,                        -- single active session; mismatch → DeviceConflictScreen
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
  purchase_uom TEXT DEFAULT NULL,    -- bulk purchase unit name (e.g. "Box", "Bag")
  units_per_pack INTEGER DEFAULT NULL, -- how many base units in one purchase pack
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
  qty INTEGER NOT NULL,              -- always in base units (e.g. 60 Pcs)
  unit_price NUMERIC NOT NULL,       -- always per base unit
  line_total NUMERIC NOT NULL,
  display_qty TEXT DEFAULT NULL      -- human label for receipt (e.g. "5 Box", "3 Bag")
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

-- Login activity log (v3.0)
CREATE TABLE IF NOT EXISTS login_events (
  id           BIGSERIAL PRIMARY KEY,
  shop_id      TEXT NOT NULL,
  device_id    TEXT,
  logged_in_at TIMESTAMPTZ DEFAULT NOW()
);
-- RLS: owner SELECT + INSERT (shop_id = right(auth.jwt() ->> 'phone', 10))

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
| Reusable components | `ScreenHeader` (branding + sync badge + notifications), `PrimaryButton`, `TextInputField`, `ProductCard`, `UpdateStockModal`, `UpdateCategoryModal`, `UomSelector`, `SummaryCard` |
| Language support | Bengali tagline on login screen ("আপনার দোকানের বন্ধু"), Hinglish consent cards. Full i18n planned for v3. |
| Dark mode | Toggle in settings (UI built, theme switching WIP) |

---

## 14. Implementation Progress Tracker

> **Legend:** 🔲 Not Started &nbsp;|&nbsp; 🔄 In Progress &nbsp;|&nbsp; ✅ Done
>
> **Last updated:** May 9, 2026 — v3.5

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
| 8 | Reports → SQLite | ✅ | ReportsScreen queries real `getTodaySales`, `getSalesByRange`, `getTopProducts`; also shows last 10 transactions. **v2.8:** PDF export implemented via `expo-print` + `expo-sharing`; generates a full HTML report (summary stats, top products, recent transactions) and shares via OS share sheet. Net Profit renamed from "Est. Profit"; now computed from real `purchase_price` vs `selling_price` per bill item (not hardcoded 20%). |
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
| 28 | `RootNavigator.tsx` — auth guard | ✅ | Shows `ActivityIndicator` while `!isReady`; **5-way guard (v3.0):** Auth → ShopSetup → ShopDeactivated → DeviceConflict → MainTabs |
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
| Edit Product screen | ✅ | **v2.8.** `EditProductScreen`: pre-filled form reached via pencil icon on each product row. Edits name, purchase price, selling price, current stock, min threshold, category, brand, and UOM. Calls `updateProduct()` which re-reads the full row before queuing sync — no partial-payload corruption. Category and brand include a "None" chip to clear them. Direct delete button on each card added to `ProductsScreen` (previously dead). |
| Estimate preview in billing | ✅ | **v2.8.** ESTIMATE button in `NewBillScreen` opens a full-screen receipt-style modal showing current bill items, customer, payment mode, and grand total without saving. Clearly labelled "NOT SAVED — For preview only". Empty-bill guard shows an alert if pressed with no items. |
| AI consent gate on Dashboard | ✅ | **v2.8.** `HomeScreen` reads `aiConsent` from SQLite via `getShop()` on every focus. Cloud users (`aiConsent=true`) see "AI Reorder Insights" with sparkle icon. Local-only users (`aiConsent=false`) see "Low Stock Alerts" with a warning icon — same threshold data, correct branding, no false "AI" label. Local-only users with low stock also see an upgrade nudge pointing to Settings → Enable Cloud Backup. |
| Bulk/pack unit support | ✅ | **v3.1.** `purchase_uom` + `units_per_pack` on products; pack-mode toggle in stock update modal; per-item retail/bulk toggle in billing; `display_qty` on bill_items for receipt display. Stock always stored in base units internally. |
| UOM selector — expanded + grouped UI | ✅ | **v3.4.** 7 hardcoded chips replaced with `UomSelector` component. 20 UOMs across 5 groups (Weight, Volume, Count, Packaging, Length) rendered as flexWrap grid with category labels. "Custom" chip reveals free-text input for any unlisted unit (Vial, Tablet, Ampule, etc.). Selected-unit badge always visible. Used in both `AddProductScreen` and `EditProductScreen`. |
| Edit Customer screen + Udhar payment recording | ✅ | **v2.9.** `EditCustomerScreen`: reached by tapping any customer row in `CustomersScreen`. Displays udhar balance card (red when owed, green when cleared). "Record Payment" modal with ₹ input, quick chips (₹100/200/500/1000 + "Full ₹X"), validates amount > 0 and ≤ outstanding balance, calls `recordUdharPayment()` which clamps at ₹0 via `MAX(0, udhar_balance − ?)` in SQL. Contact form lets owner edit name, phone, address via `updateCustomer()`. Both DB functions re-read the full row before queuing sync to prevent partial-payload corruption. Registered as `"EditCustomer"` in `RootNavigator`. |
| Customer transaction history | ✅ | **v2.9.** `EditCustomerScreen` Bill History section shows the last 10 bills for that customer via `getBillsByCustomer(customerId, 10)`. Each row shows date, total, payment mode, chevron; taps through to `BillDetailScreen` for the full receipt. Empty state shown when customer has no bills. |

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

### 14.9 Multi-Device — Single Active Session (v3.0)

> Only applies to `aiConsent = true` users. Offline-only users are unaffected — no `active_device_id` check runs for them.

| # | Task | Status | Notes |
|---|---|---|---|
| 50 | Supabase migration: `active_device_id` column | ✅ | `ALTER TABLE shops ADD COLUMN IF NOT EXISTS active_device_id TEXT` — migration `add_active_device_id_to_shops` applied |
| 51 | `storage.ts` — `getOrCreateDeviceId()` | ✅ | Generates UUID-like string on first call, persists in AsyncStorage under `device_id` key. Survives restarts; cleared on uninstall (new install = new claim, correct behaviour). |
| 52 | `authService.ts` — device claim removed from login | ✅ | **v3.3 fix.** Device claim previously fired in `verifyOtp` (fire-and-forget `UPDATE shops SET active_device_id`). Removed — it raced with `checkShopStatus`: Device B would set its own ID before the check read Supabase, always seeing itself as the active device. Claim now happens only in `checkShopStatus` (stamp-if-null) and `claimSession()` (explicit re-claim). |
| 53 | `syncQueue.ts` — device ID in shop upsert | ✅ | `case 'shop':` upsert now includes `active_device_id` from `getOrCreateDeviceId()` — ensures first-time shop creation and all shop edits stamp the correct device. |
| 54 | `syncService.ts` — device conflict detection | ✅ | `checkShopStatus()` fetches `is_active, active_device_id, ai_consent`. For consent users: **v3.3 logic:** if `active_device_id = null` → stamps this device (first login / no prior claim); if `active_device_id ≠ thisDevice` → `onDeviceConflict()`. Previously gated on `data.ai_consent && data.active_device_id` — if either was falsy (null or corrupted to false), check was silently skipped. |
| 55 | `AuthContext.tsx` — `isDeviceConflict` + `claimSession()` | ✅ | New `isDeviceConflict: boolean` state. `claimSession()` updates `active_device_id` in Supabase to this device's ID and resets `isDeviceConflict = false`. All `startSyncService()` call sites pass both callbacks. `logout()` resets `isDeviceConflict`. |
| 56 | `DeviceConflictScreen.tsx` | ✅ | New blocking screen shown when `isDeviceConflict = true`. Amber icon. "Use on This Device" → confirmation alert → `claimSession()`. "Logout" → `logout()`. Shows registered phone number for context. |
| 57 | `RootNavigator.tsx` — 5-way guard | ✅ | Guard order: Auth → ShopSetup → ShopDeactivated → **DeviceConflict** → MainTabs. |
| 58 | Login activity tracking | ✅ | `login_events (id BIGSERIAL, shop_id TEXT, device_id TEXT, logged_in_at TIMESTAMPTZ)` table created with RLS (owner read + insert). Fire-and-forget insert in `authService.verifyOtp` after session is set — records every successful login with shop phone and device ID. Queryable in Supabase Dashboard for admin visibility. |

---

### 14.10 Data Isolation & Auth Correctness (v3.2)

| # | Task | Status | Notes |
|---|---|---|---|
| 59 | Per-user SQLite database files | ✅ | `sqlite.ts` rewritten — each authenticated user gets their own `shopai_<phone>.db` file. A JS Proxy forwards all `db.*` calls to the current open instance so zero call-site changes were needed across `db.ts`, `syncQueue.ts`, `backup.ts`, `authService.ts`. Eliminates cross-user data bleed at the architectural level. |
| 60 | `openUserDatabase(phone)` | ✅ | Opens `shopai_<phone>.db` and runs schema + migrations. Safe to call multiple times with the same phone (no-op). Called in `authService.getStoredAuth()` immediately after session phone is extracted — before any SQLite read. |
| 61 | `closeUserDatabase()` | ✅ | Closes the current DB file handle and resets internal state. Called in `logout()` — releases file lock so the next user's `openUserDatabase` starts clean. |
| 62 | `logout()` — no SQLite wipe | ✅ | Logout now only calls `supabase.auth.signOut()` + `closeUserDatabase()` + `clearAllUserData()`. SQLite is **never wiped on logout** — offline users keep their data intact in their own DB file; online users keep their local cache (restore from cloud is always available). |
| 63 | `clearAllUserData()` added to `storage.ts` | ✅ | Removes all user-specific AsyncStorage keys (`HAS_CONSENT`, `LAST_SYNC`, `USER_ID`, `SHOP_ID`, `SHOP_INFO`) in one call. `DEVICE_ID` intentionally preserved — identifies the physical device across user switches. |
| 64 | `SettingsScreen` — Delete All Data uses `clearAllUserData` | ✅ | Replaced `clearShopInfo()` with `clearAllUserData()` in both `confirmDeleteLocal` and `confirmDeleteEverything` flows — ensures all AsyncStorage keys are cleared, not just `SHOP_INFO`. |
| 65 | `syncQueue.ts` — `ai_consent` corruption fix | ✅ | `case 'shop'` UPDATE path now excludes `ai_consent` from the Supabase payload — stale local values can no longer overwrite cloud consent and break device-conflict detection. INSERT path (first-time setup) still includes `ai_consent`. |
| 66 | `db.ts` `updateShop` — `aiConsent` excluded from sync payload | ✅ | `aiConsent` stripped from sync queue payload via destructuring. Local SQLite still updates correctly. Consent changes reach Supabase via a direct targeted update in `EditShopScreen`. |
| 67 | `EditShopScreen` — direct consent push | ✅ | On save, a fire-and-forget `supabase.from('shops').update({ ai_consent })` is sent using the authenticated phone — the only path that mutates `ai_consent` in Supabase, preventing any stale-value overwrite. |
| 68 | `App.tsx` — `initDatabase()` removed | ✅ | Schema creation now happens inside `openUserDatabase()`. `initDatabase` import and `useEffect` call removed from `App.tsx`. |

---

### 14.10b Parallel Billing — Draft Bills + Soft Inventory Reservation (v3.5)

> Solves the "second customer wait" problem. Shopkeeper can hold any number of in-progress bills simultaneously and switch between them. Inventory is soft-reserved per open draft so overselling across concurrent bills is impossible.

| # | Task | Status | Notes |
|---|---|---|---|
| 69 | `draft_bills` + `draft_bill_items` tables added to SQLite schema | ✅ | New tables in `sqlite.ts:initTables`. Drafts are **local-only** — never enter sync_queue, never hit Supabase. `clearDatabase()` also wipes both tables. |
| 70 | Draft DB layer — 9 new functions in `db.ts` | ✅ | `createDraft`, `upsertDraft`, `upsertDraftItems`, `getDraftById`, `getAllDrafts`, `deleteDraft`, `getReservationsMap`, `cleanupOldDrafts`, `finalizeDraft`. See details below. |
| 71 | `finalizeDraft` — atomic bill creation from draft | ✅ | Accepts current cart state directly (no DB read needed). Atomically: inserts bill + bill_items, deducts stock, writes sales_log, updates udhar balance, queues sync, **deletes the draft**. Identical correctness guarantees to the original `insertBill`. |
| 72 | `getReservationsMap(excludeDraftId)` — soft reservation query | ✅ | Single SQL query: `SUM(qty) GROUP BY product_id` across all `draft_bill_items` except the current draft. Returns `Record<product_id, reserved_qty>`. `available_qty = stock_quantity − reserved_qty`. |
| 73 | `cleanupOldDrafts` | ✅ | Deletes drafts older than 24 hours. Called on every NewBillScreen mount to prevent stale reservations locking inventory. |
| 74 | `DraftSwitcherModal` component | ✅ | New `components/billing/DraftSwitcherModal.tsx`. Bottom-sheet modal listing all open drafts (customer, item count, total, payment mode). Current draft highlighted with CURRENT badge. Non-current drafts have a discard (×) button with confirmation. "Start New Bill" action at bottom. |
| 75 | `NewBillScreen` — full refactor for draft lifecycle | ✅ | **Draft creation:** on mount, creates a new draft via `createDraft()` or loads existing via `getDraftById(route.params.draftId)`. **Auto-save:** `useEffect` on `[draftId, billItems, selectedCustomer, paymentMode]` — debounced 400ms, always cancelled on unmount. **Available qty:** search results show colour-coded `Avail: N` (green/amber/red) computed from `reservedQtyMap`. Stock checks use available qty (not raw stock) for both `addProduct` and `updateQty`. |
| 76 | `NewBillScreen` — HOLD button + Drafts switcher in header | ✅ | Header right: "Bills" button with badge count of OTHER open drafts. Tapping opens `DraftSwitcherModal`. Footer action row: `[HOLD] [ESTIMATE] [CHECKOUT]` — HOLD saves current draft immediately and navigates to a fresh NewBillScreen (`navigation.replace`). Switching drafts from modal also uses `replace` — stack stays shallow. |
| 77 | Back button + discard behaviour | ✅ | Tapping back: if cart has items → `saveNow()` (immediate save, cancels debounce timer) → `goBack()`. If cart empty → `deleteDraft()` → `goBack()`. Trash icon → confirmation alert → `deleteDraft()` → `goBack()`. |

**Key design decisions:**
- Drafts local-only: no Supabase schema changes required
- `finalizeDraft` accepts cart state directly — avoids read-after-write latency
- `navigation.replace` for draft switching keeps stack depth = 1
- `isDraftLoadedRef` (useRef, not state) prevents auto-save from firing during initial draft load

### 14.11 Future Screens (UI not yet built)

| Item | Status | Notes |
|---|---|---|
| Dedicated AI Suggestions screen | 🔲 | Currently only a teaser card on dashboard (consent-gated correctly as of v2.8) |
| Alert Settings screen | 🔲 | WhatsApp number, alert prefs, consent toggle |
| Sync status detail on dashboard | 🔲 | ScreenHeader has sync badge, but no queue detail |
| Edit Product screen | ✅ | **v2.8** — see 14.7 above |
| Edit Customer screen | ✅ | **v2.9** — see 14.7 above |
| Udhar payment recording | ✅ | **v2.9** — see 14.7 above |
| Admin panel / API | 🔲 | Endpoint to toggle `is_active` on a shop; currently done directly in Supabase dashboard |

---

### 14.12 Inventory Costing & Purchase Tracking (Planned — 3 Phases)

> **Current state:** The project uses a flat single-price-per-product model. Each product has one `purchase_price` and one `selling_price` — no batch tracking, no cost history, no WAC/FIFO. The profit report (`getSalesByRange`) joins `bill_items → products` and uses the **live** `purchase_price` from the products table, meaning a price update retroactively changes Net Profit for all historical bills.

#### Phase 1 — Snapshot Cost at Sale Time (Bug Fix — No UX Change)

> **Priority:** High — fixes a real accounting bug with zero UX disruption.

| # | Task | Status | Notes |
|---|---|---|---|
| 78 | `bill_items` — add `unit_cost REAL DEFAULT 0` column | 🔲 | SQLite: `ALTER TABLE` migration in `sqlite.ts`. Supabase: `ALTER TABLE bill_items ADD COLUMN unit_cost NUMERIC DEFAULT 0`. |
| 79 | `insertBill` / `finalizeDraft` — capture `unit_cost` at sale time | 🔲 | Look up `product.purchase_price` during bill item insertion; write to `unit_cost`. Freeze the cost forever — immune to future price edits. |
| 80 | `getSalesByRange` — use snapshotted cost | 🔲 | Change profit query from `bi.unit_price - COALESCE(p.purchase_price, 0)` to `bi.unit_price - bi.unit_cost`. Removes dependency on live product row. |
| 81 | `syncQueue.ts` — include `unit_cost` in bill_items upsert | 🔲 | Ensure Supabase bill_items upsert payload includes the new column. |
| 82 | `exportAsSql` / `backup.ts` — include `unit_cost` | 🔲 | Add column to SQL export, JSON export, and JSON import flows. |

**Selling price strategy (unchanged):** Product-level MRP — shopkeeper sets one `selling_price` per product. Billing uses `product.selling_price` as `unit_price` on each `bill_item`. No batch-level selling prices needed at this stage.

---

#### Phase 2 — Purchase Receipts & Auto WAC (New Feature)

> **Priority:** Medium — adds purchase history and automatic cost tracking. Requires a new "Receive Stock" UX flow.

| # | Task | Status | Notes |
|---|---|---|---|
| 83 | `stock_receipts` table — SQLite + Supabase | 🔲 | `id TEXT PK, product_id TEXT, qty_added REAL, unit_cost REAL, supplier_name TEXT, note TEXT, receipt_date TEXT`. Local + synced. Records every stock addition. |
| 84 | "Receive Stock" flow — stock addition creates a receipt | 🔲 | `UpdateStockModal` and any stock-editing flow → inserts a `stock_receipts` row alongside the `stock_quantity` update. |
| 85 | Auto WAC recalculation on every receipt | 🔲 | After inserting a receipt: `UPDATE products SET purchase_price = (SELECT SUM(unit_cost * qty_added) / NULLIF(SUM(qty_added), 0) FROM stock_receipts WHERE product_id = ?) WHERE id = ?`. Shopkeeper no longer needs to manually update purchase price. |
| 86 | Purchase history UI — per-product | 🔲 | `EditProductScreen` gains a "Purchase History" section showing recent receipts (date, qty, cost, supplier). |
| 87 | Sync + backup support for `stock_receipts` | 🔲 | Add to `syncQueue.ts` dispatch, `queueAllLocalData`, `exportAsSql`, `backup.ts` export/import flows, RLS policy. |

**Key design decision:** `stock_receipts` is an append-only purchase diary at this stage — no `qty_remaining` column, no batch depletion. Stock quantity is still the single counter on `products`. This keeps complexity low while giving full purchase audit trail and auto WAC.

---

#### Phase 3 — FIFO Batch Tracking (Opt-in, Per Category)

> **Priority:** Low — only needed for pharmacy/FMCG shops that require expiry tracking or true FIFO costing. Build only when user demand exists.

| # | Task | Status | Notes |
|---|---|---|---|
| 88 | `products` — add `costing_method TEXT DEFAULT 'wac'` | 🔲 | Values: `'wac'` (default), `'fifo'`. Set per product or per category. |
| 89 | `stock_receipts` — add `qty_remaining REAL`, `expiry_date TEXT` | 🔲 | Turns receipts into consumable batches. `qty_remaining` decremented on each sale. `expiry_date` enables near-expiry alerts. |
| 90 | `bill_items` — add `batch_id TEXT` (nullable) | 🔲 | Links each sale line to the batch it was consumed from. NULL for WAC products. |
| 91 | FIFO allocation logic in billing | 🔲 | On sale of a FIFO product: query batches `ORDER BY receipt_date ASC, id ASC WHERE qty_remaining > 0`, consume oldest first, split across batches if needed. `unit_cost` = actual batch cost per line. |
| 92 | Expiry alerts — near-expiry detection | 🔲 | Local query: `SELECT * FROM stock_receipts WHERE expiry_date <= date('now', '+30 days') AND qty_remaining > 0`. Show in dashboard low-stock card. |

**Decision table — which method to use:**

| Factor | WAC (Phase 2) | FIFO (Phase 3) |
|---|---|---|
| Small kirana / general retail | ✅ Recommended | Overkill |
| Pharmacy / FMCG (expiry tracking) | ❌ Can't track expiry | ✅ Essential |
| Profit calculation accuracy | Good enough | High |
| UI complexity for shopkeeper | Low | Higher |
| Offline sync complexity | Low | Higher |

---

## 15. Future Scope — v2 and Beyond

| Feature | Version | Notes |
|---|---|---|
| Barcode scanner (functional) | v2 | UI placeholder exists in billing; needs camera integration |
| Expiry date tracking | v2 | Critical for medical stores; depends on Phase 3 FIFO batch tracking (§14.12) |
| Multi-shop support | v2 | One owner, multiple locations |
| Supplier contact integration | v2 | One-tap WhatsApp to supplier from suggestion |
| Unit variants (loose vs packet) | ✅ v3.1 | Bulk/pack unit support implemented — `purchase_uom` + `units_per_pack` per product; size/colour variants still v2 |
| **Cost snapshot fix** | **v3.6** | **Phase 1 (§14.12): `unit_cost` on `bill_items` — fixes retroactive profit bug** |
| **Purchase history + auto WAC** | **v4** | **Phase 2 (§14.12): `stock_receipts` table, auto WAC recalculation, purchase diary per product** |
| **FIFO batch costing** | **v4+** | **Phase 3 (§14.12): opt-in per product/category; batch depletion, expiry tracking for pharmacy** |
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

### v3.5 — May 9, 2026

**Parallel Billing — Draft Bills + Soft Inventory Reservation (`sqlite.ts`, `db.ts`, `NewBillScreen.tsx`, `components/billing/DraftSwitcherModal.tsx` new)**

- **Root problem solved:** shopkeeper could only bill one customer at a time — second customer had to wait while first bill was in progress.

- **Draft Bills system.** Two new local-only SQLite tables (`draft_bills`, `draft_bill_items`) store in-progress bills. Drafts are never synced to Supabase — they exist only on device. On finalize, `finalizeDraft()` atomically converts the draft into a confirmed bill (same guarantees as the original `insertBill`: stock deduction, sales log, udhar update, sync queue).

- **Soft inventory reservation.** `getReservationsMap(excludeDraftId)` computes total qty reserved across all other open drafts in one SQL query. `available_qty = stock_quantity − reserved_qty`. Search results in billing now show colour-coded **Avail: N** (green ≥ 6, amber ≤ 5, red = 0). Both `addProduct` and `updateQty` check available qty — overselling across concurrent drafts is blocked at entry time, not at checkout.

- **Hold & New Bill.** New HOLD button in the billing footer. Saves current draft immediately (cancels debounce timer, writes synchronously) then `navigation.replace('NewBill')` — stack depth stays 1. Second customer billing starts instantly.

- **Drafts switcher.** "Bills" button in billing header shows a badge count of other open drafts. Tapping opens `DraftSwitcherModal` — a bottom sheet listing all open bills with customer name, item count, total, payment mode. Tap any draft to switch to it (`navigation.replace`). Discard button (×) on each non-current draft with confirmation alert. "Start New Bill" shortcut at the bottom.

- **Auto-save.** `useEffect` on `[draftId, billItems, selectedCustomer, paymentMode]` with 400ms debounce. Current draft is always persisted — no data loss if app crashes or user switches away. `isDraftLoadedRef` (useRef) prevents the auto-save from firing during the initial draft load, avoiding a redundant write on screen open.

- **Back / discard handling.** Back button: if cart has items → `saveNow()` (immediate save) → `goBack()` — draft preserved for later. If cart empty → `deleteDraft()` → `goBack()` — no orphan empty drafts. Trash icon → confirm dialog → `deleteDraft()` → `goBack()`.

- **Draft cleanup.** `cleanupOldDrafts()` deletes drafts older than 24 hours. Called on every NewBillScreen mount — prevents stale reservations permanently locking inventory.

- **New file: `components/billing/DraftSwitcherModal.tsx`.** Self-contained bottom-sheet component. Props: `visible`, `drafts`, `currentDraftId`, `onSelectDraft`, `onDiscardDraft`, `onNewBill`. No navigation logic inside — all navigation handled by the caller (NewBillScreen).

- **No Supabase schema changes required.** Drafts are local-only. Existing `bills`, `bill_items`, `sales_log` tables and all sync logic unchanged.

---

### v3.4 — May 9, 2026

**UOM selector — expanded units + grouped UI (`UomSelector.tsx` new, `AddProductScreen.tsx`, `EditProductScreen.tsx`)**

- **`UomSelector` component built (`components/products/UomSelector.tsx`).** Replaces the 7-chip horizontal scroll in both Add Product and Edit Product with a grouped flexWrap grid. All 20 UOMs visible at once — no horizontal hunting.

- **20 UOMs across 5 groups:**

  | Group | Units |
  |---|---|
  | Weight | kg, gm, mg, Quintal |
  | Volume | Liter, ml |
  | Count | Pcs, Dozen, Pair, Set |
  | Packaging | Pack, Box, Bag, Carton, Sachet, Strip, Bottle, Roll, Ream, Bundle |
  | Length | Meter, ft |

- **"Custom" chip for unlisted units.** Tapping it reveals a `TextInput` where the owner can type any unit not in the list (e.g. Vial, Tablet, Ampule, Capsule). `EditProductScreen` auto-detects existing custom UOMs — the selector initialises into custom-input mode if the product's current UOM is not in the known list. Previously, the edit screen just appended the unknown UOM to the chip list with no way to type a new one.

- **Selected-unit badge always shown.** A blue badge at the bottom of the selector shows the currently chosen unit — owner always knows what is picked even after scrolling.

- **`ALL_KNOWN_UOMS` exported** from `UomSelector.tsx` — flat array of all 20 units; used internally for the `isCustom` detection on edit.

- **Both product screens simplified.** `UOMS` constant and `uomList` memo removed. `renderChipSelector` call for UOM replaced with `<UomSelector selectedUom={selectedUom} onSelect={setSelectedUom} />`. No change to how the value is saved — still stored as plain text in `products.uom`.

---

### v3.3 — May 8, 2026

**Device conflict detection — race condition fix + ai_consent restoration (`authService.ts`, `syncService.ts`, Supabase)**

- **Root cause 1: race condition in device claim.** `verifyOtp` previously fired a fire-and-forget `UPDATE shops SET active_device_id = thisDevice` immediately before `checkShopStatus` ran. Because both were async, Device B would write its own ID to Supabase before its own conflict check read it — always seeing itself as the active device, letting two sessions run simultaneously. Fix: device claim removed from `verifyOtp` entirely.

- **Root cause 2: `ai_consent = false` in Supabase.** The conflict check gated on `data.ai_consent && data.active_device_id`. Both test shops (`9126667356`, `7003354703`) had `ai_consent` corrupted to `false` by the earlier stale-sync bug (fixed in v3.2). Even with the race fix, a `false` consent value would skip the block entirely. Fix: both shops restored to `ai_consent = true` via direct SQL.

- **`checkShopStatus` now owns the stamp-if-null logic.** For `aiConsent = true` users: if `active_device_id` is null (no prior claim) → stamps this device. If `active_device_id ≠ thisDevice` → `onDeviceConflict()`. This is the only correct place to claim — the check and the claim happen in the same read cycle, with no race window.

- **When DeviceConflictScreen appears:** whenever `checkShopStatus` detects an `active_device_id` mismatch — on login, on every app foreground via AppState, and immediately when the sync service starts. **Never auto-logs out** — user must choose "Use on This Device" (re-claim) or "Logout" (exit). Re-claiming stamps this device; the other device is blocked on its next foreground check.

---

### v3.2 — May 8, 2026

**Per-user SQLite isolation + auth correctness (`sqlite.ts`, `authService.ts`, `db.ts`, `syncQueue.ts`, `EditShopScreen.tsx`, `SettingsScreen.tsx`, `storage.ts`, `App.tsx`)**

- **Root cause fixed: cross-user data bleed on same device.** Previous architecture used a single `shopai.db` shared by all users. Logging out and logging in with a different account left the first user's rows in every table; `SELECT ... LIMIT 1` queries returned stale data from the wrong account.

- **Per-user database files (`sqlite.ts` rewritten).** Each authenticated user now gets their own SQLite file: `shopai_<phone>.db`. A JS `Proxy` object is exported as `db` and forwards every property access to the current `_db` instance at call time — all 4 callers (`db.ts`, `syncQueue.ts`, `backup.ts`, `authService.ts`) continue importing `db` unchanged. `openUserDatabase(phone)` opens the correct file and runs schema + migrations; `closeUserDatabase()` releases the handle on logout.

- **Structural isolation eliminates the need for logout wipes.** Offline users: data is preserved in `shopai_<phone>.db` across logout/login cycles — no data loss. Online users: local cache preserved; restore from cloud always available. Different user logging in on the same device simply opens a different file — no bleed, no wipe needed.

- **`logout()` simplified.** Only three steps: `supabase.auth.signOut()` → `closeUserDatabase()` → `clearAllUserData()`. The previous consent-gated SQLite wipe and cross-user detection logic are gone.

- **`clearAllUserData()` added to `storage.ts`.** Clears all user-specific AsyncStorage keys (`HAS_CONSENT`, `LAST_SYNC`, `USER_ID`, `SHOP_ID`, `SHOP_INFO`) in one `multiRemove` call. `DEVICE_ID` preserved — physical device identity must survive user switches. Replaces `clearShopInfo()` in all logout and delete-data flows.

- **`ai_consent` corruption fixed (`syncQueue.ts`, `db.ts`, `EditShopScreen.tsx`).** Shop UPDATE sync no longer includes `ai_consent` in its payload — stale local values (e.g. `false`) can no longer silently overwrite Supabase's `true` and break device-conflict detection. Consent changes are pushed directly from `EditShopScreen` via a targeted fire-and-forget `supabase.from('shops').update({ ai_consent })`.

- **`initDatabase()` removed from `App.tsx`.** Schema creation now happens inside `openUserDatabase()`. The call in `App.tsx` is gone — tables are only created once the authenticated phone is known.

---

### v3.1 — May 8, 2026

**Bulk/pack unit support — flexible buying and selling (`sqlite.ts`, `db.ts`, `AddProductScreen.tsx`, `EditProductScreen.tsx`, `UpdateStockModal.tsx`, `ProductsScreen.tsx`, `NewBillScreen.tsx`)**

- **Two new product fields: `purchase_uom` and `units_per_pack`.** Added as nullable columns on `products` (SQLite migration + Supabase schema). Existing products unaffected — both columns default NULL, which disables pack logic entirely. Owner sets these once when creating or editing a product.

- **"Bulk / Pack Size" section added to Add Product and Edit Product screens.** An optional toggle at the bottom of each form: "Sells in packs / boxes / bags?" When enabled, owner enters:
  - *Pack unit name*: what they call the big unit (e.g. "Box", "Bag", "Dozen", "Crate") — shown on receipts.
  - *Units per pack*: how many base units (e.g. Pcs, kg) fit in one pack. Live preview updates as owner types: "1 Box = 12 Pcs".

- **Stock update modal (UpdateStockModal) supports pack entry.** When any selected product has pack size configured, a "Enter quantity in packs/boxes" toggle appears. In pack mode: owner enters how many packs received; each product's `units_per_pack` is applied to compute the base unit quantity. The product chip area shows the conversion per item (e.g. "5 Box = 60 Pcs"). Products without pack config receive the plain entered quantity.

- **Billing screen (NewBillScreen) supports per-item retail/bulk toggle.** When a product has `purchase_uom` + `units_per_pack` configured, a small toggle button appears on the bill line item: tapping it switches between selling in base units ("Pcs") and bulk units ("Box"). In bulk mode:
  - Qty display shows packs (e.g. "2") not base units (e.g. "24").
  - Price display shows per-pack price (e.g. "₹120 / Box") not per-unit price.
  - `+/-` step size jumps by `units_per_pack` in base units internally.
  - Stock check enforces pack-boundary limits.
  - `display_qty` stored on `bill_items` for receipt accuracy (e.g. "2 Box").

- **Stock is always tracked in base units internally.** `stock_quantity` on `products` never changes format. `qty` on `bill_items` always stores base units. `display_qty` is a presentation-only label. Reports and AI suggestions remain unaffected.

- **`display_qty` column added to `bill_items`.** Stores the human-readable quantity label at sale time (e.g. "5 Box", "3 Bag", "10 Pcs"). Used for receipt display in `BillDetailScreen` and PDF export. Synced to Supabase as part of compound bill payload.

---

### v3.0 — May 8, 2026

**Single active session — multi-device support for cloud users (`DeviceConflictScreen.tsx` new, `storage.ts`, `authService.ts`, `syncQueue.ts`, `syncService.ts`, `AuthContext.tsx`, `RootNavigator.tsx`, Supabase migration)**

- **Supabase migration applied.** `active_device_id TEXT` column added to `shops` table via `add_active_device_id_to_shops` migration.

- **`getOrCreateDeviceId()` added to `storage.ts`.** Generates a stable UUID-like identifier on first call and persists it in AsyncStorage under the `device_id` key. Survives app restarts; cleared on uninstall so a fresh install generates a new ID and cleanly claims the session.

- **Session claim on login (`authService.ts`).** After `verifyOtp` sets the Supabase session, a fire-and-forget `UPDATE shops SET active_device_id = thisDeviceId` stamps the cloud record. If the shop row doesn't exist yet (new user, pre-setup), the update is a no-op.

- **Device ID stamped on shop sync (`syncQueue.ts`).** The `case 'shop':` upsert block now includes `active_device_id` from `getOrCreateDeviceId()` — ensures first-time shop creation and all subsequent shop edits write the correct device ID to Supabase.

- **Device conflict detection in `syncService.ts`.** `checkShopStatus()` now fetches `is_active, active_device_id, ai_consent`. For `aiConsent = true` users: if `active_device_id` in Supabase ≠ local device ID → `onDeviceConflict()` is called. Admin deactivation check runs first and applies to all users. Offline-only (`aiConsent = false`) users are never checked — their `active_device_id` is always null. `startSyncService()` signature extended to `(onDeactivated, onDeviceConflict)`.

- **`AuthContext.tsx` extended.** New `isDeviceConflict: boolean` state. New `claimSession()` function: updates `active_device_id` in Supabase to this device's ID, resets `isDeviceConflict = false`. All three `startSyncService()` call sites (`onMount`, `login`, `completeSetup`) pass both callbacks. `logout()` resets `isDeviceConflict`.

- **`DeviceConflictScreen.tsx` built.** Blocking fullscreen shown when `isDeviceConflict = true`. Amber icon. "Use on This Device" → confirmation alert → `claimSession()` (the other device detects mismatch on its next foreground and is blocked). "Logout" → `logout()`. Shows registered phone number for context.

- **`RootNavigator.tsx` updated to 5-way guard.** Order: Auth → ShopSetup → ShopDeactivated → **DeviceConflict** → MainTabs.

---

### v2.9 — April 17, 2026

**Udhar payment recording + Edit Customer screen (`EditCustomerScreen.tsx` new, `CustomersScreen.tsx`, `db.ts`, `RootNavigator.tsx`)**

- **Edit Customer screen built (`EditCustomerScreen.tsx`).** Reached by tapping any customer row in `CustomersScreen` (previously a dead `TouchableOpacity`). Shows an Udhar Balance Card (red when owed, green when fully cleared). Contact form pre-fills Name, Phone, and Address; calls `updateCustomer()` on Save. Registered as `"EditCustomer"` in `RootNavigator`.

- **Udhar payment recording.** "Record Payment" button on the balance card opens a bottom-sheet modal. Features: ₹ amount input, quick-fill chips for ₹100 / ₹200 / ₹500 / ₹1,000 (shown only when less than balance) and a "Full ₹X" chip to clear in one tap. Validates amount > 0 and ≤ outstanding balance. Calls `recordUdharPayment(customerId, amount)` which executes `UPDATE customers SET udhar_balance = MAX(0, udhar_balance - ?)` — balance cannot go negative at the SQL level. Full row re-read before sync queue entry to prevent partial-payload corruption. Success alert shows remaining balance. "Record Payment" button hidden once balance reaches ₹0.

- **Customer transaction history.** `EditCustomerScreen` includes a Bill History section showing the last 10 bills per customer via new `getBillsByCustomer(customerId, limit)` function in `db.ts`. Each row shows date, grand total, payment mode badge, and a chevron; taps through to `BillDetailScreen`. "No bills yet" empty state displayed when customer has no history.

- **`CustomersScreen` navigation wired.** Customer rows now navigate to `"EditCustomer"` with `{ customerId: item.id }`. Screen refreshes on return via `useFocusEffect`.

---

### v2.8 — April 17, 2026

**Bug fixes & UX integrity (`ReportsScreen.tsx`, `HomeScreen.tsx`, `NewBillScreen.tsx`, `EditProductScreen.tsx` new, `ProductsScreen.tsx`, `db.ts`, `RootNavigator.tsx`)**

- **PDF Report Export implemented.** `ReportsScreen` now generates and shares a full PDF report via `expo-print` + `expo-sharing`. Report includes: shop header (name, owner, phone), period + date range, summary stats (Total Sales, Net Profit, Cash Sales, Udhar, Bill Count), Top 5 Products table, and last 10 transactions table. Button shows "Generating PDF…" with spinner while in progress; alerts if period has no data. "Est. Profit" label renamed to "Net Profit" now that calculation is real.

- **Profit calculation fixed.** `getSalesByRange()` in `db.ts` replaced hardcoded `totalSales * 0.2` with a SQL join: `SUM(bi.qty × (bi.unit_price − COALESCE(p.purchase_price, 0)))` across `bill_items → products`. Uses selling price at time of sale vs current purchase price. Products with no purchase price set contribute ₹0 margin rather than inflating profit.

- **ESTIMATE button wired.** `NewBillScreen` ESTIMATE button now opens a full-screen receipt-style modal showing the current bill (items, customer, payment mode, grand total) without saving. Clearly labelled "NOT SAVED — For preview only". Shows an alert if pressed when bill is empty.

- **Edit Product screen built (`EditProductScreen.tsx`).** Pre-filled form for all product fields: name, purchase price, selling price, current stock, min threshold, category (with "None" chip), brand (with "None" chip), UOM. Calls `updateProduct()`. Wired via pencil icon on each product card in `ProductsScreen`. Trash icon on each product card now also triggers a direct single-item delete confirmation. Registered as `"EditProduct"` in `RootNavigator`.

- **AI consent gate on Dashboard.** `HomeScreen` reads `aiConsent` from SQLite (`getShop()`) on every screen focus. Cloud users see "AI Reorder Insights" with sparkle icon (unchanged). Local-only users (`aiConsent=false`) see "Low Stock Alerts" with amber warning icon — identical threshold data but no false "AI" branding, in line with the consent promise made at shop setup. Local-only users with active low-stock items see an upgrade nudge directing them to Settings → Enable Cloud Backup.

---

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

*Document prepared: April 2026 | Last updated: May 2026*
*Version: 3.3 — Reflects Device Conflict Race Fix, ai_consent Restoration, Per-User SQLite Isolation*
