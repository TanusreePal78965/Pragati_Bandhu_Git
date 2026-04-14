import { AppState, AppStateStatus } from 'react-native';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { flushSyncQueue } from '../db/syncQueue';
import { getHasConsent, getShopInfo, setShopInfo } from '../utils/storage';
import { supabase } from '../lib/supabase';

let unsubscribeNetInfo: (() => void) | null = null;
let appStateSubscription: { remove: () => void } | null = null;

/**
 * Checks with the backend whether the shop is still active.
 * Runs for ALL users regardless of consent — this is an admin control, not a sync operation.
 * If is_active = false: persists locally and fires onDeactivated so the UI blocks access.
 */
const checkShopStatus = async (onDeactivated: () => void): Promise<void> => {
  try {
    const net = await NetInfo.fetch();
    if (!net.isConnected) return;

    const { data } = await supabase
      .from('shops')
      .select('is_active')
      .single();
    if (data?.is_active === false) {
      const info = await getShopInfo();
      if (info) await setShopInfo({ ...info, isActive: false });
      onDeactivated();
    }
  } catch {
    // Non-critical — silently ignore network / auth errors
  }
};

/**
 * Start background sync listeners.
 *
 * Admin deactivation check: runs for ALL users (consent-independent).
 * Data sync: runs only for users who gave AI/cloud consent.
 *
 * @param onDeactivated - Called when the backend reports is_active = false.
 */
export const startSyncService = async (onDeactivated: () => void): Promise<void> => {
  // ── Admin deactivation check (all users) ────────────────────────────────────
  await checkShopStatus(onDeactivated);

  // AppState listener runs for ALL users:
  //   - re-checks deactivation on every foreground
  //   - also flushes sync queue if consent is given
  appStateSubscription = AppState.addEventListener(
    'change',
    async (state: AppStateStatus) => {
      if (state === 'active') {
        await checkShopStatus(onDeactivated);
        const hasConsent = await getHasConsent();
        if (hasConsent) await flushSyncQueue();
      }
    }
  );

  // ── Data sync (consent users only) ─────────────────────────────────────────
  const hasConsent = await getHasConsent();
  if (!hasConsent) return;

  // Flush when network reconnects
  unsubscribeNetInfo = NetInfo.addEventListener(async (state: NetInfoState) => {
    if (state.isConnected) {
      await flushSyncQueue();
    }
  });

  // Flush immediately on startup for queued items from last session
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
};
