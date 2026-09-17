import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import Logo from "./Logo";
import { BASE_URL } from "../api/config";
import { getToken, clearSession } from "../api/storage";
import { unregisterPushNotifications } from "../api/push";
import { peekCache, writeCache } from "../api/cache";
import { changeLanguage } from "../i18n";
import { useTheme } from "../context/ThemeContext";
import { colors, radius, shadow } from "../theme";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "عربي" },
];

// `minimal` renders just the logo + language switcher with no navigation
// links - used during profile creation, where the user should complete the
// flow rather than be offered Home/Login/Sign-up escape hatches.
export default function PageNav({ variant = "light", minimal = false }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [activeLang, setActiveLang] = useState(i18n.language?.slice(0, 2) || "en");
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  async function handleLangChange(code) {
    await changeLanguage(code);
    setActiveLang(code);
  }
  // The menu as the previous screen last saw it, so it draws instantly
  // (logged-in links + badges) instead of empty until the server answers.
  const cachedNav = peekCache("nav");
  const [profile, setProfile] = useState(cachedNav?.has_profile ? {} : null);
  const [token, setTokenState] = useState(cachedNav ? "cached" : null);
  const [matchCount, setMatchCount] = useState(cachedNav?.matches || 0);
  const [likeCount, setLikeCount] = useState(cachedNav?.likes || 0);
  const [messageCount, setMessageCount] = useState(cachedNav?.messages || 0);

  const isTokenMissing = !token || token === "null" || token === "undefined";
  const isTransparent = variant === "transparent";

  useEffect(() => {
    let isMounted = true;

    function apply(nav) {
      if (!isMounted) return;
      // No profile yet = mid-signup: keep the session, just no menu links.
      setProfile(nav.has_profile ? {} : null);
      setMatchCount(nav.matches || 0);
      setLikeCount(nav.likes || 0);
      setMessageCount(nav.messages || 0);
    }

    // Backends from before /user/badges: the old four requests.
    async function legacyNav(headers) {
      const [profileResp, matched, liked, unread] = await Promise.all([
        fetch(`${BASE_URL}/profile`, { headers }),
        fetch(`${BASE_URL}/matches/unseen_count`, { headers }).then((r) => (r.ok ? r.json() : {})),
        fetch(`${BASE_URL}/likes/profile_likes/unseen_count`, { headers }).then((r) => (r.ok ? r.json() : {})),
        fetch(`${BASE_URL}/messages/unread_count`, { headers }).then((r) => (r.ok ? r.json() : {})),
      ]);
      return {
        has_profile: profileResp.status === 200,
        matches: matched.count,
        likes: liked.count,
        messages: unread.count,
      };
    }

    // Whole menu in one request: does the profile exist + the three badges.
    async function refresh() {
      const storedToken = await getToken();
      if (!isMounted) return;
      setTokenState(storedToken);
      if (!storedToken || storedToken === "null") {
        setProfile(null);
        return;
      }
      const headers = { Authorization: `Bearer ${storedToken}` };
      try {
        const resp = await fetch(`${BASE_URL}/user/badges`, { headers });
        if (resp.status === 401) {
          // The session itself is invalid - log out, saved screens included.
          await clearSession();
          if (isMounted) {
            setTokenState(null);
            setProfile(null);
          }
          return;
        }
        // An old backend reads "badges" as a user id (422) or doesn't know it.
        const nav = resp.ok ? await resp.json() : await legacyNav(headers);
        writeCache("nav", nav);
        apply(nav);
      } catch (err) {
        // Network trouble: keep showing the last known menu - never hide the
        // links or log anyone out over it.
      }
    }

    refresh();
    // Poll only while this screen is the one on display: screens underneath
    // in the stack stay mounted, and each used to keep polling.
    const interval = setInterval(() => {
      if (navigation.isFocused()) refresh();
    }, 30000);
    // Refresh when a screen comes back into view (e.g. Messages badge after
    // reading a chat). `minimal` is a dependency too: leaving minimal mode at
    // the end of sign-up happens on the same screen, with no focus event.
    const unsubscribe = navigation.addListener("focus", refresh);
    return () => {
      isMounted = false;
      clearInterval(interval);
      unsubscribe();
    };
  }, [navigation, minimal]);

  async function handleLogout() {
    // Before the session goes: a shared phone shouldn't keep getting this
    // account's notifications.
    await unregisterPushNotifications(await getToken());
    await clearSession();
    setTokenState(null);
    setProfile(null);
    // Fresh history, so Back can't return to screens of the logged-out account.
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  }

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
        <Logo size={40} />
      </View>
      <View style={styles.nav}>
        {!minimal && !isTokenMissing && profile !== null && (
          <>
            <NavItem label={t("nav.profile")} onPress={() => navigation.navigate("Profile")} transparent={isTransparent} colors={colors} />
            <NavItem label={t("nav.browse")} onPress={() => navigation.navigate("Profiles")} transparent={isTransparent} colors={colors} />
            <NavItem label={t("nav.dateSpots")} onPress={() => navigation.navigate("DateSpots")} transparent={isTransparent} colors={colors} />
            <NavItem label={t("nav.matches")} onPress={() => navigation.navigate("MatchedList")} transparent={isTransparent} badge={matchCount} colors={colors} />
            <NavItem label={t("nav.messages")} onPress={() => navigation.navigate("Messages")} transparent={isTransparent} badge={messageCount} colors={colors} />
            <NavItem label={t("nav.likesYou")} onPress={() => navigation.navigate("LikedYou")} transparent={isTransparent} badge={likeCount} colors={colors} />
            <NavItem label={t("nav.logout")} onPress={handleLogout} transparent={isTransparent} highlight colors={colors} />
          </>
        )}
        {!minimal && isTokenMissing && (
          <>
            <NavItem label={t("nav.home")} onPress={() => navigation.navigate("Home")} transparent={isTransparent} colors={colors} />
            <NavItem label={t("nav.dateSpots")} onPress={() => navigation.navigate("DateSpots")} transparent={isTransparent} colors={colors} />
            <NavItem label={t("nav.signUp")} onPress={() => navigation.navigate("SignUp")} transparent={isTransparent} colors={colors} />
            <NavItem label={t("nav.login")} onPress={() => navigation.navigate("Login")} transparent={isTransparent} highlight colors={colors} />
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

function NavItem({ label, onPress, transparent, highlight, badge = 0, colors }) {
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
      <View style={styles.navItemRow}>
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
    alignItems: "center",
    justifyContent: "space-between",
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
