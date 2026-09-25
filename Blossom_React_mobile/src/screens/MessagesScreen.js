import { useCallback, useRef, useState } from "react";
import {
  AppState,
  View,
  Text,
  Image,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useBottomInset } from "../navigation/useBottomInset";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { IMG } from "../api/images";
import { NETWORK_ERROR, postJson } from "../api/errors";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";
import { shortTime } from "../api/chatTime";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Refresh while the screen is open, so new messages and badges show up
// without leaving it (there's no push channel).
const REFRESH_MS = 10000;

export default function MessagesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  // Last inbox from this session, shown immediately; null = nothing yet.
  const [items, setItems] = useState(() => peekCache("inbox"));
  const [error, setError] = useState("");
  const [openingId, setOpeningId] = useState(null);

  // One refresh at a time: on a slow connection a request can outlast the
  // polling interval, and stacked requests only slow the server down more.
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }
      // Instant start from the saved inbox (disk, after an app restart).
      if (!peekCache("inbox")) {
        const saved = await readCache("inbox");
        if (saved) setItems((cur) => cur || saved);
      }
      const resp = await fetch(`${BASE_URL}/messages/inbox`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status === 401) {
        await endSessionAndGoToLogin(navigation);
        return;
      }
      if (!resp.ok) throw new Error(`inbox failed with ${resp.status}`);
      const data = await resp.json();
      setItems(data);
      writeCache("inbox", data);
      setError("");
    } catch {
      // Keep what's on screen; only flag it when there's nothing to show.
      if (!peekCache("inbox")) setError(NETWORK_ERROR);
      setItems((cur) => cur || []);
    } finally {
      loadingRef.current = false;
    }
  }, [navigation]);

  // Reload whenever the screen comes into view - e.g. back from a chat, so
  // that conversation's unread count clears - and keep polling while it stays.
  useFocusEffect(
    useCallback(() => {
      load();
      // New matches are on display here, so they count as seen.
      getToken().then((token) => {
        if (!token || token === "null") return;
        fetch(`${BASE_URL}/matches/mark_seen`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      });
      const interval = setInterval(load, REFRESH_MS);
      // Back from the background: at once, not at the next tick.
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") load();
      });
      return () => {
        clearInterval(interval);
        sub.remove();
      };
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
    const text = item.last_message.is_invite
      ? `💌 ${item.last_message.content}`
      : item.last_message.content;
    return item.last_message.mine ? `${t("messages.you")}: ${text}` : text;
  }

  // Only conversations reach this list; matches with no messages yet are the
  // row of faces above it.
  function renderItem({ item }) {
    const unread = item.unread_count > 0;
    return (
      <Pressable
        onPress={() => open(item)}
        style={({ pressed }) => [styles.row, unread && styles.rowUnread, pressed && styles.rowPressed]}
      >
        {item.profile.photo ? (
          <Image source={{ uri: IMG.thumb(item.profile.photo) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text style={styles.avatarEmptyText}>🌸</Text>
          </View>
        )}

        <View style={styles.body}>
          <View style={styles.line}>
            <Text style={styles.name} numberOfLines={1}>
              {item.profile.first_name}
              {item.profile.age ? `, ${item.profile.age}` : ""}
            </Text>
            <Text style={[styles.time, unread && styles.timeUnread]}>
              {shortTime(item.last_message.created_at)}
            </Text>
          </View>
          <View style={styles.line}>
            {openingId === item.profile.id ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text
                style={[styles.preview, unread && styles.previewUnread]}
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

  // Matches nobody has written to yet ride at the top as photos; the list
  // below is the actual conversations.
  const newMatches = (items || []).filter((item) => !item.last_message);
  const conversations = (items || []).filter((item) => item.last_message);

  return (
    <View style={styles.screen}>
      <PageNav />
      <FlatList
        data={conversations}
        keyExtractor={(item) => String(item.profile.id)}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomInset + spacing.lg },
        ]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>{t("messages.title")}</Text>
            <Text style={styles.subtitle}>{t("messages.subtitle")}</Text>
            {error !== "" ? <Text style={styles.error}>{error}</Text> : null}
            {items === null ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
            ) : null}

            {newMatches.length > 0 ? (
              <View style={styles.matchesBlock}>
                <Text style={styles.sectionTitle}>{t("messages.newMatches")}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.matchesRow}
                >
                  {newMatches.map((item) => (
                    <Pressable
                      key={item.profile.id}
                      style={({ pressed }) => [styles.matchItem, pressed && { opacity: 0.7 }]}
                      onPress={() => open(item)}
                    >
                      {item.profile.photo ? (
                        <Image
                          source={{ uri: IMG.thumb(item.profile.photo) }}
                          style={styles.matchAvatar}
                        />
                      ) : (
                        <View style={[styles.matchAvatar, styles.avatarEmpty]}>
                          <Text style={styles.avatarEmptyText}>🌸</Text>
                        </View>
                      )}
                      {openingId === item.profile.id ? (
                        <ActivityIndicator size="small" color={colors.primary} />
                      ) : (
                        <>
                          <Text style={styles.matchName} numberOfLines={1}>
                            {item.profile.first_name}
                          </Text>
                          {/* Blossom's rule: she writes first. */}
                          {item.waiting_for_them ? (
                            <Text style={styles.matchWaiting} numberOfLines={1}>
                              {t("messages.waitingShort")}
                            </Text>
                          ) : null}
                        </>
                      )}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          items === null ? null : newMatches.length > 0 ? (
            <Text style={styles.hint}>{t("messages.startChatting")}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>{t("messages.empty")}</Text>
              <Pressable style={styles.emptyBtn} onPress={() => navigation.navigate("Profiles")}>
                <Text style={styles.emptyBtnText}>{t("messages.browse")}</Text>
              </Pressable>
            </View>
          )
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
  /* New matches: a row of faces above the conversations */
  matchesBlock: { marginTop: spacing.lg },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  matchesRow: { gap: 14, paddingBottom: spacing.md, paddingRight: spacing.md },
  matchItem: { width: 66, alignItems: "center", gap: 5 },
  matchAvatar: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2.5,
    borderColor: colors.primary,
  },
  matchName: { fontSize: 12.5, color: colors.text, fontWeight: "600", maxWidth: 66 },
  matchWaiting: { fontSize: 10.5, color: colors.textMuted, maxWidth: 66 },
  hint: {
    textAlign: "center",
    color: colors.textMuted,
    fontSize: 14.5,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  rowUnread: { backgroundColor: "#FFF7FA" },
  rowPressed: { backgroundColor: colors.primaryTint },
  separator: { height: 10 },
  avatar: { width: 56, height: 56, borderRadius: 28 },
  avatarEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  avatarEmptyText: { fontSize: 24 },
  body: { flex: 1, gap: 4 },
  line: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { flex: 1, fontSize: 16.5, fontWeight: "700", color: colors.text },
  time: { fontSize: 12, color: colors.textMuted },
  timeUnread: { color: colors.primary, fontWeight: "700" },
  preview: { flex: 1, fontSize: 14.5, color: colors.textMuted },
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
