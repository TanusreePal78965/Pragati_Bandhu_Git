import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  HAS_CONSENT: 'has_consent',
  LAST_SYNC: 'last_sync',
  USER_ID: 'user_id',
  SHOP_ID: 'shop_id',
  SHOP_INFO: 'shop_info',
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
