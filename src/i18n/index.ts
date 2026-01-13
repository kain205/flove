import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { detectDefaultLanguage, LANGUAGE_KEY } from './config';

// Import translation files
import commonEN from './locales/en/common.json';
import authEN from './locales/en/auth.json';
import datingEN from './locales/en/dating.json';
import blindDateEN from './locales/en/blindDate.json';
import messagesEN from './locales/en/messages.json';

import commonVI from './locales/vi/common.json';
import authVI from './locales/vi/auth.json';
import datingVI from './locales/vi/dating.json';
import blindDateVI from './locales/vi/blindDate.json';
import messagesVI from './locales/vi/messages.json';

const resources = {
  en: {
    common: commonEN,
    auth: authEN,
    dating: datingEN,
    blindDate: blindDateEN,
    messages: messagesEN,
  },
  vi: {
    common: commonVI,
    auth: authVI,
    dating: datingVI,
    blindDate: blindDateVI,
    messages: messagesVI,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    lng: detectDefaultLanguage(),
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'dating', 'blindDate', 'messages'],
    interpolation: {
      escapeValue: false, // React already escapes
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_KEY,
    },
  });

export default i18n;
