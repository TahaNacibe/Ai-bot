import { useState, useEffect } from "react";
import { readFromStorage, saveToStorage } from "@/services/storage/appStorage";
import i18n from "@/i18n";

export type LanguageCode = "en" | "ar" | "fr" | "jp" | "zh";

export function useAppLanguage() {
  const [language, setLanguageState] = useState<LanguageCode>(
    () => readFromStorage<LanguageCode>("language", "en")
  );

  useEffect(() => {
    i18n.changeLanguage(language);
  }, []);

  function setLanguage(langCode: LanguageCode) {
    setLanguageState(langCode);
    saveToStorage("language", langCode);
    i18n.changeLanguage(langCode); // triggers languageChanged → applyLangToDOM
  }

  return { language, setLanguage };
}