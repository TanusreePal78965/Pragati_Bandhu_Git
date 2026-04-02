import { MMKV } from 'react-native-mmkv';

export const storage = new MMKV();

export const StorageKeys = {
  HAS_CONSENT: 'has_consent',
  LAST_SYNC: 'last_sync',
  USER_ID: 'user_id',
  SHOP_ID: 'shop_id',
};

export const setHasConsent = (value: boolean) => {
  storage.set(StorageKeys.HAS_CONSENT, value);
};

export const getHasConsent = (): boolean => {
  return storage.getBoolean(StorageKeys.HAS_CONSENT) ?? false;
};

export const setLastSync = (value: string) => {
  storage.set(StorageKeys.LAST_SYNC, value);
};

export const getLastSync = (): string | undefined => {
  return storage.getString(StorageKeys.LAST_SYNC);
};
