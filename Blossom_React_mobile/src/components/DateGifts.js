import { useEffect, useState } from "react";
import { View, Text, Pressable, Image, ScrollView, Linking, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { BASE_URL, SITE_URL } from "../api/config";
import { IMG } from "../api/images";
import { categoryEmoji, categoryGradient } from "../api/categories";
import { colors, radius, spacing, shadow, typography } from "../theme";

const STEPS = [
  { key: "step1", icon: "💞" },
  { key: "step2", icon: "📍" },
  { key: "step3", icon: "🎟️" },
  { key: "step4", icon: "☕" },
];

// Home: "Your first date, with a little gift" - the venue gifts explained to
// the people who date, with the gifts open right now. Only real ones: with
// none open, the section shows the steps alone. Same as the website.
export default function DateGifts({ style }) {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  // Spaced capitals for Latin scripts only: spacing breaks Arabic's joined letters.
  const latinScript = !/^(ar|zh)/.test(i18n.language || "");
  const [gifts, setGifts] = useState([]);

  useEffect(() => {
    let alive = true;
    fetch(`${BASE_URL}/date_spots`)
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((spots) => {
        if (alive && Array.isArray(spots)) setGifts(spots.filter((s) => s.offer).slice(0, 3));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={[styles.section, style]}>
      <Text style={[styles.eyebrow, latinScript && styles.eyebrowLatin]}>{t("gifts.eyebrow")}</Text>
      <Text style={styles.title}>{t("gifts.title")}</Text>
      <Text style={styles.subtitle}>{t("gifts.subtitle")}</Text>

      <View style={styles.steps}>
        {STEPS.map(({ key, icon }, i) => (
          <View key={key} style={styles.step}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>{i + 1}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.stepTitle}>{t(`gifts.${key}Title`)}</Text>
              <Text style={styles.stepText}>{t(`gifts.${key}Text`)}</Text>
            </View>
            <Text style={styles.stepIcon}>{icon}</Text>
          </View>
        ))}
      </View>

      {gifts.length > 0 ? (
        <View style={styles.now}>
          <Text style={styles.nowTitle}>{t("gifts.nowTitle")}</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.giftRow}
          >
            {gifts.map((spot) => (
              <Pressable
                key={spot.id}
                style={({ pressed }) => [styles.gift, pressed && styles.pressed]}
                onPress={() => navigation.navigate("DateSpots", { spotId: spot.id })}
              >
                {spot.image_url ? (
                  <Image source={{ uri: IMG.card(spot.image_url) }} style={styles.giftImage} />
                ) : (
                  <LinearGradient
                    colors={categoryGradient(spot.category)}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.giftImage, styles.giftNoImage]}
                  >
                    <Text style={styles.giftEmoji}>{categoryEmoji(spot.category)}</Text>
                  </LinearGradient>
                )}
                <View style={styles.giftBody}>
                  <Text style={styles.giftOffer} numberOfLines={2}>
                    🎁 {spot.offer.title}
                  </Text>
                  <Text style={styles.giftName} numberOfLines={1}>
                    {spot.name}
                  </Text>
                  <Text style={styles.giftPlace} numberOfLines={1}>
                    📍 {spot.city}
                  </Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => navigation.navigate("DateSpots", { gifts: true })}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>🎁 {t("gifts.button")}</Text>
      </Pressable>
      <Text style={styles.fine}>{t("gifts.fine")}</Text>

      <Pressable onPress={() => Linking.openURL(`${SITE_URL}/partner`)} hitSlop={8}>
        <Text style={styles.owner}>🏪 {t("gifts.owner")} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xl,
    backgroundColor: colors.primaryTint,
    alignItems: "center",
  },
  eyebrow: { fontSize: 13, fontWeight: "700", color: colors.primary, textAlign: "center" },
  eyebrowLatin: { fontSize: 12, letterSpacing: 1, textTransform: "uppercase" },
  title: { ...typography.h2, fontSize: 26, textAlign: "center", marginTop: spacing.sm },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textSoft,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  steps: { alignSelf: "stretch", gap: 10, marginTop: spacing.lg },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  stepNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  stepNumberText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 15.5, fontWeight: "700", color: colors.text },
  stepText: { fontSize: 13.5, lineHeight: 19, color: colors.textSoft, marginTop: 2 },
  stepIcon: { fontSize: 24 },
  now: { alignSelf: "stretch", marginTop: spacing.lg },
  nowTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: colors.primaryDeep,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  giftRow: { gap: 10, paddingHorizontal: 2, paddingBottom: 4 },
  gift: {
    flexDirection: "row",
    width: 270,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
  giftImage: { width: 84, height: 96, backgroundColor: colors.surfaceMuted },
  giftNoImage: { alignItems: "center", justifyContent: "center" },
  giftEmoji: { fontSize: 28 },
  giftBody: { flex: 1, padding: 10, justifyContent: "center", gap: 2 },
  giftOffer: { fontSize: 14, fontWeight: "700", color: colors.primaryDeep },
  giftName: { fontSize: 13.5, fontWeight: "600", color: colors.text },
  giftPlace: { fontSize: 12.5, color: colors.textMuted },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...shadow.md,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15.5, textAlign: "center" },
  pressed: { opacity: 0.85 },
  fine: { marginTop: spacing.sm, fontSize: 12.5, color: colors.textMuted, textAlign: "center" },
  owner: { marginTop: spacing.md, fontSize: 14, fontWeight: "700", color: colors.primaryDeep, textAlign: "center" },
});
