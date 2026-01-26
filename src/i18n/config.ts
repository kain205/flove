import { Capacitor } from '@capacitor/core';

export const LANGUAGE_KEY = 'f-love-language';
export const AVAILABLE_LANGUAGES = ['en', 'vi'] as const;
export type Language = typeof AVAILABLE_LANGUAGES[number];

export const detectDefaultLanguage = (): Language => {
  // 1. Check localStorage first (user preference)
  const savedLang = localStorage.getItem(LANGUAGE_KEY);
  if (savedLang && AVAILABLE_LANGUAGES.includes(savedLang as Language)) {
    return savedLang as Language;
  }
  
  // 2. Platform detection (mobile = vi, web = en)
  const platform = Capacitor.getPlatform();
  if (platform === 'android' || platform === 'ios') {
    return 'vi'; // Mobile defaults to Vietnamese
  }
  
  // 3. Browser language detection (fallback)
  const browserLang = navigator.language.split('-')[0];
  return AVAILABLE_LANGUAGES.includes(browserLang as Language) 
    ? (browserLang as Language) 
    : 'en';
};
