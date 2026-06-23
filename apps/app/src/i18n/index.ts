import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

void i18n.use(initReactI18next).init({
  lng: 'vi',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  resources: {
    vi: {
      common: {
        aiPicks: 'AI Picks',
        blindDate: 'Blind Date',
        messages: 'Tin nhan',
        profile: 'Ho so',
        login: 'Dang nhap',
        signup: 'Dang ky',
      },
    },
    en: {
      common: {
        aiPicks: 'AI Picks',
        blindDate: 'Blind Date',
        messages: 'Messages',
        profile: 'Profile',
        login: 'Login',
        signup: 'Sign up',
      },
    },
  },
  defaultNS: 'common',
});

export default i18n;
