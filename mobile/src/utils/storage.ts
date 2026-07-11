import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  HAS_CONSENT: 'has_consent',
  LAST_SYNC: 'last_sync',
  USER_ID: 'user_id',
  SHOP_ID: 'shop_id',
  PHONE: 'phone',
  SHOP_INFO: 'shop_info',
  DEVICE_ID: 'device_id',
};

// ─── Shop session (phone+password login, no Supabase Auth session) ─────────

export const storeShopSession = async (shopId: string, phone: string): Promise<void> => {
  await AsyncStorage.multiSet([
    [StorageKeys.SHOP_ID, shopId],
    [StorageKeys.PHONE, phone],
  ]);
};

export const getStoredShopId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(StorageKeys.SHOP_ID);
};

export const getStoredPhone = async (): Promise<string | null> => {
  return AsyncStorage.getItem(StorageKeys.PHONE);
};

// ─── Consent ────────────────────────────────────────────────────────────────

export const setHasConsent = async (value: boolean): Promise<void> => {
  await AsyncStorage.setItem(StorageKeys.HAS_CONSENT, JSON.stringify(value));
};

export const getHasConsent = async (): Promise<boolean> => {
  const val = await AsyncStorage.getItem(StorageKeys.HAS_CONSENT);
  return val !== null ? JSON.parse(val) : false;
};

// ─── Sync ────────────────────────────────────────────────────────────────────

export const setLastSync = async (value: string): Promise<void> => {
  await AsyncStorage.setItem(StorageKeys.LAST_SYNC, value);
};

export const getLastSync = async (): Promise<string | undefined> => {
  const val = await AsyncStorage.getItem(StorageKeys.LAST_SYNC);
  return val ?? undefined;
};

// ─── Shop Info ───────────────────────────────────────────────────────────────

export type StoredShopInfo = {
  shopName: string;
  ownerName: string;
  phone?: string;
  category?: string;
  whatsappNumber?: string;
  aiConsent?: boolean;
  isActive?: boolean;
};

export const setShopInfo = async (info: StoredShopInfo): Promise<void> => {
  await AsyncStorage.setItem(StorageKeys.SHOP_INFO, JSON.stringify(info));
};

export const getShopInfo = async (): Promise<StoredShopInfo | null> => {
  const val = await AsyncStorage.getItem(StorageKeys.SHOP_INFO);
  return val ? (JSON.parse(val) as StoredShopInfo) : null;
};

export const clearShopInfo = async (): Promise<void> => {
  await AsyncStorage.removeItem(StorageKeys.SHOP_INFO);
};

// Clears all user-specific keys. DEVICE_ID is intentionally preserved —
// it identifies this physical device and must survive user switches.
export const clearAllUserData = async (): Promise<void> => {
  await AsyncStorage.multiRemove([
    StorageKeys.HAS_CONSENT,
    StorageKeys.LAST_SYNC,
    StorageKeys.USER_ID,
    StorageKeys.SHOP_ID,
    StorageKeys.PHONE,
    StorageKeys.SHOP_INFO,
  ]);
};

// ─── Device ID ───────────────────────────────────────────────────────────────

// Generates a UUID-like string without the 'crypto' module.
const generateDeviceId = (): string => {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1);
  return `${s4()}${s4()}-${s4()}-${s4()}-${s4()}-${s4()}${s4()}${s4()}`;
};

/**
 * Returns a stable device identifier persisted in AsyncStorage.
 * Generated once on first call; survives app restarts but not uninstalls.
 * Uninstall = new device_id = clean session claim on next login.
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  const existing = await AsyncStorage.getItem(StorageKeys.DEVICE_ID);
  if (existing) return existing;
  const newId = generateDeviceId();
  await AsyncStorage.setItem(StorageKeys.DEVICE_ID, newId);
  return newId;
};
