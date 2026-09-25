import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useBottomInset } from "../navigation/useBottomInset";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import PageNav from "../components/PageNav";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { IMG } from "../api/images";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";
import { colors, radius, spacing, shadow, typography } from "../theme";

// /likes/profile_likes only returns the ids of profiles that liked the
// current user, so each id has to be resolved via /profile/{id} to get the
// actual name/photos/etc.
function extractId(entry) {
  if (typeof entry === "number" || typeof entry === "string") return entry;
  return entry.profile_id ?? entry.id ?? entry.liker_id ?? entry.liker_profile_id;
}

export default function LikedYouScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  // Last list from this session, shown immediately while it refreshes.
  const [likedByProfiles, setLikedByProfiles] = useState(() => peekCache("likedYou") || []);
  const [matchedProfile, setMatchedProfile] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const fetchLikedBy = useCallback(async () => {
    const token = await getToken();
    if (!token || token === "null") {
      navigation.navigate("Login");
      return;
    }
    // Instant start from the saved list (disk, after an app restart).
    const cached = await readCache("likedYou");
    if (cached) setLikedByProfiles(cached);
    try {
      const toCard = (profile, fallbackId) => ({
        id: profile.id ?? fallbackId,
        first_name: profile.first_name,
        age: profile.age,
        city: profile.city,
        country: profile.country,
        occupation: profile.occupation,
        photoUrl: IMG.thumb(profile.photos?.[0]?.image_url) || null,
      });

      setLoadError(false);
      // One request for the full profiles. Falls back to the older
      // ids-then-fetch-each path if the backend hasn't been deployed yet.
      const resp = await fetch(`${BASE_URL}/likes/profile_likes/profiles`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        await endSessionAndGoToLogin(navigation);
        return;
      }

      if (resp.ok) {
        const full = await resp.json();
        const cards = full.map((p) => toCard(p, p.id));
        setLikedByProfiles(cards);
        writeCache("likedYou", cards);
      } else {
        const legacyResp = await fetch(`${BASE_URL}/likes/profile_likes`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await legacyResp.json();
        if (legacyResp.status !== 200) {
          throw new Error("Could not load the people who liked you.");
        }
        const ids = data.map(extractId).filter((id) => id !== undefined && id !== null);
        const profiles = await Promise.all(
          ids.map(async (id) => {
            const profileResp = await fetch(`${BASE_URL}/profile/${id}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            return toCard(await profileResp.json(), id);
          }),
        );
        setLikedByProfiles(profiles);
        writeCache("likedYou", profiles);
      }

      fetch(`${BASE_URL}/likes/profile_likes/mark_seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } catch (err) {
      // No internet / server trouble: stay logged in. With the saved list on
      // screen just keep it; otherwise offer a retry.
      console.log(err);
      if (!cached) setLoadError(true);
    }
  }, [navigation]);

  // The tab stays mounted all session: refresh each time it's opened and when
  // the app comes back from the background - otherwise new likes would only
  // appear after restarting the app.
  useAutoRefresh(fetchLikedBy, { minIntervalMs: 5000 });

  async function handleLikeBack(profile) {
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
      setLikedByProfiles((prev) => {
        const next = prev.filter((p) => p.id !== profile.id);
        writeCache("likedYou", next);
        return next;
      });
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <View style={styles.head}>
      <PageNav />
      <Text style={styles.title}>{t("likesYou.title")}</Text>
      {loadError ? <LoadError onRetry={fetchLikedBy} /> : null}

      {matchedProfile && (
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchHeart}>❤️</Text>
            <Text style={styles.matchTitle}>{t("likesYou.matchTitle")}</Text>
            <Image source={{ uri: matchedProfile.photoUrl }} style={styles.matchImage} />
            <Text style={styles.matchName}>{matchedProfile.first_name}</Text>
            <Text>{t("likesYou.matchText")}</Text>
          </View>
        </View>
      )}

      <FlatList
        data={likedByProfiles}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        // Room below the last row, so its Like back buttons can scroll clear
        // of the tab bar instead of sitting under it.
        contentContainerStyle={[
          styles.container,
          { paddingBottom: bottomInset + spacing.lg },
        ]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t("likesYou.empty")}</Text>
          </View>
        }
        renderItem={({ item: profile }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.imageWrapper}
              onPress={() => navigation.navigate("ProfileDetails", { id: profile.id })}
            >
              <Image source={{ uri: profile.photoUrl }} style={styles.image} />
              <View style={styles.overlay}>
                <Text style={styles.name}>
                  {profile.first_name}, {profile.age}
                </Text>
                <Text style={styles.location}>
                  📍 {profile.city}, {profile.country}
                </Text>
                {profile.occupation ? (
                  <Text style={styles.tag}>💼 {profile.occupation}</Text>
                ) : null}
              </View>
            </Pressable>

            <Pressable style={styles.likeButton} onPress={() => handleLikeBack(profile)}>
              <Text style={styles.likeButtonText}>❤️ {t("likesYou.likeBack")}</Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: colors.background },
  title: { ...typography.h3, padding: spacing.md, paddingBottom: spacing.xs },
  container: { padding: spacing.sm },
  empty: { alignItems: "center", justifyContent: "center", padding: spacing.xl },
  emptyText: { ...typography.bodyMuted, fontSize: 15 },
  card: {
    flex: 1,
    margin: 6,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    ...shadow.sm,
  },
  imageWrapper: { height: 200 },
  image: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: spacing.sm,
  },
  name: { color: "#fff", fontWeight: "700" },
  location: { color: "#fff", fontSize: 12 },
  tag: { color: "#fff", fontSize: 12, marginTop: 2 },
  likeButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: "center",
  },
  likeButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
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
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  matchHeart: { fontSize: 40 },
  matchTitle: { fontSize: 22, fontWeight: "700", marginVertical: 8 },
  matchImage: { width: 100, height: 100, borderRadius: 50, marginVertical: 8 },
  matchName: { fontSize: 18, fontWeight: "700" },
});
