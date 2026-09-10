import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  FlatList,
  Share,
  Linking,
  StyleSheet,
} from "react-native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import PageNav from "../components/PageNav";
import { BASE_URL, SITE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { IMG } from "../api/images";
import { friendlyError, NETWORK_ERROR } from "../api/errors";
import { CATEGORIES, categoryEmoji } from "../api/categories";
import { useTheme } from "../context/ThemeContext";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Fire-and-forget engagement tracking. Never block or surface errors: a missed
// count must never get in the way of the user opening a place.
function track(spotId, action) {
  fetch(`${BASE_URL}/date_spots/${spotId}/${action}`, { method: "POST" }).catch(() => {});
}

export default function DateSpotsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  const [spots, setSpots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [picker, setPicker] = useState(null); // "country" | "city" | null
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState("");

  useEffect(() => {
    getToken().then((tk) => setHasToken(!!tk && tk !== "null"));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = [];
    if (country) params.push(`country=${encodeURIComponent(country)}`);
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    const qs = params.length ? `?${params.join("&")}` : "";
    try {
      const [spotsResp, locResp] = await Promise.all([
        fetch(`${BASE_URL}/date_spots${qs}`),
        fetch(`${BASE_URL}/date_spots/locations`),
      ]);
      setSpots(spotsResp.ok ? await spotsResp.json() : []);
      setLocations(locResp.ok ? await locResp.json() : []);
    } catch {
      setError(NETWORK_ERROR);
    } finally {
      setLoading(false);
    }
  }, [country, city, category]);

  useEffect(() => {
    load();
  }, [load]);

  const citiesForCountry = useMemo(() => {
    const entry = locations.find((l) => l.country === country);
    return entry ? entry.cities : [];
  }, [locations, country]);

  const pickerOptions =
    picker === "country" ? locations.map((l) => l.country) : citiesForCountry;

  async function shareSpot(spot) {
    try {
      await Share.share({
        message: `${spot.name} — ${t("dateSpots.shareText")}
${SITE_URL}/date-spots/${spot.id}`,
      });
    } catch {
      /* user dismissed the share sheet */
    }
  }

  function openSpot(spot) {
    setSelected(spot);
    track(spot.id, "view");
  }

  function choose(value) {
    if (picker === "country") {
      setCountry(value);
      setCity("");
    } else {
      setCity(value);
    }
    setPicker(null);
  }

  return (
    <View style={[styles.head, { backgroundColor: colors.background }]}>
      <PageNav />

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.eyebrow}>{t("dateSpots.eyebrow")}</Text>
        <Text style={styles.title}>{t("dateSpots.title")}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          {t("dateSpots.subtitle")}
        </Text>

        {hasToken ? (
          <Pressable style={styles.addBtn} onPress={() => setFormOpen((o) => !o)}>
            <Text style={styles.addBtnText}>
              {formOpen ? t("dateSpots.close") : `＋ ${t("dateSpots.share")}`}
            </Text>
          </Pressable>
        ) : (
          <Text style={[styles.loginHint, { color: colors.textMuted }]}>
            {t("dateSpots.loginHint")}
          </Text>
        )}

        {error !== "" && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {formOpen && hasToken && (
          <AddSpotForm
            onCancel={() => setFormOpen(false)}
            onCreated={() => {
              setFormOpen(false);
              load();
            }}
          />
        )}

        {/* Filter chips */}
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip
              label={`🌍 ${t("dateSpots.allCountries")}`}
              active={!country}
              onPress={() => { setCountry(""); setCity(""); }}
            />
            {locations.map((l) => (
              <Chip
                key={l.country}
                label={l.country}
                active={country === l.country}
                onPress={() => { setCountry(l.country); setCity(""); }}
              />
            ))}
          </ScrollView>

          {country && citiesForCountry.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
              <Chip label={t("dateSpots.allCities")} active={!city} onPress={() => setCity("")} small />
              {citiesForCountry.map((c) => (
                <Chip key={c} label={`📍 ${c}`} active={city === c} onPress={() => setCity(c)} small />
              ))}
            </ScrollView>
          ) : null}

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label={t("dateSpots.allCategories")} active={!category} onPress={() => setCategory("")} small />
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={`${categoryEmoji(c)} ${c}`}
                active={category === c}
                onPress={() => setCategory(category === c ? "" : c)}
                small
              />
            ))}
          </ScrollView>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
        ) : spots.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📍</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              {t("dateSpots.emptyTitle")}
            </Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {country || city || category ? t("dateSpots.emptyFiltered") : t("dateSpots.emptyAll")}
            </Text>
          </View>
        ) : (
          spots.map((spot, i) => (
            <Pressable
              key={spot.id}
              style={[styles.card, i === 0 && styles.featured]}
              onPress={() => openSpot(spot)}
            >
              {spot.image_url ? (
                <Image
                  source={{ uri: i === 0 ? IMG.full(spot.image_url) : IMG.card(spot.image_url) }}
                  style={styles.cardImage}
                />
              ) : (
                <View style={[styles.cardImage, styles.noImage]} />
              )}
              <LinearGradient
                colors={["transparent", "rgba(20,14,12,0.35)", "rgba(20,14,12,0.9)"]}
                style={styles.scrim}
              />
              {i === 0 ? (
                <View style={styles.featuredFlag}>
                  <Text style={styles.featuredFlagText}>★ {t("dateSpots.featured")}</Text>
                </View>
              ) : null}
              <View style={styles.cardInfo}>
                {spot.category ? (
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>
                      {categoryEmoji(spot.category)} {spot.category}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.cardTitle, i === 0 && styles.featuredTitle]} numberOfLines={2}>
                  {spot.name}
                </Text>
                <Text style={styles.overlayPlace}>
                  📍 {spot.city}, {spot.country}
                </Text>
                {i === 0 ? (
                  <Text style={styles.featuredText} numberOfLines={2}>
                    {spot.description}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>

      {/* Detail view */}
      <Modal
        visible={!!selected}
        animationType="slide"
        onRequestClose={() => setSelected(null)}
      >
        <View style={[styles.detail, { backgroundColor: colors.background }]}>
          <ScrollView contentContainerStyle={styles.detailScroll}>
            {selected?.image_url ? (
              <Image
                source={{ uri: IMG.full(selected.image_url) }}
                style={styles.detailImage}
              />
            ) : null}
            <View style={styles.detailBody}>
              {selected?.category ? (
                <View style={styles.detailTag}>
                  <Text style={styles.detailTagText}>
                    {categoryEmoji(selected.category)} {selected.category}
                  </Text>
                </View>
              ) : null}
              <Text style={styles.detailTitle}>{selected?.name}</Text>
              <Text style={styles.detailPlace}>
                📍 {selected?.city}, {selected?.country}
              </Text>
              <Text style={[styles.detailText, { color: colors.textSoft }]}>
                {selected?.description}
              </Text>
              {selected?.profile?.first_name ? (
                <Text style={[styles.detailAuthor, { color: colors.textMuted }]}>
                  {t("dateSpots.sharedBy", { name: selected.profile.first_name })}
                </Text>
              ) : null}
              <View style={styles.detailActions}>
                {selected?.map_url ? (
                  <Pressable
                    style={styles.mapBtn}
                    onPress={() => {
                      track(selected.id, "map_click");
                      Linking.openURL(selected.map_url);
                    }}
                  >
                    <Text style={styles.mapBtnText}>🗺️ {t("dateSpots.openMap")}</Text>
                  </Pressable>
                ) : null}
                <Pressable style={styles.shareBtn} onPress={() => shareSpot(selected)}>
                  <Text style={styles.shareBtnText}>🔗 {t("dateSpots.shareLink")}</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
          <Pressable style={styles.detailClose} onPress={() => setSelected(null)}>
            <Text style={styles.detailCloseText}>✕</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Filter picker sheet */}
      <Modal visible={!!picker} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.sheetOverlay} onPress={() => setPicker(null)}>
          <View style={styles.sheet}>
            <FlatList
              data={["", ...pickerOptions]}
              keyExtractor={(item, i) => item || `all-${i}`}
              renderItem={({ item }) => (
                <Pressable style={styles.sheetRow} onPress={() => choose(item)}>
                  <Text style={styles.sheetRowText}>
                    {item ||
                      (picker === "country"
                        ? t("dateSpots.allCountries")
                        : t("dateSpots.allCities"))}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function Chip({ label, active, onPress, small }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, small && styles.chipSmall, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, small && styles.chipTextSmall, active && styles.chipTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

function AddSpotForm({ onCancel, onCreated }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [description, setDescription] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [category, setCategory] = useState("");
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function pickPhoto() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled) setPhoto(result.assets[0]);
  }

  async function submit() {
    if (submitting) return;
    setError("");
    if (!name.trim()) return setError(t("dateSpots.errName"));
    if (!city.trim() || !country.trim()) return setError(t("dateSpots.errPlace"));
    if (description.trim().length < 10) return setError(t("dateSpots.errDesc"));
    if (
      mapUrl.trim() &&
      !/^https?:\/\/(www\.)?([a-z-]+\.)?(google\.[a-z.]+|goo\.gl|maps\.app\.goo\.gl)\//i.test(mapUrl.trim())
    )
      return setError(t("dateSpots.errMapUrl"));

    const body = new FormData();
    body.append("name", name.trim());
    body.append("city", city.trim());
    body.append("country", country.trim());
    body.append("description", description.trim());
    if (category) body.append("category", category);
    if (mapUrl.trim()) body.append("map_url", mapUrl.trim());
    if (photo) {
      body.append("image", {
        uri: photo.uri,
        name: photo.fileName || "spot.jpg",
        type: photo.mimeType || "image/jpeg",
      });
    }

    setSubmitting(true);
    const token = await getToken();
    let resp;
    try {
      resp = await fetch(`${BASE_URL}/date_spots`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body,
      });
    } catch {
      setSubmitting(false);
      return setError(NETWORK_ERROR);
    }
    let data = null;
    try {
      data = await resp.json();
    } catch {
      data = null;
    }
    setSubmitting(false);
    if (!resp.ok) return setError(friendlyError(data, resp));
    onCreated();
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t("dateSpots.formTitle")}</Text>

      {error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Text style={styles.label}>
        {t("dateSpots.name")} <Text style={styles.req}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={t("dateSpots.namePlaceholder")}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>
        {t("dateSpots.city")} <Text style={styles.req}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={city}
        onChangeText={setCity}
        placeholder={t("dateSpots.cityPlaceholder")}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>
        {t("dateSpots.country")} <Text style={styles.req}>*</Text>
      </Text>
      <TextInput
        style={styles.input}
        value={country}
        onChangeText={setCountry}
        placeholder={t("dateSpots.countryPlaceholder")}
        placeholderTextColor={colors.textMuted}
      />

      <Text style={styles.label}>
        {t("dateSpots.why")} <Text style={styles.req}>*</Text>
      </Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        value={description}
        onChangeText={setDescription}
        placeholder={t("dateSpots.whyPlaceholder")}
        placeholderTextColor={colors.textMuted}
        multiline
      />

      <Text style={styles.label}>{t("dateSpots.category")}</Text>
      <View style={styles.pickRow}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={`${categoryEmoji(c)} ${c}`}
            active={category === c}
            onPress={() => setCategory(category === c ? "" : c)}
            small
          />
        ))}
      </View>

      <Text style={styles.label}>{t("dateSpots.mapUrl")}</Text>
      <TextInput
        style={styles.input}
        value={mapUrl}
        onChangeText={setMapUrl}
        placeholder={t("dateSpots.mapUrlPlaceholder")}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        keyboardType="url"
      />

      <Pressable style={styles.photoBtn} onPress={pickPhoto}>
        <Text style={styles.photoBtnText}>📷 {t("dateSpots.photo")}</Text>
      </Pressable>
      {photo ? <Image source={{ uri: photo.uri }} style={styles.preview} /> : null}

      <Text style={styles.safety}>{t("dateSpots.safety")}</Text>

      <View style={styles.formActions}>
        <Pressable style={styles.cancelBtn} onPress={onCancel}>
          <Text style={styles.cancelText}>{t("dateSpots.cancel")}</Text>
        </Pressable>
        <Pressable
          style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
          onPress={submit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.submitText}>{t("dateSpots.submit")}</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1 },
  scroll: { padding: spacing.md, paddingBottom: spacing.xl * 2 },

  eyebrow: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
    marginTop: spacing.sm,
  },
  title: { ...typography.h1, fontSize: 28, textAlign: "center", marginTop: spacing.xs },
  subtitle: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  addBtn: {
    alignSelf: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    ...shadow.md,
  },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  loginHint: { textAlign: "center", fontSize: 14 },

  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  filterBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surface,
  },
  filterBtnDisabled: { opacity: 0.55 },
  filterBtnText: { fontSize: 13.5, color: colors.text },
  clearText: { color: colors.primary, fontWeight: "700", fontSize: 13 },

  /* Filter chips */
  filterBar: { marginTop: spacing.lg, marginBottom: spacing.md, gap: spacing.sm },
  chipRow: { gap: 8, paddingRight: spacing.md },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipSmall: { paddingHorizontal: 13, paddingVertical: 7 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.textSoft },
  chipTextSmall: { fontSize: 12.5 },
  chipTextActive: { color: "#fff" },
  pickRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.sm },

  /* Overlay cards */
  card: {
    height: 240,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    ...shadow.md,
  },
  featured: { height: 320 },
  cardImage: { width: "100%", height: "100%" },
  noImage: { backgroundColor: colors.primarySoft },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "70%" },
  featuredFlag: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  featuredFlagText: { color: colors.primaryDeep, fontSize: 11, fontWeight: "700", letterSpacing: 0.6 },
  cardInfo: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.md },
  tag: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.32)",
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 4,
    marginBottom: 8,
  },
  tagText: { color: "#fff", fontSize: 11.5, fontWeight: "600" },
  cardTitle: {
    fontFamily: "serif",
    fontSize: 21,
    fontWeight: "700",
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  featuredTitle: { fontSize: 27 },
  overlayPlace: { color: "rgba(255,255,255,0.86)", fontSize: 13, fontWeight: "600", marginTop: 2 },
  featuredText: { color: "rgba(255,255,255,0.9)", fontSize: 14, lineHeight: 20, marginTop: 8 },
  detailTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  detailTagText: { color: colors.primaryDeep, fontWeight: "700", fontSize: 12.5 },

  empty: { alignItems: "center", paddingVertical: spacing.xl * 2 },
  emptyIcon: { fontSize: 44, marginBottom: spacing.sm },
  emptyTitle: { ...typography.h3, fontSize: 17 },
  emptyText: { textAlign: "center", marginTop: spacing.xs, maxWidth: 280, lineHeight: 20 },

  /* Form */
  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.lg,
    ...shadow.sm,
  },
  formTitle: { ...typography.h2, fontSize: 19, marginBottom: spacing.md },
  label: { ...typography.label, marginBottom: spacing.xs, marginTop: spacing.sm },
  req: { color: colors.primary, fontWeight: "700" },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  textarea: { minHeight: 90, textAlignVertical: "top" },
  photoBtn: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
  },
  photoBtnText: { color: colors.text, fontWeight: "600", fontSize: 14 },
  preview: {
    width: "100%",
    height: 170,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  safety: { ...typography.bodyMuted, fontSize: 12, marginTop: spacing.md },
  formActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: colors.textMuted, fontWeight: "600" },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "700" },

  errorBox: {
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: { color: colors.primaryDeep, fontSize: 13 },

  readMore: { color: colors.primary, fontWeight: "700", fontSize: 13, marginTop: 6 },

  /* Detail */
  detail: { flex: 1 },
  detailScroll: { paddingBottom: spacing.xl * 2 },
  detailImage: { width: "100%", height: 300 },
  detailBody: { padding: spacing.lg },
  detailTitle: { ...typography.h1, fontSize: 26 },
  detailPlace: { color: colors.primary, fontWeight: "600", fontSize: 14, marginTop: 4 },
  detailText: { fontSize: 16.5, lineHeight: 27, marginTop: spacing.md },
  detailAuthor: { fontSize: 13, marginTop: spacing.md },
  detailActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  mapBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    ...shadow.sm,
  },
  mapBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  shareBtn: {
    alignSelf: "flex-start",
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
    backgroundColor: colors.surface,
  },
  shareBtnText: { color: colors.textSoft, fontWeight: "600", fontSize: 14 },
  detailClose: {
    position: "absolute",
    top: 44,
    right: 18,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    ...shadow.sm,
  },
  detailCloseText: { fontSize: 16, fontWeight: "700", color: colors.text },

  /* Picker sheet */
  sheetOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "70%",
    paddingVertical: spacing.sm,
  },
  sheetRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetRowText: { fontSize: 15, color: colors.text },
});
