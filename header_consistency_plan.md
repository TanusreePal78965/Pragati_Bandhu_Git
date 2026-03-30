# Header Consistency Analysis & Plan

An audit of the header sections across all screens revealed significant inconsistencies in structure, branding, and styling. While a `ScreenHeader` component exists, it is underutilized, with most screens implementing ad-hoc headers.

## Current Inconsistencies

| Screen | Header Implementation | Branding | Sync Badge | Actions |
| :--- | :--- | :--- | :--- | :--- |
| **Home** | Inline `View` | "Pragati General Store" | Text + Icon (Below name) | Notification |
| **Customers** | Inline `View` | None | Badge (Right of title) | None |
| **Products** | Ad-hoc `navBar` + `header` | "Pragati Bandhu" | None | Notification + Avatar |
| **Reports** | `ScreenHeader` component | None | None | None |
| **Settings** | Inline `View` | None | None | Back button |
| **Add Product** | Inline `renderHeader()` | "PRAGATI BANDHU" (badge) | None | Back button |

## Issues identified
1. **Naming Inconsistency**: The app uses both "Pragati General Store" and "Pragati Bandhu".
2. **Visual Hierarchy**: `ProductsScreen` has a redundant double-header.
3. **Component Duplication**: Similar UI code is repeated across 5+ screens instead of using `ScreenHeader`.
4. **Style Variance**: Font sizes, weights, and spacing for titles and back buttons vary between screens (e.g., `colors.text` vs `colors.primary` for back icons).

## Proposed Solution

### 1. Enhance `ScreenHeader.tsx`
Update the common component to support:
- `isMainTab`: To show shop branding instead of a back button.
- `showSyncBadge`: To show the "SYNCED" status consistently.
- `shopName`: To display the shop's name.
- `onNotificationPress`: To handle notification clicks.

### 2. Standardize Header Types

#### Type A: Main Dashboard Header (Home, Products, Customers, Reports)
Shows Shop Logo, Shop Name, Sync Status, and Notification/Profile.
*Requirement*: Title should be integrated or placed in a secondary header if needed (e.g., ProductsScreen).

#### Type B: Sub-page Header (AddProduct, Settings, ManageCategories)
Shows Back button, Screen Title, and optional Right Action.

## Implementation Plan

1. **Update `ScreenHeader.tsx`** to be more flexible.
2. **Refactor `HomeScreen.tsx`** to use the updated `ScreenHeader`.
3. **Refactor `ProductsScreen.tsx`** to remove the redundant `navBar` and use `ScreenHeader`.
4. **Refactor `CustomersScreen.tsx`** to use `ScreenHeader`.
5. **Refactor `SettingsScreen.tsx`** to use `ScreenHeader`.
6. **Refactor `AddProductScreen.tsx`** to use `ScreenHeader`.

---

> [!IMPORTANT]
> Should the app consistently use "Pragati Bandhu" as the brand name, or should "Pragati General Store" be used for the dummy shop name? I recommend sticking to one style.
