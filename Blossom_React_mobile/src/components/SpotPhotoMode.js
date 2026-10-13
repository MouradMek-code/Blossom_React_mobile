import { useEffect, useRef } from "react";
import { Modal, View, Text, Image, Pressable, Animated, StatusBar, Linking, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { SITE_URL } from "../api/config";
import { IMG } from "../api/images";
import { bestForLabel, categoryEmoji, categoryGradient, categoryLabel, fullPlace } from "../api/categories";
import { colors, radius } from "../theme";

// Shown as a social proof line only once a place has real attention.
const MIN_VIEWS_SHOWN = 30;

// "📸 Photo mode": a spot as a clean full-screen poster made for a screenshot
// (a phone screen is already the Instagram story shape) - photo, name, place,
// the gift, the description, the Blossom brand - with no buttons and no
// status bar. Venues reading the post get the how-to and a link to offer
// couples a treat themselves. A tap anywhere else closes it.
export default function SpotPhotoMode({ spot, onClose }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const hint = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const fade = Animated.timing(hint, { toValue: 0, delay: 2200, duration: 600, useNativeDriver: true });
    fade.start();
    return () => fade.stop();
  }, [hint]);

  if (!spot) return null;
  const tags = [
    spot.category && `${categoryEmoji(spot.category)} ${categoryLabel(spot.category, t)}`,
    ...(spot.best_for || []).slice(0, 2).map((b) => bestForLabel(b, t)),
  ].filter(Boolean);
  const partnerUrl = spot.offer ? `${SITE_URL}/partner` : `${SITE_URL}/partner?spot=${spot.id}`;

  function openPartnerForm() {
    onClose();
    Linking.openURL(partnerUrl).catch(() => {});
  }

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar hidden />
      <Pressable style={styles.screen} onPress={onClose} accessibilityLabel={t("photoMode.hint")}>
        <View style={styles.photo}>
          {spot.image_url ? (
            <Image source={{ uri: IMG.full(spot.image_url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <LinearGradient colors={categoryGradient(spot.category)} style={[StyleSheet.absoluteFill, styles.noPhoto]}>
              <Text style={styles.noPhotoEmoji}>{categoryEmoji(spot.category)}</Text>
            </LinearGradient>
          )}
          <LinearGradient
            colors={["rgba(20,14,12,0.35)", "transparent", "transparent", "rgba(20,14,12,0.9)"]}
            locations={[0, 0.22, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.brandTop, { top: Math.max(insets.top, 14) }]}>
            <Text style={styles.brandTopText}>🌸 Blossom</Text>
          </View>
          {spot.offer ? (
            <View style={[styles.giftRibbon, { top: Math.max(insets.top, 14) }]}>
              <Text style={styles.giftRibbonText}>{t("dateSpots.giftRibbon")}</Text>
            </View>
          ) : null}
          <View style={styles.titleBox}>
            {tags.length > 0 ? <Text style={styles.tags}>{tags.join(" · ")}</Text> : null}
            <Text style={styles.name} numberOfLines={2}>{spot.name}</Text>
            <Text style={styles.place} numberOfLines={1}>📍 {fullPlace(spot)}</Text>
          </View>
        </View>

        <View style={[styles.body, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          {spot.offer ? (
            <View style={styles.gift}>
              <Text style={styles.giftLabel}>{t("photoMode.couplesGet")}</Text>
              <Text style={styles.giftTitle}>🎁 {spot.offer.title}</Text>
              <Text style={styles.giftHow}>{t("photoMode.giftHow")}</Text>
            </View>
          ) : null}

          {spot.description ? (
            <View style={styles.quote}>
              <Text style={styles.quoteText} numberOfLines={4}>“{spot.description}”</Text>
            </View>
          ) : null}

          {spot.best_for?.length > 0 || spot.view_count >= MIN_VIEWS_SHOWN ? (
            <View style={styles.facts}>
              {spot.best_for?.length > 0 ? (
                <Text style={styles.fact}>
                  💞 {t("photoMode.perfectFor")} {spot.best_for.map((b) => bestForLabel(b, t)).join(", ")}
                </Text>
              ) : null}
              {spot.view_count >= MIN_VIEWS_SHOWN ? (
                <Text style={styles.fact}>{t("photoMode.views", { count: spot.view_count })}</Text>
              ) : null}
            </View>
          ) : null}

          {/* For venues reading the post: how it works, and the way in. */}
          <Pressable style={({ pressed }) => [styles.venue, pressed && { opacity: 0.8 }]} onPress={openPartnerForm}>
            <Text style={styles.venueTitle}>
              🏪 {spot.offer ? t("photoMode.venueTitleOther") : t("photoMode.venueTitle")}
            </Text>
            <Text style={styles.venueIdeas}>{t("photoMode.venueIdeas")}</Text>
            {[t("partners.how1"), t("partners.how2"), t("partners.how3")].map((step, i) => (
              <Text key={step} style={styles.step}>
                {i + 1}. {step}
              </Text>
            ))}
            <Text style={styles.venueCta}>
              {t("photoMode.venueCta")} <Text style={styles.venueUrl}>blossom-date.com/partner</Text>
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Image source={require("../../assets/images/LogoBlossom.png")} style={styles.logo} />
            <View style={{ flex: 1 }}>
              <Text style={styles.footerName}>Blossom</Text>
              <Text style={styles.footerTagline}>{t("photoMode.tagline")}</Text>
            </View>
            <View style={styles.footerLinks}>
              <Text style={styles.footerLink}>@blossomfordate</Text>
              <Text style={styles.footerLink}>blossom-date.com</Text>
            </View>
          </View>
        </View>
      </Pressable>
      {/* Fades away, so a screenshot taken after 3 seconds is clean. */}
      <Animated.View style={[styles.hint, { opacity: hint, bottom: Math.max(insets.bottom, 12) + 8 }]} pointerEvents="none">
        <Text style={styles.hintText}>{t("photoMode.hint")}</Text>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  photo: { flex: 1, minHeight: "34%" },
  noPhoto: { alignItems: "center", justifyContent: "center" },
  noPhotoEmoji: { fontSize: 72 },
  brandTop: {
    position: "absolute",
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  brandTopText: { color: "#fff", fontWeight: "800", fontSize: 13.5 },
  giftRibbon: {
    position: "absolute",
    right: 14,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: "#FFB547",
  },
  giftRibbonText: { color: "#3D2300", fontWeight: "800", fontSize: 12.5 },
  titleBox: { position: "absolute", left: 18, right: 18, bottom: 16 },
  tags: { color: "#fff", fontSize: 12.5, fontWeight: "700", opacity: 0.92, marginBottom: 6 },
  name: {
    color: "#fff",
    fontFamily: "serif",
    fontSize: 32,
    fontWeight: "700",
    lineHeight: 36,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  place: { color: "#fff", fontSize: 14.5, marginTop: 6, opacity: 0.95 },
  body: { paddingHorizontal: 18, paddingTop: 14, gap: 10 },
  gift: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: radius.md,
    backgroundColor: "#FFEFD2",
    borderWidth: 1.5,
    borderColor: "#F0C27A",
  },
  giftLabel: { fontSize: 10.5, fontWeight: "800", letterSpacing: 0.8, color: "#8A5A10", textTransform: "uppercase" },
  giftTitle: { fontSize: 17, fontWeight: "800", color: "#3D2300", marginTop: 2 },
  giftHow: { fontSize: 12, color: "#6B4A14", marginTop: 2 },
  quote: { borderLeftWidth: 3, borderLeftColor: colors.primary, paddingLeft: 12 },
  quoteText: { fontFamily: "serif", fontStyle: "italic", fontSize: 15, lineHeight: 21, color: colors.text },
  facts: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4 },
  fact: { fontSize: 12.5, fontWeight: "600", color: colors.textSoft },
  venue: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    gap: 2,
  },
  venueTitle: { fontSize: 13.5, fontWeight: "800", color: colors.primaryDeep },
  venueIdeas: { fontSize: 12, color: colors.textSoft, marginBottom: 2 },
  step: { fontSize: 11.5, lineHeight: 16, color: colors.textSoft },
  venueCta: { fontSize: 12.5, fontWeight: "800", color: colors.primary, marginTop: 3 },
  venueUrl: { fontWeight: "600", color: colors.textSoft },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  logo: { width: 54, height: 36, borderRadius: 8 },
  footerName: { fontFamily: "serif", fontSize: 17, fontWeight: "700", color: colors.primaryDeep },
  footerTagline: { fontSize: 11.5, color: colors.textMuted },
  footerLinks: { alignItems: "flex-end" },
  footerLink: { fontSize: 12.5, fontWeight: "700", color: colors.textSoft, lineHeight: 18 },
  hint: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  hintText: { color: "#fff", fontSize: 13 },
});
