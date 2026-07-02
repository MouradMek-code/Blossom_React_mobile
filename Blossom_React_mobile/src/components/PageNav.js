import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import { BASE_URL } from "../api/config";
import { getToken, setToken, clearSession } from "../api/storage";
import { changeLanguage } from "../i18n";
import { colors, radius, shadow } from "../theme";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "عربي" },
];

export default function PageNav({ variant = "light" }) {
  const { t, i18n } = useTranslation();
  const [activeLang, setActiveLang] = useState(i18n.language?.slice(0, 2) || "en");
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  async function handleLangChange(code) {
    await changeLanguage(code);
    setActiveLang(code);
  }
  const [profile, setProfile] = useState(null);
  const [token, setTokenState] = useState(null);
  const [matchCount, setMatchCount] = useState(0);
  const [likeCount, setLikeCount] = useState(0);

  const isTokenMissing = !token || token === "null" || token === "undefined";
  const isTransparent = variant === "transparent";

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      const storedToken = await getToken();
      if (!isMounted) return;
      setTokenState(storedToken);

      if (!storedToken || storedToken === "null") return;

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const resp = await fetch(`${BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${storedToken}` },
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.status !== 200) throw new Error("failed to load profile");
        const data = await resp.json();
        if (isMounted) setProfile(data);
      } catch (err) {
        // Unreachable/slow backend or an invalid token - fall back to the
        // logged-out nav instead of leaving profile stuck at null forever,
        // which would otherwise render neither nav branch.
        await setToken(null);
        if (isMounted) setTokenState(null);
      }
    }
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function fetchCounts() {
      const storedToken = await getToken();
      if (!storedToken || storedToken === "null") return;

      try {
        const [matchedResp, likedResp] = await Promise.all([
          fetch(`${BASE_URL}/matches/unseen_count`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          }),
          fetch(`${BASE_URL}/likes/profile_likes/unseen_count`, {
            headers: { Authorization: `Bearer ${storedToken}` },
          }),
        ]);
        const matched = matchedResp.ok ? await matchedResp.json() : { count: 0 };
        const liked = likedResp.ok ? await likedResp.json() : { count: 0 };
        if (!isMounted) return;
        setMatchCount(matched.count || 0);
        setLikeCount(liked.count || 0);
      } catch (err) {
        // Leave counts as-is if the backend is unreachable - a missing
        // badge isn't worth disrupting the rest of the nav for.
      }
    }

    fetchCounts();
    const interval = setInterval(fetchCounts, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  async function handleLogout() {
    await clearSession();
    setTokenState(null);
    setProfile(null);
    navigation.navigate("Home");
  }

  return (
    <View
      style={[
        styles.head,
        { paddingTop: insets.top + 10 },
        isTransparent ? styles.headTransparent : styles.headLight,
      ]}
    >
      <View style={styles.logoRow}>
        <Logo size={40} />
      </View>
      <View style={styles.nav}>
        {!isTokenMissing && profile !== null && (
          <>
            <NavItem
              label={t("nav.profile")}
              onPress={() => navigation.navigate("Profile")}
              transparent={isTransparent}
            />
            <NavItem
              label={t("nav.browse")}
              onPress={() => navigation.navigate("Profiles")}
              transparent={isTransparent}
            />
            <NavItem
              label={t("nav.matches")}
              onPress={() => navigation.navigate("MatchedList")}
              transparent={isTransparent}
              badge={matchCount}
            />
            <NavItem
              label={t("nav.likesYou")}
              onPress={() => navigation.navigate("LikedYou")}
              transparent={isTransparent}
              badge={likeCount}
            />
            <NavItem
              label={t("nav.logout")}
              onPress={handleLogout}
              transparent={isTransparent}
              highlight
            />
          </>
        )}
        {isTokenMissing && (
          <>
            <NavItem
              label={t("nav.home")}
              onPress={() => navigation.navigate("Home")}
              transparent={isTransparent}
            />
            <NavItem
              label={t("nav.signUp")}
              onPress={() => navigation.navigate("SignUp")}
              transparent={isTransparent}
            />
            <NavItem
              label={t("nav.login")}
              onPress={() => navigation.navigate("Login")}
              transparent={isTransparent}
              highlight
            />
          </>
        )}

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
    </View>
  );
}

function NavItem({ label, onPress, transparent, highlight, badge = 0 }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
        transparent ? styles.navItemBorderTransparent : styles.navItemBorderLight,
        highlight && styles.navItemHighlight,
        pressed && (transparent ? styles.navItemPressedTransparent : styles.navItemPressedLight),
      ]}
    >
      <View style={styles.navItemRow}>
        <Text
          style={[
            styles.navText,
            transparent ? styles.navTextTransparent : styles.navTextLight,
            highlight && styles.navTextHighlight,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
          </View>
        )}
      </View>
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
    marginBottom: 8,
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
  },
  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  navItemBorderLight: {
    borderColor: "rgba(214,51,108,0.35)",
  },
  navItemBorderTransparent: {
    borderColor: "rgba(255,255,255,0.35)",
  },
  navItemHighlight: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.sm,
  },
  navItemPressedLight: {
    backgroundColor: colors.primarySoft,
    borderColor: "rgba(214,51,108,0.6)",
  },
  navItemPressedTransparent: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderColor: "rgba(255,255,255,0.6)",
  },
  navItemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: "#ff2d55",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  navText: {
    fontSize: 14,
    fontWeight: "600",
  },
  navTextLight: {
    color: colors.primary,
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
    marginTop: 4,
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
