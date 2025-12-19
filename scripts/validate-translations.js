#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const enPath = path.resolve(__dirname, '../src/locales/en/common.json');
const arPath = path.resolve(__dirname, '../src/locales/ar/common.json');

const flattenKeys = (obj, prefix = '') => {
  let keys = [];

  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys = keys.concat(flattenKeys(value, fullKey));
    } else {
      keys.push(fullKey);
    }
  }

  return keys;
};

const validateTranslations = () => {
  try {
    const enTranslations = JSON.parse(fs.readFileSync(enPath, 'utf8'));
    const arTranslations = JSON.parse(fs.readFileSync(arPath, 'utf8'));

    const enKeys = flattenKeys(enTranslations);
    const arKeys = flattenKeys(arTranslations);

    const enSet = new Set(enKeys);
    const arSet = new Set(arKeys);

    const missingInEnglish = arKeys.filter(key => !enSet.has(key));
    const missingInArabic = enKeys.filter(key => !arSet.has(key));

    console.log('\n📊 i18n Translation Validation Report\n');
    console.log('═'.repeat(50));
    console.log(`English Keys: ${enKeys.length}`);
    console.log(`Arabic Keys:  ${arKeys.length}`);
    console.log('═'.repeat(50));

    let hasErrors = false;

    if (missingInEnglish.length > 0) {
      hasErrors = true;
      console.log('\n❌ Missing in English (en):');
      console.log('─'.repeat(50));
      missingInEnglish.forEach(key => {
        console.log(`  • ${key}`);
      });
    }

    if (missingInArabic.length > 0) {
      hasErrors = true;
      console.log('\n❌ Missing in Arabic (ar):');
      console.log('─'.repeat(50));
      missingInArabic.forEach(key => {
        console.log(`  • ${key}`);
      });
    }

    if (!hasErrors) {
      console.log('\n✅ SUCCESS: All translation keys are present in both languages!\n');
      return true;
    } else {
      console.log('\n❌ FAILURE: Translation coverage is incomplete!\n');
      console.log('Please add the missing keys to the respective translation files.\n');
      return false;
    }
  } catch (error) {
    console.error('\n❌ ERROR: Failed to validate translations\n');
    console.error(error.message);
    return false;
  }
};

const isValid = validateTranslations();
process.exit(isValid ? 0 : 1);
