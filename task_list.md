Here's the full list of actionable items, in logical order:

---

## Mobile — Wire to SQLite (local data first)

1. **Products → SQLite** — save/load/delete products from `sqlite.ts` in Add Product & Products screen
2. **Categories → SQLite** — wire Manage Categories & Add Category to real data
3. **Brands → SQLite** — wire Manage Brands & Add Brand to real data
4. **Link categories + brands to Add Product form** — chip selectors should pull from SQLite, not hardcoded arrays
5. **Customers → SQLite** — wire Customers screen & Add Customer form
6. **Bills → SQLite** — wire New Bill screen (save bill + bill_items, deduct stock)
7. **Sales log → SQLite** — write to `sales` table on every bill checkout
8. **Reports → SQLite** — replace mock numbers with real queries from sales + bills
9. **Dashboard → SQLite** — today's sales, low stock count from real data
10. **Low stock detection** — compute `stock < min_threshold` locally, show alert on dashboard

---

## Mobile — Sync Layer

11. **`authService.ts`** — OTP login via Supabase Auth, store JWT in MMKV
12. **`client.js`** — inject JWT from MMKV into every Axios request header
13. **`syncQueue.ts`** — complete the flush logic (route by table + operation)
14. **`syncService.ts`** — AppState + NetInfo listeners that trigger `flushSyncQueue()`
15. **Add `axios` to `mobile/package.json`**

---

## Backend — API Routes

16. **`middleware/auth.js`** — verify Supabase JWT on every request
17. **`routes/shops.js`** — POST to create/update shop on setup
18. **`routes/products.js`** — POST, PUT, DELETE → upsert to Supabase
19. **`routes/customers.js`** — POST, PUT → upsert to Supabase
20. **`routes/sales.js`** — POST bills + bill_items + sales_log to Supabase
21. **`index.js`** — uncomment and mount all routes

---

## Backend — AI & Alerts

22. **`jobs/dailySuggestions.js`** — cron job: query sales_log → Claude API → write suggestions_log
23. **`routes/suggestions.js`** — GET endpoint for mobile to fetch suggestions
24. **`services/watiService.js`** — send WhatsApp alert via WATI
25. **`services/smsService.js`** — SMS fallback via Fast2SMS
26. **`services/stockService.js`** — detect low stock server-side, trigger alerts

---

## Mobile — Fetch from Cloud

27. **Fetch AI suggestions** — pull from `/api/suggestions`, cache in SQLite `suggestions_cache`, show on dashboard
28. **Settings screen** — load real shop name/owner from MMKV or Supabase instead of hardcoded "John Doe"

---

**28 items total.** Want to pick where to start?