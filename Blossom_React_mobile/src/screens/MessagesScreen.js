import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { IMG } from "../api/images";
import { NETWORK_ERROR, postJson } from "../api/errors";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken } from "../api/storage";
import { shortTime } from "../api/chatTime";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Refresh while the screen is open, so new messages and badges show up
// without leaving it (there's no push channel).
const REFRESH_MS = 10000;

export default function MessagesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState(null); // null while loading
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  const load = useCallback(async () => {
    const token = await getToken();
    if (!token || token === "null") {
      navigation.navigate("Login");
      return;
    }
    try {
      const resp = await fetch(`${BASE_URL}/messages/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        await endSessionAndGoToLogin(navigation);
        return;
      }
      setItems(resp.ok ? await resp.json() : []);
      setError("");
    } catch {
      setError(NETWORK_ERROR);
      setItems((cur) => cur || []);
    }
  }, [navigation]);

  // Reload whenever the screen comes into view - e.g. back from a chat, so
  // that conversation's unread count clears - and keep polling while it stays.
  useFocusEffect(
    useCallback(() => {
      load();
      const interval = setInterval(load, REFRESH_MS);
      return () => clearInterval(interval);
    }, [load]),
  );

  // New matches have no conversation until someone opens it.
  async function open(item) {
    if (item.conversation_id) {
      navigation.navigate("Chat", { conversationId: item.conversation_id });
      return;
    }
    if (openingId !== null) return;
    setOpeningId(item.profile.id);
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/profile/profile/${item.profile.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    setOpeningId(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    navigation.navigate("Chat", { conversationId: result.data.conversation_id });
  }

  function preview(item) {
    const name = item.profile.first_name;
    if (!item.last_message) {
      return item.waiting_for_them ? t("messages.waiting", { name }) : t("messages.newMatch");
    }
    const text = item.last_message.is_invite
      ? `💌 ${item.last_message.content}`
      : item.last_message.content;
    return item.last_message.mine ? `${t("messages.you")}: ${text}` : text;
  }

  function renderItem({ item }) {
    const unread = item.unread_count > 0;
    const isNew = !item.last_message;
    return (
      <Pressable
        onPress={() => open(item)}
        style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.rowPressed]}
      >
        <View>
          {item.profile.photo ? (
            <Image source={{ uri: IMG.thumb(item.profile.photo) }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarEmpty]}>
              <Text style={styles.avatarEmptyText}>🌸</Text>
            </View>
          )}
          {isNew ? <View style={styles.newDot} /> : null}
        </View>

        <View style={styles.body}>
          <View style={styles.line}>
            <Text style={styles.name} numberOfLines={1}>
              {item.profile.first_name}
              {item.profile.age ? `, ${item.profile.age}` : ""}
            </Text>
            {item.last_message ? (
              <Text style={[styles.time, unread && styles.timeUnread]}>
                {shortTime(item.last_message.created_at)}
              </Text>
            ) : null}
          </View>
          <View style={styles.line}>
            {openingId === item.profile.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[styles.preview, isNew && styles.previewNew, unread && styles.previewUnread]}
                numberOfLines={1}
              >
                {preview(item)}
              </Text>
            )}
            {unread ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 9 ? "9+" : item.unread_count}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <PageNav />
      <FlatList
        data={items || []}
        keyExtractor={(item) => String(item.profile.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: Math.max(insets.bottom, 16) + spacing.lg },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t("messages.title")}</Text>
            <Text style={styles.subtitle}>{t("messages.subtitle")}</Text>
            {error !== "" ? <Text style={styles.error}>{error}</Text> : null}
            {items === null ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          items !== null ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>{t("messages.empty")}</Text>
              <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate("Profiles")}>
                <Text style={styles.emptyBtnText}>{t("messages.browse")}</Text>
              </Pressable>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  listContent: { paddingHorizontal: spacing.md },
  header: { paddingTop: spacing.lg, paddingBottom: spacing.md },
  title: { ...typography.h1, fontSize: 28 },
  subtitle: { color: colors.textMuted, fontSize: 15, marginTop: 4 },
  error: {
    marginTop: spacing.md,
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: colors.primaryTint,
    color: colors.primaryDeep,
    fontSize: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 12,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    ...shadow.sm,
  },
  rowUnread: { backgroundColor: "#FFF7FA" },
  rowPressed: { backgroundColor: colors.primaryTint },
  separator: { height: 10 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarEmptyText: { fontSize: 24 },
  // Marks a new match nobody has written to yet.
  newDot: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surface,
  },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontSize: 16.5, fontWeight: "700", color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  timeUnread: { color: colors.primary, fontWeight: "700" },
  preview: { flex: 1, fontSize: 14.5, color: colors.textMuted },
  previewNew: { color: colors.primary, fontWeight: "600" },
  previewUnread: { color: colors.text, fontWeight: "600" },
  unreadBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  unreadBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  empty: {
    alignItems: "center",
    padding: spacing.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  emptyIcon: { fontSize: 44, marginBottom: spacing.sm },
  emptyText: { textAlign: "center", color: colors.textMuted, lineHeight: 21, maxWidth: 280 },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  emptyBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
