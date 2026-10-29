import { useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { unregisterPushNotifications } from "../api/push";
import { clearSession, getToken } from "../api/storage";
import { peekCache, writeCache } from "../api/cache";
import { useBottomInset } from "../navigation/useBottomInset";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Reached from the small "Delete account" link at the very bottom of
// Settings. A break or logging out is often all someone needs, so those come
// first; deleting for good is last, and only once the confirmation word is
// typed - it can't happen by accident.
export default function DeleteAccountScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();

  const [paused, setPaused] = useState(() => Boolean(peekCache("ownProfile")?.paused));
  const [pausing, setPausing] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);

  const word = t("deleteAccount.word");
  const confirmed = typed.trim().toUpperCase() === word.toUpperCase();

  async function takeBreak() {
    setPausing(true);
    const result = await postJson(`${BASE_URL}/profile/pause`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${await getToken()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ paused: true }),
    });
    setPausing(false);
    if (!result.ok) {
      Alert.alert(t("pause.failed"));
      return;
    }
    setPaused(true);
    // Settings shows the switch on when we go back.
    const cached = peekCache("ownProfile");
    if (cached) writeCache("ownProfile", { ...cached, paused: true });
  }

  async function logout() {
    await unregisterPushNotifications(await getToken());
    await clearSession();
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  }

  async function deleteAccount() {
    if (!confirmed) return;
    setDeleting(true);
    try {
      const resp = await fetch(`${BASE_URL}/user/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${await getToken()}` },
      });
      if (!resp.ok) throw new Error(`delete failed with ${resp.status}`);
      await clearSession();
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch {
      setDeleting(false);
      Alert.alert(t("settings.deleteFailed"));
    }
  }

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
        <Text style={styles.title}>{t("deleteAccount.title")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.intro}>{t("deleteAccount.intro")}</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("deleteAccount.breakTitle")}</Text>
          <Text style={styles.cardText}>{t("deleteAccount.breakText")}</Text>
          {paused ? (
            <Text style={styles.done}>{t("deleteAccount.breakDone")}</Text>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.primaryBtn, (pressed || pausing) && styles.pressed]}
              onPress={takeBreak}
              disabled={pausing}
              accessibilityRole="button"
            >
              {pausing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>{t("deleteAccount.breakButton")}</Text>
              )}
            </Pressable>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{t("deleteAccount.logoutTitle")}</Text>
          <Text style={styles.cardText}>{t("deleteAccount.logoutText")}</Text>
          <Pressable
            style={({ pressed }) => [styles.outlineBtn, pressed && styles.pressed]}
            onPress={logout}
            accessibilityRole="button"
          >
            <Text style={styles.outlineBtnText}>{t("deleteAccount.logoutButton")}</Text>
          </Pressable>
        </View>

        <View style={[styles.card, styles.deleteCard]}>
          <Text style={styles.cardTitle}>{t("deleteAccount.foreverTitle")}</Text>
          <Text style={styles.cardText}>{t("settings.deleteMessage")}</Text>
          <Text style={styles.typeLabel}>{t("deleteAccount.typeLabel", { word })}</Text>
          <TextInput
            style={styles.input}
            value={typed}
            onChangeText={setTyped}
            placeholder={word}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!deleting}
          />
          <Pressable
            style={({ pressed }) => [
              styles.deleteBtn,
              !confirmed && styles.disabled,
              (pressed || deleting) && confirmed && styles.pressed,
            ]}
            onPress={deleteAccount}
            disabled={!confirmed || deleting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !confirmed || deleting }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.deleteBtnText}>{t("settings.deleteYes")}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
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
  intro: { fontSize: 15, lineHeight: 21, color: colors.textSoft, marginHorizontal: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.sm,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: colors.text },
  cardText: { fontSize: 13.5, lineHeight: 19, color: colors.textSoft },
  done: { fontSize: 14, lineHeight: 20, fontWeight: "700", color: "#1F6B45", marginTop: spacing.xs },
  primaryBtn: {
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 14.5 },
  outlineBtn: {
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: 11,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  outlineBtnText: { color: colors.primary, fontWeight: "800", fontSize: 14.5 },
  // Last, and well apart from the two gentler options.
  deleteCard: { marginTop: spacing.lg, borderWidth: 1, borderColor: "#F3B7B0" },
  typeLabel: { fontSize: 13.5, fontWeight: "700", color: colors.text, marginTop: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  deleteBtn: {
    alignItems: "center",
    marginTop: spacing.xs,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.danger,
  },
  deleteBtnText: { color: "#fff", fontWeight: "800", fontSize: 14.5 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.75 },
});
