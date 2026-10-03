import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, Alert, Image, Linking, Share, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { formatDeadline, formatHours } from "../api/offers";
import { IMG } from "../api/images";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { colors, radius, spacing, shadow } from "../theme";

async function call(path, method = "GET", body) {
  const token = await getToken();
  return postJson(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Admin: events and comments members reported. Remove the event, delete the
// comment, or "nothing to do" - each closes the report.
export function EventReports({ onOpenEvent }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const result = await call("/events/admin/reports");
    if (result.ok) {
      setItems(result.data);
      setError("");
    } else {
      setError(result.message || t("partners.failed"));
    }
  }, [t]);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  async function handle(report, action) {
    setBusyId(report.id);
    setError("");
    let result = { ok: true };
    if (action === "event") result = await call(`/events/${report.event.id}`, "DELETE");
    else if (action === "comment") result = await call(`/events/comments/${report.comment.id}`, "DELETE");
    // Already removed counts as done.
    if (result.ok || result.resp?.status === 404) {
      result = await call(`/events/admin/reports/${report.id}/handled`, "POST");
    }
    setBusyId(null);
    if (!result.ok) {
      setError(result.message || t("partners.failed"));
      return;
    }
    load();
  }

  function confirmRemove(report) {
    Alert.alert(t("events.adminRemove"), t("events.adminRemoveConfirm"), [
      { text: t("offers.cancel"), style: "cancel" },
      { text: t("events.adminRemove"), style: "destructive", onPress: () => handle(report, "event") },
    ]);
  }

  if (items === null) return error ? <Text style={styles.error}>{error}</Text> : null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t("events.reportsTitle")}</Text>
      {error !== "" && <Text style={styles.error}>{error}</Text>}
      {items.length === 0 ? (
        <Text style={styles.muted}>{t("events.reportsEmpty")}</Text>
      ) : (
        items.map((report) => (
          <View key={report.id} style={styles.card}>
            {report.event ? (
              <Pressable onPress={() => onOpenEvent?.(report.event.id)} hitSlop={6}>
                <Text style={styles.title}>📅 {report.event.title}</Text>
                <Text style={styles.line}>
                  {report.event.city} · {t("events.organisedBy", { name: report.event.organizer || "?" })}
                  {report.event.status !== "active" ? ` · ${report.event.status}` : ""}
                </Text>
              </Pressable>
            ) : null}
            {report.comment ? (
              <Text style={styles.reportQuote}>
                {report.comment.author || "?"}: {report.comment.text}
                {report.comment.deleted ? ` (${t("events.deletedComment")})` : ""}
              </Text>
            ) : null}
            {report.reason ? <Text style={styles.line}>“{report.reason}”</Text> : null}
            <Text style={styles.muted}>
              {t("events.reportBy", { name: report.reporter || "?", date: formatDeadline(report.created_at, i18n.language) })}
            </Text>
            <View style={styles.actions}>
              {busyId === report.id ? <ActivityIndicator color={colors.primary} /> : null}
              {report.comment && !report.comment.deleted ? (
                <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => handle(report, "comment")} disabled={busyId === report.id}>
                  <Text style={styles.btnText}>{t("events.removeComment")}</Text>
                </Pressable>
              ) : report.event?.status === "active" ? (
                <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => confirmRemove(report)} disabled={busyId === report.id}>
                  <Text style={styles.btnText}>{t("events.adminRemove")}</Text>
                </Pressable>
              ) : null}
              <Pressable style={[styles.btn, styles.btnApprove]} onPress={() => handle(report, "done")} disabled={busyId === report.id}>
                <Text style={styles.btnText}>{t("events.reportDone")}</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// Admin: places members suggested. Approve publishes one (the member gets a
// "thank you"); refuse deletes it. "💡 Would love a gift here" = a venue worth
// asking for a gift.
export function SpotSuggestions({ onChanged }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    const result = await call("/date_spots/admin/suggestions");
    if (result.ok) {
      setItems(result.data);
      setError("");
    } else {
      setError(result.message || t("partners.failed"));
    }
  }, [t]);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  async function answer(spot, approve) {
    setBusyId(spot.id);
    const result = await call(`/date_spots/${spot.id}${approve ? "/approve" : ""}`, approve ? "POST" : "DELETE");
    setBusyId(null);
    if (!result.ok) {
      setError(result.message || t("partners.failed"));
      return;
    }
    load();
    onChanged?.();
  }

  function confirmRefuse(spot) {
    Alert.alert(t("partners.refuse"), t("partners.refuseSuggestionConfirm", { name: spot.name }), [
      { text: t("offers.cancel"), style: "cancel" },
      { text: t("partners.refuse"), style: "destructive", onPress: () => answer(spot, false) },
    ]);
  }

  if (items === null) return error ? <Text style={styles.error}>{error}</Text> : null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t("partners.suggestionsTitle")}</Text>
      {error !== "" && <Text style={styles.error}>{error}</Text>}
      {items.length === 0 ? (
        <Text style={styles.muted}>{t("partners.suggestionsEmpty")}</Text>
      ) : (
        items.map((spot) => (
          <View key={spot.id} style={styles.card}>
            <View style={styles.suggestionTop}>
              {spot.image_url ? <Image source={{ uri: IMG.thumb(spot.image_url) }} style={styles.suggestionPhoto} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{spot.name}</Text>
                <Text style={styles.line}>
                  📍 {[spot.neighborhood, spot.city, spot.country].filter(Boolean).join(", ")}
                </Text>
                <Text style={styles.muted}>
                  {t("partners.suggestedBy", {
                    name: spot.profile?.first_name || "?",
                    date: formatDeadline(spot.created_at, i18n.language),
                  })}
                </Text>
              </View>
            </View>
            {spot.wants_gift ? <Text style={styles.wantsGift}>{t("partners.wantsGiftAdmin")}</Text> : null}
            {spot.description ? <Text style={styles.line}>{spot.description}</Text> : null}
            {spot.map_url ? (
              <Pressable onPress={() => Linking.openURL(spot.map_url)} hitSlop={6}>
                <Text style={styles.link}>🗺️ Google Maps</Text>
              </Pressable>
            ) : null}
            <View style={styles.actions}>
              {busyId === spot.id ? <ActivityIndicator color={colors.primary} /> : null}
              <Pressable style={[styles.btn, styles.btnApprove]} onPress={() => answer(spot, true)} disabled={busyId === spot.id}>
                <Text style={styles.btnText}>{t("partners.approve")}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => confirmRefuse(spot)} disabled={busyId === spot.id}>
                <Text style={styles.btnText}>{t("partners.refuse")}</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

// Admin: "Partner with Blossom" requests - approve (after correcting if
// needed) or refuse - and the partner venues with their private manager link.
export function PartnerRequests({ onApproved }) {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await call("/partners/requests");
    if (result.ok) {
      setItems(result.data);
      setError("");
    } else {
      setError(result.message || t("partners.failed"));
    }
  }, [t]);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  if (items === null) return error ? <Text style={styles.error}>{error}</Text> : null;
  const pending = items.filter((r) => r.status === "pending");

  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t("partners.requests")}</Text>
      {error !== "" && <Text style={styles.error}>{error}</Text>}
      {pending.length === 0 ? (
        <Text style={styles.muted}>{t("partners.noRequests")}</Text>
      ) : (
        pending.map((r) => (
          <RequestCard
            key={r.id}
            request={r}
            language={i18n.language}
            onDone={() => {
              load();
              onApproved?.();
            }}
          />
        ))
      )}
    </View>
  );
}

function RequestCard({ request: r, language, onDone }) {
  const { t } = useTranslation();
  const newVenue = r.kind === "new_venue";
  const [editing, setEditing] = useState(false);
  const [refusing, setRefusing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState({
    venue_name: r.venue_name || "",
    city: r.city || "",
    country: r.country || "",
    offer_title: r.offer_title || "",
    offer_details: r.offer_details || "",
    max_couples: r.max_couples == null ? "" : String(r.max_couples),
  });

  async function send(path, body) {
    setBusy(true);
    setError("");
    const result = await call(`/partners/requests/${r.id}/${path}`, "POST", body);
    setBusy(false);
    if (!result.ok) {
      setError(result.message || t("partners.failed"));
      return;
    }
    onDone();
  }

  function approve() {
    const body = {};
    if (editing) {
      Object.assign(body, {
        offer_title: edits.offer_title,
        offer_details: edits.offer_details || null,
        max_couples: edits.max_couples ? parseInt(edits.max_couples, 10) : null,
      });
      if (newVenue) Object.assign(body, { venue_name: edits.venue_name, city: edits.city, country: edits.country });
    }
    send("approve", body);
  }

  const field = (key, label, numeric) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={edits[key]}
        onChangeText={(v) => setEdits((x) => ({ ...x, [key]: numeric ? v.replace(/\D/g, "").slice(0, 5) : v }))}
        keyboardType={numeric ? "number-pad" : "default"}
        style={styles.input}
      />
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.kind}>
          {newVenue ? t("partners.newVenue") : t("partners.newOfferFrom", { name: r.venue?.name || r.venue_name })}
        </Text>
        <Text style={styles.muted}>{formatDeadline(r.created_at, language)}</Text>
      </View>
      <Text style={styles.title}>🏪 {r.venue_name}</Text>
      <Text style={styles.line}>📍 {[r.city, r.country].filter(Boolean).join(", ")}</Text>
      {r.map_url ? (
        <Pressable onPress={() => Linking.openURL(r.map_url)}>
          <Text style={styles.link}>🗺️ {t("partners.openMaps")}</Text>
        </Pressable>
      ) : null}
      {r.about ? <Text style={styles.muted}>{r.about}</Text> : null}
      <Text style={styles.offer}>🎁 {r.offer_title}</Text>
      {r.offer_details ? <Text style={styles.muted}>{r.offer_details}</Text> : null}
      <Text style={styles.line}>
        {r.max_couples == null ? t("offers.noLimit") : t("offers.placesLeft", { count: r.max_couples })}
        {r.ends_at ? ` · ${t("offers.until", { date: formatDeadline(r.ends_at, language) })}` : ""}
        {r.valid_hours ? ` · ${t("offers.validAfterYes", { time: formatHours(r.valid_hours, t) })}` : ""}
      </Text>
      {!r.ends_at && !r.valid_hours ? <Text style={styles.muted}>{t("partners.defaults")}</Text> : null}
      {r.contact_name || r.contact_email || r.contact_phone ? (
        <Text style={styles.line}>
          👤 {[r.contact_name, r.contact_email, r.contact_phone].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {r.message ? <Text style={styles.muted}>💬 {r.message}</Text> : null}
      {r.suggested_spot ? (
        <Text style={styles.line}>
          🔗 {t("partners.existingSpot", { name: r.suggested_spot.name })}
          {r.spot_chosen ? ` (${t("partners.chosenByVenue")})` : ""}
        </Text>
      ) : null}

      {editing ? (
        <View style={styles.editBox}>
          {newVenue ? field("venue_name", t("partners.venueName")) : null}
          {newVenue ? field("city", t("partners.city")) : null}
          {newVenue ? field("country", t("partners.country")) : null}
          {field("offer_title", t("partners.offerTitle"))}
          {field("offer_details", t("partners.offerDetails"))}
          {field("max_couples", t("partners.maxCouples"), true)}
        </View>
      ) : null}
      {refusing ? (
        <View style={styles.field}>
          <Text style={styles.label}>{t("partners.refuseReason")}</Text>
          <TextInput value={reason} onChangeText={setReason} style={styles.input} maxLength={500} />
        </View>
      ) : null}
      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {refusing ? (
          <>
            <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => send("refuse", { reason: reason || null })} disabled={busy}>
              <Text style={[styles.btnText, { color: colors.danger }]}>{t("partners.confirmRefuse")}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setRefusing(false)} disabled={busy}>
              <Text style={styles.btnText}>{t("offers.cancel")}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={[styles.btn, styles.btnApprove]} onPress={approve} disabled={busy}>
              <Text style={[styles.btnText, { color: "#1F7A4D" }]}>{t("partners.approve")}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setEditing((v) => !v)} disabled={busy}>
              <Text style={styles.btnText}>{t("partners.edit")}</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnDanger]} onPress={() => setRefusing(true)} disabled={busy}>
              <Text style={[styles.btnText, { color: colors.danger }]}>{t("partners.refuse")}</Text>
            </Pressable>
          </>
        )}
        {busy && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
    </View>
  );
}

export function PartnerVenues({ refreshKey }) {
  const { t } = useTranslation();
  const [venues, setVenues] = useState(null);

  const load = useCallback(async () => {
    const result = await call("/partners/venues");
    if (result.ok) setVenues(result.data);
  }, []);

  useAutoRefresh(load, { minIntervalMs: 15000 });
  // A newly approved café shows up at once.
  useEffect(() => {
    if (refreshKey) load();
  }, [refreshKey, load]);

  function newLink(venue) {
    Alert.alert(t("partners.newLink"), t("partners.newLinkConfirm"), [
      { text: t("offers.cancel"), style: "cancel" },
      {
        text: t("offers.confirm"),
        onPress: async () => {
          const result = await call(`/partners/venues/${venue.id}/new_link`, "POST");
          if (result.ok) setVenues((cur) => cur.map((v) => (v.id === venue.id ? result.data : v)));
        },
      },
    ]);
  }

  if (!venues || venues.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t("partners.venues")}</Text>
      {venues.map((v) => (
        <View key={v.id} style={styles.venueRow}>
          <Text style={styles.venueName}>
            {v.name} <Text style={styles.muted}>· {v.spot?.city} · 🔑 {v.staff_code}</Text>
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.btn} onPress={() => Share.share({ message: v.manage_url }).catch(() => {})}>
              <Text style={styles.btnText}>{t("partners.shareLink")}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => newLink(v)}>
              <Text style={styles.btnText}>{t("partners.newLink")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

// "Contact us" messages from businesses: reply by email, mark as handled.
export function BusinessMessages() {
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState(null);

  const load = useCallback(async () => {
    const result = await call("/partners/contact");
    if (result.ok) setMessages(result.data);
  }, []);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  async function setHandled(message, handled) {
    const result = await call(`/partners/contact/${message.id}/handled`, "POST", { handled });
    if (result.ok) setMessages((cur) => cur.map((m) => (m.id === message.id ? result.data : m)));
  }

  if (!messages) return null;
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{t("business.messages")}</Text>
      {messages.length === 0 ? <Text style={styles.muted}>{t("business.noMessages")}</Text> : null}
      {messages.map((m) => (
        <View key={m.id} style={[styles.card, m.handled && { opacity: 0.6 }]}>
          <View style={styles.cardTop}>
            <Text style={styles.kind}>{t(`business.topic_${m.topic}`)}</Text>
            <Text style={styles.muted}>{formatDeadline(m.created_at, i18n.language)}</Text>
          </View>
          <Text style={styles.title}>
            {m.name}
            {m.business ? ` · ${m.business}` : ""}
          </Text>
          <Text style={styles.line}>{m.message}</Text>
          <Text style={styles.muted}>
            {m.email}
            {m.phone ? ` · ${m.phone}` : ""}
          </Text>
          <View style={styles.actions}>
            <Pressable style={styles.btn} onPress={() => Linking.openURL(`mailto:${m.email}?subject=Blossom`)}>
              <Text style={styles.btnText}>{t("business.reply")}</Text>
            </Pressable>
            <Pressable style={styles.btn} onPress={() => setHandled(m, !m.handled)}>
              <Text style={styles.btnText}>{m.handled ? t("business.reopen") : t("business.markHandled")}</Text>
            </Pressable>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginBottom: spacing.lg },
  suggestionTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  suggestionPhoto: { width: 56, height: 56, borderRadius: radius.sm },
  wantsGift: {
    alignSelf: "flex-start",
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: "700",
    color: "#6B3E00",
    backgroundColor: "#FFF4E5",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
    overflow: "hidden",
  },
  blockTitle: { fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: spacing.sm },
  error: { color: colors.danger, fontSize: 13, marginVertical: 6 },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  kind: { fontSize: 12, fontWeight: "800", color: colors.primaryDeep, textTransform: "uppercase" },
  title: { fontSize: 17, fontWeight: "800", color: colors.text, marginTop: 6 },
  line: { fontSize: 13.5, color: colors.textSoft, marginTop: 5 },
  link: { fontSize: 13.5, color: colors.primary, fontWeight: "700", marginTop: 5 },
  offer: { fontSize: 15.5, fontWeight: "700", color: colors.text, marginTop: 10 },
  editBox: { marginTop: 10, padding: 10, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  field: { marginTop: 8 },
  label: { fontSize: 12.5, fontWeight: "700", color: colors.textSoft, marginBottom: 4 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14.5,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 },
  btn: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  btnApprove: { borderColor: "#3BA776" },
  btnDanger: { borderColor: "#F2C4C0" },
  btnText: { fontSize: 13, fontWeight: "700", color: colors.textSoft },
  venueRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  venueName: { fontSize: 14.5, fontWeight: "700", color: colors.text },
  reportQuote: {
    marginVertical: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: colors.background,
    color: colors.text,
    fontSize: 14,
  },
});
