import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  HAS_CONSENT: 'has_consent',
  LAST_SYNC: 'last_sync',
  USER_ID: 'user_id',
  SHOP_ID: 'shop_id',
};

export const setHasConsent = async (value: boolean): Promise<void> => {
  await AsyncStorage.setItem(StorageKeys.HAS_CONSENT, JSON.stringify(value));
};

export const getHasConsent = async (): Promise<boolean> => {
  const val = await AsyncStorage.getItem(StorageKeys.HAS_CONSENT);
  return val !== null ? JSON.parse(val) : false;
};

export const setLastSync = async (value: string): Promise<void> => {
  await AsyncStorage.setItem(StorageKeys.LAST_SYNC, value);
};

export const getLastSync = async (): Promise<string | undefined> => {
  const val = await AsyncStorage.getItem(StorageKeys.LAST_SYNC);
  return val ?? undefined;
};
