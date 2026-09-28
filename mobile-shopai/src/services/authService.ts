import { supabase } from '../lib/supabase';
import {
  clearAllUserData,
  getShopInfo,
  setShopInfo,
  setHasConsent,
  getOrCreateDeviceId,
  storeShopSession,
  getStoredShopId,
} from '../utils/storage';
import db, { openUserDatabase, closeUserDatabase } from '../db/sqlite';
import { restoreFromCloud } from './restoreService';
import { emitRestoreEvent } from '../utils/restoreEvents';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

type ShopRecord = {
  id: string;
  shop_name: string;
  owner_name: string;
  phone: string;
  whatsapp_number: string | null;
  business_category: string | null;
  ai_consent: boolean;
  is_active: boolean;
  plan_expires_at?: string | null;
  plan_type?: string | null;
};

const storeShopRecordLocally = async (shop: ShopRecord): Promise<void> => {
  await setShopInfo({
    shopName: shop.shop_name,
    ownerName: shop.owner_name,
    phone: shop.phone,
    category: shop.business_category ?? '',
    whatsappNumber: shop.whatsapp_number ?? '',
    aiConsent: shop.ai_consent ?? false,
    isActive: shop.is_active ?? true,
    planExpiresAt: shop.plan_expires_at ?? undefined,
    planType: shop.plan_type ?? undefined,
  });
  await setHasConsent(shop.ai_consent ?? false);
};

/**
 * Log in with a 10-digit phone number and password via the `login` Edge
 * Function. It returns a Supabase Auth session scoped to ShopAI (JWT claims
 * app='shopai', shop_id); RLS enforces shop isolation on every request.
 */
export const login = async (phone: string, password: string): Promise<ShopRecord> => {
  const e164Phone = `+91${phone}`;
  const deviceId = await getOrCreateDeviceId();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ phone: e164Phone, password, app: 'shopai', deviceId }),
  });

  const body = await res.json();
  if (body.error === 'password_reset_required') {
    throw new Error('Please set a new password first: open pragatibandhu website → Forgot password.');
  }
  if (body.error === 'not_subscribed') {
    throw new Error('This number is not registered for ShopAI. Please register on the Pragati Bandhu website.');
  }
  if (!res.ok) throw new Error(body.error ?? 'Login failed');

  const { error: sessionError } = await supabase.auth.setSession({
    access_token: body.session.access_token,
    refresh_token: body.session.refresh_token,
  });
  if (sessionError) throw new Error('Could not start a secure session. Please try again.');

  // Plan info now comes from the per-app subscription, not the shops row.
  const shop: ShopRecord = {
    ...body.shop,
    plan_type: body.subscription?.plan_type ?? null,
    plan_expires_at: body.subscription?.expires_at ?? null,
  };

  if (shop.is_active === false) {
    throw new Error('Your shop has been deactivated by the administrator. You cannot access the app until it is reactivated.');
  }

  await storeShopSession(shop.id, shop.phone);
  await storeShopRecordLocally(shop);
  openUserDatabase(shop.id);

  supabase.from('login_events').insert({ shop_id: shop.id, device_id: deviceId }).then(
    () => {},
    () => {}
  );

  return shop;
};

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Check persisted auth state on app launch.
 *
 * Opens the user-specific SQLite database (shopai_<shopId>.db) before any
 * local reads — each shop's data is fully isolated at the file level.
 *
 * If a session exists but local shop info is missing (e.g. fresh install or
 * reinstall after logging in elsewhere), attempts to recover the shop from
 * Supabase directly by id.
 */
export const getStoredAuth = async (): Promise<{
  isAuthenticated: boolean;
  phone: string | null;
  uuid: string | null;
}> => {
  const shopId = await getStoredShopId();
  if (!shopId) {
    return { isAuthenticated: false, phone: null, uuid: null };
  }

  // Builds before Phase 0 stored only a shop id (no Supabase session). Without a
  // session every request fails RLS, so send the user back to login once.
  // A network error while refreshing returns `error` — keep them signed in offline.
  // Offline, getSession() retries the token refresh with backoff and can take
  // ~25-30s to give up — race it against a 3s timeout and treat a timeout the
  // same as "keep the user signed in" (null result skips the check below).
  const sessionCheck = await Promise.race([
    supabase.auth.getSession(),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
  ]);
  if (sessionCheck && !sessionCheck.data.session && !sessionCheck.error) {
    await clearAllUserData();
    return { isAuthenticated: false, phone: null, uuid: null };
  }

  // Open this shop's isolated DB before any SQLite access.
  // shopai_<shopId>.db is created on first open and reused on subsequent logins.
  openUserDatabase(shopId);

  let shopInfo = await getShopInfo();

  // Local shop info missing — recover directly from Supabase by id.
  if (!shopInfo) {
    try {
      const { data } = await supabase
        .from('shops')
        .select('shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active, allow_out_of_stock_billing')
        .eq('id', shopId)
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
          allowOutOfStockBilling: data.allow_out_of_stock_billing ?? false,
        };

        await setShopInfo(recovered);
        await setHasConsent(recovered.aiConsent);

        db.runSync(
          `INSERT OR REPLACE INTO shop
             (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active, allow_out_of_stock_billing)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shopId,
            data.shop_name,
            data.owner_name,
            data.phone ?? null,
            data.whatsapp_number ?? null,
            data.business_category ?? null,
            data.ai_consent ? 1 : 0,
            data.is_active ? 1 : 0,
            data.allow_out_of_stock_billing ? 1 : 0,
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
            emitRestoreEvent('start');
            restoreFromCloud()
              .then(() => emitRestoreEvent('complete'))
              .catch(() => emitRestoreEvent('error'));
          }
        }
      }
    } catch {
      // Network unavailable or shop not found — fall through with local info only
    }
  }

  return {
    isAuthenticated: true,
    phone: shopInfo?.phone ?? null,
    uuid: shopId,
  };
};

/**
 * Clear local session + shop info on logout. SQLite is NOT wiped — each
 * shop's data lives in its own shopai_<shopId>.db file and is safe to keep
 * for when they log back in.
 */
export const logout = async (): Promise<void> => {
  // scope 'local' ends only this device's ShopAI session; Chukta stays signed in.
  await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
  closeUserDatabase();
  await clearAllUserData();
};
