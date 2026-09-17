import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useBottomInset } from "../navigation/useBottomInset";
import PageNav from "../components/PageNav";
import SwipeCard from "../components/SwipeCard";
import ProfileFilterModal from "../components/ProfileFilterModal";
import { matchesFilters, getDefaultFilters } from "../api/profileFilters";
import { seededShuffle } from "../api/shuffle";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { IMG } from "../api/images";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../context/ThemeContext";
import { colors, radius, spacing, shadow, typography } from "../theme";

const FILTERS_KEY = "blossom_filters";
// Bumped when the default-filter logic changes. A stored filter from an older
// version is discarded once so the new orientation-aware default can apply,
// matching the web app (whose sessionStorage naturally resets each session).
const FILTERS_VERSION_KEY = "blossom_filters_version";
const FILTERS_VERSION = "2";

export default function ProfilesScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
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
    // Liked profiles never come back in Browse; take it out of the saved deck
    // too, or the next instant start would show it again.
    const cached = peekCache("browse");
    if (cached) {
      writeCache("browse", { ...cached, profiles: cached.profiles.filter((p) => p.id !== profile.id) });
    }
  }

  function handleSwipeLeft() {
    setCurrentIndex((i) => i + 1);
  }

  // The filters to start with: the saved ones, or the orientation-based default.
  async function initialFilters(own) {
    const savedVersion = await AsyncStorage.getItem(FILTERS_VERSION_KEY);
    const saved = await AsyncStorage.getItem(FILTERS_KEY);
    // Only honour a saved filter from the current version; otherwise fall
    // back to the freshly-computed orientation default and drop the stale
    // one so it can't keep shadowing the new default.
    if (savedVersion === FILTERS_VERSION && saved !== null) return JSON.parse(saved);
    await AsyncStorage.setItem(FILTERS_VERSION_KEY, FILTERS_VERSION);
    await AsyncStorage.removeItem(FILTERS_KEY);
    return getDefaultFilters(own);
  }

  useEffect(() => {
    let cancelled = false;

    async function showDeck(list, own) {
      const filters = own ? await initialFilters(own) : null;
      if (cancelled) return;
      if (filters) {
        setDraftFilters(filters);
        setAppliedFilters(filters);
      }
      // Randomise the deck so the same faces aren't always first.
      setProfiles(seededShuffle(list, deckSeed));
    }

    async function fetchAll() {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }

      // Instant start: show the last deck right away (memory, or disk after an
      // app restart) while the fresh one loads.
      const cached = await readCache("browse");
      if (cached && !cancelled) {
        await showDeck(cached.profiles, cached.own);
        setLoading(false);
      }

      try {
        setLoadError(false);
        const [profilesResp, ownResp] = await Promise.all([
          // Already leaves out people you liked, matched or blocked - the
          // separate /likes/profiles_i_liked request this used to make is gone.
          fetch(`${BASE_URL}/profile/all_profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (profilesResp.status === 401) {
          await endSessionAndGoToLogin(navigation);
          return;
        }
        if (profilesResp.status !== 200) {
          throw new Error(`profiles failed with ${profilesResp.status}`);
        }
        const data = await profilesResp.json();
        const own = ownResp.ok ? await ownResp.json() : cached?.own || null;
        // Capped so the saved copy stays small as the community grows.
        writeCache("browse", { profiles: data.slice(0, 150), own });
        // Don't swap the deck out from under someone who's already swiping;
        // the fresh one is saved for next time.
        if (!cancelled && (!cached || currentIndexRef.current === 0)) {
          await showDeck(data, own);
          setCurrentIndex(0);
        }
      } catch (err) {
        // No internet / server trouble: stay logged in. With a saved deck on
        // screen just keep it; otherwise offer a retry.
        if (!cached && !cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAll();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

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

      {loadError ? (
        <LoadError
          onRetry={() => {
            setLoading(true);
            setReloadKey((k) => k + 1);
          }}
        />
      ) : null}

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
              source={{ uri: IMG.thumb(matchedProfile.photos?.[0]?.image_url) }}
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
        <View style={[styles.actions, { paddingBottom: bottomInset + spacing.md }]}>
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
