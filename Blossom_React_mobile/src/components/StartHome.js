import { useEffect, useRef, useState } from "react";
import { Animated, View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { getToken } from "../api/storage";

export default function StartHome() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [hasToken, setHasToken] = useState(true);
  const fade = useRef(new Animated.Value(0)).current;
  const slide = useRef(new Animated.Value(16)).current;

  useEffect(() => {
    getToken().then((token) => setHasToken(!!token && token !== "null"));
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, delay: 100, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: 600, delay: 100, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[styles.center, { opacity: fade, transform: [{ translateY: slide }] }]}
    >
      <Text style={styles.title}>{t("home.title")}</Text>
      <Text style={styles.subtitle}>{t("home.subtitle")}</Text>
      <Text style={styles.tagline}>{t("home.tagline")}</Text>
      {!hasToken && (
        <Pressable style={styles.cta} onPress={() => navigation.navigate("SignUp")}>
          <Text style={styles.ctaText}>{t("home.cta")}</Text>
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
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
    color: "#fff",
  },
  subtitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "rgba(255,255,255,0.95)",
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: "rgba(255,255,255,0.85)",
    marginBottom: 24,
    textAlign: "center",
  },
  cta: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  ctaText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
  trustLine: {
    marginTop: 20,
    fontSize: 14,
    fontWeight: "500",
    color: "rgba(255,255,255,0.75)",
    textAlign: "center",
  },
});
