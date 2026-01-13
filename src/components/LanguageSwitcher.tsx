import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { LANGUAGE_KEY } from '@/i18n/config';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'vi' ? 'en' : 'vi';
    i18n.changeLanguage(newLang);
    localStorage.setItem(LANGUAGE_KEY, newLang);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLanguage}
      className="rounded-xl flex items-center gap-2"
    >
      <Globe className="w-4 h-4" />
      <span className="font-medium">{i18n.language.toUpperCase()}</span>
    </Button>
  );
};

export default LanguageSwitcher;
