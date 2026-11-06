import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useBottomInset } from "../navigation/useBottomInset";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import PageNav from "../components/PageNav";
import LoadError from "../components/LoadError";
import MatchCelebration from "../components/MatchCelebration";
import { Button, EmptyState, Icon, SkeletonTiles, haptics } from "../ui";
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
  const [likedByProfiles, setLikedByProfiles] = useState(() => peekCache("likedYou") || null);
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
      // Seen now: the ❤️ in the top bar and the circle in Chats drop their "new".
      const nav = peekCache("nav");
      if (nav?.likes) writeCache("nav", { ...nav, likes: 0 });
      const summary = peekCache("likesSummary");
      if (summary?.new) writeCache("likesSummary", { ...summary, new: 0 });
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
    haptics.like();
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
      // The match moment stays until they choose: write, or keep going.
      if (data.matched) setMatchedProfile(profile);
      setLikedByProfiles((prev) => {
        const next = (prev || []).filter((p) => p.id !== profile.id);
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
      {/* Opened from the banner at the top of Chats (or a "like" notification). */}
      <View style={styles.titleRow}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={6}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("messages.back")}
        >
          <Icon name="arrow-left" size={24} />
        </Pressable>
        <Text style={styles.title}>{t("likesYou.title")}</Text>
      </View>
      {loadError ? <LoadError onRetry={fetchLikedBy} /> : null}

      {matchedProfile ? (
        <MatchCelebration
          me={peekCache("browse")?.own}
          them={{ first_name: matchedProfile.first_name, photos: [{ image_url: matchedProfile.photoUrl }] }}
          onClose={() => setMatchedProfile(null)}
          onMessage={() => {
            setMatchedProfile(null);
            navigation.navigate("Main", { screen: "Messages" });
          }}
        />
      ) : null}

      {likedByProfiles === null && !loadError ? <SkeletonTiles count={2} /> : null}

      <FlatList
        data={likedByProfiles || []}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        // Room below the last row, so its Like back buttons can scroll clear
        // of the tab bar instead of sitting under it.
        contentContainerStyle={[
          styles.container,
          { paddingBottom: bottomInset + spacing.lg },
        ]}
        ListEmptyComponent={
          likedByProfiles === null ? null : (
            <EmptyState
              icon="heart"
              text={t("likesYou.empty")}
              actionTitle={t("messages.browse")}
              actionIcon="users"
              onAction={() => navigation.navigate("Main", { screen: "Profiles" })}
            />
          )
        }
        renderItem={({ item: profile }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.imageWrapper}
              onPress={() => navigation.navigate("ProfileDetails", { id: profile.id })}
              accessibilityRole="button"
              accessibilityLabel={`${profile.first_name}, ${profile.age}`}
            >
              <Image source={{ uri: profile.photoUrl }} style={styles.image} />
              <View style={styles.overlay}>
                <Text style={styles.name} numberOfLines={1}>
                  {profile.first_name}, {profile.age}
                </Text>
                {profile.city || profile.country ? (
                  <View style={styles.line}>
                    <Icon name="map-pin" size={12} color="#fff" />
                    <Text style={styles.lineText} numberOfLines={1}>
                      {[profile.city, profile.country].filter(Boolean).join(", ")}
                    </Text>
                  </View>
                ) : null}
                {profile.occupation ? (
                  <View style={styles.line}>
                    <Icon name="briefcase" size={12} color="#fff" />
                    <Text style={styles.lineText} numberOfLines={1}>{profile.occupation}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>

            <Button
              title={t("likesYou.likeBack")}
              icon="heart"
              small
              onPress={() => handleLikeBack(profile)}
              style={styles.likeButton}
            />
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: colors.background },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { ...typography.h3, paddingHorizontal: spacing.xs },
  container: { padding: spacing.sm },
  card: {
    flex: 1,
    margin: 6,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    ...shadow.sm,
  },
  imageWrapper: { height: 210 },
  image: { width: "100%", height: "100%" },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(20,14,12,0.6)",
    padding: spacing.sm,
    gap: 3,
  },
  name: { color: "#fff", fontWeight: "800", fontSize: 15 },
  line: { flexDirection: "row", alignItems: "center", gap: 5 },
  lineText: { color: "#fff", fontSize: 12, fontWeight: "600", flexShrink: 1 },
  // Square bottom: the button is the card's foot.
  likeButton: { borderRadius: 0, minHeight: 44 },
});
