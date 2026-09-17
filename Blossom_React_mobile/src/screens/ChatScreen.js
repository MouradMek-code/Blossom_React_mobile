import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { IMG } from "../api/images";
import { categoryEmoji, categoryGradient, shortPlace } from "../api/categories";
import { getToken, getProfileId } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

// A date spot sent with "Invite a match": the message text plus a tappable
// card that opens the place in Date Spots.
function InviteCard({ message, mine, onOpen }) {
  const { t } = useTranslation();
  const spot = message.date_spot;
  return (
    <View>
      <Text style={[mine ? styles.mineText : styles.theirsText, styles.inviteText]}>
        {message.content}
      </Text>
      <Pressable
        style={({ pressed }) => [styles.inviteCard, pressed && { opacity: 0.85 }]}
        onPress={() => onOpen(spot.id)}
      >
        {spot.image_url ? (
          <Image source={{ uri: IMG.card(spot.image_url) }} style={styles.inviteImage} />
        ) : (
          <LinearGradient
            colors={categoryGradient(spot.category)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.inviteImage, styles.inviteImageEmpty]}
          >
            <Text style={styles.inviteEmoji}>{categoryEmoji(spot.category)}</Text>
          </LinearGradient>
        )}
        <View style={styles.inviteInfo}>
          <Text style={styles.inviteEyebrow}>💌 {t("dateSpots.dateIdea")}</Text>
          <Text style={styles.inviteName} numberOfLines={2}>{spot.name}</Text>
          <Text style={styles.invitePlace} numberOfLines={1}>
            📍 {shortPlace(spot)}
          </Text>
          <Text style={styles.inviteCta}>{t("dateSpots.viewSpot")} →</Text>
        </View>
      </Pressable>
    </View>
  );
}

export default function ChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId } = route.params;

  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  // Messages already shown in the chat but still on their way to the server.
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const [profileId, setProfileIdState] = useState(null);
  const [details, setDetails] = useState(null);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();
  // Mirrors `text` synchronously. A quick double tap fires send twice before
  // React re-renders, and both calls would otherwise read the same text and
  // post it twice; reading and clearing through the ref lets only one through.
  const textRef = useRef("");

  function updateText(value) {
    textRef.current = value;
    setText(value);
  }

  async function loadMessages() {
    const token = await getToken();
    try {
      const resp = await fetch(`${BASE_URL}/messages/conversation/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      setMessages(await resp.json());
    } catch {
      // Keep showing what we have; the next poll will retry.
    }
  }

  useEffect(() => {
    getProfileId().then(setProfileIdState);
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [conversationId]);

  // Who's on the other side (name + photo for the header), and our own
  // profile id - more reliable than the stored one for telling our bubbles
  // apart.
  useEffect(() => {
    let alive = true;
    (async () => {
      const token = await getToken();
      try {
        const resp = await fetch(`${BASE_URL}/messages/conversation/${conversationId}/details`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.ok && alive) setDetails(await resp.json());
      } catch {
        /* header just stays generic */
      }
    })();
    return () => {
      alive = false;
    };
  }, [conversationId]);

  const myProfileId = details?.me_profile_id ?? profileId;
  const partner = details?.profile;

  function goBack() {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Messages");
  }

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, pending]);

  // Sends feel instant: the input clears and the bubble appears straight away
  // (faded, "Sending…"), then turns solid once the server confirms. On failure
  // the bubble goes away and the text is put back so nothing is lost.
  async function sendMessage() {
    const content = textRef.current.trim();
    if (!content) return;
    updateText("");
    setError("");

    const tempId = `pending-${Date.now()}-${Math.random()}`;
    const afterId = messages.reduce((max, m) => Math.max(max, Number(m.id) || 0), 0);
    setPending((cur) => [...cur, { id: tempId, content, afterId, pending: true }]);

    const token = await getToken();
    const result = await postJson(`${BASE_URL}/messages/conversation/${conversationId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    });

    setPending((cur) => cur.filter((m) => m.id !== tempId));
    if (!result.ok) {
      setError(result.message);
      if (!textRef.current) updateText(content);
      return;
    }
    setMessages((cur) =>
      cur.some((m) => m.id === result.data.id) ? cur : [...cur, result.data],
    );
  }

  // The 3s poll can deliver a message before its own send call returns; don't
  // show the pending copy next to the real one in that moment.
  const visiblePending = pending.filter(
    (p) =>
      !messages.some(
        (m) =>
          m.id > p.afterId &&
          m.content === p.content &&
          Number(m.sender_profile_id) === Number(myProfileId),
      ),
  );

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
        // On Android the manifest already sets windowSoftInputMode=adjustResize,
        // so the window is resized for us. Also setting behavior="height" here
        // made KeyboardAvoidingView resize a second time, and the two fought each
        // other - which is what made the view visibly shake on some devices.
      keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
    >
      <PageNav />
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("messages.back")}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        {partner ? (
          <Pressable
            style={styles.partner}
            onPress={() => navigation.navigate("ProfileDetails", { id: partner.id })}
          >
            {partner.photo ? (
              <Image source={{ uri: IMG.thumb(partner.photo) }} style={styles.partnerPhoto} />
            ) : (
              <View style={[styles.partnerPhoto, styles.partnerPhotoEmpty]}>
                <Text>🌸</Text>
              </View>
            )}
            <View style={styles.partnerText}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {partner.first_name}
                {partner.age ? `, ${partner.age}` : ""}
              </Text>
              <Text style={styles.partnerHint}>{t("messages.viewProfile")}</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.partnerName}>💬</Text>
        )}
      </View>

      <FlatList
        ref={listRef}
        data={[...messages, ...visiblePending]}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.messagesContainer}
        renderItem={({ item: message }) => {
          const isMine =
            message.pending || Number(message.sender_profile_id) === Number(myProfileId);
          return (
            <View style={[styles.row, isMine ? styles.right : styles.left]}>
              <View
                style={[
                  styles.bubble,
                  isMine ? styles.mine : styles.theirs,
                  message.date_spot && styles.bubbleInvite,
                  message.pending && styles.pendingBubble,
                ]}
              >
                {message.date_spot ? (
                  <InviteCard
                    message={message}
                    mine={isMine}
                    onOpen={(spotId) => navigation.navigate("DateSpots", { spotId })}
                  />
                ) : (
                  <Text style={isMine ? styles.mineText : styles.theirsText}>{message.content}</Text>
                )}
                {message.pending ? (
                  <Text style={styles.pendingStatus}>{t("messages.sending")}</Text>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {error !== "" && <Text style={styles.errorText}>{error}</Text>}

      <View style={[styles.inputBox, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TextInput
          value={text}
          onChangeText={updateText}
          placeholder={t("messages.placeholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          returnKeyType="send"
          onSubmitEditing={sendMessage}
          blurOnSubmit={false}
        />
        {/* Disabled while the box is empty - which it is right after a send,
            so a second tap can't post the same message again. */}
        <Pressable
          onPress={sendMessage}
          disabled={!text.trim()}
          style={({ pressed }) => [
            styles.button,
            !text.trim() && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text style={styles.buttonText}>{t("messages.send")}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatContainer: { flex: 1, backgroundColor: colors.background },
  // Who you're talking to: back, photo, name.
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: colors.text },
  partner: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  partnerPhoto: { width: 44, height: 44, borderRadius: 22 },
  partnerPhotoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  partnerText: { flex: 1 },
  partnerName: { ...typography.h3, fontSize: 17 },
  partnerHint: { color: colors.primary, fontSize: 12, fontWeight: "600", marginTop: 1 },
  messagesContainer: { padding: spacing.md },
  errorText: {
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: "row", marginBottom: spacing.sm },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "75%",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...shadow.sm,
  },
  mine: { backgroundColor: colors.primary, marginLeft: "auto", borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
  mineText: { color: "#fff", fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },

  /* Date spot invites */
  bubbleInvite: { width: 260, maxWidth: "82%", padding: 8 },
  inviteText: { marginHorizontal: 4, marginBottom: 8 },
  inviteCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    overflow: "hidden",
  },
  inviteImage: { width: "100%", height: 120 },
  inviteImageEmpty: { alignItems: "center", justifyContent: "center" },
  inviteEmoji: { fontSize: 44 },
  inviteInfo: { paddingHorizontal: 12, paddingTop: 9, paddingBottom: 11, gap: 2 },
  inviteEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  inviteName: { color: colors.text, fontSize: 16, fontWeight: "700" },
  invitePlace: { color: colors.textMuted, fontSize: 13 },
  inviteCta: { color: colors.primary, fontSize: 13, fontWeight: "700", marginTop: 4 },
  inputBox: {
    flexDirection: "row",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginRight: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    ...shadow.sm,
  },
  // Press feedback, so a tap visibly registers.
  buttonPressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.94 }] },
  // Empty box - including right after sending.
  buttonDisabled: { opacity: 0.45 },
  buttonText: { color: "#fff", fontWeight: "700" },
  // A message shown instantly while it's still being sent.
  pendingBubble: { opacity: 0.65 },
  pendingStatus: { color: "#fff", fontSize: 11, textAlign: "right", marginTop: 3 },
});
