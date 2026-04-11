import apiClient from '../api/client';
import {
  setAuthToken,
  getAuthToken,
  clearAuthToken,
  clearShopInfo,
  getShopInfo,
} from '../utils/storage';

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
  //base url is http://[IP_ADDRESS]
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
 * Returns isAuthenticated = false if token is missing or expired.
 */
export const getStoredAuth = async (): Promise<{
  isAuthenticated: boolean;
  isShopSetup: boolean;
}> => {
  const token = await getAuthToken();
  if (!token || isTokenExpired(token)) {
    return { isAuthenticated: false, isShopSetup: false };
  }
  const shopInfo = await getShopInfo();
  return { isAuthenticated: true, isShopSetup: !!shopInfo };
};

/**
 * Clear auth token and shop info on logout.
 */
export const logout = async (): Promise<void> => {
  await clearAuthToken();
  await clearShopInfo();
};
