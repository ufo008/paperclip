import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  getCurrentLanguage,
  languageNames,
  supportedLanguages,
  type SupportedLanguage,
} from '../i18n';

export function useLanguage() {
  const { i18n } = useTranslation();

  const currentLanguage = getCurrentLanguage();
  const languages = supportedLanguages.map((lang) => ({
    code: lang,
    name: languageNames[lang],
    isCurrent: lang === currentLanguage,
  }));

  const switchLanguage = useCallback(async (lang: SupportedLanguage) => {
    await changeLanguage(lang);
  }, []);

  return {
    currentLanguage,
    languages,
    switchLanguage,
    isI18nextReady: i18n.isInitialized,
  };
}
