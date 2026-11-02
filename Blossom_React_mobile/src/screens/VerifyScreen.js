import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import PageNav from "../components/PageNav";
import LoadError from "../components/LoadError";
import VerifiedBadge, { VERIFIED_BLUE } from "../components/VerifiedBadge";
import { POSE_EMOJI, fetchVerification, sendSelfie } from "../api/verification";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { formatDeadline } from "../api/offers";
import { colors, radius, spacing, shadow, typography } from "../theme";

// The ✓ verified badge, in two taps: copy the pose on screen, take a selfie
// with the front camera, send. The Blossom team compares it with the profile
// photos; the selfie is deleted once checked.
export default function VerifyScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  const [state, setState] = useState(null); // { status, pose, reason }
  const [loadError, setLoadError] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchVerification();
    if (result.ok) {
      setState(result.data);
      setLoadError(false);
    } else if (!state) {
      setLoadError(true);
    }
  }, [state]);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  async function takeSelfie() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("verified.cameraTitle"), t("verified.cameraText"));
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        cameraType: ImagePicker.CameraType.front,
        quality: 0.8,
      });
      if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
    } catch {
      Alert.alert(t("verified.cameraTitle"), t("verified.cameraText"));
    }
  }

  async function send() {
    setSending(true);
    const result = await sendSelfie(photo);
    setSending(false);
    if (!result.ok) {
      Alert.alert(t("verified.sendFailed"), result.message);
      return;
    }
    setPhoto(null);
    setState(result.data);
  }

  const status = state?.status;
  const pose = state?.pose;

  return (
    <View style={styles.screen}>
      <PageNav />
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("settings.back")}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>{t("verified.title")}</Text>
      </View>

      {loadError ? (
        <LoadError onRetry={load} />
      ) : !state ? (
        <ActivityIndicator style={{ marginTop: spacing.xl }} color={colors.primary} />
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}>
          {/* Asked by the Blossom team (suspicious profile): the deadline. */}
          {state.deadline && status !== "approved" ? (
            <View style={styles.deadline}>
              <Text style={styles.deadlineText}>
                ⚠️ {t("verified.deadline", { date: formatDeadline(state.deadline, i18n.language) })}
              </Text>
            </View>
          ) : null}
          {status === "approved" ? (
            <View style={[styles.card, styles.center]}>
              <VerifiedBadge size={64} />
              <Text style={styles.bigTitle}>{t("verified.doneTitle")}</Text>
              <Text style={styles.text}>{t("verified.doneText")}</Text>
            </View>
          ) : status === "pending" ? (
            <View style={[styles.card, styles.center]}>
              <Text style={styles.bigEmoji}>⏳</Text>
              <Text style={styles.bigTitle}>{t("verified.pendingTitle")}</Text>
              <Text style={styles.text}>{t("verified.pendingText")}</Text>
            </View>
          ) : (
            <>
              <View style={styles.center}>
                <VerifiedBadge size={52} />
                <Text style={styles.bigTitle}>{t("verified.introTitle")}</Text>
                <Text style={styles.text}>{t("verified.introText")}</Text>
              </View>

              {status === "rejected" && state.reason ? (
                <View style={styles.retry}>
                  <Text style={styles.retryText}>{t(`verified.reason_${state.reason}`)}</Text>
                </View>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.step}>{t("verified.step1")}</Text>
                <View style={styles.poseBox}>
                  <Text style={styles.poseEmoji}>{POSE_EMOJI[pose] || "🙂"}</Text>
                  <Text style={styles.poseText}>{t(`verified.pose_${pose}`)}</Text>
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.step}>{t("verified.step2")}</Text>
                <Text style={styles.text}>{t("verified.step2Text")}</Text>
                {photo ? (
                  <>
                    <Image source={{ uri: photo.uri }} style={styles.preview} />
                    <Pressable
                      style={({ pressed }) => [styles.primaryBtn, (pressed || sending) && styles.pressed]}
                      onPress={send}
                      disabled={sending}
                      accessibilityRole="button"
                    >
                      {sending ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.primaryBtnText}>{t("verified.send")}</Text>
                      )}
                    </Pressable>
                    <Pressable
                      style={styles.linkBtn}
                      onPress={takeSelfie}
                      disabled={sending}
                      accessibilityRole="button"
                    >
                      <Text style={styles.linkBtnText}>{t("verified.retake")}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
                    onPress={takeSelfie}
                    accessibilityRole="button"
                  >
                    <Text style={styles.primaryBtnText}>📸 {t("verified.take")}</Text>
                  </Pressable>
                )}
              </View>

              <Text style={styles.privacy}>🔒 {t("verified.privacy")}</Text>
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: colors.text },
  title: { ...typography.h3, fontSize: 18 },
  content: { padding: spacing.md, gap: spacing.md },
  center: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.sm,
  },
  bigEmoji: { fontSize: 52 },
  bigTitle: { fontSize: 21, fontWeight: "800", color: colors.text, textAlign: "center", marginTop: spacing.xs },
  text: { fontSize: 14.5, lineHeight: 21, color: colors.textSoft, textAlign: "center" },
  retry: {
    backgroundColor: "#FDF1EC",
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  retryText: { fontSize: 14, lineHeight: 20, color: colors.text, fontWeight: "600" },
  deadline: {
    backgroundColor: "#FDECEA",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  deadlineText: { fontSize: 14.5, lineHeight: 21, color: colors.danger, fontWeight: "700" },
  step: { fontSize: 13, fontWeight: "800", color: VERIFIED_BLUE, textTransform: "uppercase", letterSpacing: 0.6 },
  poseBox: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "#EEF4FE",
  },
  poseEmoji: { fontSize: 72 },
  poseText: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center", paddingHorizontal: spacing.md },
  preview: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: radius.md,
    backgroundColor: colors.border,
    marginTop: spacing.xs,
  },
  primaryBtn: {
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: 14,
    borderRadius: radius.pill,
    backgroundColor: VERIFIED_BLUE,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 15.5 },
  pressed: { opacity: 0.8 },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkBtnText: { color: colors.textSoft, fontWeight: "700", fontSize: 14 },
  privacy: { fontSize: 12.5, lineHeight: 18, color: colors.textMuted, textAlign: "center", paddingHorizontal: spacing.md },
});
