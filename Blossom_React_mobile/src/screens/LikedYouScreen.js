import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { getToken, setToken } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

// /likes/profile_likes only returns the ids of profiles that liked the
// current user, so each id has to be resolved via /profile/{id} to get the
// actual name/photos/etc.
function extractId(entry) {
  if (typeof entry === "number" || typeof entry === "string") return entry;
  return entry.profile_id ?? entry.id ?? entry.liker_id ?? entry.liker_profile_id;
}

export default function LikedYouScreen() {
  const navigation = useNavigation();
  const [likedByProfiles, setLikedByProfiles] = useState([]);
  const [matchedProfile, setMatchedProfile] = useState(null);

  async function fetchLikedBy() {
    const token = await getToken();
    if (!token || token === "null") {
      navigation.navigate("Login");
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/likes/profile_likes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(`error happeneded on likes service : ${data.detail?.[0]?.msg}`);
      }

      const ids = data.map(extractId).filter((id) => id !== undefined && id !== null);
      const profiles = await Promise.all(
        ids.map(async (id) => {
          const profileResp = await fetch(`${BASE_URL}/profile/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const profile = await profileResp.json();
          return {
            id: profile.id ?? id,
            first_name: profile.first_name,
            age: profile.age,
            city: profile.city,
            country: profile.country,
            occupation: profile.occupation,
            photoUrl: profile.photos?.[0]?.image_url || null,
          };
        }),
      );
      setLikedByProfiles(profiles);

      fetch(`${BASE_URL}/likes/profile_likes/mark_seen`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    } catch (err) {
      console.log(err);
      await setToken(null);
      navigation.navigate("Login");
    }
  }

  useEffect(() => {
    fetchLikedBy();
  }, []);

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
      setLikedByProfiles((prev) => prev.filter((p) => p.id !== profile.id));
    } catch (err) {
      console.log(err);
    }
  }

  return (
    <View style={styles.head}>
      <PageNav />
      <Text style={styles.title}>People who like you</Text>

      {matchedProfile && (
        <View style={styles.matchOverlay}>
          <View style={styles.matchCard}>
            <Text style={styles.matchHeart}>❤️</Text>
            <Text style={styles.matchTitle}>It's a Match!</Text>
            <Image source={{ uri: matchedProfile.photoUrl }} style={styles.matchImage} />
            <Text style={styles.matchName}>{matchedProfile.first_name}</Text>
            <Text>You both liked each other</Text>
          </View>
        </View>
      )}

      <FlatList
        data={likedByProfiles}
        keyExtractor={(item) => String(item.id)}
        numColumns={2}
        contentContainerStyle={styles.container}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No likes yet - check back soon!</Text>
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
              <Text style={styles.likeButtonText}>❤️ Like Back</Text>
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
