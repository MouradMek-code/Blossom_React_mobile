import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  Alert,
  ActivityIndicator,
  ScrollView,
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
import { peekCache, readCache, writeCache } from "../api/cache";
import { goToTab } from "../navigation/goToTab";
import { formatDeadline } from "../api/offers";
import { colors, radius, spacing, shadow, typography } from "../theme";

// A date spot sent with "Invite a match": the message text plus a tappable
// card that opens the place in Date Spots. The invited person answers
// "I'm in"; when the spot has a venue promotion, that gets them both a code.
function InviteCard({ message, mine, partnerName, onOpen, onAccept, accepting, onOpenVoucher }) {
  const { t, i18n } = useTranslation();
  const spot = message.date_spot;
  const offer = spot.offer;
  const voucher = message.voucher;
  const accepted = Boolean(message.accepted_at);
  const deadline = (value) => formatDeadline(value, i18n.language);
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

      {voucher ? (
        <Pressable
          style={({ pressed }) => [styles.voucherBox, pressed && { opacity: 0.85 }]}
          onPress={() => onOpenVoucher(voucher.id)}
        >
          <Text style={styles.voucherTitle}>🎁 {voucher.title}</Text>
          <Text style={styles.voucherLabel}>{t("offers.yourCode")}</Text>
          <Text style={styles.voucherCode}>{voucher.code}</Text>
          <Text style={[styles.voucherDeadline, voucher.status !== "active" && styles.voucherDone]}>
            {voucher.status === "used"
              ? t("offers.usedOn", { date: deadline(voucher.used_at) })
              : voucher.status === "expired"
                ? t("offers.expiredOn", { date: deadline(voucher.expires_at) })
                : t("offers.useBefore", { date: deadline(voucher.expires_at) })}
          </Text>
        </Pressable>
      ) : offer && !accepted ? (
        <View style={styles.offerStrip}>
          <Text style={styles.offerStripText}>
            🎁{" "}
            {mine
              ? t("offers.ifTheySayYes", { title: offer.title, name: partnerName })
              : t("offers.ifYouSayYes", { title: offer.title })}
          </Text>
        </View>
      ) : null}

      {accepted ? (
        <Text style={[mine ? styles.mineText : styles.theirsText, styles.inStatus]}>
          {mine ? t("offers.theyreIn", { name: partnerName }) : t("offers.youreIn")}
        </Text>
      ) : !mine ? (
        <Pressable
          style={({ pressed }) => [styles.imInBtn, pressed && styles.imInBtnPressed]}
          onPress={() => onAccept(message)}
          disabled={accepting}
          accessibilityRole="button"
        >
          {accepting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.imInText}>{t("offers.imIn")}</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

// "Suggest a spot" from the chat: spots with a venue promotion first, one tap
// sends the invite card. An in-screen overlay, not a <Modal> (Android
// mis-measures a ScrollView inside a Modal).
function SpotSuggester({ partner, onClose, onSent }) {
  const { t } = useTranslation();
  const [spots, setSpots] = useState(null);
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${BASE_URL}/date_spots`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setSpots)
      .catch(() => setSpots([]));
  }, []);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (spots || [])
      .filter((s) => !q || `${s.name} ${s.city} ${s.neighborhood || ""}`.toLowerCase().includes(q))
      .sort((a, b) => Number(Boolean(b.offer)) - Number(Boolean(a.offer)));
  }, [spots, search]);

  async function suggest(spot) {
    if (sending) return;
    setSending(spot.id);
    setError("");
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/date_spots/${spot.id}/invite`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: partner.id, content: t("dateSpots.inviteMessage", { name: spot.name }) }),
    });
    setSending(null);
    if (!result.ok) {
      setError(result.message || t("offers.inviteFailed"));
      return;
    }
    onSent(result.data.message);
  }

  return (
    <View style={styles.suggestOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.suggestSheet}>
        <View style={styles.suggestHead}>
          <Text style={styles.suggestTitle}>{t("offers.suggestTitle")}</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.suggestClose}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.suggestHint}>{t("offers.suggestHint")}</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t("offers.searchSpot")}
          placeholderTextColor={colors.textMuted}
          style={styles.suggestSearch}
        />
        {error !== "" && <Text style={styles.errorText}>{error}</Text>}
        {spots === null ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 380 }}>
            {shown.map((spot) => (
              <Pressable
                key={spot.id}
                style={({ pressed }) => [styles.suggestRow, pressed && { opacity: 0.7 }]}
                onPress={() => suggest(spot)}
                disabled={!!sending}
              >
                {spot.image_url ? (
                  <Image source={{ uri: IMG.thumb(spot.image_url) }} style={styles.suggestImage} />
                ) : (
                  <View style={[styles.suggestImage, styles.inviteImageEmpty, { backgroundColor: colors.primarySoft }]}>
                    <Text>{categoryEmoji(spot.category)}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.suggestName} numberOfLines={1}>{spot.name}</Text>
                  <Text style={styles.suggestPlace} numberOfLines={1}>📍 {shortPlace(spot)}</Text>
                  {spot.offer ? (
                    <Text style={styles.suggestOffer} numberOfLines={1}>🎁 {spot.offer.title}</Text>
                  ) : null}
                </View>
                {sending === spot.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.suggestSend}>💌</Text>}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { conversationId } = route.params;

  const { t, i18n } = useTranslation();
  const chatKey = `chat:${conversationId}`;
  const detailsKey = `chatDetails:${conversationId}`;
  // Last messages + header from this session: the chat opens instantly.
  const [messages, setMessages] = useState(() => peekCache(chatKey) || []);
  const savedSignature = useRef("");
  // Messages already shown in the chat but still on their way to the server.
  const [pending, setPending] = useState([]);
  const [text, setText] = useState("");
  const [profileId, setProfileIdState] = useState(null);
  const [details, setDetails] = useState(() => peekCache(detailsKey));
  const [error, setError] = useState("");
  // The invite being answered with "I'm in".
  const [accepting, setAccepting] = useState(null);
  const [suggestOpen, setSuggestOpen] = useState(false);
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

  // One poll at a time. On a slow connection a request can outlast the 3s
  // interval; without this they'd stack up, load the server even more and
  // could land out of order.
  const loadingRef = useRef(false);

  async function loadMessages() {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/messages/conversation/${conversationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) return;
      const data = await resp.json();
      setMessages(data);
      // The chat polls every 3s; only rewrite the saved copy when it changed.
      const signature = `${data.length}:${data[data.length - 1]?.id}`;
      if (signature !== savedSignature.current) {
        savedSignature.current = signature;
        writeCache(chatKey, data.slice(-100));
      }
    } catch {
      // Keep showing what we have; the next poll will retry.
    } finally {
      loadingRef.current = false;
    }
  }

  useEffect(() => {
    getProfileId().then(setProfileIdState);
    // Instant open from the saved copy (disk, after an app restart).
    if (!peekCache(chatKey)) {
      readCache(chatKey).then((saved) => {
        if (saved) setMessages((cur) => (cur.length ? cur : saved));
      });
    }
    loadMessages();
    // Poll only while the chat is on screen - not while e.g. their profile is
    // open on top of it.
    const interval = setInterval(() => {
      if (navigation.isFocused()) loadMessages();
    }, 3000);
    const unsubscribe = navigation.addListener("focus", loadMessages);
    return () => {
      clearInterval(interval);
      unsubscribe();
    };
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
        if (resp.ok && alive) {
          const data = await resp.json();
          setDetails(data);
          writeCache(detailsKey, data);
        }
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
    else goToTab(navigation, "Messages");
  }

  // `matched` tells their profile screen to offer Unmatch as well.
  function openProfile() {
    navigation.navigate("ProfileDetails", { id: partner.id, matched: true });
  }

  // Unmatching lives in the chat now that there's no matches list. The server
  // deletes the conversation with it, so there's a confirmation first.
  function confirmUnmatch() {
    Alert.alert(
      t("messages.unmatchTitle", { name: partner.first_name }),
      t("messages.unmatchMessage"),
      [
        { text: t("settings.cancel"), style: "cancel" },
        { text: t("messages.unmatch"), style: "destructive", onPress: unmatch },
      ],
    );
  }

  async function unmatch() {
    const token = await getToken();
    try {
      const resp = await fetch(`${BASE_URL}/matches/unmatch/${partner.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`unmatch failed with ${resp.status}`);
      // The conversation is deleted server-side; drop the saved copies too.
      const inbox = peekCache("inbox");
      if (inbox) writeCache("inbox", inbox.filter((i) => i.profile.id !== partner.id));
      writeCache(chatKey, []);
      goToTab(navigation, "Messages");
    } catch {
      setError(t("messages.unmatchFailed"));
    }
  }

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages, pending]);

  // "I'm in" on a date spot invite. With a venue promotion on the spot, the
  // couple gets a code - or a word on why not (one a month, profile not
  // finished, just taken by others).
  async function acceptInvite(message) {
    if (accepting) return;
    setAccepting(message.id);
    setError("");
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/offers/invites/${message.id}/accept`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    setAccepting(null);
    if (!result.ok) {
      setError(result.message || t("offers.acceptFailed"));
      return;
    }
    const updated = result.data.message;
    setMessages((cur) => cur.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)));
    const voucher = result.data.voucher;
    const reason = result.data.reason;
    if (voucher) {
      Alert.alert(
        t("offers.gotTitle"),
        t("offers.gotText", {
          title: voucher.title,
          spot: voucher.spot?.name || message.date_spot.name,
          date: formatDeadline(voucher.expires_at, i18n.language),
        }),
        [
          { text: "OK" },
          { text: t("offers.myPromos"), onPress: () => navigation.navigate("Vouchers", { highlight: voucher.id }) },
        ],
      );
    } else if (reason && reason !== "no_offer") {
      Alert.alert(t("offers.dateOn"), t(`offers.reason_${reason}`));
    }
  }

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
          <View style={styles.partner}>
            <Pressable onPress={openProfile}>
              {partner.photo ? (
                <Image source={{ uri: IMG.thumb(partner.photo) }} style={styles.partnerPhoto} />
              ) : (
                <View style={[styles.partnerPhoto, styles.partnerPhotoEmpty]}>
                  <Text>🌸</Text>
                </View>
              )}
            </Pressable>
            <View style={styles.partnerText}>
              <Pressable onPress={openProfile}>
                <Text style={styles.partnerName} numberOfLines={1}>
                  {partner.first_name}
                  {partner.age ? `, ${partner.age}` : ""}
                </Text>
              </Pressable>
              {/* Both actions in plain sight, right under the name. */}
              <View style={styles.partnerActions}>
                <Pressable onPress={openProfile} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.partnerHint}>{t("messages.viewProfile")}</Text>
                </Pressable>
                <Text style={styles.dot}>·</Text>
                <Pressable onPress={confirmUnmatch} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.unmatchText}>💔 {t("messages.unmatch")}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : (
          <Text style={styles.partnerName}>💬</Text>
        )}
      </View>
      {details?.event ? (
        <Pressable
          style={styles.eventBanner}
          onPress={() => navigation.navigate("EventDetail", { id: details.event.id })}
          accessibilityRole="button"
        >
          <Text style={styles.eventBannerText} numberOfLines={1}>
            {t("events.matchedThrough", { title: details.event.title })}
          </Text>
        </Pressable>
      ) : null}

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
                    partnerName={partner?.first_name || ""}
                    onOpen={(spotId) => navigation.navigate("DateSpots", { spotId })}
                    onAccept={acceptInvite}
                    accepting={accepting === message.id}
                    onOpenVoucher={(id) => navigation.navigate("Vouchers", { highlight: id })}
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
        {partner ? (
          <Pressable
            onPress={() => setSuggestOpen(true)}
            style={({ pressed }) => [styles.suggestBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={t("offers.suggestSpot")}
          >
            <Text style={styles.suggestBtnText}>📍</Text>
          </Pressable>
        ) : null}
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

      {suggestOpen && partner ? (
        <SpotSuggester
          partner={partner}
          onClose={() => setSuggestOpen(false)}
          onSent={(message) => {
            setSuggestOpen(false);
            setMessages((cur) => (cur.some((m) => m.id === message.id) ? cur : [...cur, message]));
          }}
        />
      ) : null}
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
  partnerActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
  },
  partnerHint: { color: colors.primary, fontSize: 12.5, fontWeight: "600" },
  dot: { color: colors.textMuted, fontSize: 12.5 },
  unmatchText: { color: colors.danger, fontSize: 12.5, fontWeight: "700" },
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
  offerStrip: {
    marginTop: 8,
    backgroundColor: "#FFF4E5",
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  offerStripText: { color: "#6B3E00", fontSize: 13, fontWeight: "600", lineHeight: 18 },
  voucherBox: {
    marginTop: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  voucherTitle: { color: colors.text, fontSize: 14, fontWeight: "700", textAlign: "center" },
  voucherLabel: { color: colors.textMuted, fontSize: 11, marginTop: 6, textTransform: "uppercase", letterSpacing: 0.6 },
  voucherCode: { color: colors.primaryDeep, fontSize: 22, fontWeight: "800", letterSpacing: 2, marginTop: 2 },
  voucherDeadline: { color: colors.textSoft, fontSize: 12.5, marginTop: 4, textAlign: "center" },
  voucherDone: { color: colors.textMuted },
  inStatus: { fontSize: 13, fontWeight: "700", marginTop: 8, marginHorizontal: 4 },
  imInBtn: {
    marginTop: 8,
    backgroundColor: colors.success,
    borderRadius: radius.pill,
    paddingVertical: 10,
    alignItems: "center",
  },
  imInBtnPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  imInText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  suggestBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF4E5",
    borderWidth: 1.5,
    borderColor: "#FFD8A3",
    marginRight: spacing.sm,
    alignSelf: "center",
  },
  suggestBtnText: { fontSize: 18 },
  suggestOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
    zIndex: 20,
  },
  suggestSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  suggestHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  suggestTitle: { ...typography.h3 },
  suggestClose: { fontSize: 20, color: colors.textMuted },
  suggestHint: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  suggestSearch: {
    marginVertical: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 9,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  suggestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  suggestImage: { width: 48, height: 48, borderRadius: 10 },
  suggestName: { fontSize: 15, fontWeight: "700", color: colors.text },
  suggestPlace: { fontSize: 12.5, color: colors.textMuted, marginTop: 1 },
  suggestOffer: { fontSize: 12.5, fontWeight: "700", color: "#6B3E00", marginTop: 2 },
  suggestSend: { fontSize: 20 },
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
  // "Matched through the event: ..." under the header.
  eventBanner: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: colors.primaryTint,
    borderBottomWidth: 1,
    borderBottomColor: colors.primarySoft,
  },
  eventBannerText: { color: colors.primaryDeep, fontWeight: "700", fontSize: 13 },
});
