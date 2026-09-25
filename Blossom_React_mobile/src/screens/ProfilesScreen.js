import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useBottomInset } from "../navigation/useBottomInset";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import PageNav from "../components/PageNav";
import SwipeCard from "../components/SwipeCard";
import ProfileFilterModal from "../components/ProfileFilterModal";
import { matchesFilters, getDefaultFilters } from "../api/profileFilters";
import { seededShuffle } from "../api/shuffle";
import { mergeDeck } from "../api/deck";
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
// How old the deck can get before coming back to Browse (or to the app)
// loads the latest people.
const REFRESH_AFTER_MS = 30000;

// The filters to start with: the saved ones, or the orientation-based default.
async function loadInitialFilters(own) {
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

export default function ProfilesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  const [profiles, setProfiles] = useState([]);
  // Passed or liked during this session: not shown again until "Refresh" on
  // the end-of-deck screen (or new filters) starts the deck over.
  const [passed, setPassed] = useState(() => new Set());
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [startingOver, setStartingOver] = useState(false);
  // One seed per mount: the deck order is random each visit but stays put
  // while the user swipes through it.
  const [deckSeed] = useState(() => Math.random());

  // The refresh runs from app and screen events, long after the render that
  // created it - it reads the current deck through these.
  const profilesRef = useRef(profiles);
  profilesRef.current = profiles;
  const passedRef = useRef(passed);
  passedRef.current = passed;
  const filtersRef = useRef(appliedFilters);
  filtersRef.current = appliedFilters;
  const ownRef = useRef(null);
  // What the filters were set up for (dating / language exchange / both).
  const filtersFor = useRef(null);
  const refreshingRef = useRef(false);

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

  function markPassed(profile) {
    setPassed((cur) => new Set(cur).add(profile.id));
  }

  function handleSwipeRight(profile) {
    likeProfile(profile);
    markPassed(profile);
    // Liked profiles never come back in Browse; take it out of the saved deck
    // too, or the next instant start would show it again.
    const cached = peekCache("browse");
    if (cached) {
      writeCache("browse", { ...cached, profiles: cached.profiles.filter((p) => p.id !== profile.id) });
    }
  }

  function handleSwipeLeft(profile) {
    markPassed(profile);
  }

  // Once, and again only if they switch between dating, language exchange and
  // both (the default filters differ): redoing it on every refresh would undo
  // a change being made in the filter window.
  const setUpFilters = useCallback(async (own) => {
    if (!own) return;
    const type = own.connection_type || "both";
    if (filtersFor.current === type) return;
    filtersFor.current = type;
    const filters = await loadInitialFilters(own);
    setDraftFilters(filters);
    setAppliedFilters(filters);
  }, []);

  // Instant start: the last deck saved on the phone shows at once, while
  // the first refresh fetches the latest.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await readCache("browse");
      if (!alive || !cached) return;
      ownRef.current = ownRef.current || cached.own || null;
      await setUpFilters(cached.own);
      if (!alive) return;
      // Shuffled, so the same faces aren't always first.
      setProfiles((cur) => (cur.length ? cur : seededShuffle(cached.profiles, deckSeed)));
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [deckSeed, setUpFilters]);

  // Loads the latest people and folds them into the deck (see mergeDeck):
  // new members appear right after the card on screen, updated profiles
  // show their new details, and the card under the user's finger never moves.
  // `startOver` also brings back the people passed this session.
  const refresh = useCallback(
    async ({ startOver = false } = {}) => {
      if (refreshingRef.current) return;
      refreshingRef.current = true;
      try {
        const token = await getToken();
        if (!token || token === "null") {
          navigation.navigate("Login");
          return;
        }
        const [profilesResp, ownResp] = await Promise.all([
          // Already leaves out people you liked, matched or blocked.
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
        const own = ownResp.ok ? await ownResp.json() : ownRef.current;
        ownRef.current = own;
        await setUpFilters(own);

        if (startOver) {
          passedRef.current = new Set();
          setPassed(passedRef.current);
        }
        const isUpcoming = (p) =>
          !passedRef.current.has(p.id) && matchesFilters(p, filtersRef.current);
        // Until the first swipe (or when starting over) the order is free to
        // change; after that, only new people slot in.
        const reshuffle = startOver || passedRef.current.size === 0;
        setProfiles((cur) => mergeDeck(cur, data, { isUpcoming, reshuffle, seed: deckSeed }));
        // Capped so the saved copy stays small as the community grows.
        writeCache("browse", { profiles: data.slice(0, 150), own });
        setLoadError(false);
      } catch {
        // No internet or server trouble: stay logged in and keep the deck on
        // screen; only an empty screen needs the retry button.
        if (profilesRef.current.length === 0) setLoadError(true);
      } finally {
        refreshingRef.current = false;
        setLoading(false);
      }
    },
    [navigation, deckSeed, setUpFilters],
  );

  // On first opening, on coming back to Browse, and on coming back to the
  // app - the tab stays alive all session, so it wouldn't reload otherwise.
  useAutoRefresh(refresh, { minIntervalMs: REFRESH_AFTER_MS, key: "browse" });

  async function startOver() {
    setStartingOver(true);
    await refresh({ startOver: true });
    setStartingOver(false);
  }

  const upcoming = useMemo(
    () => profiles.filter((p) => !passed.has(p.id) && matchesFilters(p, appliedFilters)),
    [profiles, passed, appliedFilters],
  );

  const remaining = upcoming.slice(0, 2);
  const activeFilterCount = Object.keys(appliedFilters).length;

  function openFilters() {
    setDraftFilters(appliedFilters);
    setFilterModalVisible(true);
  }

  async function applyFilters() {
    setAppliedFilters(draftFilters);
    // New filters start the deck over, people passed earlier included.
    setPassed(new Set());
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
            ⚙️ {t("browse.filters")}{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </Text>
        </Pressable>
      </View>

      {loadError ? (
        <LoadError
          onRetry={() => {
            setLoading(true);
            refresh();
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
            <Text style={styles.matchTitle}>{t("likesYou.matchTitle")}</Text>
            <Image
              source={{ uri: IMG.thumb(matchedProfile.photos?.[0]?.image_url) }}
              style={styles.matchImage}
            />
            <Text style={styles.matchName}>{matchedProfile.first_name}</Text>
            <Text>{t("likesYou.matchText")}</Text>
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
              {activeFilterCount > 0 ? t("browse.noMatchTitle") : t("browse.emptyTitle")}
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>
              {activeFilterCount > 0 ? t("browse.noMatchText") : t("browse.emptyText")}
            </Text>
            {/* The latest people, and everyone passed this session again. */}
            <Pressable
              style={[styles.refreshButton, startingOver && { opacity: 0.7 }]}
              onPress={startOver}
              disabled={startingOver}
            >
              {startingOver ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.refreshButtonText}>🔄 {t("browse.refresh")}</Text>
              )}
            </Pressable>
          </View>
        ) : (
          remaining
            .map((profile, i) => (
              <SwipeCard
                key={profile.id}
                profile={profile}
                isTop={i === 0}
                onSwipeRight={() => handleSwipeRight(profile)}
                onSwipeLeft={() => handleSwipeLeft(profile)}
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
            onPress={() => handleSwipeLeft(remaining[0])}
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
  refreshButton: {
    marginTop: spacing.lg,
    minWidth: 150,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...shadow.md,
  },
  refreshButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
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
