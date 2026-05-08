# Maestro E2E Testing — Implementation Guide

Maestro is a YAML-based mobile E2E framework that works well with Expo/React Native on Android
emulators and real devices. Auth tests are skipped (OTP requires real SMS); all flows assume the
app is already logged in (session stored in AsyncStorage).

---

## Prerequisites

```bash
# Install Maestro CLI (macOS/Linux)
curl -Ls "https://get.maestro.mobile.dev" | bash

# Start Android emulator, then build & install the app
cd mobile
npx expo run:android

# Manually log in once to seed the session in AsyncStorage,
# then all flows below can run without re-authenticating.
```

---

## Folder Structure

```
mobile/
└── .maestro/
    ├── config.yaml              # shared appId
    ├── flows/
    │   ├── 01_home.yaml
    │   ├── 02_add_product.yaml
    │   ├── 03_create_bill.yaml
    │   ├── 04_add_customer.yaml
    │   ├── 05_products_search.yaml
    │   └── 06_settings_navigation.yaml
    └── utils/
        └── navigate_home.yaml   # reusable sub-flow
```

### config.yaml
```yaml
appId: com.pragatibandhu.app
```

---

## Step 1 — Add testID Props

Before writing flows, add `testID` to every interactive element the flows need.

### BottomTabNavigator (`src/navigation/BottomTabNavigator.tsx`)
Add `testID` to each tab button:
- `tab-home`, `tab-inventory`, `tab-customers`, `tab-reports`, `tab-settings`

### HomeScreen (`src/screens/home/HomeScreen.tsx`)
| Element | testID |
|---------|--------|
| Root View | `home-screen` |
| Today's sales card | `stat-total-sales` |
| Low-stock card | `stat-low-stock` |
| New Bill FAB | `fab-new-bill` |

### ProductsScreen (`src/screens/products/ProductsScreen.tsx`)
| Element | testID |
|---------|--------|
| Root View | `products-screen` |
| Search input | `search-input` |
| Add Product FAB | `fab-add-product` |
| Each list row | `product-item-{id}` (dynamic) |

### AddProductScreen / EditProductScreen
| Element | testID |
|---------|--------|
| Name input | `input-product-name` |
| Selling price input | `input-selling-price` |
| Stock qty input | `input-stock-qty` |
| Save button | `btn-save-product` |

### NewBillScreen (`src/screens/billing/NewBillScreen.tsx`)
| Element | testID |
|---------|--------|
| Product search | `input-product-search` |
| Cash button | `btn-payment-cash` |
| UPI button | `btn-payment-upi` |
| Udhar button | `btn-payment-udhar` |
| Confirm button | `btn-confirm-bill` |

### BillsScreen / BillDetailScreen
| Element | testID |
|---------|--------|
| BillsScreen root | `bills-screen` |
| Search input | `search-input` |
| Bill total | `bill-total` |
| Share PDF button | `btn-share-pdf` |

### CustomersScreen (`src/screens/customers/CustomersScreen.tsx`)
| Element | testID |
|---------|--------|
| Root View | `customers-screen` |
| Search input | `search-input` |
| Add Customer FAB | `fab-add-customer` |

### AddCustomerScreen
| Element | testID |
|---------|--------|
| Name input | `input-customer-name` |
| Phone input | `input-customer-phone` |
| Save button | `btn-save-customer` |

### SettingsScreen (`src/screens/settings/SettingsScreen.tsx`)
| Element | testID |
|---------|--------|
| Root View | `settings-screen` |
| Logout button | `btn-logout` |

---

## Step 2 — Flow Files

### utils/navigate_home.yaml
```yaml
- tapOn:
    id: "tab-home"
- assertVisible:
    id: "home-screen"
```

### 01_home.yaml
```yaml
appId: com.pragatibandhu.app
---
- launchApp
- assertVisible:
    id: "home-screen"
- assertVisible:
    id: "stat-total-sales"
- assertVisible:
    id: "fab-new-bill"
```

### 02_add_product.yaml
```yaml
appId: com.pragatibandhu.app
---
- launchApp
- tapOn:
    id: "tab-inventory"
- assertVisible:
    id: "products-screen"
- tapOn:
    id: "fab-add-product"
- tapOn:
    id: "input-product-name"
- inputText: "Test Product E2E"
- tapOn:
    id: "input-selling-price"
- inputText: "99"
- tapOn:
    id: "input-stock-qty"
- inputText: "10"
- tapOn:
    id: "btn-save-product"
- assertVisible: "Test Product E2E"
```

### 03_create_bill.yaml
```yaml
appId: com.pragatibandhu.app
---
- launchApp
- assertVisible:
    id: "home-screen"
- tapOn:
    id: "fab-new-bill"
- tapOn:
    id: "input-product-search"
- inputText: "Test Product E2E"
- tapOn: "Test Product E2E"
- tapOn:
    id: "btn-payment-cash"
- tapOn:
    id: "btn-confirm-bill"
- assertVisible:
    id: "bills-screen"
```

### 04_add_customer.yaml
```yaml
appId: com.pragatibandhu.app
---
- launchApp
- tapOn:
    id: "tab-customers"
- assertVisible:
    id: "customers-screen"
- tapOn:
    id: "fab-add-customer"
- tapOn:
    id: "input-customer-name"
- inputText: "E2E Customer"
- tapOn:
    id: "input-customer-phone"
- inputText: "9999999999"
- tapOn:
    id: "btn-save-customer"
- assertVisible: "E2E Customer"
```

### 05_products_search.yaml
```yaml
appId: com.pragatibandhu.app
---
- launchApp
- tapOn:
    id: "tab-inventory"
- tapOn:
    id: "search-input"
- inputText: "Test Product"
- assertVisible: "Test Product E2E"
- clearText
- assertVisible:
    id: "products-screen"
```

### 06_settings_navigation.yaml
```yaml
appId: com.pragatibandhu.app
---
- launchApp
- tapOn:
    id: "tab-settings"
- assertVisible:
    id: "settings-screen"
- assertVisible:
    id: "btn-logout"
# Do NOT tap btn-logout — it would clear the session
```

---

## Running Tests

```bash
# Run a single flow
maestro test mobile/.maestro/flows/01_home.yaml

# Run all flows
maestro test mobile/.maestro/flows/

# Run with video recording
maestro record mobile/.maestro/flows/02_add_product.yaml
```

---

## Notes

- **Auth is not tested** — the OTP flow requires real SMS. Run tests on a device/emulator
  that has been manually logged in at least once.
- **Test data** — flows 02 and 04 create a "Test Product E2E" product and "E2E Customer".
  Run them before flows 03 and 05 which depend on that data.
- **New Arch** — the app uses React Native New Architecture (`newArchEnabled: true`).
  Maestro 1.38+ handles New Arch correctly; keep the CLI up to date.
- **CI** — Maestro Cloud (`maestro cloud`) can run flows on hosted Android devices in CI
  without managing emulators locally.
