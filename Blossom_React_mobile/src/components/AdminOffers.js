import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Share,
  Linking,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import { BASE_URL, SITE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { formatBirthDate } from "../api/birthDate";
import { formatDeadline, formatHours, formatTimeInput, localToIso } from "../api/offers";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { BusinessMessages, PartnerRequests, PartnerVenues } from "./PartnerAdmin";
import { colors, radius, spacing, shadow } from "../theme";

const STATE_COLORS = {
  open: { color: "#1F7A4D", backgroundColor: "#E3F4EA" },
  full: { color: "#6B3E00", backgroundColor: "#FFF4E5" },
  paused: { color: colors.textSoft, backgroundColor: colors.surfaceMuted },
  ended: { color: colors.textMuted, backgroundColor: colors.surfaceMuted },
};

async function send(path, method, body) {
  const token = await getToken();
  return postJson(`${BASE_URL}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// Admin: venue promotions for couples - publish one on a date spot, follow
// how many couples got it and used it, pause, add places, end it.
export default function AdminOffers({ bottomInset = 0 }) {
  const { t, i18n } = useTranslation();
  const [offers, setOffers] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  // Approving a partner request publishes an offer: refresh the lists.
  const [partnerKey, setPartnerKey] = useState(0);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/offers/admin`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`offers ${resp.status}`);
      setOffers(await resp.json());
      setError("");
    } catch {
      setError(t("offers.loadFailed"));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  useAutoRefresh(load, { minIntervalMs: 15000 });

  async function change(offer, changes) {
    setBusy(offer.id);
    const result = await send(`/offers/admin/${offer.id}`, "PATCH", changes);
    setBusy(null);
    if (!result.ok) {
      setError(result.message || t("offers.saveFailed"));
      return;
    }
    setOffers((cur) => cur.map((o) => (o.id === offer.id ? result.data : o)));
  }

  const deadline = (value) => formatDeadline(value, i18n.language);

  // The instructions and staff code, ready to send to the venue (WhatsApp, SMS...).
  function sendToVenue(o) {
    Share.share({
      message: t("offers.venueMessage", {
        spot: o.spot?.name || "",
        title: o.title,
        details: o.details ? ` (${o.details})` : "",
        url: `${SITE_URL}/venue`,
        code: o.staff_code,
      }),
    }).catch(() => {});
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}
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
    >
      <PartnerRequests
        onApproved={() => {
          load();
          setPartnerKey((k) => k + 1);
        }}
      />

      {formOpen ? (
        <OfferForm
          t={t}
          onCancel={() => setFormOpen(false)}
          onCreated={(offer) => {
            setFormOpen(false);
            setOffers((cur) => [offer, ...(cur || [])]);
          }}
        />
      ) : (
        <Pressable style={styles.newBtn} onPress={() => setFormOpen(true)}>
          <Text style={styles.newBtnText}>{t("offers.new")}</Text>
        </Pressable>
      )}

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      {offers === null ? (
        !error && <ActivityIndicator style={{ marginTop: 30 }} color={colors.primary} />
      ) : offers.length === 0 ? (
        <Text style={styles.empty}>{t("offers.empty")}</Text>
      ) : (
        offers.map((o) => (
          <View key={o.id} style={styles.card}>
            <View style={styles.cardTop}>
              <Text style={styles.spotName} numberOfLines={1}>📍 {o.spot?.name}</Text>
              <Text style={[styles.state, STATE_COLORS[o.state]]}>{t(`offers.state_${o.state}`)}</Text>
            </View>
            <Text style={styles.title}>🎁 {o.title}</Text>
            {o.details ? <Text style={styles.muted}>{o.details}</Text> : null}
            <Text style={styles.line}>
              {t("offers.until", { date: deadline(o.ends_at) })} ·{" "}
              {t("offers.validAfterYes", { time: formatHours(o.valid_hours, t) })}
            </Text>
            <Text style={styles.line}>
              {o.stats.remaining == null ? t("offers.noLimit") : t("offers.placesLeft", { count: o.stats.remaining })}
            </Text>
            <Text style={styles.stats}>{t("offers.stats", o.stats)}</Text>
            <Text style={styles.staffCode}>🔑 {t("offers.staffCodeShow", { code: o.staff_code })}</Text>

            {o.couples.length > 0 && (
              <View style={styles.couples}>
                <Text style={styles.couplesTitle}>{t("offers.couples")}</Text>
                {o.couples.slice(0, 8).map((c) => (
                  <Text key={c.code} style={styles.couple} numberOfLines={1}>
                    {c.names.join(" & ")} · {c.code} · {t(`offers.status_${c.status}`)}
                  </Text>
                ))}
              </View>
            )}

            {o.state !== "ended" && (
              <View style={styles.actions}>
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => change(o, { active: !o.active })}
                  disabled={busy === o.id}
                >
                  <Text style={styles.actionText}>{o.active ? t("offers.pause") : t("offers.resume")}</Text>
                </Pressable>
                {o.max_couples != null && (
                  <Pressable
                    style={styles.actionBtn}
                    onPress={() => change(o, { max_couples: o.max_couples + 5 })}
                    disabled={busy === o.id}
                  >
                    <Text style={styles.actionText}>{t("offers.addPlaces")}</Text>
                  </Pressable>
                )}
                <Pressable
                  style={styles.actionBtn}
                  onPress={() => change(o, { ends_at: new Date().toISOString() })}
                  disabled={busy === o.id}
                >
                  <Text style={[styles.actionText, { color: colors.danger }]}>{t("offers.endNow")}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => sendToVenue(o)}>
                  <Text style={styles.actionText}>{t("offers.sendVenue")}</Text>
                </Pressable>
                <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`${SITE_URL}/poster/${o.id}`)}>
                  <Text style={styles.actionText}>{t("offers.poster")}</Text>
                </Pressable>
                {busy === o.id && <ActivityIndicator size="small" color={colors.primary} />}
              </View>
            )}
          </View>
        ))
      )}
      <PartnerVenues refreshKey={partnerKey} />
      <BusinessMessages />
    </ScrollView>
  );
}

function Field({ label, hint, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function OfferForm({ t, onCancel, onCreated }) {
  const [spots, setSpots] = useState(null);
  const [search, setSearch] = useState("");
  const [spot, setSpot] = useState(null);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [maxCouples, setMaxCouples] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("23:00");
  const [days, setDays] = useState("7");
  const [hours, setHours] = useState("0");
  const [staffCode, setStaffCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useAutoRefresh(
    async () => {
      try {
        const resp = await fetch(`${BASE_URL}/date_spots`);
        if (resp.ok) setSpots(await resp.json());
      } catch {
        setSpots([]);
      }
    },
    { minIntervalMs: 60000 },
  );

  const found = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (spots || [])
      .filter((s) => !q || `${s.name} ${s.city} ${s.neighborhood || ""}`.toLowerCase().includes(q))
      .slice(0, 6);
  }, [spots, search]);

  async function publish() {
    setError("");
    if (!spot) return setError(t("offers.chooseSpot"));
    const endsAt = localToIso(endDate, endTime);
    if (!endsAt || new Date(endsAt) <= new Date()) return setError(t("offers.badDate"));
    const validHours = (parseInt(days, 10) || 0) * 24 + (parseInt(hours, 10) || 0);
    if (validHours < 1) return setError(t("offers.badValidity"));
    setSaving(true);
    const result = await send("/offers/admin", "POST", {
      spot_id: spot.id,
      title,
      details: details || null,
      max_couples: maxCouples ? parseInt(maxCouples, 10) : null,
      ends_at: endsAt,
      valid_hours: validHours,
      staff_code: staffCode || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.message || t("offers.saveFailed"));
      return;
    }
    onCreated(result.data);
  }

  return (
    <View style={styles.form}>
      <Field label={t("offers.spot")}>
        {spot ? (
          <Pressable style={styles.chosenSpot} onPress={() => setSpot(null)}>
            <Text style={styles.chosenSpotText}>📍 {spot.name} · {spot.city} ✕</Text>
          </Pressable>
        ) : (
          <>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={t("offers.searchSpot")}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
            />
            {spots === null ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 8 }} />
            ) : (
              found.map((s) => (
                <Pressable key={s.id} style={styles.spotOption} onPress={() => setSpot(s)}>
                  <Text style={styles.spotOptionText} numberOfLines={1}>
                    {s.offer ? "🎁 " : ""}
                    {s.name} · {s.city}
                  </Text>
                </Pressable>
              ))
            )}
          </>
        )}
      </Field>

      <Field label={t("offers.title")}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder={t("offers.titlePlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={styles.input}
          maxLength={120}
        />
      </Field>
      <Field label={t("offers.details")}>
        <TextInput
          value={details}
          onChangeText={setDetails}
          placeholder={t("offers.detailsPlaceholder")}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
          multiline
          maxLength={500}
        />
      </Field>
      <Field label={t("offers.maxCouples")} hint={t("offers.maxCouplesHint")}>
        <TextInput
          value={maxCouples}
          onChangeText={(v) => setMaxCouples(v.replace(/\D/g, "").slice(0, 5))}
          keyboardType="number-pad"
          placeholder="10"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </Field>
      <Field label={t("offers.endsAt")}>
        <View style={styles.row}>
          <TextInput
            value={endDate}
            onChangeText={(v) => setEndDate(formatBirthDate(v))}
            keyboardType="number-pad"
            maxLength={10}
            placeholder={t("offers.datePlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 2 }]}
          />
          <TextInput
            value={endTime}
            onChangeText={(v) => setEndTime(formatTimeInput(v))}
            keyboardType="number-pad"
            maxLength={5}
            placeholder={t("offers.timePlaceholder")}
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { flex: 1 }]}
          />
        </View>
      </Field>
      <Field label={t("offers.validFor")}>
        <View style={styles.row}>
          <TextInput
            value={days}
            onChangeText={(v) => setDays(v.replace(/\D/g, "").slice(0, 3))}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={styles.unit}>{t("offers.daysLabel")}</Text>
          <TextInput
            value={hours}
            onChangeText={(v) => setHours(v.replace(/\D/g, "").slice(0, 2))}
            keyboardType="number-pad"
            style={[styles.input, { flex: 1 }]}
          />
          <Text style={styles.unit}>{t("offers.hoursLabel")}</Text>
        </View>
      </Field>
      <Field label={t("offers.staffCode")} hint={t("offers.staffCodeHint")}>
        <TextInput
          value={staffCode}
          onChangeText={(v) => setStaffCode(v.replace(/\D/g, "").slice(0, 8))}
          keyboardType="number-pad"
          placeholder="1234"
          placeholderTextColor={colors.textMuted}
          style={styles.input}
        />
      </Field>

      {error !== "" && <Text style={styles.error}>{error}</Text>}
      <View style={styles.row}>
        <Pressable style={[styles.cancelBtn, { flex: 1 }]} onPress={onCancel}>
          <Text style={styles.cancelText}>{t("offers.cancel")}</Text>
        </Pressable>
        <Pressable style={[styles.publishBtn, { flex: 1 }, saving && { opacity: 0.6 }]} onPress={publish} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.publishText}>{t("offers.publish")}</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md },
  newBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  newBtnText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.sm, textAlign: "center" },
  empty: { color: colors.textMuted, textAlign: "center", marginTop: 30 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  spotName: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.textSoft },
  state: { fontSize: 11.5, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  title: { fontSize: 16.5, fontWeight: "800", color: colors.text, marginTop: 6 },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  line: { fontSize: 13, color: colors.textSoft, marginTop: 6 },
  stats: { fontSize: 13, fontWeight: "700", color: colors.text, marginTop: 8 },
  staffCode: { fontSize: 13, color: colors.textSoft, marginTop: 6 },
  couples: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  couplesTitle: { fontSize: 12, fontWeight: "700", color: colors.textMuted, textTransform: "uppercase", marginBottom: 4 },
  couple: { fontSize: 13, color: colors.textSoft, marginTop: 2 },
  actions: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12 },
  actionBtn: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 },
  actionText: { fontSize: 13, fontWeight: "700", color: colors.textSoft },
  form: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, ...shadow.sm },
  field: { marginBottom: spacing.md },
  label: { fontSize: 13, fontWeight: "700", color: colors.textSoft, marginBottom: 6 },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 4, lineHeight: 16 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  unit: { fontSize: 13, color: colors.textSoft },
  spotOption: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  spotOptionText: { fontSize: 14, color: colors.text },
  chosenSpot: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, padding: 12 },
  chosenSpotText: { fontSize: 14.5, fontWeight: "700", color: colors.primaryDeep },
  cancelBtn: { borderWidth: 1.5, borderColor: colors.borderStrong, borderRadius: radius.pill, paddingVertical: 12, alignItems: "center" },
  cancelText: { color: colors.textSoft, fontWeight: "700" },
  publishBtn: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12, alignItems: "center" },
  publishText: { color: "#fff", fontWeight: "800" },
});
