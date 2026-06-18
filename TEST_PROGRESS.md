# Pragati Bandhu — Feature Test Progress Tracker
> Device: CPH2487 · ADB: `192.168.29.212:38113`  
> Total Test Cases: 96 across 10 Modules  
> Last Updated: 2026-06-02

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ PASS | Test executed and passed |
| ❌ FAIL | Test executed and failed — see notes |
| ⚠️ BLOCKED | Cannot test — prerequisite or environment issue |
| ⏭ SKIP | Intentionally skipped — not applicable |
| 🔲 PENDING | Not yet tested |

---

## Overall Progress Summary

| Module | Total TCs | ✅ Pass | ❌ Fail | ⚠️ Blocked | 🔲 Pending |
|---|---|---|---|---|---|
| M1 – Authentication | 8 | 0 | 0 | 8 | 0 |
| M2 – Dashboard | 5 | 0 | 0 | 0 | 5 |
| M3 – Products | 10 | 5 | 0 | 4 | 1 |
| M4 – Billing | 11 | 2 | 0 | 0 | 9 |
| M5 – Bills History | 3 | 0 | 0 | 0 | 3 |
| M6 – Customers | 22 | 1 | 0 | 0 | 21 |
| M7 – Reports | 8 | 0 | 0 | 0 | 8 |
| M8 – Settings | 19 | 0 | 0 | 0 | 19 |
| M9 – Cloud Sync | 3 | 0 | 0 | 0 | 3 |
| M10 – Edge Cases | 7 | 0 | 0 | 0 | 7 |
| **TOTAL** | **96** | **7** | **0** | **8** | **81** |

> **7 / 96 tests completed (7.3%)**

---

## MODULE 1 — Authentication & Onboarding

> ⚠️ **All 8 tests BLOCKED** — Requires real SMS OTP delivery. Cannot be automated without a test phone number or SMS mock.

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-101 | Login — valid phone number | 🔁 | ⚠️ BLOCKED | Requires live OTP |
| TC-102 | Login — invalid/short number (UI disabled state) | ❌ | ⚠️ BLOCKED | Needs login screen visible |
| TC-103 | OTP — correct code | ✅ | ⚠️ BLOCKED | Requires live OTP |
| TC-104 | OTP — wrong code error | ❌ | ⚠️ BLOCKED | Requires live OTP |
| TC-105 | Shop Setup — cloud consent ON | ☁️ | ⚠️ BLOCKED | Requires fresh onboarding |
| TC-106 | Shop Setup — local only | 📱 | ⚠️ BLOCKED | Requires fresh onboarding |
| TC-107 | Shop Setup — required fields missing | ❌ | ⚠️ BLOCKED | Requires fresh onboarding |
| TC-108 | Change Number (back from Setup) | 🔁 | ⚠️ BLOCKED | Requires active OTP session |

---

## MODULE 2 — Home / Dashboard

> **Status: 0 / 5 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-201 | Dashboard loads with real data | 🔁 | 🔲 PENDING | |
| TC-202 | AI Reorder Insights card (Cloud user) | ☁️ | 🔲 PENDING | |
| TC-203 | Low Stock Alerts card (Local user) | 📱 | 🔲 PENDING | |
| TC-204 | Dashboard — no low-stock items | 🔁 | 🔲 PENDING | |
| TC-205 | Notification bell — does nothing | ❌ | 🔲 PENDING | Known gap, verify no crash |

---

## MODULE 3 — Products / Inventory

> **Status: 5 / 10 complete · 4 blocked (automation) · 1 pending**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-301 | Add Product — all fields | ✅ | ✅ PASS | "Tata Salt 1kg" created, verified in list |
| TC-302 | Add Product — required fields only | ✅ | ✅ PASS | "Demo Product" (name + selling price) saved successfully |
| TC-303 | Add Product — validation failures | ❌ | ⚠️ BLOCKED | Automation failure — app does fire validation ("Please enter a valid selling price" confirmed from screenshots). Name-blank path needs clean manual retest |
| TC-304 | Products list — search | 🔁 | ✅ PASS | Search for "Salt" correctly filtered |
| TC-305 | Edit Product — pre-fill check | ✅ | ✅ PASS | Fields pre-filled correctly |
| TC-306 | Edit Product — change price | ✅ | ✅ PASS | Price updated from ₹22 → ₹25 |
| TC-307 | Edit Product — clear category/brand | ✅ | ⚠️ BLOCKED | Automation failure — script opened Add New Product instead of Edit (FAB fallback fired). Dal chip deselect and Update Product flow confirmed working from v1 screenshots. Needs retest with reliable pencil detection |
| TC-308 | Edit Product — non-standard UOM | ✅ | ⚠️ BLOCKED | Automation failure — script on wrong screen (Add vs Edit). UOM section with "Custom" chip IS present in app (confirmed from screenshot). Needs clean retest |
| TC-309 | Delete Product — single item | ✅ | ⚠️ BLOCKED | Automation failure — cascaded from TC-307/308 state mess; Demo Product lost. Needs clean inventory state |
| TC-310 | Delete Product — used in past bills | 🔁 | 🔲 PENDING | Tata Salt 1kg inventory state unknown after runs — retest needed |

---

## MODULE 4 — Billing

> **Status: 2 / 11 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-401 | New Bill — cash, walk-in customer | ✅ | ✅ PASS | Completed in first run |
| TC-402 | New Bill — qty increase / decrease | ✅ | 🔲 PENDING | |
| TC-403 | New Bill — udhar + customer selected | ✅ | ✅ PASS | Ramesh Kumar selected, bill saved |
| TC-404 | New Bill — udhar, no customer ❌ | ❌ | 🔲 PENDING | Should show "Customer Required" |
| TC-405 | New Bill — empty bill checkout ❌ | ❌ | 🔲 PENDING | Should show "Empty Bill" alert |
| TC-406 | ESTIMATE preview, with items | ✅ | 🔲 PENDING | |
| TC-407 | ESTIMATE preview, empty bill ❌ | ❌ | 🔲 PENDING | |
| TC-408 | ESTIMATE → Checkout | ✅ | 🔲 PENDING | |
| TC-409 | Product search behaviour | 🔁 | 🔲 PENDING | 1-char, 2+ chars, no match |
| TC-410 | Clear all items | ✅ | 🔲 PENDING | |
| TC-411 | Customer search in modal | ✅ | 🔲 PENDING | |

---

## MODULE 5 — Bills History

> **Status: 0 / 3 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-501 | Bills list — all bills shown | 🔁 | 🔲 PENDING | |
| TC-502 | Bill Detail — content correctness | ✅ | 🔲 PENDING | |
| TC-503 | Bill Detail — PDF share | ✅ | 🔲 PENDING | Requires OS share sheet interaction |

---

## MODULE 6 — Customers

> **Status: 1 / 22 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-601 | Customer list — total udhar card | 🔁 | 🔲 PENDING | |
| TC-602 | Customer list — search | 🔁 | 🔲 PENDING | |
| TC-603 | Customer list — balance colour | 🔁 | 🔲 PENDING | Red if >0, green if =0 |
| TC-604 | Add Customer — all fields | ✅ | ✅ PASS | "Ramesh Kumar" created successfully |
| TC-605 | Add Customer — name only | ✅ | 🔲 PENDING | |
| TC-606 | Add Customer — name blank ❌ | ❌ | 🔲 PENDING | |
| TC-607 | Edit Customer — open screen | ✅ | 🔲 PENDING | |
| TC-608 | Edit Customer — update details | ✅ | 🔲 PENDING | |
| TC-609 | Edit Customer — clear phone | ✅ | 🔲 PENDING | |
| TC-610 | Edit Customer — name blank ❌ | ❌ | 🔲 PENDING | |
| TC-611 | Udhar Balance Card — balance > 0 | 🔁 | 🔲 PENDING | Ramesh has udhar from TC-403 |
| TC-612 | Udhar Balance Card — balance = 0 | 🔁 | 🔲 PENDING | |
| TC-613 | Record Payment — quick chips visibility | 🔁 | 🔲 PENDING | |
| TC-614 | Record Payment — tap chip fills input | ✅ | 🔲 PENDING | |
| TC-615 | Record Payment — partial payment | ✅ | 🔲 PENDING | |
| TC-616 | Record Payment — full payment | ✅ | 🔲 PENDING | |
| TC-617 | Record Payment — exceeds balance ❌ | ❌ | 🔲 PENDING | |
| TC-618 | Record Payment — zero/blank ❌ | ❌ | 🔲 PENDING | |
| TC-619 | Record Payment — dismiss modal | 🔁 | 🔲 PENDING | |
| TC-620 | Customer Bill History — bills exist | ✅ | 🔲 PENDING | |
| TC-621 | Customer Bill History — no bills | ✅ | 🔲 PENDING | |
| TC-622 | Balance auto-refreshes after bill | 🔁 | 🔲 PENDING | |

---

## MODULE 7 — Reports

> **Status: 0 / 8 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-701 | Reports — Today range | ✅ | 🔲 PENDING | |
| TC-702 | Reports — Week and Month ranges | 🔁 | 🔲 PENDING | |
| TC-703 | Net Profit calculation accuracy | ✅ | 🔲 PENDING | |
| TC-704 | Top Products table | 🔁 | 🔲 PENDING | |
| TC-705 | Recent Transactions list | 🔁 | 🔲 PENDING | |
| TC-706 | PDF Export — successful | ✅ | 🔲 PENDING | |
| TC-707 | PDF Export — empty period ❌ | ❌ | 🔲 PENDING | |
| TC-708 | PDF Export — shop name in header | 🔁 | 🔲 PENDING | |

---

## MODULE 8 — Settings

> **Status: 0 / 19 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-801 | Shop Info display | 🔁 | 🔲 PENDING | |
| TC-802 | Edit Shop — update name | ✅ | 🔲 PENDING | |
| TC-803 | Edit Shop — AI consent toggle | ✅ | 🔲 PENDING | |
| TC-804 | Sync Now — pending items | ☁️ | 🔲 PENDING | |
| TC-805 | Sync Now — no network ❌ | ❌ ☁️ | 🔲 PENDING | |
| TC-806 | Restore from Cloud | ✅ ☁️ | 🔲 PENDING | |
| TC-807 | Restore from Cloud — no network ❌ | ❌ ☁️ | 🔲 PENDING | |
| TC-808 | Enable Cloud Backup (Local→Cloud) | ✅ 📱 | 🔲 PENDING | |
| TC-809 | Export Backup (JSON) | ✅ | 🔲 PENDING | |
| TC-810 | Export Backup — privacy cancel | ✅ | 🔲 PENDING | |
| TC-811 | Import Backup — same phone | ✅ | 🔲 PENDING | |
| TC-812 | Import Backup — different phone ❌ | ❌ | 🔲 PENDING | |
| TC-813 | Delete All Data ❌ | ❌ | 🔲 PENDING | ⚠️ Run LAST — wipes device |
| TC-814 | Manage Categories — add | ✅ | 🔲 PENDING | |
| TC-815 | Manage Categories — delete | ✅ | 🔲 PENDING | |
| TC-816 | Manage Brands — add/delete | ✅ | 🔲 PENDING | |
| TC-817 | Help Center / Privacy / Terms | 🔁 | 🔲 PENDING | |
| TC-818 | Logout | ✅ | 🔲 PENDING | |
| TC-819 | Debug Export (Easter Egg) | 🔁 | 🔲 PENDING | Tap version 5× |

---

## MODULE 9 — Cloud Sync Behaviour

> **Status: 0 / 3 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-901 | Offline write → online sync | ☁️ | 🔲 PENDING | Toggle airplane mode on device |
| TC-902 | Sync count badge accuracy | ☁️ | 🔲 PENDING | |
| TC-903 | Auto-restore banner (new device login) | ☁️ | 🔲 PENDING | Requires second device or app reset |

---

## MODULE 10 — Cross-Feature / Edge Cases

> **Status: 0 / 7 complete**

| ID | Description | Type | Status | Notes |
|---|---|---|---|---|
| TC-1001 | Bill → stock deduction verified in inventory | 🔁 | 🔲 PENDING | |
| TC-1002 | Udhar bill → customer balance increase | 🔁 | 🔲 PENDING | Build on TC-403 baseline |
| TC-1003 | Delete customer with outstanding udhar | 🔁 | 🔲 PENDING | Document actual behaviour |
| TC-1004 | useFocusEffect refresh on tab switch | 🔁 | 🔲 PENDING | |
| TC-1005 | Very long product/customer names | 🔁 | 🔲 PENDING | |
| TC-1006 | Large currency numbers (₹10 lakh) | 🔁 | 🔲 PENDING | |
| TC-1007 | Multiple bills in same second (ID collision) | 🔁 | 🔲 PENDING | |

---

## Known Gaps (Do Not File as Bugs)

| Gap | AUDIT Ref |
|---|---|
| Notification bell does nothing | AUDIT 4.1 |
| No WhatsApp / WATI alert | AUDIT 1.2 |
| AI Suggestions is threshold-based, not real AI | AUDIT 1.1 |
| No sort/filter on customer list | AUDIT 4.6 |
| No "Disable Cloud Sync" option | AUDIT 4.3 |
| No plan enforcement (Basic vs Standard) | AUDIT 5 |
| No UPI payment mode | AUDIT 3.2 |
| No trend indicators on Stats cards | AUDIT 3.3 |
| Dark mode toggle not visible | AUDIT 4.8 |

---

## Test Run Log

| Date | Run # | Modules Covered | ✅ Passed | ❌ Failed | ⚠️ Blocked | Notes |
|---|---|---|---|---|---|---|
| 2026-06-01 | Run 1 | M3, M4, M6 | 7 | 0 | 0 | First ADB run. TC-301/304/305/306/401/403/604 PASS |
| 2026-06-02 | Run 2 (v1) | M3 remaining | 0 | 6 | 0 | All 6 failed — script bugs: search bar contamination, wrong chip text ("Other" vs "Custom"), dialogs not dismissed |
| 2026-06-02 | Run 3 (v2) | M3 remaining | 1 | 0 | 4 | TC-302 ✅ PASS. TC-303/307/308/309 ⚠️ BLOCKED — FAB fallback wrong coords, pencil icon detection unreliable. App validation confirmed working from screenshots. TC-310 still PENDING |

---

## Next Session — Recommended Order

1. **[ ] M3 (remaining)** — TC-303 (manual), TC-307, TC-308, TC-309, TC-310 (need reliable pencil/FAB detection fix)
2. **[ ] M4 (remaining)** — TC-402, TC-404, TC-405, TC-406, TC-407, TC-408, TC-409, TC-410, TC-411
3. **[ ] M2 Dashboard** — TC-201 through TC-205
4. **[ ] M5 Bills History** — TC-501, TC-502, TC-503
5. **[ ] M6 Customers (remaining)** — TC-601 through TC-622
6. **[ ] M7 Reports** — TC-701 through TC-708
7. **[ ] M8 Settings** — TC-801 through TC-818 (TC-813 last!)
8. **[ ] M10 Edge Cases** — TC-1001 through TC-1007
9. **[ ] M9 Cloud Sync** — TC-901 through TC-903
10. **[ ] M1 Authentication** — TC-101 through TC-108 (requires live OTP)
