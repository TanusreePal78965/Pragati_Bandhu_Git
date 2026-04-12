import apiClient from '../api/client';
import {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  clearShopInfo,
  getShopInfo,
  setShopInfo,
  setHasConsent,
} from '../utils/storage';
import { insertShop } from '../db/db';

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

/**
 * Decode a JWT payload without a library.
 * React Native has `atob` globally available.
 */
const decodeJwtPayload = (token: string): Record<string, any> | null => {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
};

const isTokenExpired = (token: string): boolean => {
  const payload = decodeJwtPayload(token);
  if (!payload?.exp) return true;
  return payload.exp * 1000 < Date.now();
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Request OTP for the given phone number.
 * In dev mode, the response includes __dev_otp for auto-fill.
 */
export const sendOtp = async (
  phone: string
): Promise<{ success: boolean; __dev_otp?: string }> => {
  console.log('Base URL:', apiClient.defaults.baseURL);
  console.log('Sending OTP to:', phone);
  const res = await apiClient.post('/api/auth/send-otp', { phone });
  console.log('OTP sent successfully:', res.data);
  return res.data;
};

/**
 * Verify OTP and store the returned JWT in AsyncStorage.
 */
export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  const res = await apiClient.post('/api/auth/verify-otp', { phone, otp });
  await setAuthToken(res.data.token);
};

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Check persisted auth state on app launch.
 *
 * If the JWT is valid but local shop info is missing (e.g. fresh install, Expo Go
 * reset, or data wipe), attempts to recover the shop from the backend before
 * deciding isShopSetup. This prevents an already-registered shop from being forced
 * through setup again.
 */
export const getStoredAuth = async (): Promise<{
  isAuthenticated: boolean;
  isShopSetup: boolean;
  phone: string | null;
}> => {
  const token = await getAuthToken();
  if (!token || isTokenExpired(token)) {
    return { isAuthenticated: false, isShopSetup: false, phone: null };
  }

  const payload = decodeJwtPayload(token);
  let shopInfo = await getShopInfo();

  // JWT is valid but no local shop info — try to recover from backend
  if (!shopInfo) {
    try {
      const res = await apiClient.get('/api/shops/me');
      if (res.data?.shop_name) {
        const recovered = {
          shopName: res.data.shop_name,
          ownerName: res.data.owner_name,
          phone: res.data.phone,
          category: res.data.business_category ?? '',
          whatsappNumber: res.data.whatsapp_number ?? '',
          aiConsent: res.data.ai_consent ?? false,
          isActive: res.data.is_active ?? true,
        };

        // Restore to AsyncStorage
        await setShopInfo(recovered);
        await setHasConsent(recovered.aiConsent);

        // Restore to SQLite
        insertShop(recovered);

        shopInfo = recovered;
      }
    } catch {
      // Network unavailable or no shop found — fall through to setup screen
    }
  }

  return {
    isAuthenticated: true,
    isShopSetup: !!shopInfo,
    phone: payload?.phone ?? null,
  };
};

/**
 * Clear auth token and shop info on logout.
 */
export const logout = async (): Promise<void> => {
  await clearAuthToken();
  await clearShopInfo();
};
