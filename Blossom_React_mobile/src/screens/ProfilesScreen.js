import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageNav from "../components/PageNav";
import SwipeCard from "../components/SwipeCard";
import ProfileFilterModal from "../components/ProfileFilterModal";
import { matchesFilters, getDefaultFilters } from "../api/profileFilters";
import { seededShuffle } from "../api/shuffle";
import { BASE_URL } from "../api/config";
import { getToken, setToken } from "../api/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../context/ThemeContext";
import { colors, radius, spacing, shadow, typography } from "../theme";

const FILTERS_KEY = "blossom_filters";
// Bumped when the default-filter logic changes. A stored filter from an older
// version is discarded once so the new orientation-aware default can apply,
// matching the web app (whose sessionStorage naturally resets each session).
const FILTERS_VERSION_KEY = "blossom_filters_version";
const FILTERS_VERSION = "2";

// /likes/profiles_i_liked may return plain ids or objects wrapping one.
function extractLikedId(entry) {
  if (typeof entry === "number" || typeof entry === "string") return entry;
  return entry.profile_id ?? entry.id ?? entry.liked_profile_id;
}

export default function ProfilesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  // One seed per mount: the deck order is random each visit but stays put
  // while the user swipes through it.
  const [deckSeed] = useState(() => Math.random());

  async function likeProfile(profile) {
    const token = await getToken();
    try {
      const resp = await fetch(`${BASE_URL}/likes/${profile.id}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(`error happened on like service : ${data.detail?.[0]?.msg}`);
      }
      if (data.matched) {
        setMatchedProfile(profile);
        setTimeout(() => setMatchedProfile(null), 2000);
      }
    } catch (err) {
      console.log(err);
    }
  }

  function handleSwipeRight(profile) {
    likeProfile(profile);
    setCurrentIndex((i) => i + 1);
  }

  function handleSwipeLeft() {
    setCurrentIndex((i) => i + 1);
  }

  useEffect(() => {
    async function fetchAll() {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }
      try {
        const [profilesResp, likedResp, ownResp] = await Promise.all([
          fetch(`${BASE_URL}/profile/all_profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/likes/profiles_i_liked`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const data = await profilesResp.json();
        if (profilesResp.status !== 200) {
          throw new Error(`error happened on login : ${data.detail?.[0]?.msg}`);
        }
        const likedData = likedResp.ok ? await likedResp.json() : [];
        const likedIds = likedData.map(extractLikedId).filter((id) => id != null);
        // Randomise the deck so the same faces aren't always first.
        setProfiles(seededShuffle(data.filter((p) => !likedIds.includes(p.id)), deckSeed));
        setCurrentIndex(0);

        if (ownResp.ok) {
          const ownData = await ownResp.json();
          const defaults = getDefaultFilters(ownData);
          const savedVersion = await AsyncStorage.getItem(FILTERS_VERSION_KEY);
          const saved = await AsyncStorage.getItem(FILTERS_KEY);
          // Only honour a saved filter from the current version; otherwise fall
          // back to the freshly-computed orientation default and drop the stale
          // one so it can't keep shadowing the new default.
          let initial;
          if (savedVersion === FILTERS_VERSION && saved !== null) {
            initial = JSON.parse(saved);
          } else {
            initial = defaults;
            await AsyncStorage.setItem(FILTERS_VERSION_KEY, FILTERS_VERSION);
            await AsyncStorage.removeItem(FILTERS_KEY);
          }
          setDraftFilters(initial);
          setAppliedFilters(initial);
        }
      } catch (err) {
        await setToken(null);
        navigation.navigate("Login");
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const filteredProfiles = useMemo(
    () => profiles.filter((p) => matchesFilters(p, appliedFilters)),
    [profiles, appliedFilters],
  );

  const remaining = filteredProfiles.slice(currentIndex, currentIndex + 2);
  const activeFilterCount = Object.keys(appliedFilters).length;

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFilterModalVisible(true);
  }

  async function applyFilters() {
    setAppliedFilters(draftFilters);
    setCurrentIndex(0);
    setFilterModalVisible(false);
    await AsyncStorage.setItem(FILTERS_VERSION_KEY, FILTERS_VERSION);
    await AsyncStorage.setItem(FILTERS_KEY, JSON.stringify(draftFilters));
  }

  if (loading) {
    return (
      <View style={[styles.head, { backgroundColor: colors.background }]}>
        <PageNav />
        <View style={styles.empty}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.head, { backgroundColor: colors.background }]}>
      <PageNav />

      <View style={styles.toolbar}>
        <Pressable style={[styles.filterButton, { borderColor: colors.primary, backgroundColor: colors.surface }]} onPress={openFilters}>
          <Text style={[styles.filterButtonText, { color: colors.primary }]}>
            ⚙️ Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Text>
        </Pressable>
      </View>

      <ProfileFilterModal
        visible={filterModalVisible}
        filters={draftFilters}
        onChange={setDraftFilters}
        onApply={applyFilters}
        onClose={() => setFilterModalVisible(false)}
        profiles={profiles}
      />

      {matchedProfile && (
        <View style={styles.matchOverlay}>
          <View style={[styles.matchCard, { backgroundColor: colors.surface }]}>
            <Text style={styles.matchHeart}>❤️</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Image
              source={{ uri: matchedProfile.photos?.[0]?.image_url }}
              style={styles.matchImage}
            />
            <Text style={styles.matchName}>{matchedProfile.first_name}</Text>
            <Text>You both liked each other</Text>
          </View>
        </View>
      )}

      <View style={styles.deck}>
        {remaining.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>
              {activeFilterCount > 0 ? "🔍" : "🌸"}
            </Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {activeFilterCount > 0 ? "No matches for your filters" : "You've seen everyone!"}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {activeFilterCount > 0
                ? "Try widening your search — tap ⚙️ Filters to adjust."
                : "Check back later — new people join every day 💌"}
            </Text>
          </View>
        ) : (
          remaining
            .map((profile, i) => (
              <SwipeCard
                key={profile.id}
                profile={profile}
                isTop={i === 0}
                onSwipeRight={() => handleSwipeRight(profile)}
                onSwipeLeft={() => handleSwipeLeft()}
                onViewDetails={
                  i === 0
                    ? () => navigation.navigate("ProfileDetails", { id: profile.id })
                    : undefined
                }
              />
            ))
            .reverse()
        )}
      </View>

      {remaining.length > 0 && (
        <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
          <Pressable
            style={[styles.actionButton, styles.nopeButton, { backgroundColor: colors.surface }]}
            onPress={() => handleSwipeLeft()}
          >
            <Text style={styles.nopeButtonText}>✕</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.likeButton, { backgroundColor: colors.surface }]}
            onPress={() => handleSwipeRight(remaining[0])}
          >
            <Text style={styles.actionButtonText}>❤️</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  filterButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.surface,
  },
  filterButtonText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  deck: {
    flex: 1,
    margin: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 280,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.lg,
    paddingBottom: spacing.lg,
  },
  actionButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  nopeButton: { borderWidth: 1.5, borderColor: colors.danger },
  likeButton: { borderWidth: 1.5, borderColor: colors.success },
  actionButtonText: { fontSize: 24, color: colors.text },
  nopeButtonText: { fontSize: 24, color: colors.danger, fontWeight: "700" },
  matchOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  matchCard: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: "center",
    ...shadow.lg,
  },
  matchHeart: { fontSize: 40 },
  matchTitle: { ...typography.h2, marginVertical: spacing.sm },
  matchImage: { width: 100, height: 100, borderRadius: 50, marginVertical: spacing.sm },
  matchName: { ...typography.h3 },
});
