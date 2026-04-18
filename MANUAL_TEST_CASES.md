# Pragati Bandhu — Manual Test Cases
> Version: v2.9 · April 17, 2026  
> Covers all implemented features as of Sprint 3

---

## Legend

| Symbol | Meaning |
|---|---|
| ☁️ | Test applies to **Cloud user** (aiConsent = ON) only |
| 📱 | Test applies to **Local-only user** (aiConsent = OFF) only |
| 🔁 | Test applies to **both** user types |
| ✅ | Expected: PASS |
| ❌ | Expected: app should block / show error |
| TC-XXX | Test Case ID |

---

## Test User Profiles

Before starting, set up two separate testing sessions or two devices:

**Profile A — Cloud User**
- Complete onboarding with "Enable Cloud Backup & AI" = ON
- This user's HomeScreen should show "AI Reorder Insights"
- This user has access to Sync Now, Restore from Cloud in Settings

**Profile B — Local-Only User**
- Complete onboarding with "This Phone Only" = selected
- This user's HomeScreen should show "Low Stock Alerts"
- Settings shows "Enable Cloud Backup" CTA instead of Sync Now

---

## MODULE 1 — Authentication

### TC-101 · Login — valid phone number 🔁

| Field | Value |
|---|---|
| Screen | Login |
| Action | Enter a valid 10-digit Indian mobile number → tap Send OTP |
| Expected | OTP screen opens; number displayed at top matches input |
| Check | Number is trimmed (no spaces/dashes accepted); button disabled if fewer than 10 digits |

---

### TC-102 · Login — short / invalid number ❌ 🔁

| Input | Expected result |
|---|---|
| 9 digits | Send OTP button remains disabled |
| Blank | Button disabled |
| Alphabets | Keyboard should be numeric; button stays disabled |

---

### TC-103 · OTP screen — correct code ✅ 🔁

| Field | Value |
|---|---|
| Action | Enter the 6-digit OTP received on the test number |
| Expected | If new number → ShopSetupScreen; if returning user → MainTabs (Dashboard) |
| Check | OTP auto-advances focus per digit; Verify button enabled only after 6 digits |

---

### TC-104 · OTP screen — wrong code ❌ 🔁

| Input | Expected |
|---|---|
| 000000 (wrong) | Error alert: "Invalid or expired OTP. Please try again." |
| Resend OTP | OTP resend triggered; countdown resets (if implemented) |

---

### TC-105 · Shop Setup — cloud consent ON ☁️

| Field | Value |
|---|---|
| Shop Name | "Test Kirana Store" |
| Owner Name | "Ramesh Kumar" |
| Category | "Grocery" |
| WhatsApp | "9876543210" |
| Consent toggle | ON (cloud + AI enabled) |
| Action | Tap Complete Setup |
| Expected | Navigates to Dashboard; first visit shows consent-aware "AI Reorder Insights" card on HomeScreen |

---

### TC-106 · Shop Setup — local only ☁️📱

| Field | Value |
|---|---|
| Consent toggle | OFF ("This Phone Only") |
| Action | Tap Complete Setup |
| Expected | Navigates to Dashboard; HomeScreen shows "Low Stock Alerts" (amber icon, no sparkle) — NOT "AI Reorder Insights" |

---

### TC-107 · Shop Setup — required fields missing ❌ 🔁

| Scenario | Expected |
|---|---|
| Shop Name blank, Owner filled | Complete Setup button disabled |
| Owner Name blank, Shop filled | Complete Setup button disabled |
| Both filled | Button enabled |
| Category blank (optional) | Setup completes normally |

---

### TC-108 · Change Number (back from Setup) 🔁

| Action | Expected |
|---|---|
| Tap "Change Number" on ShopSetupScreen | Logs out; returns to Login screen |
| Re-enter different number | OTP sent to new number |

---

## MODULE 2 — Home / Dashboard

### TC-201 · Dashboard loads with real data 🔁

| Check | Expected |
|---|---|
| "Today's Sales" card | Shows sum of all bills created today in ₹ |
| "Low Stock" count | Shows count of products where stock < min_threshold |
| "Recent Bills" | Shows up to 5 of today's bills; most recent first |
| All figures update on return from another tab | Yes — useFocusEffect reloads on tab switch |

**Test with:** 0 bills today → all cards should show ₹0 / 0.

---

### TC-202 · Dashboard — AI Reorder Insights card (Cloud user) ☁️

**Pre-condition:** At least one product with stock_quantity < min_stock_threshold.

| Check | Expected |
|---|---|
| Section heading | "AI Reorder Insights" with ✨ sparkle icon |
| Card colour | Primary blue background |
| Text | "[Product name] is low on stock (X left, threshold: Y). Consider restocking soon." |
| No low-stock products | Section hidden entirely |

---

### TC-203 · Dashboard — Low Stock Alerts card (Local user) 📱

**Pre-condition:** At least one product with stock_quantity < min_stock_threshold.

| Check | Expected |
|---|---|
| Section heading | "Low Stock Alerts" with amber ⚠️ warning icon |
| Card colour | Amber / yellow tones — NOT blue |
| No "AI" label anywhere in the section | Confirm |
| Upgrade nudge card visible below | Yes — "Enable Cloud Backup" nudge card shown when low-stock items exist |
| Tapping upgrade nudge | Should navigate to Settings (or show info — verify behaviour) |

---

### TC-204 · Dashboard — no low-stock items 🔁

| Pre-condition | Expected |
|---|---|
| All products have stock ≥ min_threshold | Neither AI Insights nor Low Stock Alerts card shown |
| Local user | Upgrade nudge card also NOT shown |

---

### TC-205 · Notification bell ❌ 🔁

| Action | Expected |
|---|---|
| Tap bell icon in header | Nothing happens (known gap — documented in AUDIT.md 4.1) |
| Verify | No crash; no navigation |

---

## MODULE 3 — Products

### TC-301 · Add Product — all fields ✅ 🔁

| Field | Test value |
|---|---|
| Product Name | "Tata Salt 1kg" |
| Purchase Price | 18.00 |
| Selling Price | 22.00 |
| Current Stock | 50 |
| Min Threshold | 10 |
| Category | Select from dropdown (pre-created) |
| Brand | Select from dropdown (pre-created) |
| UOM | "Kg" |
| Action | Tap Add Product |
| Expected | Product appears in Products list; stock = 50; price = ₹22 |

---

### TC-302 · Add Product — required fields only ✅ 🔁

| Field | Value |
|---|---|
| Product Name | "Generic Product" |
| Selling Price | 10.00 |
| All other fields | Left blank / 0 |
| Expected | Product saved; purchase_price = 0; profit contribution will be ₹0 in reports |

---

### TC-303 · Add Product — validation failures ❌ 🔁

| Scenario | Expected |
|---|---|
| Product Name blank | Save button disabled or shows validation error |
| Selling Price = 0 | Allowed (no block), but verify it saves correctly |
| Selling Price blank | Validation error |
| Negative stock | Verify behaviour (should block or save as 0) |

---

### TC-304 · Products list — search 🔁

| Input | Expected |
|---|---|
| Type "Salt" | Shows "Tata Salt 1kg"; filters in real-time |
| Type "XYZ123" | "No products found" empty state |
| Clear search | Full list restored |
| Search by category name | Matching products shown |

---

### TC-305 · Edit Product — pre-fill check ✅ 🔁

| Action | Expected |
|---|---|
| Tap pencil icon on "Tata Salt 1kg" | EditProductScreen opens |
| All fields pre-filled | Name = "Tata Salt 1kg", Purchase = 18, Selling = 22, Stock = 50, Threshold = 10, correct category/brand/UOM |

---

### TC-306 · Edit Product — change price ✅ 🔁

| Action | Expected |
|---|---|
| Change Selling Price from 22 to 25 | Tap Save |
| Return to Products list | Price shows ₹25 |
| Create a new bill with this product | Bill uses new price ₹25 |
| Check Reports → Net Profit | Profit uses updated selling price for new bills; old bills unaffected |

---

### TC-307 · Edit Product — clear category / brand ✅ 🔁

| Action | Expected |
|---|---|
| Tap "None" chip under Category | Category cleared |
| Tap "None" chip under Brand | Brand cleared |
| Save | Product saved with no category / no brand |
| Verify in list | Category column shows empty / "No category" |

---

### TC-308 · Edit Product — non-standard UOM ✅ 🔁

| Scenario | Expected |
|---|---|
| Original UOM is "Litre" (standard) | Dropdown pre-selects "Litre" |
| Original UOM is "Bori" (custom, not in standard list) | "Other" chip selected; custom input pre-filled with "Bori" |
| Change custom UOM to "Bag" and save | Saved as "Bag" |

---

### TC-309 · Delete Product — single item ✅ 🔁

| Action | Expected |
|---|---|
| Tap trash icon on a product card | Confirmation alert: "Delete [name]? This cannot be undone." |
| Tap Cancel | Product remains in list |
| Tap Delete | Product removed from list; stock gone |
| Check billing | Deleted product no longer appears in search results |

---

### TC-310 · Delete Product — product used in past bills 🔁

| Action | Expected |
|---|---|
| Delete a product that appears in past bills | Product deleted |
| Open old bill in Bills screen | Bill detail still shows the product name and amount (recorded at time of billing) |
| Check Reports → Net Profit | Historical bills still compute — purchase_price JOIN returns NULL, treated as 0 |

---

## MODULE 4 — Billing

### TC-401 · New Bill — cash, walk-in customer ✅ 🔁

| Step | Action |
|---|---|
| 1 | Open New Bill (FAB or from Home) |
| 2 | Payment Mode = Cash (default) |
| 3 | Search "Salt" → tap "Tata Salt 1kg" |
| 4 | Qty auto-set to 1; line total = ₹22 |
| 5 | Search "Sugar" → tap product |
| 6 | Grand total updates correctly |
| 7 | Tap Checkout |
| Expected | "Bill Saved! ₹XX bill saved successfully." alert → OK returns to previous screen |
| Verify | Bills screen shows the new bill; Products screen shows reduced stock |

---

### TC-402 · New Bill — increase / decrease qty ✅ 🔁

| Action | Expected |
|---|---|
| Add "Tata Salt" → tap + button | qty = 2; line total doubles |
| Tap − button | qty = 1 |
| Tap − when qty = 1 | Item removed from bill |
| Item disappears from bill list | Confirm |

---

### TC-403 · New Bill — udhar payment, customer selected ✅ 🔁

| Step | Action |
|---|---|
| 1 | Select payment mode = Udhar (Credit) |
| 2 | Tap Checkout immediately | ❌ "Customer Required" alert |
| 3 | Tap "Select Customer" → search → select "Ramesh" |
| 4 | Customer card shows current udhar balance |
| 5 | Add products → Checkout |
| Expected | Bill saved; customer's udhar_balance increases by grand total |
| Verify in Customers tab | Ramesh's balance increased by bill amount |

---

### TC-404 · New Bill — udhar payment, no customer selected ❌ 🔁

| Action | Expected |
|---|---|
| Payment mode = Udhar | Tap Checkout without selecting a customer |
| Expected | Alert: "Customer Required. Please select a customer for Udhar payment." |
| Bill NOT saved | Confirm nothing written to DB |

---

### TC-405 · New Bill — empty bill checkout ❌ 🔁

| Action | Expected |
|---|---|
| Open New Bill; add no products | Tap Checkout |
| Expected | Alert: "Empty Bill. Please add at least one product to the bill." |

---

### TC-406 · New Bill — ESTIMATE preview, with items ✅ 🔁

| Step | Action |
|---|---|
| 1 | Add 2–3 products to bill |
| 2 | Tap ESTIMATE button |
| Expected | Full-screen receipt modal opens |
| Check | Shows all items, qty, price per line; customer name (or "Walk-in"); payment mode; grand total |
| Check | Red/amber banner: "NOT SAVED — For preview only" |
| Dismiss | Tap Close → back to bill; items still in bill |

---

### TC-407 · New Bill — ESTIMATE preview, empty bill ❌ 🔁

| Action | Expected |
|---|---|
| No products added; tap ESTIMATE | Alert: "Empty Bill. Add at least one product to preview an estimate." |
| Modal does NOT open | Confirm |

---

### TC-408 · New Bill — ESTIMATE then Checkout ✅ 🔁

| Action | Expected |
|---|---|
| View estimate → close modal → tap Checkout | Bill saves normally; estimate had no effect on data |

---

### TC-409 · New Bill — product search behaviour 🔁

| Input | Expected |
|---|---|
| 1 character | No results shown (requires > 1 character) |
| 2+ characters matching product | Up to 8 results shown |
| Matches category name | Correct products shown |
| No match | "No products found for '[search]'" message |
| Tap a result | Product added; search bar clears |
| Same product tapped again | Qty increments (not a duplicate row) |

---

### TC-410 · New Bill — clear all items ✅ 🔁

| Action | Expected |
|---|---|
| Add 3 products → tap trash icon (header) | All items cleared |
| Alternatively tap "Clear All" link above items list | All items cleared |
| Grand total resets to ₹0 | Confirm |

---

### TC-411 · New Bill — customer search in modal ✅ 🔁

| Action | Expected |
|---|---|
| Tap "Select Customer" | Modal opens with full customer list |
| Type partial name | Filtered results |
| Type partial phone | Filtered results |
| Type random text | Empty list |
| Tap a customer → modal closes | Customer card shows name + current udhar |

---

## MODULE 5 — Bills History

### TC-501 · Bills list — all bills shown 🔁

| Check | Expected |
|---|---|
| Navigate to Bills tab or via Home recent bills | All bills shown; most recent first |
| Each row shows | Date, customer (or "Walk-in"), total amount, payment mode badge |

---

### TC-502 · Bill Detail — content ✅ 🔁

| Action | Expected |
|---|---|
| Tap any bill row | BillDetailScreen opens |
| Check | Shop name, owner, phone at top |
| Check | Bill date/time |
| Check | Each line item: product name, qty, unit price, line total |
| Check | Payment mode label (Cash / Udhar) |
| Check | Grand total at bottom matches sum of line items |

---

### TC-503 · Bill Detail — PDF receipt share ✅ 🔁

| Action | Expected |
|---|---|
| Tap share icon (top-right of BillDetailScreen) | OS share sheet opens |
| Share to WhatsApp / save to Files | PDF opens with correct bill content |
| PDF content | Shop header, items table, total, payment mode |
| Empty bill (edge case) | Should not be reachable — bills always have items |

---

## MODULE 6 — Customers

### TC-601 · Customer list — total udhar card 🔁

| Check | Expected |
|---|---|
| "TOTAL OUTSTANDING UDHAR" card | Sum of all customer udhar_balances |
| Customer count badge | Shows correct count |
| Updates after udhar payment is recorded | Card refreshes when screen regains focus |

---

### TC-602 · Customer list — search 🔁

| Input | Expected |
|---|---|
| Type partial name | Matching customers shown |
| Type partial phone | Matching customers shown |
| "XXXXXX" (no match) | Empty list (no error) |
| Clear search | Full list restored |

---

### TC-603 · Customer list — balance colour 🔁

| Scenario | Expected |
|---|---|
| customer.udhar_balance > 0 | Balance shown in red |
| customer.udhar_balance = 0 | Balance shown in green |

---

### TC-604 · Add Customer — all fields ✅ 🔁

| Field | Value |
|---|---|
| Name | "Suresh Patel" |
| Phone | "9123456789" |
| Address | "12 Gandhi Nagar" |
| Action | Save |
| Expected | Customer appears in list; balance = ₹0.00 |

---

### TC-605 · Add Customer — name only (required) ✅ 🔁

| Field | Value |
|---|---|
| Name | "Amit" |
| Phone | blank |
| Address | blank |
| Expected | Saved successfully |

---

### TC-606 · Add Customer — name blank ❌ 🔁

| Action | Expected |
|---|---|
| Leave name blank, tap Save | Validation error / button disabled |

---

### TC-607 · Edit Customer — open screen ✅ 🔁

| Action | Expected |
|---|---|
| Tap any customer row in list | EditCustomerScreen opens |
| Header | "Edit Customer" with back arrow |
| Pre-fill check | Name, phone, address match what was saved |
| Udhar balance card | Shows current balance (red if > 0, green if = 0) |

---

### TC-608 · Edit Customer — update contact details ✅ 🔁

| Action | Expected |
|---|---|
| Change name from "Suresh Patel" to "Suresh P." | Tap Save Changes |
| Alert | "Customer details updated." → OK |
| Return to customer list | Updated name shown |
| Re-enter EditCustomer | New name pre-filled |

---

### TC-609 · Edit Customer — clear phone number ✅ 🔁

| Action | Expected |
|---|---|
| Delete phone number, tap Save | Saved; phone shown as blank in list |

---

### TC-610 · Edit Customer — name blank ❌ 🔁

| Action | Expected |
|---|---|
| Clear name field | Save Changes button becomes disabled (grey) |
| Attempt save | Alert: "Validation. Customer name is required." |

---

### TC-611 · Udhar Balance Card — state when balance > 0 🔁

| Check | Expected |
|---|---|
| Customer has udhar_balance = ₹1,200 | Card background: light red (#FFF1F2) |
| Balance value | "₹ 1,200.00" in red font |
| "Record Payment" button | Visible (green button) |
| Sub-label | "Outstanding amount to collect" |

---

### TC-612 · Udhar Balance Card — state when balance = 0 🔁

| Check | Expected |
|---|---|
| Customer has udhar_balance = 0 | Card background: light green (#ECFDF5) |
| Balance value | "₹ 0.00" in green |
| "All cleared" badge with ✅ | Visible |
| "Record Payment" button | Hidden |

---

### TC-613 · Record Payment — quick chip amounts 🔁

**Pre-condition:** Customer has udhar_balance = ₹800.

| Chip | Expected visibility |
|---|---|
| ₹100 chip | Shown (100 < 800) |
| ₹200 chip | Shown |
| ₹500 chip | Shown |
| ₹1,000 chip | Hidden (1000 > 800) |
| "Full ₹800" chip | Shown (always shown when balance > 0) |

**Pre-condition:** Customer has udhar_balance = ₹150.

| Chip | Expected visibility |
|---|---|
| ₹100 chip | Shown |
| ₹200 chip | Hidden |
| ₹500 chip | Hidden |
| ₹1,000 chip | Hidden |
| "Full ₹150" chip | Shown |

---

### TC-614 · Record Payment — tap quick chip ✅ 🔁

| Action | Expected |
|---|---|
| Tap ₹500 chip | Amount input fills with "500" |
| Tap "Full ₹800" chip | Amount input fills with "800" |
| Input is editable after chip tap | Yes — can still type different value |

---

### TC-615 · Record Payment — valid partial payment ✅ 🔁

**Pre-condition:** Customer udhar = ₹1,200.

| Action | Expected |
|---|---|
| Enter ₹500 → Confirm Payment | Alert: "Payment Recorded ✓ ₹ 500.00 marked as received. Remaining balance: ₹ 700.00" |
| Balance card updates immediately | Shows ₹700.00 (red) |
| Return to customer list | Balance column shows ₹700 |
| Total Udhar card (customer list) | Reduced by ₹500 |

---

### TC-616 · Record Payment — full payment (balance cleared) ✅ 🔁

**Pre-condition:** Customer udhar = ₹300.

| Action | Expected |
|---|---|
| Tap "Full ₹300" chip → Confirm Payment | Alert: "Remaining balance: ₹ 0.00" |
| Balance card | Turns green; "All cleared" badge; Record Payment button hidden |

---

### TC-617 · Record Payment — amount exceeds balance ❌ 🔁

**Pre-condition:** Customer udhar = ₹500.

| Action | Expected |
|---|---|
| Type 600 → Confirm Payment | Alert: "Amount Exceeds Balance. [Name] only owes ₹ 500.00. Enter a lower amount." |
| Payment NOT recorded | Balance unchanged |

---

### TC-618 · Record Payment — zero / blank amount ❌ 🔁

| Action | Expected |
|---|---|
| Leave input blank → Confirm | Alert: "Invalid Amount. Please enter a valid payment amount." |
| Enter 0 → Confirm | Same alert |
| Enter negative (e.g. -100) | Same alert (parseFloat gives negative, fails > 0 check) |

---

### TC-619 · Record Payment — dismiss modal 🔁

| Action | Expected |
|---|---|
| Open payment modal → tap Cancel | Modal closes; balance unchanged |
| Open modal → tap overlay (outside modal) | Modal closes; balance unchanged |

---

### TC-620 · Customer Bill History — bills exist ✅ 🔁

**Pre-condition:** Customer "Ramesh" has 3 udhar bills.

| Check | Expected |
|---|---|
| "BILL HISTORY" section in EditCustomerScreen | Shows up to 10 most recent bills |
| Each row | Date+time, item count, payment mode badge (Cash = green, Udhar = amber), amount |
| Most recent bill at top | Confirm |
| Tap a bill row | Navigates to BillDetailScreen with full receipt |

---

### TC-621 · Customer Bill History — no bills ✅ 🔁

**Pre-condition:** Newly added customer, no bills yet.

| Check | Expected |
|---|---|
| BILL HISTORY section | Shows receipt icon + "No bills recorded for this customer yet" |
| No crash | Confirm |

---

### TC-622 · Balance auto-refreshes after bill 🔁

| Step | Expected |
|---|---|
| 1. Open EditCustomerScreen for Ramesh; balance = ₹700 | Shown |
| 2. Go back → New Bill → select Ramesh → Udhar ₹200 bill → Checkout | Bill saved |
| 3. Return to Customers tab → tap Ramesh again | Balance now ₹900 |

---

## MODULE 7 — Reports

### TC-701 · Reports — Today range ✅ 🔁

| Action | Expected |
|---|---|
| Navigate to Reports tab | Default range = Today |
| Check Total Sales | Sum of all bills with today's date |
| Check Net Profit | SUM(qty × (selling_price_at_sale − purchase_price)) for today's bills |
| Check Cash Sales | Sum of bills with payment_mode = 'cash' |
| Check Udhar | Sum of bills with payment_mode = 'udhar' |
| Check Bill Count | Count of bills today |

**Test with 0 bills today:** All values should be ₹0 / 0.

---

### TC-702 · Reports — Week and Month ranges 🔁

| Action | Expected |
|---|---|
| Tap "This Week" | Stats update to last 7 days |
| Tap "This Month" | Stats update from 1st of current month to today |
| Figures higher than Today | Yes, as they include more days |
| Net Profit | Recalculated for selected range |

---

### TC-703 · Net Profit calculation — accuracy check ✅ 🔁

**Test setup:**
- Product A: purchase_price = ₹10, selling_price = ₹15
- Product B: purchase_price = ₹0, selling_price = ₹50
- Bill 1: 2× Product A → expected margin = 2 × (15 − 10) = ₹10
- Bill 2: 1× Product B → expected margin = 1 × (50 − 0) = ₹50

| Check | Expected |
|---|---|
| Reports Net Profit for today | ₹60 |
| Product B margin | ₹50 (not inflated; 0 purchase_price handled) |

---

### TC-704 · Reports — Top Products table 🔁

| Check | Expected |
|---|---|
| Shows up to 5 products | Top 5 by quantity sold in period |
| Each row | Product name, qty sold, revenue |
| Period with no sales | "No products sold" or empty section |

---

### TC-705 · Reports — Recent Transactions list 🔁

| Check | Expected |
|---|---|
| Shows up to 10 most recent bills | Most recent first |
| Each row | Date/time, customer name / "Walk-in", amount, payment mode |
| Tapping a row | Navigates to BillDetailScreen |

---

### TC-706 · PDF Export — successful generation ✅ 🔁

| Action | Expected |
|---|---|
| Select "This Month" range with some bills | Tap Export PDF button |
| Loading indicator | "Generating PDF…" / spinner shown |
| OS share sheet appears | Share to Files / WhatsApp / email |
| PDF content | Shop header (name, owner, phone), period label, summary stats table, Top 5 Products table, last 10 transactions table, generation timestamp footer |

---

### TC-707 · PDF Export — empty period ❌ 🔁

| Action | Expected |
|---|---|
| Select "Today" when no bills today | Tap Export PDF |
| Expected | Alert: "No data to export. There are no bills in this period." |
| PDF NOT generated | Confirm |

---

### TC-708 · PDF Export — shop name in header 🔁

| Check | Expected |
|---|---|
| Shop name in PDF header | Matches name set in Settings → Shop Info |
| Owner name in PDF header | Matches settings |
| Phone in PDF header | Matches registered phone |

---

## MODULE 8 — Settings

### TC-801 · Shop Info display 🔁

| Check | Expected |
|---|---|
| Shop Name | Matches what was entered at setup |
| Owner Name | Correct |
| Phone | Registered phone number |
| WhatsApp | If entered at setup |
| Category | If entered |
| Cloud Backup status | "Enabled" (☁️ user) or "Disabled" (📱 user) |

---

### TC-802 · Edit Shop — update name ✅ 🔁

| Action | Expected |
|---|---|
| Tap Shop Name row | EditShopScreen opens |
| Change shop name → Save | Updated name shown in Settings; PDF reports use new name |
| HomeScreen header | Reflects updated shop name |

---

### TC-803 · Edit Shop — AI consent toggle ✅

**Cloud user (☁️):**

| Action | Expected |
|---|---|
| Tap AI consent toggle to turn OFF | Confirmation alert (destructive action warning) |
| Confirm | aiConsent set to false; HomeScreen switches to "Low Stock Alerts" on next visit |

**Local user (📱):**

| Action | Expected |
|---|---|
| "Enable Cloud Backup" button visible | Yes |
| Tap it | See TC-808 |

---

### TC-804 · Sync Now — pending items ☁️

**Pre-condition:** Cloud user; some items queued (added while offline).

| Action | Expected |
|---|---|
| View "X items pending" count in Settings | Correct count |
| Tap Sync Now | Spinner shown; queue flushed |
| All synced | Alert: "All X items uploaded successfully." |
| Some failed | Alert: "X items uploaded. Y still pending — they will retry automatically." |
| Nothing to sync | Alert: "All Caught Up. Nothing to sync." |

---

### TC-805 · Sync Now — no network ❌ ☁️

| Action | Expected |
|---|---|
| Disable internet → tap Sync Now | Alert: "X items could not be uploaded. Check your connection and try again." |
| Pending count unchanged | Confirm |

---

### TC-806 · Restore from Cloud ✅ ☁️

| Action | Expected |
|---|---|
| Tap "Restore from Cloud" | Confirmation alert |
| Confirm → network available | Alert: "Restore Complete. Restored: X products, Y customers, Z bills…" |
| Data appears in respective tabs | Confirm |

---

### TC-807 · Restore from Cloud — no network ❌ ☁️

| Action | Expected |
|---|---|
| Disable internet → Restore from Cloud | Alert: "Restore Failed. Could not connect to cloud. Check your internet connection and try again." |

---

### TC-808 · Enable Cloud Backup (Local → Cloud) ✅ 📱

| Action | Expected |
|---|---|
| Tap "Enable Cloud Backup" | Confirmation alert explaining what will happen |
| Tap Enable | "Uploading X items…" label shown; spinner |
| Success | Alert: "Cloud Backup Enabled. Your data has been uploaded. Future changes will sync automatically." |
| Return to Settings | Cloud Backup status now shows "Enabled" |
| HomeScreen | Now shows "AI Reorder Insights" instead of "Low Stock Alerts" |

---

### TC-809 · Export Backup (JSON) ✅ 🔁

| Action | Expected |
|---|---|
| Tap "Export Backup" | Privacy warning alert shown first |
| Tap "Export Anyway" | OS share sheet opens with .json file |
| File name | `pragati_bandhu_backup_YYYYMMDD.json` |
| File content | Valid JSON with products, customers, bills arrays |

---

### TC-810 · Export Backup — privacy warning cancel ✅ 🔁

| Action | Expected |
|---|---|
| Tap "Export Backup" → tap Cancel on privacy alert | No file created; no share sheet |

---

### TC-811 · Import Backup — same shop phone ✅ 🔁

**Pre-condition:** Export a backup from the same phone number.

| Action | Expected |
|---|---|
| Tap "Import Backup" → pick the .json file | Data imported silently; products/customers/bills restored |
| Alert | "Import Complete" with restored counts |

---

### TC-812 · Import Backup — different shop phone ❌ 🔁

**Pre-condition:** Use a backup file from a different shop/phone.

| Action | Expected |
|---|---|
| Pick file | Alert: "This backup belongs to a different shop. Import anyway?" (destructive confirmation) |
| Cancel | No import |
| Import Anyway | Data imported with explicit consent |

---

### TC-813 · Delete All Data ❌ 🔁

| Action | Expected |
|---|---|
| Tap "Delete Everything" | Double-confirmation alert (destructive) |
| Confirm | All local data cleared; user returned to Login or ShopSetup |
| Verify | Products, customers, bills all gone |

**⚠️ Test this last — it wipes the device.**

---

### TC-814 · Manage Categories — add ✅ 🔁

| Action | Expected |
|---|---|
| Tap Manage Categories | ManageCategoriesScreen opens |
| Tap + / Add Category | Input field shown |
| Enter "Dairy" → Save | "Dairy" appears in category list |
| Go to Add Product | "Dairy" available in category dropdown |

---

### TC-815 · Manage Categories — delete ✅ 🔁

| Action | Expected |
|---|---|
| Delete "Dairy" category | Removed from list |
| Existing products with "Dairy" | Category field becomes empty/null; product not deleted |

---

### TC-816 · Manage Brands — add and delete ✅ 🔁

Same flow as TC-814 / TC-815 but for brands.

---

### TC-817 · Help Center, Privacy Policy, Terms of Service 🔁

| Screen | Expected |
|---|---|
| Tap Help Center | HelpCenterScreen opens; static content shown; no crash |
| Tap Privacy Policy | PrivacyPolicyScreen opens |
| Tap Terms of Service | TermsOfServiceScreen opens |
| Back navigation | Returns to Settings |

---

### TC-818 · Logout ✅ 🔁

| Action | Expected |
|---|---|
| Tap Logout → confirm | User returned to LoginScreen |
| Local data | Remains in SQLite (not deleted) |
| Re-login same number | Shop data still present |

---

### TC-819 · Debug Export (Easter Egg) 🔁

| Action | Expected |
|---|---|
| Tap app version number 5× | Alert: "Debug Mode. Export Local Data button is now visible." |
| Tap "Export Local Data" | SQL dump shared via OS share sheet |
| Format | Plain text SQL statements |

---

## MODULE 9 — Cloud Sync Behaviour

### TC-901 · Offline write → online sync ☁️

| Step | Expected |
|---|---|
| 1. Disable internet | — |
| 2. Add a new product | Saved to SQLite; added to sync_queue |
| 3. Enable internet | — |
| 4. Settings → Sync Now | Product synced to Supabase |
| 5. Verify on another device (same account, after restore) | Product appears |

---

### TC-902 · Sync count badge accuracy ☁️

| Step | Expected |
|---|---|
| Offline: add 3 products, 2 customers | Sync pending count = 5 |
| Go online → Sync Now | All 5 synced; count drops to 0 |

---

### TC-903 · Auto-restore banner on first login (new device) ☁️

| Action | Expected |
|---|---|
| Log in on a fresh device with same phone number that has cloud data | Blue "Restoring your data from cloud…" banner visible at top while restore runs |
| Banner disappears | After restore completes |
| Data present | All products/customers/bills from cloud now in SQLite |

---

## MODULE 10 — Cross-Feature / Edge Cases

### TC-1001 · Bill → stock deduction 🔁

| Action | Expected |
|---|---|
| Product "Rice 5kg" has stock = 20 | Create bill with 3× Rice 5kg |
| After checkout | Stock = 17 in Products tab |
| Low stock threshold = 18 | Dashboard now shows Rice in Low Stock Alerts |

---

### TC-1002 · Udhar bill → customer balance increase 🔁

| Action | Expected |
|---|---|
| Ramesh has udhar = ₹700 | Create udhar bill for ₹300 |
| After checkout | Ramesh's balance = ₹1,000 |
| Record payment of ₹1,000 (full) | Balance = ₹0; "All cleared" badge |

---

### TC-1003 · Delete customer with outstanding udhar 🔁

| Action | Expected |
|---|---|
| Customer has udhar_balance > 0 | Attempt to delete |
| Expected | Confirm whether app blocks or allows (verify behaviour — no specific guard currently) |

---

### TC-1004 · useFocusEffect refresh on tab switch 🔁

| Action | Expected |
|---|---|
| Open Products list; note stock of "Salt" = 50 | — |
| Go to Billing → sell 5× Salt → checkout | — |
| Return to Products tab | Salt stock = 45 (auto-refreshed) |
| Return to Home tab | Today's Sales updated |
| Return to Customers tab | Udhar balances current |

---

### TC-1005 · Very long product name / customer name 🔁

| Input | Expected |
|---|---|
| Product name 80+ characters | Saved; long name truncated with ellipsis in list cards |
| Customer name 80+ characters | Saved; truncated in list |
| PDF receipt with long name | Name wraps or truncates gracefully |

---

### TC-1006 · Large numbers in currency 🔁

| Input | Expected |
|---|---|
| Selling price = ₹10,00,000 (10 lakh) | Saved correctly |
| Bill with this product | Grand total shows ₹10,00,000.00 in Indian number format |
| Reports | Net Profit / Total Sales formatted correctly |

---

### TC-1007 · Multiple bills in same second (ID collision) 🔁

| Action | Expected |
|---|---|
| Create 3 bills very quickly in succession | All 3 saved with unique IDs (genId uses Date.now + random) |
| Bills screen | All 3 visible |

---

## Known Gaps (Do Not File as Bugs — Document in Test Notes)

These are documented open items per AUDIT.md. Do not fail test runs for these:

| Gap | Status |
|---|---|
| Notification bell does nothing | Known — AUDIT 4.1 |
| No WhatsApp / WATI alert | Known — AUDIT 1.2 |
| AI Suggestions is threshold-based, not real AI (Cloud users) | Known — AUDIT 1.1 |
| No sort/filter on customer list | Known — AUDIT 4.6 |
| No "Disable Cloud Sync" option (only Delete Everything) | Known — AUDIT 4.3 |
| No plan enforcement (Basic vs Standard) | Known — AUDIT 5 |
| No UPI payment mode | Known — AUDIT 3.2 |
| No trend indicators on Stats cards | Known — AUDIT 3.3 |
| Dark mode toggle not visible | Known — AUDIT 4.8 |

---

## Test Execution Checklist

Use this before each release build:

- [ ] TC-101 to TC-108 — Auth flow
- [ ] TC-201 to TC-205 — Dashboard
- [ ] TC-301 to TC-310 — Products
- [ ] TC-401 to TC-411 — Billing
- [ ] TC-501 to TC-503 — Bills History
- [ ] TC-601 to TC-622 — Customers
- [ ] TC-701 to TC-708 — Reports
- [ ] TC-801 to TC-819 — Settings
- [ ] TC-901 to TC-903 — Cloud Sync (cloud user only)
- [ ] TC-1001 to TC-1007 — Edge Cases

**Total test cases: 87**
