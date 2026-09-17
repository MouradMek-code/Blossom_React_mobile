import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  BackHandler,
  Animated,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import PageNav from "../components/PageNav";
import { BASE_URL, SITE_URL } from "../api/config";
import { getToken, setProfileId } from "../api/storage";
import { IMG } from "../api/images";
import { friendlyError, NETWORK_ERROR, postJson } from "../api/errors";
import {
  BEST_FOR,
  CATEGORIES,
  bestForLabel,
  categoryEmoji,
  categoryGradient,
  categoryLabel,
  fullPlace,
  shortPlace,
} from "../api/categories";
import { useTheme } from "../context/ThemeContext";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Fire-and-forget engagement tracking. Never block or surface errors: a missed
// count must never get in the way of the user opening a place.
function track(spotId, action) {
  fetch(`${BASE_URL}/date_spots/${spotId}/${action}`, { method: "POST" }).catch(() => {});
}

// Social proof line. Deliberately renders nothing for a zero count: an empty
// spot shouldn't advertise "0 views".
function SpotStats({ spot, t, style }) {
  const views = spot?.view_count || 0;
  const went = spot?.map_click_count || 0;
  if (views < 1 && went < 1) return null;
  const parts = [];
  if (views >= 1) parts.push(`👁 ${t("dateSpots.viewsCount", { count: views })}`);
  if (went >= 1) parts.push(`🧭 ${t("dateSpots.wentCount", { count: went })}`);
  return <Text style={style}>{parts.join("  ·  ")}</Text>;
}

// The spot's photo, or - for places without one, like the starter spots - a
// backdrop tinted by vibe with the vibe's emoji, so the card still looks
// intentional.
function SpotBackdrop({ spot, uri, style, emojiStyle }) {
  if (spot?.image_url) {
    return <Image source={{ uri }} style={style} />;
  }
  return (
    <LinearGradient
      colors={categoryGradient(spot?.category)}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[style, styles.noImage]}
    >
      <Text style={emojiStyle}>{categoryEmoji(spot?.category)}</Text>
    </LinearGradient>
  );
}

// "📍 Châtelet, Paris"
function placeLine(spot) {
  return `📍 ${shortPlace(spot)}`;
}

// Admin-only editor for a spot's counters, shown right under its photo.
// Used to seed a venue's numbers or correct them; everyone else never sees it.
function AdminStatsEditor({ spot, token, t, onSaved }) {
  const [views, setViews] = useState(String(spot?.view_count || 0));
  const [went, setWent] = useState(String(spot?.map_click_count || 0));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  // Switching to another spot must reload that spot's numbers, not keep the
  // previous one's.
  useEffect(() => {
    setViews(String(spot?.view_count || 0));
    setWent(String(spot?.map_click_count || 0));
    setStatus("");
  }, [spot?.id, spot?.view_count, spot?.map_click_count]);

  async function save() {
    setSaving(true);
    setStatus("");
    try {
      const resp = await fetch(`${BASE_URL}/date_spots/${spot.id}/stats`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          view_count: Math.max(0, parseInt(views, 10) || 0),
          map_click_count: Math.max(0, parseInt(went, 10) || 0),
        }),
      });
      let data = null;
      try {
        data = await resp.json();
      } catch {
        data = null;
      }
      if (!resp.ok) {
        setStatus(friendlyError(data, resp));
      } else {
        setStatus(t("dateSpots.adminSaved"));
        onSaved(data);
        setTimeout(() => setStatus(""), 2000);
      }
    } catch {
      setStatus(NETWORK_ERROR);
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.adminBox}>
      <Text style={styles.adminTitle}>🛠️ {t("dateSpots.adminTitle")}</Text>
      <View style={styles.adminRow}>
        <View style={styles.adminField}>
          <Text style={styles.adminLabel}>👁 {t("dateSpots.adminViews")}</Text>
          <TextInput
            style={styles.adminInput}
            value={views}
            onChangeText={setViews}
            keyboardType="number-pad"
          />
        </View>
        <View style={styles.adminField}>
          <Text style={styles.adminLabel}>🧭 {t("dateSpots.adminWent")}</Text>
          <TextInput
            style={styles.adminInput}
            value={went}
            onChangeText={setWent}
            keyboardType="number-pad"
          />
        </View>
        <Pressable
          style={[styles.adminSave, saving && styles.adminSaveDisabled]}
          onPress={save}
          disabled={saving}
        >
          <Text style={styles.adminSaveText}>
            {saving ? t("dateSpots.adminSaving") : t("dateSpots.adminSave")}
          </Text>
        </Pressable>
      </View>
      {status !== "" ? <Text style={styles.adminStatus}>{status}</Text> : null}
    </View>
  );
}

export default function DateSpotsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

  const [spots, setSpots] = useState([]);
  const [locations, setLocations] = useState([]);
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [token, setToken] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [picker, setPicker] = useState(null); // "country" | "city" | null
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState("");
  const [bestFor, setBestFor] = useState("");
  const [inviteSpot, setInviteSpot] = useState(null);

  // The token only carries the username, so ask the backend whether this
  // account is an admin - that gates the counter editor below each photo.
  useEffect(() => {
    let alive = true;
    getToken().then(async (tk) => {
      const valid = !!tk && tk !== "null";
      if (!alive) return;
      setHasToken(valid);
      setToken(valid ? tk : null);
      if (!valid) return;
      try {
        const resp = await fetch(`${BASE_URL}/user/me`, {
          headers: { Authorization: `Bearer ${tk}` },
        });
        const data = resp.ok ? await resp.json() : null;
        if (alive) setIsAdmin(Boolean(data?.is_admin));
        // Chat works out which bubbles are "mine" from the stored profile id.
        // An invite sends the user straight into a conversation, so make sure
        // it's there.
        if (data?.profile_id) await setProfileId(data.profile_id);
      } catch {
        /* not admin, or offline - leave the editor hidden */
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const insets = useSafeAreaInsets();
  const detailOpen = !!selected;
  const detailAnim = useRef(new Animated.Value(0)).current;

  // The detail view is an in-screen overlay rather than a <Modal> (see the
  // render below), so the hardware back button has to be wired up by hand.
  useEffect(() => {
    if (!detailOpen) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setSelected(null);
      return true;
    });
    return () => sub.remove();
  }, [detailOpen]);

  // The invite picker sits on top of the detail view; back closes it first.
  // (Android calls the most recently added listener first.)
  useEffect(() => {
    if (!inviteSpot) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      setInviteSpot(null);
      return true;
    });
    return () => sub.remove();
  }, [inviteSpot]);

  // Keep the slide-up feel the Modal used to give.
  useEffect(() => {
    if (!detailOpen) return;
    detailAnim.setValue(0);
    Animated.timing(detailAnim, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    }).start();
  }, [detailOpen, detailAnim]);

  // Reflect an admin edit straight away, in the open detail view and in the
  // list behind it, so the new numbers show without a refetch.
  function applyStats(updated) {
    if (!updated?.id) return;
    setSpots((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
    setSelected((cur) => (cur && cur.id === updated.id ? { ...cur, ...updated } : cur));
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const params = [];
    if (country) params.push(`country=${encodeURIComponent(country)}`);
    if (city) params.push(`city=${encodeURIComponent(city)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (bestFor) params.push(`best_for=${encodeURIComponent(bestFor)}`);
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
  }, [country, city, category, bestFor]);

  useEffect(() => {
    load();
  }, [load]);

  // Opened from a chat invite card: navigate("DateSpots", { spotId }).
  // If active filters hide that spot, clear them once and look again.
  const linkedSpotId = route.params?.spotId;
  const clearedFiltersForLink = useRef(false);
  useEffect(() => {
    if (!linkedSpotId || loading) return;
    const match = spots.find((s) => String(s.id) === String(linkedSpotId));
    const filtered = Boolean(country || city || category || bestFor);
    if (!match && filtered && !clearedFiltersForLink.current) {
      clearedFiltersForLink.current = true;
      setCountry("");
      setCity("");
      setCategory("");
      setBestFor("");
      return;
    }
    if (match) openSpot(match);
    // Found, or the spot no longer exists: either way, this link is handled.
    clearedFiltersForLink.current = false;
    navigation.setParams({ spotId: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedSpotId, spots, loading]);

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

        {/* Filter chips - each row is named so it's clear what it filters. */}
        <View style={styles.filterBar}>
          <Text style={styles.filterLabel}>{t("dateSpots.country")}</Text>
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
            <>
              <Text style={styles.filterLabel}>{t("dateSpots.city")}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
                <Chip label={t("dateSpots.allCities")} active={!city} onPress={() => setCity("")} small />
                {citiesForCountry.map((c) => (
                  <Chip key={c} label={`📍 ${c}`} active={city === c} onPress={() => setCity(c)} small />
                ))}
              </ScrollView>
            </>
          ) : null}

          <Text style={styles.filterLabel}>{t("dateSpots.category")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <Chip label={t("dateSpots.allCategories")} active={!category} onPress={() => setCategory("")} small />
            {CATEGORIES.map((c) => (
              <Chip
                key={c}
                label={categoryLabel(c, t)}
                active={category === c}
                onPress={() => setCategory(category === c ? "" : c)}
                small
              />
            ))}
          </ScrollView>

          {/* Tap a chip again to clear it. */}
          <Text style={styles.filterLabel}>{t("dateSpots.bestFor")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {BEST_FOR.map((b) => (
              <Chip
                key={b}
                label={bestForLabel(b, t)}
                active={bestFor === b}
                onPress={() => setBestFor(bestFor === b ? "" : b)}
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
              {country || city || category || bestFor
                ? t("dateSpots.emptyFiltered")
                : t("dateSpots.emptyAll")}
            </Text>
          </View>
        ) : (
          spots.map((spot, i) => (
            <Pressable
              key={spot.id}
              style={[styles.card, i === 0 && styles.featured]}
              onPress={() => openSpot(spot)}
            >
              <SpotBackdrop
                spot={spot}
                uri={i === 0 ? IMG.full(spot.image_url) : IMG.card(spot.image_url)}
                style={styles.cardImage}
                emojiStyle={[styles.noImageEmoji, i === 0 && styles.noImageEmojiFeatured]}
              />
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
                      {categoryLabel(spot.category, t)}
                    </Text>
                  </View>
                ) : null}
                <Text style={[styles.cardTitle, i === 0 && styles.featuredTitle]} numberOfLines={2}>
                  {spot.name}
                </Text>
                <Text style={styles.overlayPlace} numberOfLines={1}>
                  {placeLine(spot)}
                </Text>
                <SpotStats spot={spot} t={t} style={styles.overlayStats} />
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

      {/* Detail view.
          An in-screen overlay, not a <Modal>: on Android a ScrollView inside a
          Modal is mis-measured and won't scroll (the same bug the filter
          screen had), so a long description pushed the Maps/Share buttons off
          screen with no way to reach them. The buttons now also live in a bar
          pinned below the scroll area, so they're visible whatever the
          description's length. */}
      {detailOpen ? (
        <Animated.View
          style={[
            styles.detail,
            {
              backgroundColor: colors.background,
              opacity: detailAnim,
              transform: [
                {
                  translateY: detailAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <ScrollView
            style={styles.detailScrollView}
            contentContainerStyle={styles.detailScroll}
            keyboardShouldPersistTaps="handled"
          >
            <SpotBackdrop
              spot={selected}
              uri={IMG.full(selected?.image_url)}
              style={styles.detailImage}
              emojiStyle={styles.noImageEmojiFeatured}
            />
            {isAdmin && selected ? (
              <AdminStatsEditor
                spot={selected}
                token={token}
                t={t}
                onSaved={applyStats}
              />
            ) : null}
            <View style={styles.detailBody}>
              {selected?.category || selected?.best_for?.length > 0 ? (
                <View style={styles.detailTags}>
                  {selected?.category ? (
                    <View style={styles.detailTag}>
                      <Text style={styles.detailTagText}>
                        {categoryLabel(selected.category, t)}
                      </Text>
                    </View>
                  ) : null}
                  {(selected?.best_for || []).map((b) => (
                    <View key={b} style={styles.bestForPill}>
                      <Text style={styles.bestForPillText}>{bestForLabel(b, t)}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <Text style={styles.detailTitle}>{selected?.name}</Text>
              <Text style={styles.detailPlace}>📍 {fullPlace(selected)}</Text>
              <SpotStats spot={selected} t={t} style={styles.detailStats} />
              <Text style={[styles.detailText, { color: colors.textSoft }]}>
                {selected?.description}
              </Text>
              {selected?.profile?.first_name ? (
                <Text style={[styles.detailAuthor, { color: colors.textMuted }]}>
                  {t("dateSpots.sharedBy", { name: selected.profile.first_name })}
                </Text>
              ) : null}
            </View>
          </ScrollView>

          <View
            style={[
              styles.detailFooter,
              {
                backgroundColor: colors.background,
                borderTopColor: colors.border,
                paddingBottom: Math.max(insets.bottom, 16) + 12,
              },
            ]}
          >
            {hasToken ? (
              <Pressable style={styles.inviteBtn} onPress={() => setInviteSpot(selected)}>
                <Text style={styles.inviteBtnText} numberOfLines={1}>
                  💌 {t("dateSpots.invite")}
                </Text>
              </Pressable>
            ) : null}
            <View style={styles.footerRow}>
              {selected?.map_url ? (
                <Pressable
                  // Invite is the main action when logged in; otherwise
                  // directions stay the primary button.
                  style={[hasToken ? styles.shareBtn : styles.mapBtn, styles.footerBtn]}
                  onPress={() => {
                    track(selected.id, "map_click");
                    Linking.openURL(selected.map_url);
                  }}
                >
                  <Text style={hasToken ? styles.shareBtnText : styles.mapBtnText} numberOfLines={1}>
                    🗺️ {t("dateSpots.openMap")}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                style={[styles.shareBtn, styles.footerBtn]}
                onPress={() => shareSpot(selected)}
              >
                <Text style={styles.shareBtnText} numberOfLines={1}>
                  🔗 {t("dateSpots.shareLink")}
                </Text>
              </Pressable>
            </View>
          </View>

          <Pressable
            style={[styles.detailClose, { top: insets.top + 12 }]}
            onPress={() => setSelected(null)}
            hitSlop={8}
          >
            <Text style={styles.detailCloseText}>✕</Text>
          </Pressable>
        </Animated.View>
      ) : null}

      {inviteSpot ? (
        <InvitePicker
          spot={inviteSpot}
          token={token}
          insets={insets}
          onClose={() => setInviteSpot(null)}
          onSent={(conversationId) => {
            setInviteSpot(null);
            setSelected(null);
            navigation.navigate("Chat", { conversationId });
          }}
        />
      ) : null}

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

// Pick a match to send this spot to. The invite lands in your conversation as
// a card ("Want to go to ... together?") - for a woman opening the chat, it's
// a ready-made first message. An in-screen overlay rather than a <Modal>, for
// the same Android scrolling reason as the detail view.
function InvitePicker({ spot, token, insets, onClose, onSent }) {
  const { t } = useTranslation();
  const [matches, setMatches] = useState(null); // null while loading
  const [error, setError] = useState("");
  const [sendingId, setSendingId] = useState(null);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE_URL}/profile/profiles/matched`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (alive) setMatches(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!alive) return;
        setMatches([]);
        setError(NETWORK_ERROR);
      });
    return () => {
      alive = false;
    };
  }, [token]);

  async function invite(match) {
    if (sendingId !== null) return;
    setSendingId(match.id);
    setError("");
    const result = await postJson(`${BASE_URL}/date_spots/${spot.id}/invite`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        profile_id: match.id,
        content: t("dateSpots.inviteMessage", { name: spot.name }),
      }),
    });
    setSendingId(null);
    if (!result.ok) {
      // e.g. "the woman has to send the first message" - shown as-is.
      setError(result.message);
      return;
    }
    onSent(result.data.conversation_id);
  }

  return (
    <View style={styles.inviteOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.inviteSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
        <View style={styles.inviteHeader}>
          <Text style={styles.inviteTitle}>
            💌 {t("dateSpots.inviteTitle", { name: spot.name })}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.inviteClose}>
            <Text style={styles.detailCloseText}>✕</Text>
          </Pressable>
        </View>
        <Text style={styles.inviteHint}>{t("dateSpots.inviteHint")}</Text>

        {error !== "" ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {matches === null ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
        ) : matches.length === 0 ? (
          <Text style={styles.inviteEmpty}>{t("dateSpots.inviteEmpty")}</Text>
        ) : (
          <ScrollView style={styles.matchList} keyboardShouldPersistTaps="handled">
            {matches.map((m) => (
              <Pressable
                key={m.id}
                style={({ pressed }) => [styles.matchRow, pressed && styles.matchRowPressed]}
                onPress={() => invite(m)}
                disabled={sendingId !== null}
              >
                {m.photos?.[0]?.image_url ? (
                  <Image source={{ uri: IMG.thumb(m.photos[0].image_url) }} style={styles.matchPhoto} />
                ) : (
                  <View style={[styles.matchPhoto, styles.matchPhotoEmpty]}>
                    <Text>🌸</Text>
                  </View>
                )}
                <Text style={styles.matchName} numberOfLines={1}>
                  {m.first_name}
                  {m.age ? `, ${m.age}` : ""}
                </Text>
                {sendingId === m.id ? (
                  <ActivityIndicator color={colors.primary} size="small" />
                ) : (
                  <Text style={styles.matchAction}>→</Text>
                )}
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
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
  const [neighborhood, setNeighborhood] = useState("");
  const [bestFor, setBestFor] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function toggleBestFor(value) {
    setBestFor((cur) =>
      cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
    );
  }

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
    if (neighborhood.trim()) body.append("neighborhood", neighborhood.trim());
    if (category) body.append("category", category);
    if (bestFor.length > 0) body.append("best_for", bestFor.join(","));
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

      <Text style={styles.label}>{t("dateSpots.neighborhood")}</Text>
      <TextInput
        style={styles.input}
        value={neighborhood}
        onChangeText={setNeighborhood}
        placeholder={t("dateSpots.neighborhoodPlaceholder")}
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
            label={categoryLabel(c, t)}
            active={category === c}
            onPress={() => setCategory(category === c ? "" : c)}
            small
          />
        ))}
      </View>

      <Text style={styles.label}>{t("dateSpots.bestFor")}</Text>
      <View style={styles.pickRow}>
        {BEST_FOR.map((b) => (
          <Chip
            key={b}
            label={bestForLabel(b, t)}
            active={bestFor.includes(b)}
            onPress={() => toggleBestFor(b)}
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
  // Name above each filter row ("Country", "Vibe", ...).
  filterLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: -2,
  },

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
  // Spots without a photo: the vibe gradient comes from SpotBackdrop; the emoji
  // sits in the upper part so it clears the text overlay at the bottom.
  noImage: { alignItems: "center", justifyContent: "center", paddingBottom: "22%" },
  noImageEmoji: {
    fontSize: 54,
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowOffset: { width: 0, height: 6 },
    textShadowRadius: 16,
  },
  noImageEmojiFeatured: { fontSize: 72 },
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
  overlayStats: {
    color: "rgba(255,255,255,0.82)",
    fontSize: 12,
    fontWeight: "600",
    marginTop: 6,
  },
  detailStats: {
    color: colors.textMuted,
    fontSize: 13.5,
    fontWeight: "600",
    marginTop: spacing.sm,
  },
  detailTag: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radius.pill,
    paddingHorizontal: 13,
    paddingVertical: 6,
    marginBottom: spacing.sm,
  },
  detailTagText: { color: colors.primaryDeep, fontWeight: "700", fontSize: 12.5 },
  detailTags: { flexDirection: "row", flexWrap: "wrap", columnGap: 8 },
  bestForPill: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  bestForPillText: { color: colors.textSoft, fontWeight: "600", fontSize: 12.5 },
  /* Invite picker (bottom sheet over the detail view) */
  inviteOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1100,
    elevation: 1100,
    justifyContent: "flex-end",
    backgroundColor: "rgba(28,20,17,0.55)",
  },
  inviteSheet: {
    maxHeight: "75%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  inviteHeader: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  inviteTitle: { ...typography.h3, flex: 1, fontSize: 19, lineHeight: 25 },
  inviteClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  inviteHint: { color: colors.textMuted, fontSize: 14, marginTop: 6, marginBottom: spacing.md },
  inviteEmpty: {
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  matchList: { flexGrow: 0 },
  matchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: 6,
  },
  matchRowPressed: { backgroundColor: colors.primaryTint },
  matchPhoto: { width: 46, height: 46, borderRadius: 23 },
  matchPhotoEmpty: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  matchName: { flex: 1, fontSize: 16, fontWeight: "600", color: colors.text },
  matchAction: { color: colors.primary, fontSize: 18, fontWeight: "700" },

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
  detail: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  detailScrollView: { flex: 1 },
  detailScroll: { paddingBottom: spacing.md },
  detailFooter: {
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  footerRow: { flexDirection: "row", gap: spacing.sm },
  inviteBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
    ...shadow.sm,
  },
  inviteBtnText: { color: "#fff", fontWeight: "700", fontSize: 15.5 },
  footerBtn: {
    flex: 1,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.sm,
  },
  detailImage: { width: "100%", height: 300 },

  /* Admin-only counter editor, sitting directly under the spot's photo.
     Tinted strip so it never reads as part of the public listing. */
  adminBox: {
    backgroundColor: "#FFF6F9",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#F2D9E2",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  adminTitle: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: spacing.sm,
  },
  adminRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  adminField: { gap: 4 },
  adminLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  adminInput: {
    width: 92,
    borderWidth: 1.5,
    borderColor: "#E8CCD7",
    borderRadius: radius.sm,
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  adminSave: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  adminSaveDisabled: { opacity: 0.6 },
  adminSaveText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  adminStatus: {
    color: colors.primary,
    fontSize: 12.5,
    fontWeight: "600",
    marginTop: spacing.sm,
  },

  detailBody: { padding: spacing.lg },
  detailTitle: { ...typography.h1, fontSize: 26 },
  detailPlace: { color: colors.primary, fontWeight: "600", fontSize: 14, marginTop: 4 },
  detailText: { fontSize: 16.5, lineHeight: 27, marginTop: spacing.md },
  detailAuthor: { fontSize: 13, marginTop: spacing.md },
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
