import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Alert, RefreshControl, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { IMG } from "../api/images";
import { POSE_EMOJI, decideSelfie, fetchPendingSelfies } from "../api/verification";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { VERIFIED_BLUE } from "./VerifiedBadge";
import { colors, radius, spacing, shadow } from "../theme";

const REASONS = ["pose", "face", "blurry"];

// Admin → ✓ Verifications: each selfie next to the profile photos, with the
// pose that was asked. Approve gives the badge; Reject asks why (the member
// is told, and gets a new pose to try again).
export default function AdminVerifications({ bottomInset = 0 }) {
  const { t } = useTranslation();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchPendingSelfies();
    if (result.ok) {
      setItems(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setRefreshing(false);
  }, []);

  useAutoRefresh(load, { minIntervalMs: 10000 });

  async function decide(item, approve, reason) {
    setBusy(item.id);
    const result = await decideSelfie(item.id, approve, reason);
    setBusy(null);
    if (result.ok || result.resp?.status === 409) {
      setItems((cur) => (cur || []).filter((i) => i.id !== item.id));
    } else {
      setError(result.message);
    }
  }

  function askReason(item) {
    Alert.alert(t("verified.rejectTitle"), t("verified.rejectQuestion", { name: item.profile.first_name }), [
      ...REASONS.map((reason) => ({
        text: t(`verified.rejectReason_${reason}`),
        onPress: () => decide(item, false, reason),
      })),
      { text: t("offers.cancel"), style: "cancel" },
    ]);
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomInset + spacing.xl }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            load();
          }}
          colors={[colors.primary]}
        />
      }
    >
      <Text style={styles.title}>{t("verified.adminTitle")}</Text>
      <Text style={styles.hint}>{t("verified.adminHint")}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>{t("verified.adminEmpty")}</Text>
      ) : (
        items.map((item) => {
          const p = item.profile;
          return (
            <View key={item.id} style={styles.card}>
              <Text style={styles.name}>
                {p.first_name}
                {p.age ? `, ${p.age}` : ""}
              </Text>
              <Text style={styles.meta}>📍 {[p.city, p.country].filter(Boolean).join(", ")}</Text>

              <View style={styles.pose}>
                <Text style={styles.poseEmoji}>{POSE_EMOJI[item.pose] || "🙂"}</Text>
                <Text style={styles.poseText}>
                  {t("verified.adminPose")} {t(`verified.pose_${item.pose}`)}
                </Text>
              </View>

              <View style={styles.compare}>
                <View style={styles.selfieWrap}>
                  {item.selfie ? (
                    <Image source={{ uri: item.selfie }} style={styles.selfie} />
                  ) : (
                    <View style={[styles.selfie, styles.missing]} />
                  )}
                  <Text style={styles.caption}>{t("verified.adminSelfie")}</Text>
                </View>
                <View style={styles.photos}>
                  {p.photos.slice(0, 4).map((url) => (
                    <Image key={url} source={{ uri: IMG.thumb(url) }} style={styles.photo} />
                  ))}
                  <Text style={[styles.caption, styles.captionWide]}>{t("verified.adminPhotos")}</Text>
                </View>
              </View>

              <View style={styles.actions}>
                {busy === item.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Pressable
                      style={({ pressed }) => [styles.approve, pressed && { opacity: 0.8 }]}
                      onPress={() => decide(item, true)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.approveText}>✓ {t("verified.approve")}</Text>
                    </Pressable>
                    <Pressable
                      style={({ pressed }) => [styles.reject, pressed && { opacity: 0.8 }]}
                      onPress={() => askReason(item)}
                      accessibilityRole="button"
                    >
                      <Text style={styles.rejectText}>{t("verified.reject")}</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 2, marginBottom: spacing.md, lineHeight: 18 },
  error: { color: colors.danger, fontWeight: "600", marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14.5, marginTop: spacing.md },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    ...shadow.sm,
  },
  name: { fontSize: 16, fontWeight: "800", color: colors.text },
  meta: { fontSize: 12.5, color: colors.textMuted, marginTop: -4 },
  pose: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: radius.sm,
    backgroundColor: "#EEF4FE",
  },
  poseEmoji: { fontSize: 30 },
  poseText: { flex: 1, fontSize: 14, fontWeight: "700", color: colors.text },
  compare: { flexDirection: "row", gap: 10 },
  selfieWrap: { flex: 1.15 },
  selfie: { width: "100%", aspectRatio: 3 / 4, borderRadius: radius.sm, backgroundColor: colors.border },
  missing: { opacity: 0.5 },
  photos: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6, alignContent: "flex-start" },
  photo: { width: "47%", aspectRatio: 3 / 4, borderRadius: 8, backgroundColor: colors.border },
  caption: { fontSize: 11.5, color: colors.textMuted, marginTop: 4, textAlign: "center" },
  captionWide: { width: "100%" },
  actions: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4 },
  approve: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderRadius: radius.pill,
    backgroundColor: VERIFIED_BLUE,
  },
  approveText: { color: "#fff", fontWeight: "800", fontSize: 14.5 },
  reject: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  rejectText: { color: colors.danger, fontWeight: "800", fontSize: 14.5 },
});
