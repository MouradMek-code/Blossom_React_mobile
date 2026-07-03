import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, Pressable, Animated } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing, shadow } from "../theme";

export default function ProfileDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { id } = route.params;

  const [profile, setProfile] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [liked, setLiked] = useState(false);
  const [liking, setLiking] = useState(false);
  const [matchToast, setMatchToast] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/profile/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setProfile(data);
    }
    fetchProfile();
  }, [id]);

  async function handleLike() {
    if (liked || liking) return;
    setLiking(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/likes/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      const data = await resp.json();
      setLiked(true);
      if (data.matched) {
        setMatchToast(true);
        setTimeout(() => setMatchToast(false), 3000);
      }
    } catch (err) {
      console.log(err);
    } finally {
      setLiking(false);
    }
  }

  function handleBlock() {
    setBlockModalVisible(true);
  }

  async function confirmBlock() {
    setBlocking(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/blocks/${id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error("Failed to block");
      navigation.navigate("Profiles");
    } catch (err) {
      console.log("Block failed:", err);
      setBlocking(false);
    }
  }

  function handleReport() {
    setReportReason("");
    setReportModalVisible(true);
  }

  async function submitReport() {
    const reason = reportReason.trim();
    if (!reason) return;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/reports`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reported_profile_id: Number(id), reason }),
      });
      if (!resp.ok) throw new Error("Failed to submit report");
      setReportModalVisible(false);
    } catch (err) {
      console.log("Report failed:", err);
    }
  }

  if (!profile) {
    return (
      <View style={[styles.head, { backgroundColor: colors.background }]}>
        <PageNav />
        <Text style={[styles.loading, { color: colors.textMuted }]}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.head, { backgroundColor: colors.background }]}>
      <PageNav />

      <ProfileView
        profile={profile}
        showLocationLine={false}
        onBlock={handleBlock}
        onReport={handleReport}
        blocking={blocking}
      />

      {/* STICKY ACTION BAR */}
      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          style={[styles.passBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.passBtnText}>✕</Text>
        </Pressable>

        <Pressable
          style={[styles.likeBtn, liked && styles.likeBtnDone]}
          onPress={handleLike}
          disabled={liked || liking}
        >
          <Text style={styles.likeBtnText}>{liked ? "💖" : "❤️"}</Text>
        </Pressable>
      </View>

      {/* MATCH TOAST */}
      {matchToast && (
        <View style={styles.matchToast}>
          <Text style={styles.matchToastText}>🎉 It's a Match with {profile.first_name}!</Text>
        </View>
      )}

      {/* BLOCK MODAL */}
      <Modal visible={blockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Block {profile.first_name}?</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              You won't see each other again and won't be able to message them.
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setBlockModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalDestructiveButton} onPress={confirmBlock} disabled={blocking}>
                <Text style={styles.modalSubmitText}>{blocking ? "Blocking…" : "Block"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* REPORT MODAL */}
      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Report this profile</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>Why are you reporting {profile.first_name}?</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Describe the issue…"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setReportModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitButton} onPress={submitReport}>
                <Text style={styles.modalSubmitText}>Submit</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1 },
  loading: { textAlign: "center", marginTop: 40, fontSize: 16 },

  /* Sticky bar */
  actionBar: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 24,
    paddingTop: 14,
    borderTopWidth: 1,
    ...shadow.md,
  },
  passBtn: {
    width: 54, height: 54, borderRadius: 27,
    borderWidth: 2,
    alignItems: "center", justifyContent: "center",
    ...shadow.sm,
  },
  passBtnText: { fontSize: 20, color: "#999" },
  likeBtn: {
    width: 66, height: 66, borderRadius: 33,
    backgroundColor: "#E0245A",
    alignItems: "center", justifyContent: "center",
    ...shadow.md,
  },
  likeBtnDone: { backgroundColor: "#ff6b9d" },
  likeBtnText: { fontSize: 28 },

  /* Toast */
  matchToast: {
    position: "absolute",
    top: 100, left: 20, right: 20,
    backgroundColor: "#E0245A",
    borderRadius: 999,
    padding: 14,
    alignItems: "center",
    ...shadow.lg,
  },
  matchToastText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  /* Modals */
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center", justifyContent: "center", padding: spacing.lg,
  },
  modalCard: { width: "100%", borderRadius: radius.lg, padding: spacing.lg, ...shadow.md },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: spacing.xs },
  modalSubtitle: { marginBottom: spacing.md, lineHeight: 20 },
  modalInput: {
    borderWidth: 1.5, borderRadius: radius.sm,
    padding: spacing.md, minHeight: 80, textAlignVertical: "top",
  },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, justifyContent: "flex-end" },
  modalCancelButton: { paddingHorizontal: 14, paddingVertical: 10 },
  modalCancelText: { fontWeight: "600" },
  modalSubmitButton: { backgroundColor: "#E0245A", paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  modalDestructiveButton: { backgroundColor: "#dc2626", paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  modalSubmitText: { color: "#fff", fontWeight: "700" },
});
