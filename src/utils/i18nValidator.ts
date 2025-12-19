import enTranslations from '../locales/en/common.json';
import arTranslations from '../locales/ar/common.json';

interface TranslationObject {
  [key: string]: string | TranslationObject;
}

const flattenKeys = (obj: TranslationObject, prefix = ''): string[] => {
  let keys: string[] = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null) {
      keys = keys.concat(flattenKeys(value as TranslationObject, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
};

const validateTranslations = () => {
  const enKeys = flattenKeys(enTranslations as TranslationObject);
  const arKeys = flattenKeys(arTranslations as TranslationObject);

  const enSet = new Set(enKeys);
  const arSet = new Set(arKeys);

  const missingInEnglish = arKeys.filter(key => !enSet.has(key));
  const missingInArabic = enKeys.filter(key => !arSet.has(key));

  const hasErrors = missingInEnglish.length > 0 || missingInArabic.length > 0;

  if (hasErrors) {
    console.group('🚨 i18n Translation Coverage Issues Detected');

    if (missingInEnglish.length > 0) {
      console.group('❌ Missing in English (en):');
      missingInEnglish.forEach(key => {
        console.error(`  - ${key}`);
      });
      console.groupEnd();
    }

    if (missingInArabic.length > 0) {
      console.group('❌ Missing in Arabic (ar):');
      missingInArabic.forEach(key => {
        console.error(`  - ${key}`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  } else {
    console.log('✅ i18n: All translation keys are present in both languages');
  }

  return {
    valid: !hasErrors,
    missingInEnglish,
    missingInArabic,
    totalEnKeys: enKeys.length,
    totalArKeys: arKeys.length
  };
};

const getTranslation = (obj: TranslationObject, path: string): string | undefined => {
  const keys = path.split('.');
  let current: any = obj;

  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }

  return typeof current === 'string' ? current : undefined;
};

export const checkKeyExists = (key: string, language: 'en' | 'ar'): boolean => {
  const translations = language === 'en' ? enTranslations : arTranslations;
  const value = getTranslation(translations as TranslationObject, key);
  return value !== undefined;
};

export const checkKeyExistsInBothLanguages = (key: string): {
  en: boolean;
  ar: boolean;
  missingIn: string[];
} => {
  const enExists = checkKeyExists(key, 'en');
  const arExists = checkKeyExists(key, 'ar');

  const missingIn: string[] = [];
  if (!enExists) missingIn.push('en');
  if (!arExists) missingIn.push('ar');

  return {
    en: enExists,
    ar: arExists,
    missingIn
  };
};

export const validateTranslationKey = (key: string): void => {
  const result = checkKeyExistsInBothLanguages(key);

  if (result.missingIn.length > 0) {
    console.error(
      `🚨 Missing translation key: "${key}" in [${result.missingIn.join(', ')}]`
    );
  }
};

export const getAllTranslationKeys = (language: 'en' | 'ar'): string[] => {
  const translations = language === 'en' ? enTranslations : arTranslations;
  return flattenKeys(translations as TranslationObject);
};

export default validateTranslations;
