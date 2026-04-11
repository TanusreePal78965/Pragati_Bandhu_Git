# Pragati Bandhu — Login Mechanism (Dev Mode, SMS-Free)

## Context

Building a proper login backbone now — backend routes, JWT sessions, AuthContext, conditional navigation — but **skipping real SMS** since there are no real users yet (sole developer testing).

During dev, the OTP is returned directly in the API response and auto-filled on the OTP screen. When real users arrive, swapping in Fast2SMS is a one-function change in the backend route.

---

## Architecture

```
[LoginScreen] → POST /api/auth/send-otp { phone }
                    → generate 6-digit OTP
                    → log to console
                    ← { success: true, __dev_otp: "123456" }  ← auto-filled on screen

[OtpScreen]  → POST /api/auth/verify-otp { phone, otp }
                  → verify against in-memory store (10-min TTL)
                  ← { token }  ← JWT, 30-day expiry

[ShopSetup]  → save shop data to SQLite + AsyncStorage
             → AuthContext.completeSetup() → MainTabs renders

[App launch] → read JWT from AsyncStorage
             → valid? → MainTabs   |   missing/expired? → LoginScreen
```

---

## Files to Create / Modify

### Backend

| File | Action |
|---|---|
| `backend/package.json` | Add `jsonwebtoken` |
| `backend/.env.example` | Add `JWT_SECRET` entry |
| `backend/.env` | Add `JWT_SECRET=dev-secret-change-in-prod` |
| `backend/src/routes/auth.js` | Create — `send-otp` + `verify-otp` (no SMS, OTP in response) |
| `backend/src/middleware/auth.js` | Create — JWT verify middleware (ready for future routes) |
| `backend/src/index.js` | Mount `/api/auth` routes |

### Mobile

| File | Action |
|---|---|
| `mobile/package.json` | Add `axios`, `jwt-decode` |
| `mobile/src/api/client.ts` | Create — axios instance with base URL + JWT interceptor |
| `mobile/src/services/authService.ts` | Create — `sendOtp()`, `verifyOtp()`, `getStoredAuth()`, `logout()` |
| `mobile/src/utils/storage.ts` | Add `setAuthToken`, `getAuthToken`, `clearAuthToken`, `setShopInfo`, `getShopInfo` |
| `mobile/src/context/AuthContext.tsx` | Create — `isReady`, `isAuthenticated`, `login()`, `logout()`, `completeSetup()` |
| `mobile/App.tsx` | Wrap with `<AuthProvider>` |
| `mobile/src/navigation/RootNavigator.tsx` | Conditional render: `Auth` stack vs `MainTabs` stack based on `isAuthenticated` |
| `mobile/src/screens/auth/LoginScreen.tsx` | Call `sendOtp()`, show error states, re-enable validation |
| `mobile/src/screens/auth/OtpScreen.tsx` | Call `verifyOtp()`, auto-fill OTP from `__dev_otp` in response |
| `mobile/src/screens/auth/ShopSetupScreen.tsx` | Save shop to SQLite + AsyncStorage, call `completeSetup()` |
| `mobile/src/db/sqlite.ts` | Add `shop` table |
| `mobile/src/db/db.ts` | Add `insertShop()`, `getShop()` |

---

## Step-by-Step Implementation

---

### Step 1 — Backend: Auth Routes (no SMS)

**`backend/package.json`** — add:
```json
"jsonwebtoken": "^9.0.2"
```

**`backend/src/routes/auth.js`**:
```js
const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

// In-memory OTP store: Map<phone, { otp, expiresAt }>
const otpStore = new Map();

// POST /api/auth/send-otp
router.post('/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: 'Valid 10-digit phone number required' });
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { otp, expiresAt: Date.now() + 10 * 60 * 1000 });

  // DEV: log OTP + return it in response. 
  // PROD: replace this block with Fast2SMS call, remove __dev_otp from response.
  console.log(`[DEV] OTP for ${phone}: ${otp}`);
  res.json({ success: true, __dev_otp: otp });
});

// POST /api/auth/verify-otp
router.post('/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  const record = otpStore.get(phone);
  if (!record) return res.status(400).json({ error: 'OTP not found or expired' });
  if (Date.now() > record.expiresAt) {
    otpStore.delete(phone);
    return res.status(400).json({ error: 'OTP expired' });
  }
  if (record.otp !== otp) return res.status(400).json({ error: 'Incorrect OTP' });

  otpStore.delete(phone);
  const token = jwt.sign({ phone }, process.env.JWT_SECRET || 'dev-secret', { expiresIn: '30d' });
  res.json({ token });
});

module.exports = router;
```

**`backend/src/middleware/auth.js`**:
```js
const jwt = require('jsonwebtoken');
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(header.slice(7), process.env.JWT_SECRET || 'dev-secret');
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

**`backend/src/index.js`** — add before the health check route:
```js
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);
```

**`backend/.env`** — add:
```
JWT_SECRET=dev-secret-change-in-prod
```

---

### Step 2 — Mobile: Storage + Axios Client

**`mobile/src/utils/storage.ts`** — add new keys and helpers to existing file:
```ts
// Add to StorageKeys:
AUTH_TOKEN: 'auth_token',
SHOP_INFO: 'shop_info',

// New functions:
export const setAuthToken = async (token: string) =>
  AsyncStorage.setItem(StorageKeys.AUTH_TOKEN, token);

export const getAuthToken = async (): Promise<string | null> =>
  AsyncStorage.getItem(StorageKeys.AUTH_TOKEN);

export const clearAuthToken = async () =>
  AsyncStorage.removeItem(StorageKeys.AUTH_TOKEN);

export const setShopInfo = async (info: object) =>
  AsyncStorage.setItem(StorageKeys.SHOP_INFO, JSON.stringify(info));

export const getShopInfo = async (): Promise<Record<string, any> | null> => {
  const val = await AsyncStorage.getItem(StorageKeys.SHOP_INFO);
  return val ? JSON.parse(val) : null;
};
```

**`mobile/src/api/client.ts`** — new file:
```ts
import axios from 'axios';
import { getAuthToken } from '../utils/storage';

// Android emulator: 10.0.2.2 = host machine localhost
// Physical device / production: set EXPO_PUBLIC_API_URL in .env.local
const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3000';

const apiClient = axios.create({ baseURL: API_BASE, timeout: 10000 });

apiClient.interceptors.request.use(async (config) => {
  const token = await getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default apiClient;
```

---

### Step 3 — Mobile: authService.ts

```ts
import apiClient from '../api/client';
import { setAuthToken, getAuthToken, clearAuthToken, getShopInfo } from '../utils/storage';

// Decode JWT expiry without a library — just base64 decode the payload
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch { return true; }
};

export const sendOtp = async (phone: string): Promise<{ success: boolean; __dev_otp?: string }> => {
  const res = await apiClient.post('/api/auth/send-otp', { phone });
  return res.data;
};

export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  const res = await apiClient.post('/api/auth/verify-otp', { phone, otp });
  await setAuthToken(res.data.token);
};

export const getStoredAuth = async (): Promise<{ isAuthenticated: boolean; isShopSetup: boolean }> => {
  const token = await getAuthToken();
  if (!token || isTokenExpired(token)) return { isAuthenticated: false, isShopSetup: false };
  const shopInfo = await getShopInfo();
  return { isAuthenticated: true, isShopSetup: !!shopInfo };
};

export const logout = async () => clearAuthToken();
```

> **No `jwt-decode` package needed** — using `atob()` on the JWT payload directly. React Native has `atob` available globally.

---

### Step 4 — Mobile: AuthContext

**`mobile/src/context/AuthContext.tsx`**:
```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { getStoredAuth, logout as logoutService } from '../services/authService';

type AuthState = {
  isReady: boolean;
  isAuthenticated: boolean;
  isShopSetup: boolean;
  login: () => void;
  completeSetup: () => void;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState>({} as AuthState);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isShopSetup, setIsShopSetup] = useState(false);

  useEffect(() => {
    getStoredAuth().then(({ isAuthenticated, isShopSetup }) => {
      setIsAuthenticated(isAuthenticated);
      setIsShopSetup(isShopSetup);
      setIsReady(true);
    });
  }, []);

  return (
    <AuthContext.Provider value={{
      isReady, isAuthenticated, isShopSetup,
      login: () => setIsAuthenticated(true),
      completeSetup: () => setIsShopSetup(true),
      logout: async () => { await logoutService(); setIsAuthenticated(false); setIsShopSetup(false); },
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

---

### Step 5 — RootNavigator: Conditional Auth Gating

```tsx
import { useAuth } from '../context/AuthContext';
import { ActivityIndicator, View } from 'react-native';

export default function RootNavigator() {
  const { isReady, isAuthenticated } = useAuth();

  // Splash guard — don't flash wrong screen while AsyncStorage is being read
  if (!isReady) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
      <ActivityIndicator size="large" color="#1a57db" />
    </View>
  );

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        ) : (
          <>
            <Stack.Screen name="MainTabs" component={BottomTabNavigator} />
            <Stack.Screen name="NewBill" component={NewBillScreen} />
            <Stack.Screen name="AddProduct" component={AddProductScreen} />
            <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
            <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
            <Stack.Screen name="ManageBrands" component={ManageBrandsScreen} />
            <Stack.Screen name="AddBrand" component={AddBrandScreen} />
            <Stack.Screen name="AddCustomer" component={AddCustomerScreen} />
            <Stack.Screen name="Bills" component={BillsScreen} />
            <Stack.Screen name="BillDetail" component={BillDetailScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

> When `isAuthenticated` flips `true` (after OTP verify or JWT found on launch), React Navigation automatically transitions to the MainTabs stack. No `navigation.navigate()` needed.

---

### Step 6 — Wire Auth Screens

**`LoginScreen.tsx`** — uncomment validation, call API:
```tsx
const handleGetOtp = async () => {
  const clean = phoneNumber.replace(/\D/g, '');
  if (clean.length !== 10) { setError('Enter a valid 10-digit number'); return; }
  setIsLoading(true); setError('');
  try {
    const data = await sendOtp(clean);
    // DEV: auto-navigate with OTP pre-filled
    navigation.navigate('Otp', { phoneNumber: clean, devOtp: data.__dev_otp });
  } catch (e: any) {
    setError(e?.response?.data?.error ?? 'Could not send OTP. Check your connection.');
  } finally { setIsLoading(false); }
};
```

**`OtpScreen.tsx`** — verify + auto-fill dev OTP:
```tsx
const { login } = useAuth();
const devOtp: string | undefined = route.params?.devOtp;

// On mount: auto-fill devOtp if present
useEffect(() => {
  if (devOtp) {
    const digits = devOtp.split('');
    setOtp(digits);
    // Auto-verify after short delay so user sees it fill
    setTimeout(() => handleVerifyOtp(devOtp), 600);
  }
}, []);

const handleVerifyOtp = async (otpCode?: string) => {
  const code = otpCode ?? otp.join('');
  if (code.length !== 6) return;
  setIsVerifying(true);
  try {
    await verifyOtp(phoneNumber, code);
    login();
    const shopInfo = await getShopInfo();
    if (!shopInfo) navigation.navigate('ShopSetup');
    // If shop already set up: AuthContext isAuthenticated=true → RootNavigator shows MainTabs
  } catch (e: any) {
    setError(e?.response?.data?.error ?? 'Incorrect OTP');
    setIsVerifying(false);
  }
};
```

> **Update `AuthStackParamList`** in `AuthNavigator.tsx` to allow `devOtp` param on Otp screen:
> ```ts
> Otp: { phoneNumber: string; devOtp?: string } | undefined;
> ```

**`ShopSetupScreen.tsx`**:
```tsx
const { completeSetup } = useAuth();

const handleCompleteSetup = async () => {
  const shopData = { shopName, ownerName, category, whatsappNumber, aiConsent };
  await setHasConsent(aiConsent);
  await setShopInfo(shopData);
  await insertShop(shopData);   // SQLite
  completeSetup();              // flips isShopSetup → MainTabs renders
};
```

---

### Step 7 — SQLite: `shop` table + helpers

**`mobile/src/db/sqlite.ts`** — add to `initDatabase()`:
```sql
CREATE TABLE IF NOT EXISTS shop (
  id TEXT PRIMARY KEY,
  shop_name TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  phone TEXT,
  whatsapp_number TEXT,
  business_category TEXT,
  ai_consent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**`mobile/src/db/db.ts`** — add:
```ts
export type ShopInfo = {
  shopName: string; ownerName: string; category?: string;
  whatsappNumber?: string; phone?: string; aiConsent?: boolean;
};

export const insertShop = (data: ShopInfo): void => {
  db.runSync(
    `INSERT OR REPLACE INTO shop (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [generateId(), data.shopName, data.ownerName, data.phone ?? '',
     data.whatsappNumber ?? '', data.category ?? '', data.aiConsent ? 1 : 0]
  );
};

export const getShop = (): ShopInfo | null =>
  (db.getFirstSync('SELECT * FROM shop LIMIT 1') as any) ?? null;
```

---

### Step 8 — App.tsx

```tsx
import { AuthProvider } from './src/context/AuthContext';

export default function App() {
  useEffect(() => { initDatabase(); }, []);
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

---

### Step 9 — Settings: Logout Button

**`SettingsScreen.tsx`**:
```tsx
import { useAuth } from '../../context/AuthContext';
const { logout } = useAuth();
// On logout press:
await logout(); // clears token → RootNavigator re-renders Auth stack
```

---

## Packages to Install

```bash
# Backend
cd backend && npm install jsonwebtoken

# Mobile
cd mobile && npm install axios
```

> No `jwt-decode` needed — using native `atob()` for JWT expiry check.

---

## How to Test (Dev Flow)

1. Start backend: `cd backend && npm run dev`
2. Start Expo: `cd mobile && npx expo start --android`
3. Enter any 10-digit number in LoginScreen
4. OTP auto-fills and auto-verifies (from `__dev_otp` in response)
5. First time: ShopSetup screen → fill details → MainTabs
6. Kill app + reopen → goes straight to MainTabs (JWT in AsyncStorage)
7. Settings → Logout → returns to LoginScreen

### Physical Device Note
When testing on a physical phone (not emulator), set `EXPO_PUBLIC_API_URL` to your machine's LAN IP:
```
# mobile/.env.local
EXPO_PUBLIC_API_URL=http://192.168.29.199:3000
```
Both phone and dev machine must be on the same WiFi network. Restart Expo after adding this file.

---

## Implementation Status

| Step | Task | Status |
|---|---|---|
| Backend | `jsonwebtoken` installed | ✅ Done |
| Backend | `routes/auth.js` — send-otp + verify-otp | ✅ Done |
| Backend | `middleware/auth.js` — JWT verify middleware | ✅ Done |
| Backend | `index.js` — `/api/auth` routes mounted | ✅ Done |
| Backend | `.env` — JWT_SECRET added | ✅ Done |
| Mobile | `axios` installed | ✅ Done |
| Mobile | `src/api/client.js` — JWT interceptor | ✅ Done |
| Mobile | `src/services/authService.ts` — sendOtp, verifyOtp, getStoredAuth, logout | ✅ Done |
| Mobile | `src/utils/storage.ts` — auth token + shop info helpers | ✅ Done |
| Mobile | `src/context/AuthContext.tsx` — isReady, isAuthenticated, login, logout, completeSetup | ✅ Done |
| Mobile | `App.tsx` — wrapped with AuthProvider | ✅ Done |
| Mobile | `RootNavigator.tsx` — conditional Auth vs MainTabs gating + splash guard | ✅ Done |
| Mobile | `LoginScreen.tsx` — calls sendOtp, validation enabled | ✅ Done |
| Mobile | `OtpScreen.tsx` — calls verifyOtp, auto-fills devOtp | ✅ Done |
| Mobile | `ShopSetupScreen.tsx` — saves to SQLite + AsyncStorage, calls completeSetup | ✅ Done |
| Mobile | `sqlite.ts` — shop table added | ✅ Done |
| Mobile | `db.ts` — insertShop, getShop helpers | ✅ Done |
| Testing | Postman — send-otp + verify-otp verified | ✅ Done |
| Testing | Physical device login flow — end-to-end | ✅ Done |
| Future | Wire logout button in SettingsScreen | 🔲 Pending |
| Future | Replace devOtp auto-fill with real Fast2SMS SMS | 🔲 Pending (when first real user) |

---

## When Ready for Real SMS

Only one change needed in `backend/src/routes/auth.js`, inside `send-otp`:
```js
// Replace the console.log line with:
await axios.get('https://www.fast2sms.com/dev/bulkV2', {
  params: { authorization: process.env.FAST2SMS_API_KEY, route: 'otp',
            variables_values: otp, flash: 0, numbers: phone },
});
// And remove __dev_otp from the response:
res.json({ success: true });
```
