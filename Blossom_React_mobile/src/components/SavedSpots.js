import { useCallback, useState } from "react";
import { View, Text, Image, Pressable, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { IMG } from "../api/images";
import { categoryEmoji, categoryGradient, shortPlace } from "../api/categories";
import { colors, radius, spacing, shadow } from "../theme";

// "♡ My saved places" on your profile: the spots you saved, latest first.
// Tap one to open it (and invite a match from there); ♥ removes it.
export default function SavedSpots() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [spots, setSpots] = useState(null);

  const load = useCallback(async () => {
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/date_spots/saved`, { headers: { Authorization: `Bearer ${token}` } });
    setSpots((cur) => (result.ok ? result.data : cur || []));
  }, []);

  // Again each time the profile comes back into view (a spot saved meanwhile).
  useAutoRefresh(load, { minIntervalMs: 3000 });

  async function unsave(spot) {
    setSpots((cur) => cur.filter((s) => s.id !== spot.id));
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/date_spots/${spot.id}/save`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!result.ok) setSpots((cur) => [spot, ...cur]);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{t("dateSpots.savedTitle")}</Text>
      {spots === null ? null : spots.length === 0 ? (
        <Pressable onPress={() => navigation.navigate("Main", { screen: "Spots" })}>
          <Text style={styles.empty}>
            {t("dateSpots.savedEmpty")} <Text style={styles.link}>{t("dateSpots.savedSeeAll")}</Text>
          </Text>
        </Pressable>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {spots.map((spot) => (
            <Pressable
              key={spot.id}
              style={({ pressed }) => [styles.item, pressed && { opacity: 0.85 }]}
              onPress={() => navigation.navigate("DateSpots", { spotId: spot.id })}
            >
              {spot.image_url ? (
                <Image source={{ uri: IMG.card(spot.image_url) }} style={StyleSheet.absoluteFill} />
              ) : (
                <LinearGradient colors={categoryGradient(spot.category)} style={[StyleSheet.absoluteFill, styles.noPhoto]}>
                  <Text style={styles.noPhotoEmoji}>{categoryEmoji(spot.category)}</Text>
                </LinearGradient>
              )}
              <LinearGradient colors={["transparent", "rgba(20,14,12,0.85)"]} locations={[0.4, 1]} style={StyleSheet.absoluteFill} />
              {spot.offer ? (
                <View style={styles.gift}>
                  <Text style={styles.giftText} numberOfLines={1}>🎁 {spot.offer.title}</Text>
                </View>
              ) : null}
              <Pressable
                style={styles.heart}
                onPress={() => unsave(spot)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t("dateSpots.saved")}
              >
                <Text style={styles.heartText}>♥</Text>
              </Pressable>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{spot.name}</Text>
                <Text style={styles.place} numberOfLines={1}>📍 {shortPlace(spot)}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  title: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  empty: { fontSize: 14, lineHeight: 20, color: colors.textSoft },
  link: { color: colors.primary, fontWeight: "700" },
  row: { gap: 10, paddingRight: spacing.sm },
  item: { width: 150, height: 190, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.primarySoft },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  noPhotoEmoji: { fontSize: 40 },
  gift: {
    position: "absolute",
    top: 8,
    left: 8,
    right: 46,
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    backgroundColor: "#FFB547",
  },
  giftText: { color: "#3D2300", fontSize: 10.5, fontWeight: "800" },
  heart: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
  },
  heartText: { color: colors.primary, fontSize: 17, lineHeight: 20 },
  info: { position: "absolute", left: 10, right: 10, bottom: 10 },
  name: { color: "#fff", fontWeight: "800", fontSize: 14.5, lineHeight: 18 },
  place: { color: "rgba(255,255,255,0.9)", fontSize: 11.5, marginTop: 2 },
});
