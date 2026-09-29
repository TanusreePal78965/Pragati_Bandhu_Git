import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import bn from './bn.json';
import hi from './hi.json';

export type Language = 'en' | 'bn' | 'hi';
const KEY = 'chukta.language';

export async function initI18n(lang: Language): Promise<void> {
  if (!i18n.isInitialized) {
    await i18n.use(initReactI18next).init({
      resources: { en: { translation: en }, bn: { translation: bn }, hi: { translation: hi } },
      lng: lang,
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
    });
  } else {
    await i18n.changeLanguage(lang);
  }
}

export async function setLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(KEY, lang);
  await initI18n(lang);
}

export async function getStoredLanguage(): Promise<Language | null> {
  const v = await AsyncStorage.getItem(KEY);
  return v === 'en' || v === 'bn' || v === 'hi' ? v : null;
}

export { i18n };
