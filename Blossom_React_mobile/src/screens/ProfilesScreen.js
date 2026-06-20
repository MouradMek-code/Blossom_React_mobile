import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import SwipeCard from "../components/SwipeCard";
import ProfileFilterModal from "../components/ProfileFilterModal";
import { matchesFilters } from "../api/profileFilters";
import { BASE_URL } from "../api/config";
import { getToken, setToken } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

// /likes/profiles_i_liked may return plain ids or objects wrapping one.
function extractLikedId(entry) {
  if (typeof entry === "number" || typeof entry === "string") return entry;
  return entry.profile_id ?? entry.id ?? entry.liked_profile_id;
}

export default function ProfilesScreen() {
  const navigation = useNavigation();
  const [profiles, setProfiles] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [draftFilters, setDraftFilters] = useState({});
  const [appliedFilters, setAppliedFilters] = useState({});

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
    async function fetchProfiles() {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }
      try {
        const [profilesResp, likedResp] = await Promise.all([
          fetch(`${BASE_URL}/profile/all_profile`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${BASE_URL}/likes/profiles_i_liked`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        const data = await profilesResp.json();
        if (profilesResp.status !== 200) {
          throw new Error(`error happeneded on login : ${data.detail?.[0]?.msg}`);
        }
        const likedData = likedResp.ok ? await likedResp.json() : [];
        const likedIds = likedData.map(extractLikedId).filter((id) => id != null);
        setProfiles(data.filter((p) => !likedIds.includes(p.id)));
        setCurrentIndex(0);
      } catch (err) {
        await setToken(null);
        navigation.navigate("Login");
      }
    }
    fetchProfiles();
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

  function applyFilters() {
    setAppliedFilters(draftFilters);
    setCurrentIndex(0);
    setFilterModalVisible(false);
  }

  return (
    <View style={styles.head}>
      <PageNav />

      <View style={styles.toolbar}>
        <Pressable style={styles.filterButton} onPress={openFilters}>
          <Text style={styles.filterButtonText}>
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
          <View style={styles.matchCard}>
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
            <Text style={styles.emptyText}>
              {activeFilterCount > 0
                ? "No profiles match your filters"
                : "No more profiles for now"}
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
        <View style={styles.actions}>
          <Pressable
            style={[styles.actionButton, styles.nopeButton]}
            onPress={() => handleSwipeLeft()}
          >
            <Text style={styles.actionButtonText}>✕</Text>
          </Pressable>
          <Pressable
            style={[styles.actionButton, styles.likeButton]}
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
  head: { flex: 1, backgroundColor: colors.background },
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
  },
  emptyText: {
    ...typography.bodyMuted,
    fontSize: 16,
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
    backgroundColor: colors.surface,
    ...shadow.md,
  },
  nopeButton: { borderWidth: 1.5, borderColor: colors.danger },
  likeButton: { borderWidth: 1.5, borderColor: colors.success },
  actionButtonText: { fontSize: 24 },
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
    backgroundColor: colors.surface,
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
