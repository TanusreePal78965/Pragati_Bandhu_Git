# ShopAI — Inventory Tracker with AI Reorder Suggestions
### Project Document v1.0

---

## 1. Project Overview

**ShopAI** is a mobile application built for small Indian retail shops that helps owners track inventory, monitor stock levels, and receive AI-powered reorder suggestions — all via a simple Android app and WhatsApp alerts.

The core problem it solves: small shop owners in tier-2 and tier-3 Indian towns lose money every day because they run out of stock unexpectedly or over-order and waste capital. No affordable, simple tool exists for them today.

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
- No affordable tool exists — existing solutions cost ₹2,000–10,000/month, far beyond reach
- Shop owners are comfortable with WhatsApp but not with complex software

---

## 4. The Solution

A simple Android app where the shopkeeper:
1. Adds products and sets minimum stock thresholds
2. Logs daily sales with one tap
3. Gets WhatsApp alerts when stock drops low
4. Gets AI-generated reorder suggestions based on sales history

Everything runs on shared infrastructure — one backend serving multiple shops — keeping costs as low as ₹110–340 per shop per month at scale.

---

## 5. Core Features — v1 Scope

### 5.1 Stock Entry / Update
- Add new products (name, category, unit, opening stock)
- Update stock quantity after deliveries arrive
- Set minimum stock threshold per product
- View full product list with current stock levels

### 5.2 Sales Tracking
- Daily sales entry — tap a product, enter quantity sold
- Auto-deducts from current stock
- Builds daily sales history per product
- Shows today's total sales count on dashboard

### 5.3 AI Reorder Suggestions (Claude API)
- Triggered once daily or on-demand by owner
- Sends last 14-day sales history to Claude API
- Claude returns: urgency level, days of stock left, suggested reorder quantity, short reason
- Displayed as clean cards in the app
- Suggestions batched to keep API costs minimal (~₹15–40/month per shop)

### 5.4 Low Stock Alerts — WhatsApp
- Automatic alert when stock drops below threshold
- Sent via shared WATI account (cost split across all shops)
- SMS fallback via Fast2SMS for shops without WhatsApp
- Owner sets alert timing: instant or daily morning digest

---

## 6. Future Scope — v2 and Beyond

| Feature | Version | Notes |
|---|---|---|
| Barcode scanner support | v2 | Auto stock deduction on sale |
| Expiry date tracking | v2 | Critical for medical stores |
| Multi-shop support | v2 | One owner, multiple locations |
| Supplier contact integration | v2 | One-tap WhatsApp to supplier from suggestion |
| Unit variants | v2 | Loose vs packet, sizes, colours |
| Sales analytics dashboard | v2 | Weekly and monthly trends |
| Offline mode | v2 | Sync when internet available |
| Salon — usage per service | v3 | Track product consumed per customer |
| Restaurant — daily ingredient reset | v3 | Perishable stock management |
| UPI payment tracking | v3 | Link sales to payment mode |
| Hindi / Bengali language UI | v3 | Full regional language support |

---

## 7. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Mobile app | React Native + Expo | Cross-platform, developer's strength |
| Navigation | React Navigation v6 | Industry standard |
| State management | Zustand | Lightweight, simple |
| Backend | Node.js + Express | Simple REST API |
| Database | Supabase (PostgreSQL) | Free tier, auth built-in, realtime |
| AI engine | Anthropic Claude API | Reorder suggestions |
| WhatsApp alerts | WATI (shared account) | Cost split across shops |
| SMS fallback | Fast2SMS | ₹0.15–0.25 per SMS |
| Hosting | Railway or Render | Free tier backend |

---

## 8. App Screens — v1

| Screen | Purpose |
|---|---|
| Dashboard | Overview: total products, low stock count, today's sales |
| Stock entry | Add/edit products, update stock after delivery |
| Sales tracking | Daily sales log per product |
| AI suggestions | Reorder suggestions with urgency cards |
| Alert settings | Set WhatsApp number and alert preferences |

---

## 9. Database Schema

```sql
-- Shops
create table shops (
  id uuid primary key default gen_random_uuid(),
  owner_name text not null,
  shop_name text not null,
  whatsapp_number text,
  plan text default 'standard',
  created_at timestamp default now()
);

-- Products
create table products (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid references shops(id),
  name text not null,
  category text,
  unit text default 'piece',
  stock int default 0,
  min_threshold int default 5,
  created_at timestamp default now()
);

-- Daily sales log
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

---

## 10. Pricing Model

### Shared Infrastructure Model
One backend, one Supabase instance, one WATI account — shared across all shops. Costs stay flat as shops are added.

| Shops | WATI | Claude API | Hosting | Total cost | Per shop cost |
|---|---|---|---|---|---|
| 5 shops | ₹1,500 | ₹200 | ₹0 | ₹1,700 | ₹340 |
| 10 shops | ₹1,500 | ₹400 | ₹0 | ₹1,900 | ₹190 |
| 20 shops | ₹1,500 | ₹800 | ₹500 | ₹2,800 | ₹140 |
| 50 shops | ₹3,000 | ₹2,000 | ₹500 | ₹5,500 | ₹110 |

### Customer Pricing

| Plan | Monthly | What's included |
|---|---|---|
| Basic | ₹299/month | Stock tracking + SMS alerts |
| Standard | ₹499/month | Everything + WhatsApp alerts + AI suggestions |
| Setup fee | ₹500–1,000 | One-time, on-site setup and onboarding |

### Early Adopter Offer (First 10 shops)
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
| Weekend 1 | Foundation | Expo setup, Supabase schema, stock entry + product list screens, OTP auth |
| Weekend 2 | Core features | Sales tracking, Claude AI integration, suggestions screen, low stock detection |
| Weekend 3 | Polish + alerts | WATI WhatsApp alerts, dashboard stats, UI polish, deploy, test on real device |

---

## 13. Go-To-Market Strategy

**Phase 1 — Local vertical focus**
Target one business type in Kāliyāganj first (recommended: medical stores or kirana shops). One happy client refers others — they all know each other and face identical problems.

**Phase 2 — Word of mouth + YouTube**
Document the build and first client onboarding as a YouTube video in Hinglish. Positions the developer as the local AI tech expert. Inbound leads follow.

**Phase 3 — Expand verticals**
Add small customisations per vertical (expiry dates for medical, variants for clothing) and charge slightly higher setup fees while reusing 90% of the codebase.

---

## 14. Competitive Advantage

- Only solution built specifically for small-town Indian shops at Bharat pricing
- WhatsApp-native alerts — no new app habit required for shop owners
- AI suggestions in simple Hindi/English — not technical jargon
- Developer is local — can do on-site setup and support, building trust

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Shops don't enter sales daily | Make it one-tap simple; send daily WhatsApp reminder |
| Claude API costs spike | Batch suggestions once/day, keep prompts short |
| WATI cost too high early | Start with SMS (Fast2SMS) for first 5 shops |
| Shop owner loses phone | Cloud sync — data never lost, restore instantly |
| Competition from bigger apps | Price and local presence are the moat |

---

*Document prepared: March 2026*
*Version: 1.0*
