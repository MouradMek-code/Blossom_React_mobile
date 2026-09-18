import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, Pressable, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { peekCache, writeCache } from "../api/cache";
import { goToTab } from "../navigation/goToTab";
import { useTheme } from "../context/ThemeContext";
import { radius, spacing, shadow, typography } from "../theme";

// Someone's full profile. Liking and passing happen on the Browse cards, not
// here. Opened from a chat (`matched`), it also offers Unmatch next to Report
// and Block.
export default function ProfileDetailsScreen() {
  const { t } = useTranslation();
  const route = useRoute();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { id, matched = false } = route.params;

  const [profile, setProfile] = useState(null);
  const [blocking, setBlocking] = useState(false);
  const [unmatching, setUnmatching] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [blockModalVisible, setBlockModalVisible] = useState(false);
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
      goToTab(navigation, "Profiles");
    } catch (err) {
      console.log("Block failed:", err);
      setBlocking(false);
    }
  }

  // The server deletes the conversation with the match, hence the confirmation.
  function handleUnmatch() {
    Alert.alert(
      t("messages.unmatchTitle", { name: profile.first_name }),
      t("messages.unmatchMessage"),
      [
        { text: t("safety.cancel"), style: "cancel" },
        { text: t("messages.unmatch"), style: "destructive", onPress: unmatch },
      ],
    );
  }

  async function unmatch() {
    setUnmatching(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/matches/unmatch/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`unmatch failed with ${resp.status}`);
      // Gone from the chats list straight away, not after the next refresh.
      const inbox = peekCache("inbox");
      if (inbox) writeCache("inbox", inbox.filter((i) => i.profile.id !== Number(id)));
      goToTab(navigation, "Messages");
    } catch {
      setUnmatching(false);
      Alert.alert(t("messages.unmatchFailed"));
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

  const header = (
    <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
      <Pressable
        onPress={() => navigation.goBack()}
        hitSlop={10}
        style={styles.back}
        accessibilityRole="button"
        accessibilityLabel={t("safety.back")}
      >
        <Text style={[styles.backText, { color: colors.text }]}>←</Text>
      </Pressable>
      {profile ? (
        <Text style={styles.headerTitle} numberOfLines={1}>
          {profile.first_name}
        </Text>
      ) : null}
    </View>
  );

  if (!profile) {
    return (
      <View style={[styles.head, { backgroundColor: colors.background }]}>
        <PageNav />
        {header}
        <Text style={[styles.loading, { color: colors.textMuted }]}>{t("loading")}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.head, { backgroundColor: colors.background }]}>
      <PageNav />
      {header}

      <ProfileView
        profile={profile}
        showLocationLine={false}
        onBlock={handleBlock}
        onReport={handleReport}
        onUnmatch={matched ? handleUnmatch : undefined}
        blocking={blocking}
        unmatching={unmatching}
      />

      {/* BLOCK MODAL */}
      <Modal visible={blockModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {t("safety.blockTitle", { name: profile.first_name })}
            </Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              {t("safety.blockMessage")}
            </Text>
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setBlockModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>{t("safety.cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalDestructiveButton} onPress={confirmBlock} disabled={blocking}>
                <Text style={styles.modalSubmitText}>
                  {blocking ? t("safety.blocking") : t("safety.block")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* REPORT MODAL */}
      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t("safety.reportTitle")}</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
              {t("safety.reportQuestion", { name: profile.first_name })}
            </Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.text }]}
              value={reportReason}
              onChangeText={setReportReason}
              placeholder={t("safety.reportPlaceholder")}
              placeholderTextColor={colors.textMuted}
              multiline
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancelButton} onPress={() => setReportModalVisible(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>{t("safety.cancel")}</Text>
              </Pressable>
              <Pressable style={styles.modalSubmitButton} onPress={submitReport}>
                <Text style={styles.modalSubmitText}>{t("safety.submit")}</Text>
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

  /* Back + name */
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22 },
  headerTitle: { ...typography.h3, flex: 1 },

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
  modalSubmitButton: { backgroundColor: "#C1466B", paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  modalDestructiveButton: { backgroundColor: "#dc2626", paddingHorizontal: 18, paddingVertical: 10, borderRadius: radius.pill },
  modalSubmitText: { color: "#fff", fontWeight: "700" },
});
