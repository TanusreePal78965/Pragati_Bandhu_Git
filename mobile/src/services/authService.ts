import { supabase } from '../lib/supabase';
import {
  clearShopInfo,
  getShopInfo,
  setShopInfo,
  setHasConsent,
} from '../utils/storage';
import db from '../db/sqlite';
import { restoreFromCloud } from './restoreService';
import { emitRestoreEvent } from '../utils/restoreEvents';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ─── Auth API ─────────────────────────────────────────────────────────────────

/**
 * Request OTP for the given 10-digit phone number.
 * Calls the custom send-otp Edge Function which stores an OTP hash
 * in the database and delivers the OTP via Fast2SMS.
 */
export const sendOtp = async (phone: string): Promise<void> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ phone }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to send OTP');
};

/**
 * Verify OTP. On success the Edge Function returns a signed JWT
 * which we store in Supabase's AsyncStorage session so all subsequent
 * supabase.from() calls are authenticated automatically.
 */
export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/verify-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ phone, otp }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to verify OTP');

  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });
  if (error) throw error;
};

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Check persisted auth state on app launch.
 *
 * If the session is valid but local shop info is missing (e.g. fresh install
 * or data wipe), attempts to recover the shop from Supabase before deciding
 * isShopSetup. This prevents an already-registered shop from being forced
 * through setup again.
 */
export const getStoredAuth = async (): Promise<{
  isAuthenticated: boolean;
  isShopSetup: boolean;
  phone: string | null;
}> => {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return { isAuthenticated: false, isShopSetup: false, phone: null };
  }

  // Extract 10-digit phone — auth.users.phone may be '+91XXXXXXXXXX', '91XXXXXXXXXX', or 'XXXXXXXXXX'
  const rawPhone = (session.user.phone ?? '') as string;
  const phone = rawPhone.slice(-10);

  let shopInfo = await getShopInfo();

  // Session is valid but no local shop info — try to recover from Supabase
  if (!shopInfo) {
    try {
      const { data } = await supabase
        .from('shops')
        .select('shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active')
        .single();

      if (data?.shop_name) {
        const recovered = {
          shopName: data.shop_name,
          ownerName: data.owner_name,
          phone: data.phone,
          category: data.business_category ?? '',
          whatsappNumber: data.whatsapp_number ?? '',
          aiConsent: data.ai_consent ?? false,
          isActive: data.is_active ?? true,
        };

        await setShopInfo(recovered);
        await setHasConsent(recovered.aiConsent);

        // Insert directly preserving the real Supabase ID (phone).
        // Don't use insertShop() — it generates a random id and re-queues sync.
        db.runSync(
          `INSERT OR REPLACE INTO shop
             (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            phone,
            data.shop_name,
            data.owner_name,
            data.phone ?? null,
            data.whatsapp_number ?? null,
            data.business_category ?? null,
            data.ai_consent ? 1 : 0,
            data.is_active ? 1 : 0,
          ]
        );

        shopInfo = recovered;

        // Auto-restore: if cloud consent is on and local SQLite is empty,
        // pull all tables from Supabase in the background. The user will see
        // their data appear on the home screen without any manual action.
        if (recovered.aiConsent) {
          const { count } = db.getFirstSync(
            'SELECT COUNT(*) as count FROM products'
          ) as { count: number };
          if (count === 0) {
            // C11: Emit events so AuthContext can show a "Restoring…" banner.
            // Non-blocking — user lands on the home screen while data loads in.
            emitRestoreEvent('start');
            restoreFromCloud()
              .then(() => emitRestoreEvent('complete'))
              .catch(() => emitRestoreEvent('error'));
          }
        }
      }
    } catch {
      // Network unavailable or no shop found — fall through to setup screen
    }
  }

  return {
    isAuthenticated: true,
    isShopSetup: !!shopInfo,
    phone,
  };
};

/**
 * Clear Supabase session and local shop info on logout.
 */
export const logout = async (): Promise<void> => {
  await supabase.auth.signOut();
  await clearShopInfo();
};
