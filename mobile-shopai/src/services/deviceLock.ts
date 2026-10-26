import { supabase } from '../lib/supabase';
import { getOrCreateDeviceId, getStoredShopId } from '../utils/storage';

// Must not import syncQueue / syncService (syncQueue imports this module).
export type DeviceCheck = 'ok' | 'conflict' | 'unknown';

const DEFAULT_MAX_AGE_MS = 60000;

let conflict = false;
let cached: { value: DeviceCheck; at: number } | null = null;

export const setDeviceConflict = (v: boolean): void => {
  conflict = v;
  cached = null;
};

export const isDeviceConflict = (): boolean => conflict;

/**
 * Asks the server whether this device still holds the session. Only an
 * ai_consent user with a different non-null active_device_id is in conflict.
 * 'unknown' (offline / error) is never cached, so the next call retries.
 */
export const verifyActiveDevice = async (
  opts: { maxAgeMs?: number } = {},
): Promise<DeviceCheck> => {
  const maxAgeMs = opts.maxAgeMs ?? DEFAULT_MAX_AGE_MS;
  if (cached && cached.value !== 'unknown' && Date.now() - cached.at < maxAgeMs) {
    return cached.value;
  }
  try {
    const shopId = await getStoredShopId();
    if (!shopId) return 'unknown';
    const deviceId = await getOrCreateDeviceId();
    const { data, error } = await supabase
      .from('shops')
      .select('active_device_id, ai_consent')
      .eq('id', shopId)
      .maybeSingle();
    if (error || !data) return 'unknown';
    const result: DeviceCheck =
      data.ai_consent === true && data.active_device_id && data.active_device_id !== deviceId
        ? 'conflict'
        : 'ok';
    conflict = result === 'conflict';
    cached = { value: result, at: Date.now() };
    return result;
  } catch {
    return 'unknown';
  }
};
