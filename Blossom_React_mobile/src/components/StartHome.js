import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { getToken } from "../api/storage";

export default function StartHome() {
  const navigation = useNavigation();
  const [hasToken, setHasToken] = useState(true);

  useEffect(() => {
    getToken().then((token) => setHasToken(!!token && token !== "null"));
  }, []);

  return (
    <View style={styles.center}>
      <Text style={styles.title}>Find someone worth showing up for !!</Text>
      <Text style={styles.subtitle}> Match today. Meet this week</Text>
      <Text style={styles.tagline}> Free swipe → chat → maybe meet</Text>
      {!hasToken && (
        <Pressable style={styles.cta} onPress={() => navigation.navigate("SignUp")}>
          <Text style={styles.ctaText}>Start Dating Now ❤️</Text>
        </Pressable>
      )}
    </View>
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
});
