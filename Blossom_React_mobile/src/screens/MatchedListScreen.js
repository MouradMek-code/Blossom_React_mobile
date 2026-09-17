import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageNav from "../components/PageNav";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { IMG } from "../api/images";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";
import { colors, radius, spacing, shadow } from "../theme";

export default function MatchedListScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  // Last list from this session, shown immediately while it refreshes.
  const [listMatchedProfiles, setListMatchedProfiles] = useState(() => peekCache("matches") || []);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  async function openConversation(profile) {
    const token = await getToken();
    try {
      const resp = await fetch(`${BASE_URL}/profile/profile/${profile.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail);
      navigation.navigate("Chat", { conversationId: data.conversation_id });
    } catch (err) {
      console.log(err);
    }
  }

  async function unmatch(profile) {
    const token = await getToken();
    try {
      const resp = await fetch(`${BASE_URL}/matches/unmatch/${profile.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to unmatch");
      setListMatchedProfiles((prev) => {
        const next = prev.filter((p) => p.id !== profile.id);
        writeCache("matches", next);
        return next;
      });
    } catch (err) {
      console.log(err);
    }
  }


  useEffect(() => {
    async function fetchMatchedProfile() {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }
      // Instant start from the saved list (disk, after an app restart).
      const cached = await readCache("matches");
      if (cached) setListMatchedProfiles(cached);
      try {
        setLoadError(false);
        const resp = await fetch(`${BASE_URL}/profile/profiles/matched`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 401) {
          await endSessionAndGoToLogin(navigation);
          return;
        }
        if (resp.status !== 200) {
          throw new Error(`matched profiles failed with ${resp.status}`);
        }
        const data = await resp.json();
        setListMatchedProfiles(data);
        writeCache("matches", data);

        fetch(`${BASE_URL}/matches/mark_seen`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((markResp) =>
            markResp.text().then((body) => console.log("mark_seen status:", markResp.status, body)),
          )
          .catch((err) => console.log("mark_seen network error:", err));
      } catch (err) {
        // No internet / server trouble: stay logged in. With the saved list
        // on screen just keep it; otherwise offer a retry.
        if (!cached) setLoadError(true);
      }
    }
    fetchMatchedProfile();
  }, [reloadKey]);

  return (
    <View style={styles.head}>
      <PageNav />
      {loadError ? <LoadError onRetry={() => setReloadKey((k) => k + 1)} /> : null}
      <FlatList
        data={listMatchedProfiles}
        keyExtractor={(item) => String(item.id)}
        numColumns={1}
        // Room below the last card, so its Message/Unmatch buttons can scroll
        // clear of the phone's navigation bar instead of sitting under it.
        contentContainerStyle={[
          styles.container,
          { paddingBottom: Math.max(insets.bottom, 16) + spacing.lg },
        ]}
        renderItem={({ item: profile }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.imageWrapper}
              onPress={() => navigation.navigate("ProfileDetails", { id: profile.id })}
            >
              <Image source={{ uri: IMG.thumb(profile.photos?.[0]?.image_url) }} style={styles.image} />
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

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.messageButton]}
                onPress={() => openConversation(profile)}
              >
                <Text style={styles.messageButtonText}>💬 Message</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.unmatchButton]}
                onPress={() => unmatch(profile)}
              >
                <Text style={styles.unmatchButtonText}>Unmatch</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.sm },
  card: {
    flex: 1,
    margin: 6,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    ...shadow.sm,
  },
  imageWrapper: {
    height: 320,
  },
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
  actionsRow: { flexDirection: "row" },
  actionButton: { paddingVertical: 12, alignItems: "center" },
  messageButton: {
    flex: 2,
    backgroundColor: colors.primary,
  },
  messageButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  unmatchButton: {
    flex: 1,
    backgroundColor: "#555",
    borderLeftWidth: 1,
    borderLeftColor: "rgba(255,255,255,0.3)",
  },
  unmatchButtonText: { color: "#fff", fontWeight: "700", fontSize: 12 },
});
