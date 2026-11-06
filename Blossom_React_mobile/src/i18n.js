import { Alert, I18nManager } from "react-native";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

import en from "./locales/en.json";
import fr from "./locales/fr.json";
import zh from "./locales/zh.json";
import ar from "./locales/ar.json";

const LANG_KEY = "@blossom_language";

// Arabic reads right to left: the whole layout follows the app's language
// (not the phone's). Android applies a direction change at the next start;
// returns true when that's still to come.
function applyDirection(code) {
  const rtl = code === "ar";
  try {
    I18nManager.allowRTL(rtl);
    I18nManager.forceRTL(rtl);
  } catch (_) {
    return false;
  }
  return I18nManager.isRTL !== rtl;
}

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
  applyDirection(lng);
}

export async function changeLanguage(code) {
  await i18n.changeLanguage(code);
  try {
    await AsyncStorage.setItem(LANG_KEY, code);
  } catch (_) {}
  // To or from Arabic: the layout flips once Blossom is opened again.
  if (applyDirection(code)) {
    Alert.alert(i18n.t("direction.restartTitle"), i18n.t("direction.restartText"));
  }
}

export default i18n;
