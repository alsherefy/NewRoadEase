import { formatNumber, formatCurrency, toEnglishDigits } from '../utils/numberUtils';

export function useFormatNumber() {
  return {
    formatNumber: (value: number | string) => formatNumber(value),
    formatCurrency: (value: number | string) => formatCurrency(value),
    toEnglishDigits: (value: number | string) => toEnglishDigits(String(value))
  };
}
