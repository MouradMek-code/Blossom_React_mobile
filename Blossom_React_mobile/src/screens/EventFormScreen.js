import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, Image, Switch, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import KeyboardAwareScroll from "../components/KeyboardAwareScroll";
import LocationFields from "../components/LocationFields";
import { ProfileQuestion } from "../components/StartProfile";
import allQuestions from "../data/questions.json";
import { invalidate } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { BASE_URL } from "../api/config";
import { IMG } from "../api/images";
import { getToken } from "../api/storage";
import { postJson } from "../api/errors";
import { formatBirthDate } from "../api/birthDate";
import { formatTimeInput, localToIso } from "../api/offers";
import { pickPhotos, shrink } from "../api/photoUpload";
import { EVENT_KINDS, KIND_EMOJI, isoToDateText, isoToTimeText } from "../api/events";
import { colors, radius, spacing, shadow, typography } from "../theme";

const WOMEN = ["Woman", "Trans Woman"];
const LANGUAGE_QUESTION = (Array.isArray(allQuestions) ? allQuestions : allQuestions.questions || [])
  .find((q) => q.field === "language_name");

// The end is a time on the same day - or the next day when it's earlier
// than the start (a party until 1:00).
function endIso(dateText, startText, endText) {
  if (!endText) return null;
  const start = localToIso(dateText, startText);
  const end = localToIso(dateText, endText);
  if (!start || !end) return undefined;
  if (end > start) return end;
  return new Date(new Date(end).getTime() + 24 * 3600 * 1000).toISOString();
}

// Create an event (params: spotId for "Create an event here") or edit one
// (params: id).
export default function EventFormScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const id = route.params?.id;
  const editing = Boolean(id);
  const bottomInset = useBottomInset();

  const [me, setMe] = useState(null);
  const [kind, setKind] = useState("group");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [spot, setSpot] = useState(null);
  const [placeName, setPlaceName] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [place, setPlace] = useState({ country: "", city: "" });
  const [maxPeople, setMaxPeople] = useState("");
  const [languages, setLanguages] = useState({ language_name: [] });
  const [womenOnly, setWomenOnly] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(true);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(!editing);
  const [originalStart, setOriginalStart] = useState(null);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }
      try {
        const resp = await fetch(`${BASE_URL}/user/me`, { headers: { Authorization: `Bearer ${token}` } });
        if (resp.ok) setMe(await resp.json());
      } catch {
        /* the form still works */
      }
    })();
  }, [navigation]);

  // "Create an event here" from a date spot.
  useEffect(() => {
    const spotId = route.params?.spotId;
    if (editing || !spotId) return;
    fetch(`${BASE_URL}/partners/spots/${spotId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setSpot(data);
        setPlace({ country: data.country || "", city: data.city || "" });
      })
      .catch(() => {});
  }, [route.params?.spotId, editing]);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      const token = await getToken();
      const result = await postJson(`${BASE_URL}/events/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      const e = result.data;
      setOriginalStart(e.starts_at);
      setKind(e.kind);
      setTitle(e.title);
      setDescription(e.description);
      setDate(isoToDateText(e.starts_at));
      setStart(isoToTimeText(e.starts_at));
      setEnd(e.ends_at ? isoToTimeText(e.ends_at) : "");
      setSpot(e.spot);
      setPlaceName(e.place_name || "");
      setMapUrl(e.map_url || "");
      setPlace({ country: e.country || "", city: e.city || "" });
      setMaxPeople(e.max_people ? String(e.max_people) : "");
      setLanguages({ language_name: e.languages || [] });
      setWomenOnly(e.women_only);
      setCommentsOpen(e.comments_open);
      setPreview(e.image_url ? IMG.card(e.image_url) : "");
      setLoaded(true);
    })();
  }, [editing, id]);

  // Date spot search, as the member types.
  useEffect(() => {
    if (spot || query.trim().length < 2) {
      setResults([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      fetch(`${BASE_URL}/partners/spots?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setResults)
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, spot]);

  async function choosePhoto() {
    const [asset] = await pickPhotos({ max: 1 });
    if (!asset) return;
    setPreview(asset.uri);
    setPhoto(await shrink(asset));
  }

  function pickSpot(found) {
    setSpot(found);
    setQuery("");
    setResults([]);
    if (found.city) setPlace({ country: found.country || "", city: found.city });
  }

  async function submit() {
    if (saving) return;
    setError("");
    const startsAt = localToIso(date, start);
    const endsAt = endIso(date, start, end);
    if (!startsAt || endsAt === undefined) return setError(t("events.errDate"));
    if (!spot && !placeName.trim()) return setError(t("events.errPlace"));

    const fields = {
      kind,
      title: title.trim(),
      description: description.trim(),
      starts_at: startsAt,
      ends_at: endsAt,
      place_name: spot && !placeName.trim() ? spot.name : placeName.trim(),
      map_url: mapUrl.trim() || null,
      city: place.city,
      country: place.country,
      max_people: kind === "group" && maxPeople ? Number(maxPeople) : null,
      languages: languages.language_name || [],
      women_only: womenOnly,
      comments_open: commentsOpen,
    };
    // Unchanged start: not sent, so a started event can still be edited.
    if (editing && originalStart && new Date(originalStart).getTime() === new Date(startsAt).getTime()) {
      delete fields.starts_at;
    }

    setSaving(true);
    const token = await getToken();
    const auth = { Authorization: `Bearer ${token}` };
    let result;
    if (editing) {
      result = await postJson(`${BASE_URL}/events/${id}`, {
        method: "PATCH",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (result.ok && photo) {
        const body = new FormData();
        body.append("image", photo);
        result = await postJson(`${BASE_URL}/events/${id}/image`, { method: "PUT", headers: auth, body });
      }
    } else {
      const body = new FormData();
      Object.entries(fields).forEach(([key, value]) => {
        if (value === null || value === undefined || value === "") return;
        body.append(key, Array.isArray(value) ? value.join(",") : String(value));
      });
      if (spot) body.append("spot_id", String(spot.id));
      if (photo) body.append("image", photo);
      result = await postJson(`${BASE_URL}/events`, { method: "POST", headers: auth, body });
    }
    setSaving(false);
    if (!result.ok) return setError(result.message);
    invalidate("events");
    if (editing) navigation.goBack();
    else navigation.replace("EventDetail", { id: result.data.id });
  }

  const isWoman = WOMEN.includes(me?.gender);
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && date.length === 10 && start.length >= 4 && place.city;

  return (
    <View style={styles.screen}>
      <PageNav />
      <View style={styles.topBar}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.topTitle}>{editing ? t("events.formEdit") : t("events.formNew")}</Text>
      </View>

      {!loaded ? (
        <View style={styles.center}>
          {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator color={colors.primary} />}
        </View>
      ) : (
        <KeyboardAwareScroll contentContainerStyle={[styles.form, { paddingBottom: bottomInset + spacing.xl }]}>
          <Text style={styles.safety}>🛡️ {t("events.safety")}</Text>

          <Text style={styles.label}>{t("events.fieldKind")}</Text>
          <View style={styles.kinds}>
            {EVENT_KINDS.map((k) => (
              <Pressable key={k} style={[styles.kind, kind === k && styles.kindOn]} onPress={() => setKind(k)} accessibilityRole="button">
                <Text style={styles.kindEmoji}>{KIND_EMOJI[k]}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.kindTitle}>{t(`events.kind_${k}`)}</Text>
                  <Text style={styles.kindHint}>{t(`events.kindHint_${k}`)}</Text>
                </View>
                {kind === k && <Text style={styles.kindCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>{t("events.fieldTitle")}</Text>
          <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={120}
            placeholder={t("events.titlePlaceholder")} placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>{t("events.fieldDescription")}</Text>
          <TextInput style={[styles.input, styles.textarea]} value={description} onChangeText={setDescription}
            maxLength={1500} multiline placeholder={t("events.descriptionPlaceholder")} placeholderTextColor={colors.textMuted} />
          <Text style={styles.counter}>{description.length}/1500</Text>

          <Text style={styles.label}>{t("events.fieldStarts")}</Text>
          <View style={styles.row}>
            <TextInput style={[styles.input, { flex: 1.4 }]} value={date} onChangeText={(v) => setDate(formatBirthDate(v))}
              keyboardType="number-pad" maxLength={10} placeholder={t("events.datePlaceholder")} placeholderTextColor={colors.textMuted} />
            <TextInput style={[styles.input, { flex: 1 }]} value={start} onChangeText={(v) => setStart(formatTimeInput(v))}
              keyboardType="number-pad" maxLength={5} placeholder={t("events.timePlaceholder")} placeholderTextColor={colors.textMuted} />
          </View>
          <Text style={styles.label}>{t("events.fieldEnds")}</Text>
          <TextInput style={[styles.input, { width: 120 }]} value={end} onChangeText={(v) => setEnd(formatTimeInput(v))}
            keyboardType="number-pad" maxLength={5} placeholder={t("events.timePlaceholder")} placeholderTextColor={colors.textMuted} />

          <Text style={styles.label}>{t("events.fieldPlace")}</Text>
          <Text style={styles.hint}>{t("events.placeHint")}</Text>
          {spot ? (
            <View style={styles.spotChip}>
              {spot.image_url ? <Image source={{ uri: IMG.thumb(spot.image_url) }} style={styles.spotImage} /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.spotName}>{spot.name}</Text>
                <Text style={styles.hint}>{[spot.neighborhood, spot.city].filter(Boolean).join(", ")}</Text>
              </View>
              {!editing && <Text style={styles.spotChange} onPress={() => setSpot(null)}>{t("events.removeSpot")}</Text>}
            </View>
          ) : (
            <>
              {!editing && (
                <>
                  <TextInput style={styles.input} value={query} onChangeText={setQuery}
                    placeholder={`🔎 ${t("events.searchSpot")}`} placeholderTextColor={colors.textMuted} />
                  {results.length > 0 && (
                    <View style={styles.results}>
                      {results.map((found) => (
                        <Pressable key={found.id} style={styles.result} onPress={() => pickSpot(found)}>
                          {found.image_url ? (
                            <Image source={{ uri: IMG.thumb(found.image_url) }} style={styles.resultImage} />
                          ) : (
                            <View style={[styles.resultImage, styles.resultEmpty]}><Text>🌸</Text></View>
                          )}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.spotName} numberOfLines={1}>{found.name}</Text>
                            <Text style={styles.hint} numberOfLines={1}>{[found.neighborhood, found.city].filter(Boolean).join(", ")}</Text>
                          </View>
                          {found.partner && <Text>🎁</Text>}
                        </Pressable>
                      ))}
                    </View>
                  )}
                  <Text style={styles.or}>{t("events.orPlace")}</Text>
                </>
              )}
              <TextInput style={styles.input} value={placeName} onChangeText={setPlaceName} maxLength={150}
                placeholder={t("events.placePlaceholder")} placeholderTextColor={colors.textMuted} />
              <TextInput style={[styles.input, { marginTop: 8 }]} value={mapUrl} onChangeText={setMapUrl} maxLength={500}
                autoCapitalize="none" keyboardType="url" placeholder={t("events.mapLink")} placeholderTextColor={colors.textMuted} />
            </>
          )}

          <Text style={styles.label}>{t("events.fieldCity")}</Text>
          <LocationFields country={place.country} city={place.city} onChange={setPlace} />

          {kind === "group" && (
            <>
              <Text style={styles.label}>{t("events.fieldMax")}</Text>
              <TextInput style={[styles.input, { width: 120 }]} value={maxPeople}
                onChangeText={(v) => setMaxPeople(v.replace(/\D/g, "").slice(0, 3))}
                keyboardType="number-pad" placeholder="8" placeholderTextColor={colors.textMuted} />
            </>
          )}

          {(kind === "language" || languages.language_name.length > 0) && LANGUAGE_QUESTION && (
            <>
              <Text style={styles.label}>{t("events.fieldLanguages")}</Text>
              <ProfileQuestion question={LANGUAGE_QUESTION} handleClicked={() => {}} answer={languages}
                setAnswer={setLanguages} setClicked={() => {}} />
            </>
          )}

          {(isWoman || womenOnly) && (
            <View style={styles.toggle}>
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleTitle}>👩 {t("events.fieldWomenOnly")}</Text>
                <Text style={styles.hint}>{t("events.womenOnlyHint")}</Text>
              </View>
              <Switch value={womenOnly} onValueChange={setWomenOnly} trackColor={{ true: colors.primary }} />
            </View>
          )}
          <View style={styles.toggle}>
            <Text style={[styles.toggleTitle, { flex: 1 }]}>💬 {t("events.fieldComments")}</Text>
            <Switch value={commentsOpen} onValueChange={setCommentsOpen} trackColor={{ true: colors.primary }} />
          </View>

          <Text style={styles.label}>{t("events.fieldPhoto")}</Text>
          <Pressable style={styles.photo} onPress={choosePhoto} accessibilityRole="button">
            {preview ? <Image source={{ uri: preview }} style={styles.photoImage} /> : <Text style={{ fontSize: 30 }}>📷</Text>}
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.submit, (!valid || saving) && { opacity: 0.5 }]}
            onPress={submit}
            disabled={!valid || saving}
            accessibilityRole="button"
          >
            <Text style={styles.submitText}>
              {saving ? t("events.saving") : editing ? t("events.saveChanges") : t("events.publish")}
            </Text>
          </Pressable>
        </KeyboardAwareScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  topBar: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: spacing.md, paddingVertical: 6 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: colors.text },
  topTitle: { ...typography.h3, fontSize: 18 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.lg },
  form: { padding: spacing.md },
  safety: {
    padding: 12, borderRadius: radius.md, backgroundColor: colors.primaryTint, color: colors.primaryDeep,
    fontSize: 13, lineHeight: 19, overflow: "hidden",
  },
  label: { fontSize: 14.5, fontWeight: "700", color: colors.text, marginTop: 18, marginBottom: 8 },
  hint: { fontSize: 12.5, color: colors.textMuted, marginBottom: 6 },
  input: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1.5,
    borderColor: colors.borderStrong, backgroundColor: colors.surface, fontSize: 15, color: colors.text,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  counter: { alignSelf: "flex-end", fontSize: 11.5, color: colors.textMuted, marginTop: 4 },
  row: { flexDirection: "row", gap: 10 },
  kinds: { gap: 8 },
  kind: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.borderStrong, backgroundColor: colors.surface,
  },
  kindOn: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primaryTint },
  kindEmoji: { fontSize: 26 },
  kindTitle: { fontWeight: "800", fontSize: 15, color: colors.text },
  kindHint: { fontSize: 12.5, color: colors.textSoft },
  kindCheck: { color: colors.primary, fontWeight: "900", fontSize: 18 },
  spotChip: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.md,
    borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primaryTint,
  },
  spotImage: { width: 48, height: 48, borderRadius: 10 },
  spotName: { fontWeight: "700", fontSize: 15, color: colors.text },
  spotChange: { color: colors.primaryDeep, fontWeight: "700", textDecorationLine: "underline" },
  results: {
    marginTop: 6, padding: 4, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong,
    backgroundColor: colors.surface, ...shadow.sm,
  },
  result: { flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
  resultImage: { width: 38, height: 38, borderRadius: 8 },
  resultEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  or: { textAlign: "center", color: colors.textMuted, fontSize: 12.5, marginVertical: 8 },
  toggle: {
    flexDirection: "row", alignItems: "center", gap: 12, marginTop: 16, padding: 12,
    borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  toggleTitle: { fontWeight: "700", fontSize: 14.5, color: colors.text },
  photo: {
    height: 170, borderRadius: radius.md, borderWidth: 2, borderStyle: "dashed", borderColor: colors.borderStrong,
    backgroundColor: colors.surface, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  photoImage: { width: "100%", height: "100%" },
  error: { color: colors.danger, fontWeight: "600", textAlign: "center", marginTop: 14 },
  submit: {
    marginTop: 20, paddingVertical: 15, borderRadius: radius.pill, backgroundColor: colors.primary,
    alignItems: "center", ...shadow.md,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
