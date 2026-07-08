import { supabase } from '../lib/supabase';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as FileSystem from 'expo-file-system/legacy';
import {
  clearAllUserData,
  getShopInfo,
  setShopInfo,
  setHasConsent,
  getOrCreateDeviceId,
} from '../utils/storage';
import db, { openUserDatabase, closeUserDatabase } from '../db/sqlite';
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
let _confirmationResult: any = null;

/**
 * Request OTP for the given 10-digit phone number using Firebase Auth.
 */
export const sendOtp = async (phone: string): Promise<void> => {
  const e164Phone = `+91${phone}`;
  const confirmation = await auth().signInWithPhoneNumber(e164Phone);
  _confirmationResult = confirmation;
};

/**
 * POST a Firebase ID Token to the exchange-token Edge Function and adopt the
 * returned custom JWT as the live Supabase session. Shared by OTP login,
 * Google login, and the silent re-mint path in getStoredAuth().
 */
const exchangeFirebaseTokenForSupabaseSession = async (
  firebaseIdToken: string
): Promise<{ user: { id: string; email?: string; phone?: string } }> => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/exchange-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ idToken: firebaseIdToken }),
  });

  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? 'Failed to exchange token');

  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });
  if (error) throw error;

  return body;
};

/** Record a login event for activity tracking. Best-effort — never blocks login. */
const logLoginEvent = (shopId: string | undefined, deviceId: string) => {
  if (!shopId) return;
  supabase.from('login_events').insert({ shop_id: shopId, device_id: deviceId }).then(
    () => {},
    () => {}
  );
};

/**
 * Verify OTP using Firebase Auth, then exchange the Firebase ID Token
 * for a native Supabase session via the exchange-token Edge Function.
 */
export const verifyOtp = async (phone: string, otp: string): Promise<void> => {
  if (!_confirmationResult) {
    throw new Error('No OTP request found. Please request OTP first.');
  }
  const userCredential = await _confirmationResult.confirm(otp);
  if (!userCredential) {
    throw new Error('Failed to verify OTP');
  }

  const idToken = await userCredential.user.getIdToken();
  await exchangeFirebaseTokenForSupabaseSession(idToken);

  const deviceId = await getOrCreateDeviceId();
  logLoginEvent(phone, deviceId);
};

/**
 * Verify Google Login using Firebase Auth and exchange the ID Token for Supabase.
 */
export const verifyGoogleLogin = async (idToken: string, accessToken?: string | null): Promise<void> => {
  const credential = auth.GoogleAuthProvider.credential(idToken, accessToken || 'not_empty');
  const userCredential = await auth().signInWithCredential(credential);
  if (!userCredential) {
    throw new Error('Failed to verify Google Sign-In with Firebase');
  }

  const firebaseIdToken = await userCredential.user.getIdToken();
  const { user } = await exchangeFirebaseTokenForSupabaseSession(firebaseIdToken);

  const deviceId = await getOrCreateDeviceId();
  logLoginEvent(user?.phone ?? user?.email, deviceId);
};

// ─── Session ──────────────────────────────────────────────────────────────────

/**
 * Check persisted auth state on app launch.
 *
 * Opens the user-specific SQLite database (shopai_<phone>.db) before any
 * local reads — each user's data is fully isolated at the file level, so
 * there is no cross-user bleed and no need to wipe on logout.
 *
 * If the session is valid but local shop info is missing (e.g. fresh install),
 * attempts to recover the shop from Supabase before deciding isShopSetup.
 *
 * The Supabase session is a short-lived (24h) custom JWT with no real GoTrue
 * refresh token, so once it expires supabase.auth.getSession() comes back
 * empty. Firebase's own session persists on-device and auto-refreshes its ID
 * tokens indefinitely, so if it's still present we silently re-mint a fresh
 * Supabase session from it instead of bouncing the user to the login screen.
 */
export const getStoredAuth = async (): Promise<{
  isAuthenticated: boolean;
  isShopSetup: boolean;
  phone: string | null;
  uuid: string | null;
}> => {
  const { data: { session: existingSession } } = await supabase.auth.getSession();
  let session = existingSession;

  if (!session) {
    const firebaseUser = auth().currentUser;
    if (firebaseUser) {
      try {
        const idToken = await firebaseUser.getIdToken();
        await exchangeFirebaseTokenForSupabaseSession(idToken);
        ({ data: { session } } = await supabase.auth.getSession());
      } catch (_) {
        // Firebase session invalid/revoked too — fall through to unauthenticated.
      }
    }
  }

  if (!session) {
    return { isAuthenticated: false, isShopSetup: false, phone: null, uuid: null };
  }

  const uuid = session.user.id;
  const rawPhone = (session.user.phone ?? '') as string;
  const phone = rawPhone ? rawPhone.slice(-10) : null;

  // Migration: If shopai_<phone>.db exists and shopai_<uuid>.db doesn't, rename it!
  if (phone) {
    const oldDbUri = `${FileSystem.documentDirectory}SQLite/shopai_${phone}.db`;
    const newDbUri = `${FileSystem.documentDirectory}SQLite/shopai_${uuid}.db`;
    try {
      const dbInfo = await FileSystem.getInfoAsync(oldDbUri);
      if (dbInfo.exists) {
        const moveFileIfExists = async (from: string, to: string) => {
          const info = await FileSystem.getInfoAsync(from);
          if (info.exists) {
            await FileSystem.moveAsync({ from, to });
          }
        };
        await moveFileIfExists(oldDbUri, newDbUri);
        await moveFileIfExists(`${oldDbUri}-wal`, `${newDbUri}-wal`);
        await moveFileIfExists(`${oldDbUri}-shm`, `${newDbUri}-shm`);
        await moveFileIfExists(`${oldDbUri}-journal`, `${newDbUri}-journal`);
        console.log(`[Migration] Database successfully renamed to shopai_${uuid}.db`);
      }
    } catch (err) {
      console.warn('[Migration] Failed to migrate database filename:', err);
    }
  }

  // Open this user's isolated DB before any SQLite access.
  // shopai_<uuid>.db is created on first open and reused on subsequent logins.
  openUserDatabase(uuid);

  // If we migrated the database, update the local shop.id in SQLite.
  if (phone) {
    try {
      db.runSync('UPDATE shop SET id = ? WHERE id = ?', [uuid, phone]);
    } catch (_) {}
  }

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

        // Insert directly preserving the real Supabase ID (UUID).
        // Don't use insertShop() — it generates a random id and re-queues sync.
        db.runSync(
          `INSERT OR REPLACE INTO shop
             (id, shop_name, owner_name, phone, whatsapp_number, business_category, ai_consent, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuid,
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
    uuid,
  };
};

/**
 * Clear Supabase session and all user-specific AsyncStorage keys on logout.
 * SQLite is NOT wiped — each user's data lives in their own shopai_<phone>.db
 * file and is safe to keep for when they log back in.
 */
export const logout = async (): Promise<void> => {
  try {
    await auth().signOut();
  } catch (_) {}
  try {
    await GoogleSignin.signOut();
  } catch (_) {}
  await supabase.auth.signOut();
  closeUserDatabase();
  await clearAllUserData();
};
