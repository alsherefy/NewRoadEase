export function toEnglishDigits(value: string | number): string {
  const arabicToEnglish: { [key: string]: string } = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9'
  };

  const strValue = String(value);
  return strValue.replace(/[٠-٩]/g, (match) => arabicToEnglish[match] || match);
}

export function normalizeNumberInput(value: string): string {
  return toEnglishDigits(value);
}

export function handleNumberInputChange(e: React.ChangeEvent<HTMLInputElement>): string {
  return normalizeNumberInput(e.target.value);
}

export function formatNumber(value: number | string, locale?: string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue) || numValue === 0) return '';

  const formatted = numValue.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });

  return formatted;
}

export function formatCurrency(value: number | string, locale?: string): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue) || numValue === 0) return '';

  return numValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function displayNumber(value: number | string | undefined | null): string {
  if (value === undefined || value === null || value === '') return '';
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue) || numValue === 0) return '';
  return toEnglishDigits(numValue.toLocaleString('en-US'));
}

export function formatToFixed(value: number, decimals: number = 2): string {
  const fixed = value.toFixed(decimals);
  return toEnglishDigits(fixed);
}
