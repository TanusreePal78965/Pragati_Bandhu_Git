# ShopAI (Pragati Bandhu) — Shop Management with AI Reorder Suggestions
### Project Scope Document v2.1 | April 2026

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
- `MMKV` (react-native-mmkv) stores fast key-value flags: consent setting, auth token, plan type
- All user actions write to SQLite first — the app is always responsive regardless of connectivity

#### Sync queue mechanism
Every write appends a row to a local `sync_queue` table with fields: table name, row ID, operation (insert/update/delete), payload (JSON), and synced status. When internet is available and consent is given, a background processor flushes all unsynced rows as a batch POST to the backend, then marks them as synced.

#### Sync flow
1. User action → write to SQLite + append to sync_queue
2. NetInfo check: if offline, queue stays; retry automatically when online
3. Privacy gate check: if `consent = false`, queue stays local — no cloud sync, no Claude, no WATI
4. If online + consent = true: flush sync_queue → Express API → Supabase
5. Daily cron job then triggers Claude API for that shop's suggestions

### 5.8 Privacy & Data Consent

ShopAI gives shop owners full control over their data. This is presented clearly during onboarding, not buried in a legal wall.

#### Consent flag
A single boolean (`consent_given`) stored in MMKV controls three behaviours: whether the sync queue flushes to cloud, whether Claude API is called for that shop, and whether WATI alerts are sent (requires WhatsApp number stored server-side).

#### What works without consent (local-only mode)
- Full stock tracking, product, category, and brand management
- Billing and invoicing
- Customer and udhar management
- Business reports (local data only)
- Local low-stock detection (`stock < threshold` computed on device)
- Suggestions cache from last sync (if they previously consented)

#### What requires consent
- Cloud backup and multi-device restore
- AI reorder suggestions (Claude API)
- WhatsApp and SMS alerts

#### Onboarding consent screen
Presented during shop setup as two clear radio-card options:
- **"AI suggestions chahiye"** — Smart reordering & analytics (Recommended)
- **"Sirf mere phone pe"** — Basic stock tracking only, no internet data share

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
| Settings | Settings | User profile with edit, language selector, dark mode toggle, notification settings, business info (shop name, GSTIN, address), manage categories, manage brands, help center, privacy policy, terms of service, app version, logout |

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

---

## 7. Folder Structure

Monorepo with two top-level directories. Only `backend/` deploys to Railway. The `mobile/` directory builds via Expo EAS.

```
shopai/
├── backend/
│   ├── src/
│   │   ├── config/          # supabase.js, claude.js
│   │   ├── routes/          # products, sales, suggestions, alerts
│   │   ├── controllers/
│   │   ├── services/        # claudeService, watiService, smsService, stockService
│   │   ├── middleware/      # auth.js (Supabase JWT), errorHandler.js
│   │   └── jobs/            # dailySuggestions.js (cron)
│   └── railway.toml
└── mobile/
    ├── src/
    │   ├── api/             # Axios client → Railway URL
    │   ├── screens/
    │   │   ├── auth/        # LoginScreen, OtpScreen, ShopSetupScreen
    │   │   ├── home/        # HomeScreen (Dashboard)
    │   │   ├── products/    # ProductsScreen, AddProductScreen
    │   │   ├── billing/     # NewBillScreen
    │   │   ├── customers/   # CustomersScreen, AddCustomerScreen
    │   │   ├── reports/     # ReportsScreen
    │   │   └── settings/    # SettingsScreen, ManageCategoriesScreen, AddCategoryScreen, ManageBrandsScreen, AddBrandScreen
    │   ├── components/
    │   │   ├── common/      # ScreenHeader, PrimaryButton, TextInputField
    │   │   ├── products/    # ProductCard, UpdateStockModal, UpdateCategoryModal
    │   │   └── home/        # SummaryCard
    │   ├── store/           # Zustand: useProductStore
    │   ├── db/              # SQLite schema setup, sync queue processor
    │   ├── navigation/      # RootNavigator, AuthNavigator, BottomTabNavigator
    │   ├── services/        # authService, syncService
    │   ├── theme/           # colors, spacing, typography
    │   └── utils/           # storage (MMKV helpers)
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
| Local prefs | react-native-mmkv | Fast key-value: consent flag, auth token |
| Connectivity | @react-native-community/netinfo | Online/offline detection for sync |
| Icons | @expo/vector-icons (Ionicons, MaterialCommunityIcons) | Rich icon set |
| Backend | Node.js + Express | Simple REST API |
| Database | Supabase (PostgreSQL) | Free tier, auth built-in, realtime |
| AI engine | Anthropic Claude API | Reorder suggestions (consent-gated) |
| WhatsApp alerts | WATI (shared account) | Cost split across shops |
| SMS fallback | Fast2SMS | ₹0.15–0.25 per SMS |
| Hosting | Railway | Backend deployment |

---

## 9. Database Schema

### 9.1 Supabase (cloud)

```sql
-- Shops
create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  shop_name text not null,
  whatsapp_number text,
  shop_address text,
  gstin text,
  business_category text,
  plan text default 'standard',
  consent_given boolean default false,
  created_at timestamp default now()
);

-- Categories
create table categories (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  name text not null,
  icon text,
  icon_color text,
  created_at timestamp default now()
);

-- Brands
create table brands (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  name text not null,
  logo_url text,
  created_at timestamp default now()
);

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  name text not null,
  category text,
  brand text,
  unit text default 'piece',
  uom text default 'Pcs',
  stock int default 0,
  min_threshold int default 5,
  purchase_price decimal(10,2),
  selling_price decimal(10,2),
  created_at timestamp default now()
);

-- Customers
create table customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  name text not null,
  phone text,
  address text,
  udhar_balance decimal(10,2) default 0,
  created_at timestamp default now()
);

-- Bills
create table bills (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  customer_id uuid references customers(id),
  payment_mode text default 'cash',  -- cash | udhar
  total_amount decimal(10,2) not null,
  total_items int not null,
  bill_date timestamp default now()
);

-- Bill Items
create table bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid references bills(id),
  product_id uuid references products(id),
  qty int not null,
  unit_price decimal(10,2) not null,
  line_total decimal(10,2) not null
);

-- Daily sales log (aggregated)
create table sales_log (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id),
  shop_id uuid references shops(id),
  qty_sold int not null,
  sold_date date default current_date
);

-- AI suggestion log
create table suggestions_log (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  product_id uuid references products(id),
  urgency text,
  days_left int,
  suggested_qty int,
  reason text,
  created_at timestamp default now()
);
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

-- Sync queue (local only, never synced to cloud)
CREATE TABLE IF NOT EXISTS sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  operation TEXT NOT NULL,   -- insert | update | delete
  payload TEXT,              -- JSON of the row data
  synced INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

---

## 10. Pricing Model

### 10.1 Shared infrastructure costs

| Shops | WATI | Claude API | Hosting | Total cost | Per shop cost |
|---|---|---|---|---|---|
| 5 shops | ₹1,500 | ₹200 | ₹0 | ₹1,700 | ₹340 |
| 10 shops | ₹1,500 | ₹400 | ₹0 | ₹1,900 | ₹190 |
| 20 shops | ₹1,500 | ₹800 | ₹500 | ₹2,800 | ₹140 |
| 50 shops | ₹3,000 | ₹2,000 | ₹500 | ₹5,500 | ₹110 |

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
> **Last updated:** April 2026

---

### 14.1 Mobile — Wire Screens to SQLite (local data)

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Products → SQLite | 🔲 | Save/load/delete in AddProduct & ProductsScreen |
| 2 | Categories → SQLite | 🔲 | Manage Categories & Add Category wired to real data |
| 3 | Brands → SQLite | 🔲 | Manage Brands & Add Brand wired to real data |
| 4 | Link categories + brands to Add Product form | 🔲 | Chip selectors pull from SQLite, not hardcoded arrays |
| 5 | Customers → SQLite | 🔲 | CustomersScreen & AddCustomer form wired |
| 6 | Bills → SQLite | 🔲 | NewBillScreen saves bill + bill_items, deducts stock |
| 7 | Sales log → SQLite | 🔲 | Write to `sales` table on every bill checkout |
| 8 | Reports → SQLite | 🔲 | Replace mock numbers with real queries |
| 9 | Dashboard → SQLite | 🔲 | Today's sales, low stock count from real data |
| 10 | Low stock detection (local) | 🔲 | Compute `stock < min_threshold` on device, show alert |

---

### 14.2 Mobile — Sync Layer

| # | Task | Status | Notes |
|---|---|---|---|
| 11 | `authService.ts` | 🔲 | OTP login via Supabase Auth, store JWT in MMKV |
| 12 | `client.js` — auth header | 🔲 | Inject JWT from MMKV into every Axios request |
| 13 | `syncQueue.ts` — flush logic | 🔲 | Complete route-by-table + operation dispatch |
| 14 | `syncService.ts` — listeners | 🔲 | AppState + NetInfo listeners triggering flushSyncQueue |
| 15 | Add `axios` to package.json | 🔲 | Currently imported but not in dependencies |

---

### 14.3 Backend — API Routes

| # | Task | Status | Notes |
|---|---|---|---|
| 16 | `middleware/auth.js` | 🔲 | Verify Supabase JWT on every request |
| 17 | `routes/shops.js` | 🔲 | POST create/update shop on setup |
| 18 | `routes/products.js` | 🔲 | POST, PUT, DELETE → upsert to Supabase |
| 19 | `routes/customers.js` | 🔲 | POST, PUT → upsert to Supabase |
| 20 | `routes/sales.js` | 🔲 | POST bills + bill_items + sales_log to Supabase |
| 21 | `index.js` — mount routes | 🔲 | Uncomment and register all route files |

---

### 14.4 Backend — AI & Alerts

| # | Task | Status | Notes |
|---|---|---|---|
| 22 | `jobs/dailySuggestions.js` | 🔲 | Cron: sales_log → Claude API → suggestions_log |
| 23 | `routes/suggestions.js` | 🔲 | GET endpoint for mobile to fetch suggestions |
| 24 | `services/watiService.js` | 🔲 | WhatsApp alerts via shared WATI account |
| 25 | `services/smsService.js` | 🔲 | SMS fallback via Fast2SMS |
| 26 | `services/stockService.js` | 🔲 | Server-side low stock detection → trigger alerts |

---

### 14.5 Mobile — Fetch from Cloud

| # | Task | Status | Notes |
|---|---|---|---|
| 27 | AI suggestions → dashboard | 🔲 | Fetch from `/api/suggestions`, cache in SQLite, display card |
| 28 | Settings screen — real data | 🔲 | Load shop name/owner from MMKV or Supabase |

---

### 14.6 Future Screens (UI not yet built)

| Item | Status | Notes |
|---|---|---|
| Dedicated AI Suggestions screen | 🔲 | Currently only a teaser card on dashboard |
| Alert Settings screen | 🔲 | WhatsApp number, alert prefs, consent toggle |
| Sync status detail on dashboard | 🔲 | ScreenHeader has sync badge, but no queue detail |

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

*Document prepared: April 2026*
*Version: 2.1 — Updated to reflect actual mobile implementation*
