import { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, ActivityIndicator, Share, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import EventCard from "./EventCard";
import { BASE_URL, SITE_URL } from "../api/config";
import { IMG } from "../api/images";
import { matchesFilters } from "../api/profileFilters";
import { getToken } from "../api/storage";
import { colors, radius, spacing, shadow } from "../theme";

const WEEK_MS = 7 * 24 * 3600 * 1000;

// Upcoming events in the member's city (else their country): this week's
// first, otherwise the next ones.
async function loadEvents(own) {
  const token = await getToken();
  const headers = token && token !== "null" ? { Authorization: `Bearer ${token}` } : {};
  for (const [key, value] of [["city", own?.city], ["country", own?.country]]) {
    if (!value) continue;
    try {
      const resp = await fetch(`${BASE_URL}/events?${key}=${encodeURIComponent(value)}`, { headers });
      const list = resp.ok ? (await resp.json()).filter((e) => e.status === "active") : [];
      if (list.length) {
        const soon = list.filter((e) => new Date(e.starts_at) - Date.now() < WEEK_MS);
        return { thisWeek: soon.length > 0, events: (soon.length ? soon : list).slice(0, 3) };
      }
    } catch {
      // offline: just no events section
    }
  }
  return { thisWeek: false, events: [] };
}

async function loadSpot() {
  try {
    const resp = await fetch(`${BASE_URL}/date_spots/featured`);
    const data = resp.ok ? await resp.json() : null;
    return data?.spot || null;
  } catch {
    return null;
  }
}

// Other cities with people still to see, for someone whose location filter
// ran out: their own country first, then the busiest.
function otherCities(profiles, passed, filters, own) {
  const { city, country, ...others } = filters;
  if (!city?.length && !country?.length) return null;
  const counts = new Map();
  for (const p of profiles) {
    if (!p.city || passed.has(p.id) || !matchesFilters(p, others) || matchesFilters(p, filters)) continue;
    const key = `${p.city}|${p.country || ""}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  const cities = [...counts.entries()]
    .map(([key, count]) => {
      const [name, inCountry] = key.split("|");
      return { name, country: inCountry, count };
    })
    .sort((a, b) => (b.country === own?.country) - (a.country === own?.country) || b.count - a.count)
    .slice(0, 4);
  return { cities, total, others };
}

// What Browse shows once the deck has run out: never a dead end - people in
// other cities, events this week, a place to try and a friend to invite.
export default function BrowseEnd({ own, profiles, passed, filters, filtered, onApplyFilters, onStartOver, startingOver }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const [events, setEvents] = useState(null);
  const [spot, setSpot] = useState(null);

  useEffect(() => {
    let alive = true;
    loadEvents(own).then((result) => alive && setEvents(result));
    loadSpot().then((result) => alive && setSpot(result));
    return () => {
      alive = false;
    };
  }, [own]);

  const nearby = useMemo(() => otherCities(profiles, passed, filters, own), [profiles, passed, filters, own]);

  function invite() {
    Share.share({ message: t("browseEnd.inviteMessage", { url: SITE_URL }) }).catch(() => {});
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <Text style={styles.icon}>{filtered ? "🔍" : "🌸"}</Text>
        <Text style={styles.title}>{filtered ? t("browse.noMatchTitle") : t("browse.emptyTitle")}</Text>
        <Text style={styles.subtitle}>{filtered ? t("browse.noMatchText") : t("browseEnd.comeBack")}</Text>
        {/* The latest people, and everyone passed this session again. */}
        <Pressable
          style={[styles.refresh, startingOver && { opacity: 0.7 }]}
          onPress={onStartOver}
          disabled={startingOver}
          accessibilityRole="button"
        >
          {startingOver ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.refreshText}>🔄 {t("browse.refresh")}</Text>
          )}
        </Pressable>
      </View>

      {nearby && nearby.total > 0 ? (
        <Section title={t("browseEnd.citiesTitle")}>
          <View style={styles.chips}>
            {nearby.cities.map((c) => (
              <Pressable
                key={`${c.name}|${c.country}`}
                style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                onPress={() => onApplyFilters({ ...nearby.others, city: [c.name] })}
                accessibilityRole="button"
              >
                <Text style={styles.chipText}>📍 {c.name} · {c.count}</Text>
              </Pressable>
            ))}
            <Pressable
              style={({ pressed }) => [styles.chip, styles.chipAll, pressed && styles.pressed]}
              onPress={() => onApplyFilters(nearby.others)}
              accessibilityRole="button"
            >
              <Text style={[styles.chipText, styles.chipAllText]}>🌍 {t("browseEnd.everywhere", { count: nearby.total })}</Text>
            </Pressable>
          </View>
        </Section>
      ) : null}

      {events?.events.length ? (
        <Section
          title={events.thisWeek ? t("browseEnd.eventsWeek") : t("browseEnd.eventsSoon")}
          action={t("browseEnd.seeAll")}
          onAction={() => navigation.navigate("Events")}
        >
          <View style={{ gap: spacing.md }}>
            {events.events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                t={t}
                language={i18n.language}
                onPress={() => navigation.navigate("EventDetail", { id: event.id })}
              />
            ))}
          </View>
        </Section>
      ) : null}

      {spot ? (
        <Section title={t("browseEnd.spotTitle")}>
          <Pressable
            style={({ pressed }) => [styles.spot, pressed && styles.pressed]}
            onPress={() => navigation.navigate("DateSpots", { spotId: spot.id })}
            accessibilityRole="button"
          >
            {spot.photos?.[0] || spot.image_url ? (
              <Image source={{ uri: IMG.card(spot.photos?.[0] || spot.image_url) }} style={styles.spotImage} />
            ) : (
              <View style={[styles.spotImage, styles.spotNoImage]}>
                <Text style={{ fontSize: 34 }}>📍</Text>
              </View>
            )}
            <View style={styles.spotBody}>
              <Text style={styles.spotName} numberOfLines={1}>{spot.name}</Text>
              <Text style={styles.spotMeta} numberOfLines={1}>📍 {[spot.city, spot.country].filter(Boolean).join(", ")}</Text>
              {spot.offer ? (
                <Text style={styles.spotGift} numberOfLines={1}>🎁 {spot.offer.title}</Text>
              ) : (
                <Text style={styles.spotHint}>{t("browseEnd.spotHint")}</Text>
              )}
            </View>
          </Pressable>
        </Section>
      ) : null}

      <View style={styles.invite}>
        <Text style={styles.inviteTitle}>💌 {t("browseEnd.inviteTitle")}</Text>
        <Text style={styles.inviteText}>{t("browseEnd.inviteText")}</Text>
        <Pressable
          style={({ pressed }) => [styles.inviteButton, pressed && styles.pressed]}
          onPress={invite}
          accessibilityRole="button"
        >
          <Text style={styles.inviteButtonText}>{t("browseEnd.inviteButton")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title, action, onAction, children }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8} accessibilityRole="link">
            <Text style={styles.sectionAction}>{action} ›</Text>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.sm, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.lg },
  top: { alignItems: "center", paddingHorizontal: spacing.md },
  icon: { fontSize: 52, marginBottom: spacing.sm },
  title: { fontSize: 20, fontWeight: "800", textAlign: "center", color: colors.text, marginBottom: spacing.xs },
  subtitle: { fontSize: 14, textAlign: "center", lineHeight: 21, color: colors.textMuted, maxWidth: 300 },
  refresh: {
    marginTop: spacing.md,
    minWidth: 150,
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    ...shadow.md,
  },
  refreshText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 4 },
  sectionTitle: { fontSize: 16.5, fontWeight: "800", color: colors.text },
  sectionAction: { fontSize: 13.5, fontWeight: "700", color: colors.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  chipText: { fontSize: 14, fontWeight: "700", color: colors.text },
  chipAll: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  chipAllText: { color: colors.primary },
  pressed: { opacity: 0.8 },
  spot: {
    flexDirection: "row",
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    overflow: "hidden",
    ...shadow.sm,
  },
  spotImage: { width: 110, height: 110, backgroundColor: colors.border },
  spotNoImage: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  spotBody: { flex: 1, padding: spacing.md, justifyContent: "center", gap: 4 },
  spotName: { fontSize: 16, fontWeight: "800", color: colors.text },
  spotMeta: { fontSize: 13, color: colors.textMuted },
  spotGift: { fontSize: 13, fontWeight: "700", color: "#B4581E" },
  spotHint: { fontSize: 13, color: colors.textSoft },
  invite: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    backgroundColor: colors.primarySoft,
    gap: spacing.sm,
    alignItems: "center",
  },
  inviteTitle: { fontSize: 17, fontWeight: "800", color: colors.text, textAlign: "center" },
  inviteText: { fontSize: 14, lineHeight: 20, color: colors.textSoft, textAlign: "center" },
  inviteButton: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  inviteButtonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
});
