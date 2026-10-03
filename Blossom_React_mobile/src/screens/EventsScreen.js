import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, FlatList, ScrollView, RefreshControl, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import EventCard from "../components/EventCard";
import LoadError from "../components/LoadError";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { peekCache, writeCache } from "../api/cache";
import { EVENT_KINDS, KIND_EMOJI } from "../api/events";
import { colors, radius, spacing, shadow, typography } from "../theme";

// The Events tab: date ideas, group outings and language exchanges organised
// by members. Say "I'm interested", talk in the comments, and the organiser
// matches the people they'd like to meet.
export default function EventsScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  const [events, setEvents] = useState(() => peekCache("events"));
  const [cities, setCities] = useState([]);
  const [kind, setKind] = useState("");
  const [city, setCity] = useState("");
  const [mine, setMine] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (mine) params.set("mine", "true");
    else {
      if (kind) params.set("kind", kind);
      if (city) params.set("city", city);
    }
    try {
      const token = await getToken();
      const headers = token && token !== "null" ? { Authorization: `Bearer ${token}` } : {};
      const [listResp, locResp] = await Promise.all([
        fetch(`${BASE_URL}/events?${params}`, { headers }),
        fetch(`${BASE_URL}/events/locations`),
      ]);
      const list = listResp.ok ? await listResp.json() : [];
      setEvents(list);
      if (!mine && !kind && !city) writeCache("events", list);
      if (locResp.ok) setCities((await locResp.json()).flatMap((l) => l.cities));
      setLoadError(false);
    } catch {
      setLoadError(true);
      setEvents((cur) => cur || []);
    }
  }, [kind, city, mine]);

  // On opening and whenever a filter changes; then when coming back to the
  // tab ("events" is invalidated after creating or cancelling one).
  useEffect(() => {
    load();
  }, [load]);
  useAutoRefresh(load, { minIntervalMs: 20000, skipFirst: true, key: "events" });

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const header = (
    <View>
      <View style={styles.hero}>
        <Text style={styles.title}>📅 {t("events.title")}</Text>
        <Text style={styles.subtitle}>{t("events.subtitle")}</Text>
        <Pressable
          style={({ pressed }) => [styles.createBtn, pressed && { opacity: 0.85 }]}
          onPress={() => navigation.navigate("EventForm")}
          accessibilityRole="button"
        >
          <Text style={styles.createText}>＋ {t("events.create")}</Text>
        </Pressable>
      </View>

      <View style={styles.switch}>
        {[false, true].map((value) => (
          <Pressable key={String(value)} style={[styles.switchItem, mine === value && styles.switchOn]} onPress={() => setMine(value)}>
            <Text style={[styles.switchText, mine === value && styles.switchTextOn]}>
              {value ? t("events.myEvents") : t("events.allEvents")}
            </Text>
          </Pressable>
        ))}
      </View>

      {!mine && (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            <Chip label={t("events.allTypes")} on={!kind} onPress={() => setKind("")} />
            {EVENT_KINDS.map((k) => (
              <Chip key={k} label={`${KIND_EMOJI[k]} ${t(`events.kind_${k}`)}`} on={kind === k} onPress={() => setKind(kind === k ? "" : k)} />
            ))}
          </ScrollView>
          {cities.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label={t("events.allCities")} on={!city} onPress={() => setCity("")} />
              {cities.map((c) => (
                <Chip key={c} label={`📍 ${c}`} on={city === c} onPress={() => setCity(city === c ? "" : c)} />
              ))}
            </ScrollView>
          )}
        </>
      )}
      {loadError ? <LoadError onRetry={load} /> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <PageNav />
      <FlatList
        data={events || []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomInset + spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => (
          <EventCard
            event={item}
            t={t}
            language={i18n.language}
            onPress={() => navigation.navigate("EventDetail", { id: item.id })}
          />
        )}
        ListEmptyComponent={
          events === null ? (
            <Text style={styles.muted}>{t("dashboard.loading")}</Text>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📅</Text>
              <Text style={styles.emptyText}>{mine ? t("events.emptyMine") : t("events.empty")}</Text>
            </View>
          )
        }
      />
    </View>
  );
}

function Chip({ label, on, onPress }) {
  return (
    <Pressable style={[styles.chip, on && styles.chipOn]} onPress={onPress} accessibilityRole="button">
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  hero: { alignItems: "center", paddingTop: spacing.sm, paddingBottom: spacing.md },
  title: { ...typography.h1, fontSize: 28, textAlign: "center" },
  subtitle: { ...typography.bodyMuted, textAlign: "center", marginTop: 6, lineHeight: 20, paddingHorizontal: spacing.sm },
  createBtn: {
    marginTop: spacing.md,
    paddingHorizontal: 26,
    paddingVertical: 13,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.md,
  },
  createText: { color: "#fff", fontWeight: "800", fontSize: 15.5 },
  switch: {
    flexDirection: "row",
    alignSelf: "center",
    padding: 4,
    marginBottom: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  switchItem: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: radius.pill },
  switchOn: { backgroundColor: colors.text },
  switchText: { fontWeight: "700", color: colors.textSoft, fontSize: 14 },
  switchTextOn: { color: "#fff" },
  chips: { gap: 8, paddingVertical: 6 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.textSoft },
  chipTextOn: { color: "#fff" },
  muted: { ...typography.bodyMuted, textAlign: "center", marginTop: spacing.lg },
  empty: { alignItems: "center", paddingVertical: 40, paddingHorizontal: spacing.md },
  emptyIcon: { fontSize: 40 },
  emptyText: { ...typography.body, color: colors.textSoft, textAlign: "center", marginTop: 8, lineHeight: 21 },
});
