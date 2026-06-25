import { useEffect, useState } from "react";
import { View, Text, Image, Pressable, FlatList, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { getToken, setToken } from "../api/storage";
import { colors, radius, spacing, shadow } from "../theme";

export default function MatchedListScreen() {
  const navigation = useNavigation();
  const [listMatchedProfiles, setListMatchedProfiles] = useState([]);

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
      setListMatchedProfiles((prev) => prev.filter((p) => p.id !== profile.id));
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
      try {
        const resp = await fetch(`${BASE_URL}/profile/profiles/matched`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (resp.status !== 200) {
          throw new Error(`error happeneded on matching service : ${data.detail?.[0]?.msg}`);
        }
        setListMatchedProfiles(data);

        fetch(`${BASE_URL}/matches/mark_seen`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((markResp) =>
            markResp.text().then((body) => console.log("mark_seen status:", markResp.status, body)),
          )
          .catch((err) => console.log("mark_seen network error:", err));
      } catch (err) {
        await setToken(null);
        navigation.navigate("Login");
      }
    }
    fetchMatchedProfile();
  }, []);

  return (
    <View style={styles.head}>
      <PageNav />
      <FlatList
        data={listMatchedProfiles}
        keyExtractor={(item) => String(item.id)}
        numColumns={1}
        contentContainerStyle={styles.container}
        renderItem={({ item: profile }) => (
          <View style={styles.card}>
            <Pressable
              style={styles.imageWrapper}
              onPress={() => navigation.navigate("ProfileDetails", { id: profile.id })}
            >
              <Image source={{ uri: profile.photos?.[0]?.image_url }} style={styles.image} />
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
