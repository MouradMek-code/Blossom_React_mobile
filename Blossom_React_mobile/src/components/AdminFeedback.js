import { useCallback, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, Linking, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { formatDeadline } from "../api/offers";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { colors, radius, spacing, shadow } from "../theme";

const KIND_EMOJI = { child_safety: "🛡️", scam: "🎭", harassment: "🚫", bug: "🐞", other: "💬" };

async function call(path, method = "GET", body) {
  const token = await getToken();
  return postJson(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Admin → 🚩 Reports, below the reported profiles: what members and visitors
// sent with "Report a problem" (child safety first). "Mark as done" only
// files it away; reply by email when there's an address.
export default function AdminFeedback() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const [items, setItems] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await call(`/feedback/admin${showAll ? "?all=true" : ""}`);
    if (result.ok) {
      setItems(result.data);
      setError("");
    } else {
      setError(result.message);
    }
  }, [showAll]);

  useAutoRefresh(load, { minIntervalMs: 10000 });

  async function setDone(item, handled) {
    setBusy(item.id);
    const result = await call(`/feedback/admin/${item.id}/handled`, "POST", { handled });
    setBusy(null);
    if (result.ok) load();
    else setError(result.message);
  }

  function confirmDelete(item) {
    Alert.alert(t("feedback.adminDelete"), t("feedback.adminDeleteConfirm"), [
      { text: t("offers.cancel"), style: "cancel" },
      {
        text: t("feedback.adminDelete"),
        style: "destructive",
        onPress: async () => {
          setBusy(item.id);
          const result = await call(`/feedback/admin/${item.id}`, "DELETE");
          setBusy(null);
          if (result.ok) setItems((cur) => cur.filter((x) => x.id !== item.id));
          else setError(result.message);
        },
      },
    ]);
  }

  return (
    <View style={styles.block}>
      <View style={styles.head}>
        <Text style={styles.title}>{t("feedback.adminTitle")}</Text>
        <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
          <Text style={styles.toggle}>{showAll ? t("feedback.adminHideDone") : t("feedback.adminShowAll")}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {items === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
      ) : items.length === 0 ? (
        <Text style={styles.muted}>{t("feedback.adminEmpty")}</Text>
      ) : (
        items.map((item) => (
          <View
            key={item.id}
            style={[styles.card, item.kind === "child_safety" && styles.cardChild, item.handled && { opacity: 0.6 }]}
          >
            <Text style={[styles.kind, item.kind === "child_safety" && styles.kindChild]}>
              {KIND_EMOJI[item.kind]} {t(`feedback.kind_${item.kind}`)}
            </Text>
            <Text style={styles.meta}>
              {item.reporter.name ? t("feedback.adminFrom", { name: item.reporter.name }) : t("feedback.adminVisitor")}
              {item.reporter.email ? ` · ${item.reporter.email}` : ""} · {formatDeadline(item.created_at, i18n.language)}
            </Text>
            {item.about ? (
              <Pressable onPress={() => navigation.navigate("ProfileDetails", { id: item.about.profile_id })}>
                <Text style={styles.about}>👤 {t("feedback.adminAbout", { name: item.about.name || "?" })} ›</Text>
              </Pressable>
            ) : null}
            <Text style={styles.message}>{item.message}</Text>
            <View style={styles.actions}>
              {busy === item.id ? <ActivityIndicator color={colors.primary} /> : null}
              {item.reporter.email ? (
                <Pressable
                  style={styles.secondary}
                  onPress={() => Linking.openURL(`mailto:${item.reporter.email}?subject=${encodeURIComponent("Blossom")}`)}
                >
                  <Text style={styles.secondaryText}>✉️ {t("feedback.adminReply")}</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.secondary} onPress={() => setDone(item, !item.handled)} disabled={busy === item.id}>
                <Text style={styles.secondaryText}>
                  {item.handled ? t("feedback.adminReopen") : `✓ ${t("feedback.adminDone")}`}
                </Text>
              </Pressable>
              <Pressable style={styles.danger} onPress={() => confirmDelete(item)} disabled={busy === item.id}>
                <Text style={styles.dangerText}>{t("feedback.adminDelete")}</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  toggle: { color: colors.textMuted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  error: { color: colors.danger, fontWeight: "600", marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14.5 },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    gap: 6,
    ...shadow.sm,
  },
  cardChild: { borderWidth: 1.5, borderColor: colors.danger },
  kind: { fontSize: 15, fontWeight: "800", color: colors.text },
  kindChild: { color: colors.danger },
  meta: { fontSize: 12.5, color: colors.textMuted },
  about: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
  message: { fontSize: 14.5, lineHeight: 20, color: colors.text },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 4 },
  secondary: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
  },
  secondaryText: { color: colors.textSoft, fontWeight: "700", fontSize: 13 },
  danger: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  dangerText: { color: colors.danger, fontWeight: "700", fontSize: 13 },
});
