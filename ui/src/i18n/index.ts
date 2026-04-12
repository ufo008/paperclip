import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import enUS from '../locales/en-US.json';
import zhCN from '../locales/zh-CN.json';

export const resources = {
  'en-US': { translation: enUS },
  'zh-CN': { translation: zhCN },
} as const;

export const supportedLanguages = ['en-US', 'zh-CN'] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const defaultLanguage: SupportedLanguage = 'en-US';

export const languageNames: Record<SupportedLanguage, string> = {
  'en-US': 'English',
  'zh-CN': '中文',
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: defaultLanguage,
    supportedLngs: supportedLanguages,
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'paperclip-language',
    },
  });

export default i18n;

export function changeLanguage(lang: SupportedLanguage): Promise<void> {
  return new Promise((resolve) => {
    i18n.changeLanguage(lang, () => {
      localStorage.setItem('paperclip-language', lang);
      resolve();
    });
  });
}

export function getCurrentLanguage(): SupportedLanguage {
  return (i18n.language || defaultLanguage) as SupportedLanguage;
}
