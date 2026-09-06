import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

import en from '../locales/en.json';
import hi from '../locales/hi.json';
import mr from '../locales/mr.json';

const resources = {
  en: { translation: en },
  hi: { translation: hi },
  mr: { translation: mr },
};

// Fallback to Hindi if locale not matched, given target artisan demographic
const deviceLanguage = Localization.getLocales()?.[0]?.languageCode || 'hi';
const initialLanguage = ['hi', 'en', 'mr'].includes(deviceLanguage) ? deviceLanguage : 'hi';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: initialLanguage,
    fallbackLng: 'hi',
    interpolation: {
      escapeValue: false, // React handles escaping
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
