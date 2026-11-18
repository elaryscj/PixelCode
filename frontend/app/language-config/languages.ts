// app/language-config/languages.ts — i18n setup and the list of languages the game offers.
// Each language lives in ./locales/<code>.ts; anything missing falls back to English.
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en";
import kz from "./locales/kz";
import ru from "./locales/ru";
import es from "./locales/es";
import fr from "./locales/fr";
import de from "./locales/de";
import pt from "./locales/pt";
import id from "./locales/id";
import zh from "./locales/zh";
import ja from "./locales/ja";
import ko from "./locales/ko";
import hi from "./locales/hi";
import ar from "./locales/ar";
import ur from "./locales/ur";

export type Language = {
  code: string;
  /** name in its own language, shown in the picker */
  label: string;
  /** value for <html lang> */
  htmlLang: string;
  rtl?: boolean;
};

export const LANGUAGES: Language[] = [
  { code: "en", label: "English", htmlLang: "en" },
  { code: "kz", label: "Қазақша", htmlLang: "kk" },
  { code: "ru", label: "Русский", htmlLang: "ru" },
  { code: "es", label: "Español", htmlLang: "es" },
  { code: "fr", label: "Français", htmlLang: "fr" },
  { code: "de", label: "Deutsch", htmlLang: "de" },
  { code: "pt", label: "Português", htmlLang: "pt" },
  { code: "id", label: "Bahasa Indonesia", htmlLang: "id" },
  { code: "zh", label: "中文", htmlLang: "zh-Hans" },
  { code: "ja", label: "日本語", htmlLang: "ja" },
  { code: "ko", label: "한국어", htmlLang: "ko" },
  { code: "hi", label: "हिन्दी", htmlLang: "hi" },
  { code: "ar", label: "العربية", htmlLang: "ar", rtl: true },
  { code: "ur", label: "اردو", htmlLang: "ur", rtl: true },
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export function languageInfo(code: string | undefined): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

const translations = { en, kz, ru, es, fr, de, pt, id, zh, ja, ko, hi, ar, ur };

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(translations).map(([code, t]) => [code, { translation: t }])),
  lng: "en", // the saved choice is applied after hydration (root.tsx), so server and client markup match
  fallbackLng: "en",
  supportedLngs: LANGUAGE_CODES,
  interpolation: {
    escapeValue: false, // React already escapes
  },
});

export default i18n;
