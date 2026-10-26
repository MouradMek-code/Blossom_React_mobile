import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Alert, RefreshControl, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { IMG } from "../api/images";
import { formatDeadline } from "../api/offers";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { colors, radius, spacing, shadow } from "../theme";

async function call(path, method = "GET") {
  const token = await getToken();
  return postJson(`${BASE_URL}${path}`, { method, headers: { Authorization: `Bearer ${token}` } });
}

// Admin → 🚩 Reports: who, why, how many times that person was reported.
// "Done" files a report away; "Delete the account" removes the person (the
// report stays, with their name).
export default function AdminReports({ bottomInset = 0, onDeleted }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const [reports, setReports] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const result = await call(`/reports/admin${showAll ? "?all=true" : ""}`);
    if (result.ok) {
      setReports(result.data);
      setError("");
    } else {
      setError(result.message);
    }
    setRefreshing(false);
  }, [showAll]);

  useAutoRefresh(load, { minIntervalMs: 10000 });

  async function done(report) {
    setBusy(report.id);
    const result = await call(`/reports/admin/${report.id}/handled`, "POST");
    setBusy(null);
    if (result.ok) load();
    else setError(result.message);
  }

  function confirmDelete(report) {
    const person = report.reported;
    Alert.alert(t("profileReports.deleteAccount"), t("profileReports.deleteConfirm", { name: person.name }), [
      { text: t("offers.cancel"), style: "cancel" },
      {
        text: t("profileReports.deleteAccount"),
        style: "destructive",
        onPress: async () => {
          setBusy(report.id);
          const result = await call(`/user/admin/users/${person.user_id}`, "DELETE");
          setBusy(null);
          if (!result.ok) {
            setError(t("profileReports.deleteFailed"));
            return;
          }
          onDeleted?.(person.user_id);
          load();
        },
      },
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
      <View style={styles.head}>
        <Text style={styles.title}>{t("profileReports.title")}</Text>
        <Pressable onPress={() => setShowAll((v) => !v)} hitSlop={8}>
          <Text style={styles.toggle}>{showAll ? t("profileReports.hideHandled") : t("profileReports.showAll")}</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {reports === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.lg }} />
      ) : reports.length === 0 ? (
        <Text style={styles.muted}>{t("profileReports.empty")}</Text>
      ) : (
        reports.map((report) => {
          const person = report.reported;
          return (
            <View key={report.id} style={[styles.card, report.handled && { opacity: 0.6 }]}>
              <View style={styles.person}>
                {person.photo ? (
                  <Image source={{ uri: IMG.thumb(person.photo) }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarEmpty]}><Text>🌸</Text></View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {person.name || "?"}{person.age ? `, ${person.age}` : ""}
                    {person.deleted ? <Text style={styles.deleted}>  · {t("profileReports.deleted")}</Text> : null}
                  </Text>
                  <Text style={styles.meta}>
                    {t("profileReports.reportedBy", { name: report.reporter.name || "?" })} ·{" "}
                    {formatDeadline(report.created_at, i18n.language)}
                  </Text>
                  {report.times_reported > 1 ? (
                    <Text style={styles.times}>{t("profileReports.times", { count: report.times_reported })}</Text>
                  ) : null}
                </View>
              </View>
              <Text style={styles.reason}>{report.reason}</Text>
              <View style={styles.actions}>
                {busy === report.id ? <ActivityIndicator color={colors.primary} /> : null}
                {!person.deleted && person.id ? (
                  <Pressable style={styles.secondary} onPress={() => navigation.navigate("ProfileDetails", { id: person.id })}>
                    <Text style={styles.secondaryText}>👤 {t("profileReports.seeProfile")}</Text>
                  </Pressable>
                ) : null}
                {!person.deleted && person.user_id ? (
                  <Pressable style={styles.danger} onPress={() => confirmDelete(report)} disabled={busy === report.id}>
                    <Text style={styles.dangerText}>🗑 {t("profileReports.deleteAccount")}</Text>
                  </Pressable>
                ) : null}
                {report.handled ? (
                  <Text style={styles.handled}>✓ {t("profileReports.handled")}</Text>
                ) : (
                  <Pressable style={styles.done} onPress={() => done(report)} disabled={busy === report.id}>
                    <Text style={styles.doneText}>✓ {t("profileReports.done")}</Text>
                  </Pressable>
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
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  title: { fontSize: 19, fontWeight: "800", color: colors.text },
  toggle: { color: colors.textMuted, fontSize: 13, fontWeight: "600", textDecorationLine: "underline" },
  error: { color: colors.danger, fontWeight: "600", marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14.5, marginTop: spacing.md },
  card: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: "#F3B7B0",
    ...shadow.sm,
  },
  person: { flexDirection: "row", gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 15.5, fontWeight: "800", color: colors.text },
  deleted: { fontSize: 12.5, fontWeight: "600", color: colors.textMuted },
  meta: { fontSize: 12.5, color: colors.textMuted, marginTop: 2 },
  times: {
    alignSelf: "flex-start",
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: "#FDECEA",
    color: colors.danger,
    fontSize: 12,
    fontWeight: "800",
    overflow: "hidden",
  },
  reason: {
    marginVertical: spacing.sm,
    paddingLeft: 10,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    fontSize: 14.5,
    lineHeight: 20,
    color: colors.text,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
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
  done: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: colors.success },
  doneText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  handled: { color: colors.success, fontWeight: "700", fontSize: 13 },
});
