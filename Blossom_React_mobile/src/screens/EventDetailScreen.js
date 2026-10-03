import { useCallback, useEffect, useState } from "react";
import {
  View, Text, Image, Pressable, TextInput, Alert, Share, Linking, ActivityIndicator, StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import PageNav from "../components/PageNav";
import KeyboardAwareScroll from "../components/KeyboardAwareScroll";
import { useAutoRefresh, invalidate } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { BASE_URL, SITE_URL } from "../api/config";
import { IMG } from "../api/images";
import { getToken } from "../api/storage";
import { postJson } from "../api/errors";
import { KIND_EMOJI, KIND_GRADIENT, eventWhen } from "../api/events";
import { colors, radius, spacing, shadow, typography } from "../theme";

const WOMEN = ["Woman", "Trans Woman"];

async function authHeaders(json = false) {
  const token = await getToken();
  return {
    ...(token && token !== "null" ? { Authorization: `Bearer ${token}` } : {}),
    ...(json ? { "Content-Type": "application/json" } : {}),
  };
}

function timeOnly(iso, language) {
  try {
    return new Date(iso).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// An event: what, when, where, "I'm interested", the organiser's list of
// people to match, and the comments.
export default function EventDetailScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const id = Number(route.params?.id);
  const bottomInset = useBottomInset();
  const [event, setEvent] = useState(null);
  const [missing, setMissing] = useState("");
  const [me, setMe] = useState(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [people, setPeople] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const headers = await authHeaders();
    setLoggedIn(Boolean(headers.Authorization));
    const result = await postJson(`${BASE_URL}/events/${id}`, { headers });
    if (result.ok) {
      setEvent(result.data);
      setMissing("");
    } else if (result.resp?.status === 404) {
      setMissing(result.message);
    } else {
      setError(result.message);
    }
  }, [id]);

  const loadPeople = useCallback(async () => {
    const result = await postJson(`${BASE_URL}/events/${id}/interested`, { headers: await authHeaders() });
    if (result.ok) setPeople(result.data);
  }, [id]);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  useEffect(() => {
    (async () => {
      const headers = await authHeaders();
      if (!headers.Authorization) return;
      try {
        const resp = await fetch(`${BASE_URL}/user/me`, { headers });
        if (resp.ok) setMe(await resp.json());
      } catch {
        /* the event still shows */
      }
    })();
  }, []);

  const isOwner = Boolean(event?.is_owner);
  const isAdmin = Boolean(me?.is_admin);
  useEffect(() => {
    if (event && (isOwner || isAdmin)) loadPeople();
  }, [event, isOwner, isAdmin, loadPeople]);

  function flash(text) {
    setNotice(text);
    setTimeout(() => setNotice(""), 2500);
  }

  async function act(url, options = {}) {
    setBusy(true);
    setError("");
    const result = await postJson(url, { ...options, headers: await authHeaders(Boolean(options.body)) });
    setBusy(false);
    if (!result.ok) setError(result.message);
    return result;
  }

  async function toggleInterest(on) {
    const result = await act(`${BASE_URL}/events/${id}/interest`, { method: on ? "POST" : "DELETE" });
    if (result.ok) {
      setEvent(result.data);
      invalidate("events");
    }
  }

  async function answer(person, action) {
    const result = await act(`${BASE_URL}/events/${id}/interested/${person.id}/${action}`, { method: "POST" });
    if (!result.ok) return;
    loadPeople();
    load();
    if (result.data.conversation_id && !result.data.already_matched) {
      Alert.alert("💞", t("events.matchedBadge"), [
        { text: "OK", style: "cancel" },
        { text: t("events.openChat"), onPress: () => navigation.navigate("Chat", { conversationId: result.data.conversation_id }) },
      ]);
    }
  }

  function confirm(message, onYes, destructive = true) {
    Alert.alert("", message, [
      { text: t("dateSpots.cancel"), style: "cancel" },
      { text: "OK", style: destructive ? "destructive" : "default", onPress: onYes },
    ]);
  }

  function cancelEvent() {
    confirm(t("events.cancelConfirm"), async () => {
      const result = await act(`${BASE_URL}/events/${id}`, { method: "DELETE" });
      if (result.ok) {
        invalidate("events");
        load();
      }
    });
  }

  function adminRemove() {
    confirm(t("events.adminRemoveConfirm"), async () => {
      const result = await act(`${BASE_URL}/events/${id}`, { method: "DELETE" });
      if (result.ok) {
        invalidate("events");
        navigation.goBack();
      }
    });
  }

  function report(commentId) {
    confirm(t("events.reportConfirm"), async () => {
      const result = await act(`${BASE_URL}/events/${id}/report`, {
        method: "POST",
        body: JSON.stringify(commentId ? { comment_id: commentId } : {}),
      });
      if (result.ok) flash(t("events.reported"));
    }, false);
  }

  async function share() {
    try {
      await Share.share({ message: `${t("events.shareText")} ${event.title}\n${SITE_URL}/events/${event.id}` });
    } catch {
      /* dismissed */
    }
  }

  const header = (
    <View style={styles.topBar}>
      <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityRole="button">
        <Text style={styles.backText}>←</Text>
      </Pressable>
      <Text style={styles.topTitle}>📅 {t("events.title")}</Text>
    </View>
  );

  if (missing || !event) {
    return (
      <View style={styles.screen}>
        <PageNav />
        {header}
        <View style={styles.center}>
          {missing ? (
            <>
              <Text style={{ fontSize: 40 }}>📅</Text>
              <Text style={styles.missingText}>{missing}</Text>
            </>
          ) : error ? (
            <Text style={styles.error}>{error}</Text>
          ) : (
            <ActivityIndicator color={colors.primary} />
          )}
        </View>
      </View>
    );
  }

  const language = i18n.language;
  const womanBlocked = event.women_only && !isOwner && me && !WOMEN.includes(me.gender);
  const status = event.status !== "active" ? "cancelled" : event.past ? "past" : null;

  return (
    <View style={styles.screen}>
      <PageNav />
      {header}
      <KeyboardAwareScroll contentContainerStyle={{ paddingBottom: bottomInset + spacing.xl }}>
        <View style={styles.media}>
          {event.image_url ? (
            <Image source={{ uri: IMG.full(event.image_url) }} style={styles.image} />
          ) : (
            <LinearGradient colors={KIND_GRADIENT[event.kind] || KIND_GRADIENT.group} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={[styles.image, styles.noImage]}>
              <Text style={{ fontSize: 64 }}>{KIND_EMOJI[event.kind]}</Text>
            </LinearGradient>
          )}
          <View style={styles.kindPill}>
            <Text style={styles.kindPillText}>{KIND_EMOJI[event.kind]} {t(`events.kind_${event.kind}`)}</Text>
          </View>
        </View>

        <View style={styles.content}>
          {status && <Text style={styles.statusBar}>{t(`events.${status}`)}</Text>}
          <Text style={styles.title}>{event.title}</Text>

          <Fact icon="🕒">
            <Text style={styles.factStrong}>
              {eventWhen(event.starts_at, language)}
              {event.ends_at ? ` – ${timeOnly(event.ends_at, language)}` : ""}
            </Text>
          </Fact>
          <Fact icon="📍">
            <Text style={styles.factText}>
              <Text style={styles.factStrong}>{event.place_name}</Text> · {event.city}
            </Text>
            {event.map_url ? (
              <Text style={styles.link} onPress={() => Linking.openURL(event.map_url)}>🗺️ Google Maps</Text>
            ) : null}
          </Fact>
          {event.spot ? (
            <Pressable
              style={[styles.fact, event.spot.offer && styles.giftFact]}
              onPress={() => navigation.navigate("DateSpots", { spotId: event.spot.id })}
            >
              <Text style={styles.factIcon}>{event.spot.offer ? "🎁" : "🌸"}</Text>
              <Text style={[styles.link, event.spot.offer && { color: "#6b3e00" }, { flex: 1 }]}>
                {event.spot.offer
                  ? t("events.giftHere", { title: event.spot.offer.title })
                  : t("events.atSpot", { name: event.spot.name })}
              </Text>
            </Pressable>
          ) : null}
          {event.max_people ? (
            <Fact icon="👥"><Text style={styles.factText}>{t("events.upTo", { count: event.max_people })}</Text></Fact>
          ) : null}
          {event.languages.length > 0 && (
            <Fact icon="🗣️">
              <View style={styles.langs}>
                {event.languages.map((l) => <Text key={l} style={styles.lang}>{l}</Text>)}
              </View>
            </Fact>
          )}
          {event.women_only && <Fact icon="👩"><Text style={styles.factText}>{t("events.womenOnly")}</Text></Fact>}

          <Text style={styles.description}>{event.description}</Text>

          <View style={styles.organizer}>
            {event.organizer?.photo ? (
              <Image source={{ uri: IMG.thumb(event.organizer.photo) }} style={styles.organizerPhoto} />
            ) : (
              <View style={[styles.organizerPhoto, styles.avatarEmpty]}><Text>🌸</Text></View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.organizerName}>
                {event.organizer?.first_name}{event.organizer?.age ? `, ${event.organizer.age}` : ""}
              </Text>
              <Text style={styles.muted}>{t("events.organiserBadge")}</Text>
            </View>
            <Text style={styles.counts}>🙋 {event.interested_count} · 💬 {event.comment_count}</Text>
          </View>

          <View style={styles.actions}>
            {!loggedIn ? (
              <Button label={t("events.visitorJoin")} onPress={() => navigation.navigate("SignUp")} />
            ) : isOwner ? (
              event.status === "active" && (
                <View style={styles.row}>
                  <Button label={`✏️ ${t("events.edit")}`} kind="secondary" onPress={() => navigation.navigate("EventForm", { id: event.id })} />
                  <Button label={t("events.cancelEvent")} kind="danger" onPress={cancelEvent} disabled={busy} />
                </View>
              )
            ) : event.my_interest === "matched" ? (
              <View style={styles.matchedBox}>
                <Text style={styles.matchedText}>{t("events.matched")}</Text>
                <Button label={t("events.openMessages")} onPress={() => navigation.navigate("Main", { screen: "Messages" })} />
              </View>
            ) : event.my_interest === "pending" ? (
              <View style={{ gap: 8 }}>
                <Text style={styles.interestOn}>{t("events.interestedOn")}</Text>
                <Text style={styles.muted}>{t("events.interestHint")}</Text>
                {event.open && (
                  <Text style={styles.linkMuted} onPress={() => !busy && toggleInterest(false)}>{t("events.withdraw")}</Text>
                )}
              </View>
            ) : womanBlocked ? (
              <Text style={styles.muted}>👩 {t("events.womenOnlyHint")}</Text>
            ) : event.open ? (
              <View style={{ gap: 8 }}>
                <Button label={t("events.interested")} onPress={() => toggleInterest(true)} disabled={busy} />
                <Text style={styles.muted}>{t("events.interestHint")}</Text>
              </View>
            ) : null}

            <View style={styles.smallActions}>
              <SmallButton label={`🔗 ${t("events.share")}`} onPress={share} />
              {loggedIn && !isOwner && <SmallButton label={`🚩 ${t("events.report")}`} onPress={() => report(null)} />}
              {isAdmin && !isOwner && <SmallButton label={`🛡️ ${t("events.adminRemove")}`} danger onPress={adminRemove} />}
            </View>
          </View>
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.safety}>🛡️ {t("events.safety")}</Text>
        </View>

        {(isOwner || isAdmin) && people && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("events.interestedTitle", { count: people.length })}</Text>
            {isOwner && <Text style={styles.muted}>{t("events.ownerHint")}</Text>}
            {people.length === 0 ? (
              <Text style={styles.emptyText}>{t("events.interestedEmpty")}</Text>
            ) : (
              people.map(({ person, status: answerStatus }) => (
                <View key={person.id} style={styles.person}>
                  <Pressable style={styles.personLink} onPress={() => navigation.navigate("ProfileDetails", { id: person.id })}>
                    {person.photo ? (
                      <Image source={{ uri: IMG.thumb(person.photo) }} style={styles.personPhoto} />
                    ) : (
                      <View style={[styles.personPhoto, styles.avatarEmpty]}><Text>🌸</Text></View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.personName}>{person.first_name}{person.age ? `, ${person.age}` : ""}</Text>
                      <Text style={styles.personMeta} numberOfLines={1}>
                        {[person.city, person.languages.slice(0, 3).join(" · ")].filter(Boolean).join(" — ")}
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.personActions}>
                    {answerStatus === "matched" ? (
                      <Text style={styles.matchedBadge}>💞 {t("events.matchedBadge")}</Text>
                    ) : isOwner && event.open ? (
                      <>
                        {answerStatus === "declined" && <Text style={styles.declinedBadge}>{t("events.declinedBadge")}</Text>}
                        <Pressable style={styles.matchBtn} onPress={() => answer(person, "match")} disabled={busy}>
                          <Text style={styles.matchBtnText}>{t("events.match")}</Text>
                        </Pressable>
                        {answerStatus === "pending" && (
                          <Text style={styles.linkMuted} onPress={() => !busy && answer(person, "decline")}>{t("events.decline")}</Text>
                        )}
                      </>
                    ) : answerStatus === "declined" ? (
                      <Text style={styles.declinedBadge}>{t("events.declinedBadge")}</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <Comments
          event={event}
          loggedIn={loggedIn}
          isAdmin={isAdmin}
          blocked={womanBlocked}
          onReport={report}
          onCount={(count) => setEvent((e) => (e ? { ...e, comment_count: count } : e))}
        />
      </KeyboardAwareScroll>
    </View>
  );
}

function Fact({ icon, children }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.factIcon}>{icon}</Text>
      <View style={{ flex: 1, gap: 2 }}>{children}</View>
    </View>
  );
}

function Button({ label, onPress, kind = "primary", disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        kind === "secondary" && styles.btnSecondary,
        kind === "danger" && styles.btnDanger,
        (pressed || disabled) && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.btnText, kind === "secondary" && { color: colors.text }, kind === "danger" && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SmallButton({ label, onPress, danger }) {
  return (
    <Pressable onPress={onPress} style={[styles.smallBtn, danger && { borderColor: colors.danger }]} accessibilityRole="button">
      <Text style={[styles.smallBtnText, danger && { color: colors.danger }]}>{label}</Text>
    </Pressable>
  );
}

function Comments({ event, loggedIn, isAdmin, blocked, onReport, onCount }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const [comments, setComments] = useState(null);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!loggedIn) return;
    const result = await postJson(`${BASE_URL}/events/${event.id}/comments`, { headers: await authHeaders() });
    if (result.ok) {
      setComments(result.data);
      onCount(result.data.filter((c) => !c.deleted).length);
    } else setError(result.message);
  }, [event.id, loggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  async function send() {
    if (!text.trim() || sending) return;
    setSending(true);
    setError("");
    const result = await postJson(`${BASE_URL}/events/${event.id}/comments`, {
      method: "POST",
      headers: await authHeaders(true),
      body: JSON.stringify({ text: text.trim(), parent_id: replyTo?.id || null }),
    });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setText("");
    setReplyTo(null);
    load();
  }

  function remove(comment) {
    Alert.alert("", t("events.deleteCommentConfirm"), [
      { text: t("dateSpots.cancel"), style: "cancel" },
      {
        text: t("events.deleteComment"),
        style: "destructive",
        onPress: async () => {
          const result = await postJson(`${BASE_URL}/events/comments/${comment.id}`, {
            method: "DELETE",
            headers: await authHeaders(),
          });
          if (result.ok) load();
          else setError(result.message);
        },
      },
    ]);
  }

  const threads = (comments || []).filter((c) => !c.parent_id);
  const repliesOf = (cid) => (comments || []).filter((c) => c.parent_id === cid);
  const canWrite = loggedIn && !blocked && event.open && (event.comments_open || event.is_owner);

  function renderComment(comment, isReply) {
    if (comment.deleted) {
      return <Text key={comment.id} style={[styles.deleted, isReply && styles.reply]}>{t("events.deletedComment")}</Text>;
    }
    return (
      <View key={comment.id} style={[styles.comment, isReply && styles.reply]}>
        {comment.author?.photo ? (
          <Image source={{ uri: IMG.thumb(comment.author.photo) }} style={styles.commentAvatar} />
        ) : (
          <View style={[styles.commentAvatar, styles.avatarEmpty]}><Text style={{ fontSize: 12 }}>🌸</Text></View>
        )}
        <View style={styles.commentBody}>
          <View style={styles.commentHead}>
            <Text style={styles.commentName}>{comment.author?.first_name}</Text>
            {comment.is_owner ? <Text style={styles.organiserBadge}>{t("events.organiserBadge")}</Text> : null}
            {!comment.is_owner && comment.interested ? <Text style={styles.interestedBadge}>{t("events.interestedBadge")}</Text> : null}
          </View>
          <Text style={styles.commentText}>{comment.text}</Text>
          <View style={styles.commentActions}>
            <Text style={styles.commentTime}>{eventWhen(comment.created_at, i18n.language)}</Text>
            {canWrite && (
              <Text style={styles.commentAction} onPress={() => setReplyTo({ id: comment.parent_id || comment.id, name: comment.author?.first_name })}>
                {t("events.reply")}
              </Text>
            )}
            {(comment.can_delete || isAdmin) && (
              <Text style={styles.commentAction} onPress={() => remove(comment)}>{t("events.deleteComment")}</Text>
            )}
            {!comment.mine && (
              <Text style={styles.commentAction} onPress={() => onReport(comment.id)}>{t("events.report")}</Text>
            )}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        💬 {t("events.commentsTitle")}{comments ? ` (${comments.filter((c) => !c.deleted).length})` : ""}
      </Text>
      {!loggedIn ? (
        <Pressable style={styles.membersOnly} onPress={() => navigation.navigate("Login")}>
          <Text style={styles.muted}>🔒 {t("events.commentsMembers")}</Text>
        </Pressable>
      ) : (
        <>
          {comments === null ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : threads.length === 0 ? (
            <Text style={styles.emptyText}>{t("events.noComments")}</Text>
          ) : (
            threads.map((comment) => (
              <View key={comment.id} style={{ marginTop: 12 }}>
                {renderComment(comment, false)}
                {repliesOf(comment.id).map((reply) => renderComment(reply, true))}
              </View>
            ))
          )}
          {canWrite ? (
            <View style={styles.composer}>
              {replyTo && (
                <View style={styles.replying}>
                  <Text style={styles.muted}>↪ {t("events.replyingTo", { name: replyTo.name })}</Text>
                  <Text style={styles.replyingClose} onPress={() => setReplyTo(null)}>✕</Text>
                </View>
              )}
              <View style={styles.composerRow}>
                <TextInput
                  style={styles.input}
                  value={text}
                  onChangeText={setText}
                  placeholder={t("events.commentPlaceholder")}
                  placeholderTextColor={colors.textMuted}
                  maxLength={500}
                  multiline
                />
                <Pressable
                  style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
                  onPress={send}
                  disabled={!text.trim() || sending}
                  accessibilityRole="button"
                >
                  <Text style={styles.sendText}>{t("events.send")}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Text style={[styles.muted, { marginTop: 12 }]}>
              {blocked ? t("events.commentsWomenOnly") : !event.open ? t("events.past") : t("events.commentsClosed")}
            </Text>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: colors.text },
  topTitle: { ...typography.h3, fontSize: 17 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg, gap: 10 },
  missingText: { ...typography.body, color: colors.textSoft, textAlign: "center" },
  media: { height: 230, position: "relative" },
  image: { width: "100%", height: "100%" },
  noImage: { alignItems: "center", justifyContent: "center" },
  kindPill: {
    position: "absolute", top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: radius.pill, backgroundColor: "rgba(20,14,12,0.55)",
  },
  kindPillText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  content: {
    marginTop: -18, marginHorizontal: spacing.md, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, ...shadow.md,
  },
  statusBar: {
    marginBottom: 10, padding: 10, borderRadius: radius.sm, backgroundColor: "#fdecea",
    color: colors.danger, fontWeight: "700", overflow: "hidden",
  },
  title: { ...typography.h2, marginBottom: 12 },
  fact: { flexDirection: "row", gap: 10, alignItems: "flex-start", marginBottom: 9 },
  giftFact: { padding: 10, borderRadius: radius.sm, backgroundColor: "#fff4e5" },
  factIcon: { width: 22, textAlign: "center", fontSize: 15 },
  factText: { fontSize: 15, color: colors.text },
  factStrong: { fontSize: 15, fontWeight: "700", color: colors.text },
  link: { fontSize: 14.5, fontWeight: "700", color: colors.primaryDeep },
  langs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  lang: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.pill, backgroundColor: colors.primaryTint,
    color: colors.primaryDeep, fontWeight: "700", fontSize: 13, overflow: "hidden",
  },
  description: { ...typography.body, lineHeight: 23, marginTop: 6, marginBottom: 14 },
  organizer: {
    flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border,
  },
  organizerPhoto: { width: 44, height: 44, borderRadius: 22 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  organizerName: { fontWeight: "700", fontSize: 15, color: colors.text },
  counts: { fontWeight: "700", color: colors.textSoft, fontSize: 13.5 },
  muted: { ...typography.bodyMuted, lineHeight: 19 },
  actions: { marginTop: 16, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  btn: {
    paddingHorizontal: 22, paddingVertical: 13, borderRadius: radius.pill, backgroundColor: colors.primary,
    alignItems: "center", ...shadow.sm,
  },
  btnSecondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.borderStrong, shadowOpacity: 0, elevation: 0 },
  btnDanger: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.danger, shadowOpacity: 0, elevation: 0 },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  matchedBox: { padding: 14, borderRadius: radius.md, backgroundColor: colors.primaryTint, gap: 10 },
  matchedText: { fontWeight: "800", color: colors.primaryDeep, fontSize: 15 },
  interestOn: {
    alignSelf: "flex-start", paddingHorizontal: 16, paddingVertical: 9, borderRadius: radius.pill,
    backgroundColor: colors.primaryTint, color: colors.primaryDeep, fontWeight: "800", overflow: "hidden",
  },
  linkMuted: { color: colors.textSoft, fontWeight: "600", textDecorationLine: "underline", fontSize: 14 },
  smallActions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  smallBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1,
    borderColor: colors.borderStrong, backgroundColor: colors.surface,
  },
  smallBtnText: { fontSize: 13, fontWeight: "600", color: colors.textSoft },
  notice: { color: colors.success, fontWeight: "700", marginTop: 10 },
  error: { color: colors.danger, fontWeight: "600", marginTop: 10, textAlign: "center" },
  safety: { marginTop: 14, fontSize: 12.5, color: colors.textMuted, lineHeight: 18 },
  section: {
    marginTop: spacing.md, marginHorizontal: spacing.md, padding: spacing.md, borderRadius: radius.lg,
    backgroundColor: colors.surface, ...shadow.sm,
  },
  sectionTitle: { ...typography.h3, fontSize: 18, marginBottom: 4 },
  emptyText: { ...typography.body, color: colors.textSoft, marginTop: 12 },
  person: { marginTop: 12, padding: 10, borderRadius: radius.md, backgroundColor: colors.background, gap: 10 },
  personLink: { flexDirection: "row", alignItems: "center", gap: 10 },
  personPhoto: { width: 46, height: 46, borderRadius: 23 },
  personName: { fontWeight: "700", fontSize: 15, color: colors.text },
  personMeta: { fontSize: 13, color: colors.textSoft },
  personActions: { flexDirection: "row", alignItems: "center", gap: 12, justifyContent: "flex-end" },
  matchBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: radius.pill, backgroundColor: colors.primary },
  matchBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  matchedBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.primaryTint,
    color: colors.primaryDeep, fontWeight: "700", fontSize: 12.5, overflow: "hidden",
  },
  declinedBadge: {
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: colors.border,
    color: colors.textSoft, fontWeight: "700", fontSize: 12.5, overflow: "hidden",
  },
  membersOnly: { marginTop: 10, padding: 14, borderRadius: radius.md, backgroundColor: colors.background },
  comment: { flexDirection: "row", gap: 10 },
  reply: { marginLeft: 34, marginTop: 10 },
  commentAvatar: { width: 34, height: 34, borderRadius: 17 },
  commentBody: {
    flex: 1, paddingHorizontal: 12, paddingVertical: 9, backgroundColor: colors.background,
    borderTopLeftRadius: 4, borderTopRightRadius: 16, borderBottomLeftRadius: 16, borderBottomRightRadius: 16,
  },
  commentHead: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 2 },
  commentName: { fontWeight: "700", fontSize: 14, color: colors.text },
  organiserBadge: {
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.text,
    color: "#fff", fontSize: 10.5, fontWeight: "800", overflow: "hidden",
  },
  interestedBadge: {
    paddingHorizontal: 7, paddingVertical: 1, borderRadius: radius.pill, backgroundColor: colors.primaryTint,
    color: colors.primaryDeep, fontSize: 10.5, fontWeight: "800", overflow: "hidden",
  },
  commentText: { fontSize: 14.5, color: colors.text, lineHeight: 20 },
  commentActions: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 6 },
  commentTime: { fontSize: 11.5, color: colors.textMuted },
  commentAction: { fontSize: 12, fontWeight: "700", color: colors.textMuted },
  deleted: { fontSize: 13, fontStyle: "italic", color: colors.textMuted, marginLeft: 44 },
  composer: { marginTop: 16 },
  replying: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  replyingClose: { fontSize: 16, color: colors.textSoft, paddingHorizontal: 6 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  input: {
    flex: 1, minHeight: 46, maxHeight: 120, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface, fontSize: 15, color: colors.text,
  },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.pill, backgroundColor: colors.primary },
  sendText: { color: "#fff", fontWeight: "800" },
});
