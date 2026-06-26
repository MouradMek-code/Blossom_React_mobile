import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert, Modal, TextInput, Pressable } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { colors, radius, spacing, shadow } from "../theme";

export default function ProfileDetailsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { id } = route.params;
  const [profile, setProfile] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportReason, setReportReason] = useState("");

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

  function handleBlock() {
    Alert.alert(
      "Block this person?",
      "You won't see each other again, and you won't be able to message them.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
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
          },
        },
      ]
    );
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
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reported_profile_id: Number(id), reason }),
      });
      if (!resp.ok) throw new Error("Failed to submit report");
      setReportModalVisible(false);
      Alert.alert("Report submitted", "Thank you for letting us know.");
    } catch (err) {
      console.log("Report failed:", err);
    }
  }

  if (!profile) {
    return (
      <View style={styles.head}>
        <PageNav />
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.head}>
      <PageNav />
      <ProfileView
        profile={profile}
        showLocationLine={false}
        onBlock={handleBlock}
        onReport={handleReport}
        blocking={blocking}
      />

      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Report this profile</Text>
            <Text style={styles.modalSubtitle}>Why are you reporting this profile?</Text>
            <TextInput
              style={styles.modalInput}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder="Describe the issue"
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelButton}
                onPress={() => setReportModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
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
  head: { flex: 1, backgroundColor: "#fff" },
  loading: { textAlign: "center", marginTop: 40 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.md,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: colors.text, marginBottom: spacing.xs },
  modalSubtitle: { color: colors.textMuted, marginBottom: spacing.md },
  modalInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 80,
    textAlignVertical: "top",
    color: colors.text,
  },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, justifyContent: "flex-end" },
  modalCancelButton: { paddingHorizontal: 14, paddingVertical: 10 },
  modalCancelText: { color: colors.textMuted, fontWeight: "600" },
  modalSubmitButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  modalSubmitText: { color: "#fff", fontWeight: "700" },
});
