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
  });
  await setHasConsent(shop.ai_consent ?? false);
};

/**
 * Log in with a 10-digit phone number and password via the `login` Edge
 * Function. There is no Supabase Auth session here — a successful login just
 * returns the shop row, which is trusted and stored locally. Data access is
 * scoped entirely by the app querying its own shop_id (see permissive RLS
 * migration); there is no server-verified session backing this.
 */
export const login = async (phone: string, password: string): Promise<ShopRecord> => {
  const e164Phone = `+91${phone}`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ phone: e164Phone, password }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Login failed');

  const shop: ShopRecord = body.shop;

  if (shop.is_active === false) {
    throw new Error('Your shop has been deactivated by the administrator. You cannot access the app until it is reactivated.');
  }

  await storeShopSession(shop.id, shop.phone);
  await storeShopRecordLocally(shop);
  openUserDatabase(shop.id);

  const deviceId = await getOrCreateDeviceId();
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

  // Open this shop's isolated DB before any SQLite access.
  // shopai_<shopId>.db is created on first open and reused on subsequent logins.
  openUserDatabase(shopId);

  let shopInfo = await getShopInfo();

  // Local shop info missing — recover directly from Supabase by id.
  if (!shopInfo) {
    try {
      const { data } = await supabase
        .from('shops')
        .select('shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active')
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
        };

        await setShopInfo(recovered);
        await setHasConsent(recovered.aiConsent);

        db.runSync(
          `INSERT OR REPLACE INTO shop
             (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            shopId,
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
  closeUserDatabase();
  await clearAllUserData();
};
