import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import LocationFields from "../components/LocationFields";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { tidyCity } from "../api/geo";
import { changeLanguage } from "../i18n";
import { unregisterPushNotifications, updatePushLanguage } from "../api/push";
import { clearSession, getToken } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";
import { useBottomInset } from "../navigation/useBottomInset";
import { colors, radius, spacing, shadow, typography } from "../theme";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
];

const PRIVACY_URL = "https://blossom-date.com/privacy-policy";
const TERMS_URL = "https://blossom-date.com/terms";
const SUPPORT_EMAIL = "mailto:mourad.meknioui@gmail.com";

// Everything about the account rather than about dating: language, where you
// live, the legal pages, logging out and deleting the account. Reached from
// the gear on your own profile, so "Log out" is never one stray tap away.
export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();

  const [language, setLanguage] = useState(i18n.language?.slice(0, 2) || "en");
  const [profile, setProfile] = useState(() => peekCache("ownProfile"));
  const [editingLocation, setEditingLocation] = useState(false);
  const [locationDraft, setLocationDraft] = useState({ country: "", city: "" });
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState("");
  const [deleting, setDeleting] = useState(false);

  // The saved profile shows the current city at once; the refresh keeps it
  // right if it was changed elsewhere.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await readCache("ownProfile");
      if (cached && alive) setProfile((cur) => cur || cached);
      const token = await getToken();
      if (!token || token === "null") return;
      try {
        const resp = await fetch(`${BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!resp.ok || !alive) return;
        const data = await resp.json();
        setProfile(data);
        writeCache("ownProfile", data);
      } catch {
        // Offline: the saved copy is enough to show the current city.
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function pickLanguage(code) {
    if (code === language) return;
    await changeLanguage(code);
    setLanguage(code);
    // Notifications are written by the server in the language saved with this
    // phone, so tell it about the change too.
    updatePushLanguage(await getToken(), code);
  }

  function startEditingLocation() {
    setLocationDraft({ country: profile?.country || "", city: profile?.city || "" });
    setLocationError("");
    setEditingLocation(true);
  }

  async function saveLocation() {
    setSavingLocation(true);
    setLocationError("");
    const query =
      `country=${encodeURIComponent(locationDraft.country)}` +
      `&city=${encodeURIComponent(tidyCity(locationDraft.city))}`;
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/profile/update_city_country?${query}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSavingLocation(false);
    if (!result.ok) {
      setLocationError(result.message);
      return;
    }
    setProfile(result.data);
    // So the profile tab shows the new city without refetching.
    writeCache("ownProfile", result.data);
    setEditingLocation(false);
  }

  function confirmLogout() {
    Alert.alert(t("settings.logoutTitle"), t("settings.logoutMessage"), [
      { text: t("settings.cancel"), style: "cancel" },
      { text: t("settings.logout"), style: "destructive", onPress: logout },
    ]);
  }

  async function logout() {
    // A shared phone shouldn't keep getting this account's notifications.
    await unregisterPushNotifications(await getToken());
    await clearSession();
    // Fresh history, so Back can't return to the logged-out account's screens.
    navigation.reset({ index: 0, routes: [{ name: "Home" }] });
  }

  function confirmDeleteAccount() {
    Alert.alert(t("settings.deleteTitle"), t("settings.deleteMessage"), [
      { text: t("settings.cancel"), style: "cancel" },
      { text: t("settings.delete"), style: "destructive", onPress: deleteAccount },
    ]);
  }

  async function deleteAccount() {
    setDeleting(true);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/user/me`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`delete failed with ${resp.status}`);
      await clearSession();
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch {
      setDeleting(false);
      Alert.alert(t("settings.deleteFailed"));
    }
  }

  const place = [profile?.city, profile?.country].filter(Boolean).join(", ");
  const locationReady = Boolean(locationDraft.country && locationDraft.city.trim());

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
        <Text style={styles.title}>{t("settings.title")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}
      >
        <Section title={t("settings.language")}>
          {LANGUAGES.map((option, index) => (
            <Pressable
              key={option.code}
              style={({ pressed }) => [
                styles.row,
                index === LANGUAGES.length - 1 && styles.rowLast,
                pressed && styles.rowPressed,
              ]}
              onPress={() => pickLanguage(option.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: language === option.code }}
            >
              <Text style={[styles.rowLabel, language === option.code && styles.rowLabelActive]}>
                {option.label}
              </Text>
              {language === option.code ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
        </Section>

        <Section title={t("settings.location")}>
          {editingLocation ? (
            <View style={styles.editor}>
              <LocationFields
                country={locationDraft.country}
                city={locationDraft.city}
                onChange={setLocationDraft}
              />
              {locationError !== "" ? <Text style={styles.error}>{locationError}</Text> : null}
              <View style={styles.editorActions}>
                <Pressable
                  style={[styles.primaryBtn, !locationReady && styles.btnDisabled]}
                  onPress={saveLocation}
                  disabled={savingLocation || !locationReady}
                >
                  {savingLocation ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>{t("location.save")}</Text>
                  )}
                </Pressable>
                <Pressable style={styles.outlineBtn} onPress={() => setEditingLocation(false)}>
                  <Text style={styles.outlineBtnText}>{t("location.cancel")}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
              onPress={startEditingLocation}
              accessibilityRole="button"
            >
              <Text style={styles.rowLabel}>📍 {place || t("location.notSet")}</Text>
              <Text style={styles.rowAction}>{t("location.change")}</Text>
            </Pressable>
          )}
        </Section>

        <Section title={t("settings.about")}>
          <LinkRow label={t("settings.privacy")} url={PRIVACY_URL} />
          <LinkRow label={t("settings.terms")} url={TERMS_URL} />
          <LinkRow label={t("settings.support")} url={SUPPORT_EMAIL} last />
        </Section>

        <Section title={t("settings.account")}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={confirmLogout}
            accessibilityRole="button"
          >
            <Text style={styles.rowLabel}>{t("settings.logout")}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.row, styles.rowLast, pressed && styles.rowPressed]}
            onPress={confirmDeleteAccount}
            disabled={deleting}
            accessibilityRole="button"
          >
            <Text style={[styles.rowLabel, styles.danger]}>{t("settings.deleteAccount")}</Text>
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={[styles.chevron, styles.danger]}>›</Text>
            )}
          </Pressable>
        </Section>

        <Text style={styles.footnote}>
          {t("settings.footnote", { year: new Date().getFullYear() })}
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function LinkRow({ label, url, last }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, last && styles.rowLast, pressed && styles.rowPressed]}
      onPress={() => Linking.openURL(url)}
      accessibilityRole="link"
    >
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
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
  content: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...shadow.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: colors.primaryTint },
  rowLabel: { flex: 1, fontSize: 15.5, color: colors.text, fontWeight: "500" },
  rowLabelActive: { color: colors.primary, fontWeight: "700" },
  rowAction: { color: colors.primary, fontWeight: "700", fontSize: 14 },
  check: { color: colors.primary, fontSize: 17, fontWeight: "700" },
  chevron: { fontSize: 22, color: colors.textMuted },
  danger: { color: colors.danger },
  editor: { paddingVertical: spacing.md },
  editorActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm, fontSize: 13 },
  primaryBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
  outlineBtn: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: radius.pill,
  },
  outlineBtnText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  footnote: { ...typography.bodyMuted, fontSize: 12, textAlign: "center", marginTop: spacing.sm },
});
