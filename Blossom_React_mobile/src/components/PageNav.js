import { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Logo from "./Logo";
import { BASE_URL } from "../api/config";
import { getToken, setToken, clearSession } from "../api/storage";
import { colors, radius, shadow } from "../theme";

export default function PageNav({ variant = "light" }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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
      <Logo size={40} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.nav}
      >
        {!isTokenMissing && profile !== null && (
          <>
            <NavItem
              label="Profile"
              onPress={() => navigation.navigate("Profile")}
              transparent={isTransparent}
            />
            <NavItem
              label="Browse"
              onPress={() => navigation.navigate("Profiles")}
              transparent={isTransparent}
            />
            <NavItem
              label="Matches"
              onPress={() => navigation.navigate("MatchedList")}
              transparent={isTransparent}
              badge={matchCount}
            />
            <NavItem
              label="Likes You"
              onPress={() => navigation.navigate("LikedYou")}
              transparent={isTransparent}
              badge={likeCount}
            />
            <NavItem
              label="Logout"
              onPress={handleLogout}
              transparent={isTransparent}
              highlight
            />
          </>
        )}
        {isTokenMissing && (
          <>
            <NavItem
              label="Home"
              onPress={() => navigation.navigate("Home")}
              transparent={isTransparent}
            />
            <NavItem
              label="Sign Up"
              onPress={() => navigation.navigate("SignUp")}
              transparent={isTransparent}
            />
            <NavItem
              label="Login"
              onPress={() => navigation.navigate("Login")}
              transparent={isTransparent}
              highlight
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function NavItem({ label, onPress, transparent, highlight, badge = 0 }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navItem,
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
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingBottom: 10,
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
    alignItems: "center",
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  navItem: {
    marginLeft: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  navItemHighlight: {
    backgroundColor: colors.primary,
    ...shadow.sm,
  },
  navItemPressedLight: {
    backgroundColor: colors.primarySoft,
  },
  navItemPressedTransparent: {
    backgroundColor: "rgba(255,255,255,0.18)",
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
    fontSize: 13,
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
});
