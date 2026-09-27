import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
  AppState,
  Linking,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as Notifications from "expo-notifications";
import PageNav from "../components/PageNav";
import AdminDashboard from "../components/AdminDashboard";
import AdminOffers from "../components/AdminOffers";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { registerForPushNotifications } from "../api/push";
import { peekCache, writeCache } from "../api/cache";
import { IMG } from "../api/images";
import { isNewMember } from "../api/newMember";
import { parseServerDate } from "../api/chatTime";
import { CONNECTION_EMOJI, connectionOf } from "../api/connection";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { colors, radius, spacing, shadow, typography } from "../theme";

const FILTERS = ["all", "new", "incomplete"];

// Fewer than 2 photos (or no profile at all) = sign-up not finished.
const isIncomplete = (u) => !u.profile || (u.profile.photos_count ?? 1) < 2;

// Every member, like the website's admin page. Only admins get here (the
// server refuses the list to anyone else); a "🌱 New profile" notification
// opens it with the new member highlighted.
export default function AdminScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const highlight = route.params?.highlight;
  const bottomInset = useBottomInset();

  const [users, setUsers] = useState(() => peekCache("adminUsers") ?? null);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [deletingId, setDeletingId] = useState(null);
  // A "new profile" notification opens the member list; otherwise the dashboard.
  const [tab, setTab] = useState(route.params?.tab || (highlight ? "members" : "dashboard"));
  // Opened from a notification that names a tab (e.g. a partner request).
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);
  // Blossom's notifications turned off on this phone: new-profile alerts
  // can't arrive, so say so (and only then).
  const [alertsOff, setAlertsOff] = useState(false);

  // Make sure this phone gets the "new profile" notifications: registering
  // it while logged in as admin subscribes it for good. Checked on opening
  // and when coming back from the phone's settings.
  useEffect(() => {
    let alive = true;
    async function check() {
      try {
        const { status } = await Notifications.getPermissionsAsync();
        if (!alive) return;
        setAlertsOff(status !== "granted");
        if (status === "granted") await registerForPushNotifications(await getToken());
      } catch {
        // Offline: checked again next time.
      }
    }
    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  async function turnOnAlerts() {
    try {
      if (await registerForPushNotifications(await getToken())) {
        setAlertsOff(false);
        return;
      }
    } catch {
      // fall through to the settings
    }
    Linking.openSettings(); // refused before: only the phone's settings can allow it
  }
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/user/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 403 || resp.status === 401) {
        Alert.alert(t("admin.forbidden"));
        navigation.goBack();
        return;
      }
      if (!resp.ok) throw new Error(`admin users failed with ${resp.status}`);
      const data = await resp.json();
      setUsers(data);
      setLoadError(false);
      writeCache("adminUsers", data);
    } catch {
      setLoadError(true);
    } finally {
      loadingRef.current = false;
      setRefreshing(false);
    }
  }, [navigation, t]);

  // On opening, and when coming back to the app after a while.
  useAutoRefresh(load, { minIntervalMs: 15000 });

  // Opened (again) from a "New profile" notification: fetch now, so the new
  // member is on the list.
  useEffect(() => {
    if (!highlight) return;
    setTab("members");
    load();
  }, [highlight, load]);

  function confirmDelete(user) {
    const name = user.profile?.first_name || user.username;
    Alert.alert(t("admin.deleteTitle", { name }), t("admin.deleteText"), [
      { text: t("admin.cancel"), style: "cancel" },
      { text: t("admin.deleteConfirm"), style: "destructive", onPress: () => deleteUser(user) },
    ]);
  }

  async function deleteUser(user) {
    setDeletingId(user.id);
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/user/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok && resp.status !== 404) throw new Error(`delete failed with ${resp.status}`);
      setUsers((prev) => {
        const next = (prev || []).filter((u) => u.id !== user.id);
        writeCache("adminUsers", next);
        return next;
      });
    } catch {
      Alert.alert(t("admin.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  }

  const stats = useMemo(() => {
    const list = users || [];
    return {
      all: list.length,
      new: list.filter((u) => isNewMember(u.profile)).length,
      incomplete: list.filter(isIncomplete).length,
    };
  }, [users]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (filter === "new" && !isNewMember(u.profile)) return false;
      if (filter === "incomplete" && !isIncomplete(u)) return false;
      if (!q) return true;
      return [u.username, u.email, u.profile?.first_name, u.profile?.city, u.profile?.country]
        .some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [users, search, filter]);

  function renderUser({ item: u }) {
    const p = u.profile;
    const joined = parseServerDate(p?.created_at);
    const isNew = isNewMember(p);
    const deleting = deletingId === u.id;
    return (
      <Pressable
        style={({ pressed }) => [
          styles.row,
          p?.id === highlight && styles.rowHighlight,
          pressed && p && styles.rowPressed,
        ]}
        onPress={() => p && navigation.navigate("ProfileDetails", { id: p.id })}
        disabled={!p}
      >
        {p?.photo ? (
          <Image source={{ uri: IMG.thumb(p.photo) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarEmoji}>🌸</Text>
          </View>
        )}

        <View style={styles.info}>
          <View style={styles.nameLine}>
            <Text style={styles.name} numberOfLines={1}>
              {p?.first_name || u.username}
            </Text>
            {isNew && <Text style={styles.newBadge}>{t("admin.newBadge")}</Text>}
            {u.is_admin && <Text style={styles.adminBadge}>{t("admin.adminBadge")}</Text>}
          </View>
          <Text style={styles.sub} numberOfLines={1}>
            @{u.username} · {u.email}
          </Text>
          {p ? (
            <>
              <Text style={styles.sub} numberOfLines={1}>
                📍 {[p.city, p.country].filter(Boolean).join(", ") || "—"} · {p.gender || "—"} · {p.age || "—"} ·{" "}
                {CONNECTION_EMOJI[connectionOf(p)]}
              </Text>
              <Text style={styles.meta}>
                {joined ? t("admin.joined", { date: joined.toLocaleDateString() }) : "—"} ·{" "}
                <Text style={(p.photos_count ?? 1) < 2 && styles.warn}>
                  {t("admin.photos", { count: p.photos_count ?? 0 })}
                </Text>
              </Text>
            </>
          ) : (
            <Text style={[styles.meta, styles.warn]}>{t("admin.noProfile")}</Text>
          )}
        </View>

        {!u.is_admin && (
          <Pressable
            onPress={() => confirmDelete(u)}
            disabled={deleting}
            hitSlop={8}
            style={({ pressed }) => [styles.deleteBtn, pressed && styles.deleteBtnPressed]}
            accessibilityRole="button"
            accessibilityLabel={t("admin.deleteConfirm")}
          >
            {deleting ? (
              <ActivityIndicator size="small" color={colors.danger} />
            ) : (
              <Text style={styles.deleteText}>🗑</Text>
            )}
          </Pressable>
        )}
      </Pressable>
    );
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
        <Text style={styles.title}>🛡️ {t("admin.title")}</Text>
      </View>

      {alertsOff && (
        <Pressable style={styles.alertsOff} onPress={turnOnAlerts} accessibilityRole="button">
          <Text style={styles.alertsOffText}>🔕 {t("admin.alertsOff")}</Text>
          <Text style={styles.alertsOffAction}>{t("admin.turnOn")}</Text>
        </Pressable>
      )}

      <View style={styles.tabs}>
        {[
          ["dashboard", t("dashboard.dashboardLink")],
          ["members", t("dashboard.membersLink")],
          ["promos", t("offers.tab")],
        ].map(([key, label]) => (
          <Pressable
            key={key}
            onPress={() => setTab(key)}
            style={[styles.tab, tab === key && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === key }}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === "dashboard" ? (
        <AdminDashboard bottomInset={bottomInset} />
      ) : tab === "promos" ? (
        <AdminOffers bottomInset={bottomInset} />
      ) : users === null ? (
        loadError ? (
          <LoadError onRetry={load} />
        ) : (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        )
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(u) => String(u.id)}
          renderItem={renderUser}
          contentContainerStyle={[styles.list, { paddingBottom: bottomInset + spacing.xl }]}
          keyboardShouldPersistTaps="handled"
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
          ListHeaderComponent={
            <View>
              <View style={styles.stats}>
                {FILTERS.map((key) => (
                  <Pressable
                    key={key}
                    style={[styles.stat, filter === key && styles.statActive]}
                    onPress={() => setFilter(key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filter === key }}
                  >
                    <Text style={[styles.statNumber, filter === key && styles.statTextActive]}>{stats[key]}</Text>
                    <Text style={[styles.statLabel, filter === key && styles.statTextActive]}>
                      {t(`admin.filter_${key}`)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder={t("admin.search")}
                placeholderTextColor={colors.textMuted}
                style={styles.search}
                autoCapitalize="none"
                autoCorrect={false}
                clearButtonMode="while-editing"
              />
              {loadError && <Text style={styles.offline}>{t("common.loadError")}</Text>}
            </View>
          }
          ListEmptyComponent={<Text style={styles.empty}>{t("admin.empty")}</Text>}
        />
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
  loading: { marginTop: 40 },
  alertsOff: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "#FDECEA",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  alertsOffText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  alertsOffAction: { fontSize: 13, fontWeight: "700", color: colors.danger },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 14, fontWeight: "600", color: colors.textMuted },
  tabTextActive: { color: colors.text, fontWeight: "700" },
  list: { padding: spacing.md },
  stats: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  statActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  statNumber: { fontSize: 20, fontWeight: "800", color: colors.text },
  statLabel: { fontSize: 12, fontWeight: "600", color: colors.textMuted, marginTop: 2 },
  statTextActive: { color: "#fff" },
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    marginBottom: spacing.md,
  },
  offline: { color: colors.danger, fontSize: 13, marginBottom: spacing.sm, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  rowHighlight: { backgroundColor: colors.primaryTint, borderWidth: 1.5, borderColor: colors.primary },
  rowPressed: { opacity: 0.85 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  avatarEmoji: { fontSize: 22 },
  info: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text, flexShrink: 1 },
  newBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: "hidden",
  },
  adminBadge: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
    backgroundColor: colors.primaryDeep,
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
    overflow: "hidden",
  },
  sub: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  warn: { color: colors.danger, fontWeight: "600" },
  deleteBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: "#F2C4C0",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtnPressed: { backgroundColor: "#FBE9E7" },
  deleteText: { fontSize: 16 },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: 40 },
});
