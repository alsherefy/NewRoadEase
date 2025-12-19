import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enTranslations from './locales/en/common.json';
import arTranslations from './locales/ar/common.json';
import validateTranslations, { validateTranslationKey } from './utils/i18nValidator';
import { toEnglishDigits } from './utils/numberUtils';

const resources = {
  en: {
    translation: enTranslations,
  },
  ar: {
    translation: arTranslations,
  },
};

const isDevelopment = import.meta.env.DEV;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'ar',
    lng: 'ar',
    debug: false,
    interpolation: {
      escapeValue: false,
      format: (value, format, lng) => {
        if (format === 'number' && (typeof value === 'number' || typeof value === 'string')) {
          return toEnglishDigits(value);
        }
        return value;
      },
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    saveMissing: isDevelopment,
    missingKeyHandler: (lngs, ns, key, fallbackValue) => {
      if (isDevelopment) {
        console.error(
          `🚨 Missing translation key: "${key}"\n` +
          `   Languages: [${lngs.join(', ')}]\n` +
          `   Namespace: ${ns}\n` +
          `   Fallback: "${fallbackValue}"`
        );
        validateTranslationKey(key);
      }
    },
  });

i18n.on('languageChanged', (lng) => {
  const dir = lng === 'ar' ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = lng;

  localStorage.setItem('i18nextLng', lng);
});

const currentLang = i18n.language || 'ar';
const dir = currentLang === 'ar' ? 'rtl' : 'ltr';
document.documentElement.dir = dir;
document.documentElement.lang = currentLang;

if (isDevelopment) {
  console.log('🔍 Running i18n validation check...');
  validateTranslations();
}

export default i18n;
