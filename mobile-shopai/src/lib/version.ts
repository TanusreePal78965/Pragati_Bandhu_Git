import Constants from 'expo-constants';
import * as Application from 'expo-application';

export const getAppVersion = (): string => {
  return Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
};

export const getAppVersionCode = (): number => {
  if (Application.nativeBuildVersion) {
    const parsed = parseInt(Application.nativeBuildVersion, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return Constants.expoConfig?.android?.versionCode || 1;
};
