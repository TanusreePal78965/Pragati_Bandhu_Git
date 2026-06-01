import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushSyncQueue } from '../db/syncQueue';
import { getHasConsent, getShopInfo, setShopInfo, getOrCreateDeviceId } from '../utils/storage';
import { supabase } from '../lib/supabase';
import { restoreFromCloud } from './restoreService';

// Minimum ms between background pulls — avoids hammering Supabase on rapid app switches
const PULL_INTERVAL_MS = 2 * 60 * 1000;
let _lastPullAt = 0;

const pullIfStale = (): void => {
  const now = Date.now();
  if (now - _lastPullAt < PULL_INTERVAL_MS) return;
  _lastPullAt = now;
  // Fire-and-forget — non-blocking, non-critical
  restoreFromCloud().catch(() => {});
};

let unsubscribeNetInfo: (() => void) | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/**
 * Checks shop status from Supabase on every foreground for ALL users:
 *   - is_active = false  → onDeactivated() (admin control)
 *   - active_device_id mismatch AND aiConsent = true → onDeviceConflict()
 *     (another device has claimed the session)
 */
const checkShopStatus = async (
  onDeactivated: () => void,
  onDeviceConflict: () => void,
): Promise<void> => {
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    const { data: { session } } = await supabase.auth.getSession();
    const phone = session?.user?.phone?.slice(-10);
    if (!phone) return;

    const { data } = await supabase
      .from('shops')
      .select('is_active, active_device_id, ai_consent')
      .eq('id', phone)
      .single();

    if (!data) return;

    // Admin deactivation — applies to all users
    if (data.is_active === false) {
      const info = await getShopInfo();
      if (info) await setShopInfo({ ...info, isActive: false });
      onDeactivated();
      return;
    }

    // Device conflict — only for online (aiConsent) users.
    if (data.ai_consent) {
      const thisDeviceId = await getOrCreateDeviceId();
      if (!data.active_device_id) {
        // No device claimed yet (new shop or just cleared) — stamp this device.
        // Fire-and-forget: non-critical, next check will confirm.
        supabase.from('shops')
          .update({ active_device_id: thisDeviceId })
          .eq('id', phone)
          .then(() => {}).catch(() => {});
      } else if (data.active_device_id !== thisDeviceId) {
        // Another device holds the session — block access.
        onDeviceConflict();
        return;
      }
    }
  } catch {
    // Non-critical — silently ignore network / auth errors
  }
};

/**
 * Start background sync listeners.
 *
 * Admin deactivation check: runs for ALL users (consent-independent).
 * Device conflict check: runs for aiConsent users only.
 * Data sync: runs only for users who gave AI/cloud consent.
 *
 * @param onDeactivated   - Called when backend reports is_active = false.
 * @param onDeviceConflict - Called when another device has claimed the session.
 */
export const startSyncService = async (
  onDeactivated: () => void,
  onDeviceConflict: () => void,
): Promise<void> => {
  // Clean up existing listeners before re-subscribing to prevent leaks
  stopSyncService();

  // ── Initial check (all users) ────────────────────────────────────────────────
  await checkShopStatus(onDeactivated, onDeviceConflict);

  // AppState listener: re-check on every foreground + flush queue for consent users
  appStateSubscription = AppState.addEventListener(
    'change',
    async (state: AppStateStatus) => {
      if (state === 'active') {
        await checkShopStatus(onDeactivated, onDeviceConflict);
        const hasConsent = await getHasConsent();
        if (hasConsent) {
          await flushSyncQueue();
          pullIfStale();
        }
      }
    }
  );

  // ── Data sync (consent users only) ──────────────────────────────────────────
  const hasConsent = await getHasConsent();
  if (!hasConsent) return;

  // Flush and pull when network reconnects
  unsubscribeNetInfo = NetInfo.addEventListener(async (state: NetInfoState) => {
    if (state.isConnected) {
      await flushSyncQueue();
      pullIfStale();
    }
  });

  // Flush immediately for items queued in last session
  await flushSyncQueue();
};

/**
 * Stop sync listeners. Call on logout.
 */
export const stopSyncService = (): void => {
  appStateSubscription?.remove();
  appStateSubscription = null;
  unsubscribeNetInfo?.();
  unsubscribeNetInfo = null;
  _lastPullAt = 0;
};
