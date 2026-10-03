import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { IMG } from "../api/images";
import { KIND_EMOJI, KIND_GRADIENT, eventDay, eventWhen } from "../api/events";
import { colors, radius, spacing, shadow } from "../theme";

// One event in the Events list: photo (or the type's colours), the date
// badge, what/when/where, who organises and how many are interested.
export default function EventCard({ event, t, language, onPress }) {
  const { day, month } = eventDay(event.starts_at, language);
  const off = event.status !== "active";
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, off && styles.cardOff, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <View style={styles.media}>
        {event.image_url ? (
          <Image source={{ uri: IMG.card(event.image_url) }} style={styles.image} />
        ) : (
          <LinearGradient
            colors={KIND_GRADIENT[event.kind] || KIND_GRADIENT.group}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.image, styles.noImage]}
          >
            <Text style={styles.noImageEmoji}>{KIND_EMOJI[event.kind]}</Text>
          </LinearGradient>
        )}
        <View style={styles.dateBadge}>
          <Text style={styles.dateDay}>{day}</Text>
          <Text style={styles.dateMonth}>{month}</Text>
        </View>
        <View style={styles.kindPill}>
          <Text style={styles.kindPillText}>
            {KIND_EMOJI[event.kind]} {t(`events.kind_${event.kind}`)}
          </Text>
        </View>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
        <Text style={styles.line}>🕒 {eventWhen(event.starts_at, language)}</Text>
        <Text style={styles.line} numberOfLines={1}>📍 {event.place_name} · {event.city}</Text>
        {(event.spot?.offer || event.women_only || event.status === "cancelled") && (
          <View style={styles.tags}>
            {event.spot?.offer && (
              <Text style={[styles.tag, styles.giftTag]} numberOfLines={1}>🎁 {event.spot.offer.title}</Text>
            )}
            {event.women_only && <Text style={styles.tag}>👩 {t("events.womenOnly")}</Text>}
            {event.status === "cancelled" && (
              <Text style={[styles.tag, styles.warnTag]}>{t("events.cancelled")}</Text>
            )}
          </View>
        )}
        <View style={styles.foot}>
          <View style={styles.organizer}>
            {event.organizer?.photo ? (
              <Image source={{ uri: IMG.thumb(event.organizer.photo) }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty]}>
                <Text style={{ fontSize: 12 }}>🌸</Text>
              </View>
            )}
            <Text style={styles.organizerText} numberOfLines={1}>
              {t("events.organisedBy", { name: event.organizer?.first_name || "?" })}
            </Text>
          </View>
          <Text style={styles.counts}>🙋 {event.interested_count} · 💬 {event.comment_count}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: "hidden",
    marginBottom: spacing.md,
    ...shadow.md,
  },
  cardOff: { opacity: 0.65 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  media: { height: 160, position: "relative" },
  image: { width: "100%", height: "100%" },
  noImage: { alignItems: "center", justifyContent: "center" },
  noImageEmoji: { fontSize: 52 },
  dateBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    minWidth: 48,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    ...shadow.sm,
  },
  dateDay: { fontSize: 20, fontWeight: "800", color: colors.primaryDeep, lineHeight: 22 },
  dateMonth: { fontSize: 10, fontWeight: "800", color: colors.textSoft, letterSpacing: 0.6 },
  kindPill: {
    position: "absolute",
    top: 14,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: "rgba(20,14,12,0.55)",
  },
  kindPillText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  body: { padding: 14, gap: 4 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 2 },
  line: { fontSize: 13.5, color: colors.textSoft },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTint,
    color: colors.primaryDeep,
    fontSize: 11.5,
    fontWeight: "700",
    overflow: "hidden",
    maxWidth: "100%",
  },
  giftTag: { backgroundColor: "#fff4e5", color: "#6b3e00" },
  warnTag: { backgroundColor: "#fdecea", color: colors.danger },
  foot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  organizer: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  avatar: { width: 26, height: 26, borderRadius: 13 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  organizerText: { fontSize: 13, color: colors.textSoft, flexShrink: 1 },
  counts: { fontSize: 13, fontWeight: "700", color: colors.textSoft },
});
