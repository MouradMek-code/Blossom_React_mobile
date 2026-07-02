import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";

const LANG_KEY = "@blossom_language";

export async function initI18n() {
  let savedLang = null;
  try {
    savedLang = await AsyncStorage.getItem(LANG_KEY);
  } catch (_) {}

  const deviceLang = (Localization.getLocales()?.[0]?.languageCode || "en").slice(0, 2);
  const lng = savedLang || (["en", "fr", "zh", "ar"].includes(deviceLang) ? deviceLang : "en");

  await i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      zh: { translation: zh },
      ar: { translation: ar },
    },
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
  });
}

export async function changeLanguage(code) {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch (_) {}
}

export default i18n;
