import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'ar' ? 'en' : 'ar';
    i18n.changeLanguage(newLang);
  };

  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 bg-blue-500 hover:bg-blue-400 text-white px-4 py-2 rounded-lg transition-colors"
      title={i18n.language === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
    >
      <Languages className="h-5 w-5" />
      <span className="text-sm font-medium">
        {i18n.language === 'ar' ? 'English' : 'العربية'}
      </span>
    </button>
  );
}
