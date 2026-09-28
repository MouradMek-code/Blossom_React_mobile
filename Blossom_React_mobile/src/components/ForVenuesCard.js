import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { SITE_URL } from "../api/config";
import { colors, radius, spacing } from "../theme";

// "For cafés & restaurants" - how a venue owner offers a treat to Blossom
// couples. Opens the website pages (no account needed). Shown to everyone,
// visitors included.
export default function ForVenuesCard({ style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, style]}>
      <Text style={styles.icon}>🏪</Text>
      <Text style={styles.title}>{t("business.homeTitle")}</Text>
      <Text style={styles.text}>{t("business.homeText")}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && { opacity: 0.85 }]}
        onPress={() => Linking.openURL(`${SITE_URL}/partner`)}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("business.homeButton")}</Text>
      </Pressable>
      <Pressable onPress={() => Linking.openURL(`${SITE_URL}/business`)} hitSlop={8}>
        <Text style={styles.more}>{t("business.homeMore")} →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: "#FFF4E5",
    borderWidth: 1,
    borderColor: "#FFD8A3",
    alignItems: "center",
  },
  icon: { fontSize: 40 },
  title: { fontSize: 20, fontWeight: "800", color: "#3D2300", textAlign: "center", marginTop: 6 },
  text: { fontSize: 14.5, color: "#5C3A0A", textAlign: "center", marginTop: 8, lineHeight: 21 },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  more: { marginTop: spacing.sm, color: colors.primaryDeep, fontWeight: "700", fontSize: 13.5 },
});
