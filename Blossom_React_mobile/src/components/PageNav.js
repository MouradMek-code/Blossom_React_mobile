import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import { getToken, peekToken } from "../api/storage";
import { goToTab } from "../navigation/goToTab";
import { changeLanguage } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { colors, radius, shadow } from "../theme";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "عربي" },
];

// The bar at the top of every screen.
//
// Once you're logged in it's only the logo (tapping it goes to Browse) plus
// whatever the screen puts on its right: moving around is the tab bar's job
// now, and language, logout and the account live in Settings.
//
// Logged out it carries the links a visitor needs plus the language switcher.
// `minimal` - used while a profile is being created - shows the logo and the
// languages only, so the flow isn't abandoned halfway.
export default function PageNav({ variant = "light", minimal = false, right = null }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [activeLang, setActiveLang] = useState(i18n.language?.slice(0, 2) || "en");
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // From memory first (instant), then confirmed against storage.
  const [token, setTokenState] = useState(() => peekToken());

  useEffect(() => {
    let alive = true;
    getToken().then((stored) => {
      if (alive) setTokenState(stored);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function handleLangChange(code) {
    await changeLanguage(code);
    setActiveLang(code);
  }

  const loggedIn = Boolean(token) && token !== "null" && token !== "undefined";
  const isTransparent = variant === "transparent";
  const showLinks = !minimal && !loggedIn;

  return (
    <View
      style={[
        styles.head,
        { paddingTop: insets.top + 10 },
        isTransparent
          ? styles.headTransparent
          : { backgroundColor: colors.surface, borderBottomColor: colors.border, borderBottomWidth: 1 },
      ]}
    >
      <View style={styles.logoRow}>
        <Logo
          size={40}
          onPress={loggedIn && !minimal ? () => goToTab(navigation, "Profiles") : undefined}
        />
        {right}
      </View>

      {showLinks || minimal ? (
        <View style={styles.nav}>
          {showLinks ? (
            <>
              <NavItem label={t("nav.home")} onPress={() => navigation.navigate("Home")} transparent={isTransparent} colors={colors} />
              <NavItem label={t("nav.dateSpots")} onPress={() => navigation.navigate("DateSpots")} transparent={isTransparent} colors={colors} />
              <NavItem label={t("nav.signUp")} onPress={() => navigation.navigate("SignUp")} transparent={isTransparent} colors={colors} />
              <NavItem label={t("nav.login")} onPress={() => navigation.navigate("Login")} transparent={isTransparent} highlight colors={colors} />
            </>
          ) : null}

          <View style={styles.langRow}>
            {LANGUAGES.map((l) => (
              <Pressable
                key={l.code}
                onPress={() => handleLangChange(l.code)}
                style={[
                  styles.langBtn,
                  isTransparent ? styles.langBtnTransparent : styles.langBtnLight,
                  activeLang === l.code && styles.langBtnActive,
                ]}
              >
                <Text style={[
                  styles.langBtnText,
                  isTransparent ? styles.langBtnTextTransparent : styles.langBtnTextLight,
                  activeLang === l.code && styles.langBtnTextActive,
                ]}>
                  {l.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function NavItem({ label, onPress, transparent, highlight, colors }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        transparent
          ? styles.navItemBorderTransparent
          : { borderColor: colors.border },
        highlight && { backgroundColor: colors.primary, borderColor: colors.primary },
        pressed && (transparent ? styles.navItemPressedTransparent : { backgroundColor: colors.surfaceMuted }),
      ]}
    >
      <Text
        style={[
          styles.navText,
          transparent ? styles.navTextTransparent : { color: colors.text },
          highlight && styles.navTextHighlight,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
headLight: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadow.sm,
  },
  headTransparent: {
    backgroundColor: "transparent",
  },
  nav: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "flex-start",
    rowGap: 8,
    columnGap: 8,
    marginTop: 8,
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  navItemBorderTransparent: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  navItemPressedTransparent: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.6)",
  },
  navText: {
    fontSize: 14,
    fontWeight: "600",
  },
  navTextTransparent: {
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  navTextHighlight: {
    color: "#fff",
  },
  langRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  langBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  langBtnLight: {
    borderColor: "rgba(214,51,108,0.35)",
  },
  langBtnTransparent: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  langBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  langBtnTextLight: {
    color: colors.primary,
  },
  langBtnTextTransparent: {
    color: "#fff",
  },
  langBtnTextActive: {
    color: "#fff",
  },
});
