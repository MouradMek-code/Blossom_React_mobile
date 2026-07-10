import { useEffect, useRef, useState } from "react";
import { Animated, View, Text, Pressable, StyleSheet, Easing } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { getToken } from "../api/storage";
import { colors, shadow } from "../theme";

export default function StartHome() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [hasToken, setHasToken] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    getToken().then((token) => setHasToken(!!token && token !== "null"));
  }, []);

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.in(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View
      style={[styles.center, { opacity: fade, transform: [{ translateY: slide }] }]}
    >
      <Text style={styles.title}>{t("home.title")}</Text>
      <View style={styles.floatingBadge}>
        <Animated.View style={[styles.badgeDot, { opacity: pulse }]} />
        <Text style={styles.badgeText}>{t("home.langBadge")}</Text>
      </View>
      <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
      <Text style={styles.tagline}>{t("home.tagline")}</Text>
      {!hasToken && (
        <Pressable style={styles.cta} onPress={() => navigation.navigate("SignUp")}>
          <Text style={styles.ctaText}>{t("home.cta")}</Text>
          <Text style={styles.ctaArrow}>→</Text>
        </Pressable>
      )}
      <Text style={styles.trustLine}>{t("home.trustLine")}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  title: {
    fontFamily: "serif",
    fontSize: 44,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: -0.5,
    lineHeight: 48,
    marginBottom: 14,
    color: "#fff",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 8 },
    textShadowRadius: 24,
  },
  subtitle: {
    fontFamily: "serif",
    fontStyle: "italic",
    fontSize: 24,
    fontWeight: "500",
    textAlign: "center",
    color: "rgba(255,255,255,0.96)",
    marginBottom: 10,
  },
  tagline: {
    fontSize: 16,
    lineHeight: 24,
    color: "rgba(255,255,255,0.82)",
    marginBottom: 30,
    textAlign: "center",
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.primary,
    paddingHorizontal: 34,
    paddingVertical: 16,
    borderRadius: 999,
    ...shadow.lg,
    shadowColor: colors.primary,
    shadowOpacity: 0.55,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16.5,
    letterSpacing: 0.2,
  },
  ctaArrow: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "600",
  },
  trustLine: {
    marginTop: 22,
    fontSize: 13.5,
    fontWeight: "400",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
  },
  floatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 18,
  },
  badgeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
});
