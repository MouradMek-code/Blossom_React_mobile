import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { INSTAGRAM_URL } from "../api/config";
import { colors, radius, spacing, shadow, typography } from "../theme";

const INSTAGRAM_COLORS = ["#F58529", "#DD2A7B", "#8134AF"];

// Home: "Follow Blossom on Instagram" - @blossomfordate. Same as the website.
export default function InstagramCard({ style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.card, style]}>
      <LinearGradient colors={INSTAGRAM_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.badge}>
        <Text style={styles.badgeIcon}>📸</Text>
      </LinearGradient>
      <Text style={styles.title}>{t("social.title")}</Text>
      <Text style={styles.text}>{t("social.text")}</Text>
      <Pressable
        onPress={() => Linking.openURL(INSTAGRAM_URL)}
        accessibilityRole="link"
        style={({ pressed }) => [styles.buttonWrap, pressed && { opacity: 0.85 }]}
      >
        <LinearGradient colors={INSTAGRAM_COLORS} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.button}>
          <Text style={styles.buttonText}>{t("social.button")}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  badge: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  badgeIcon: { fontSize: 26 },
  title: { ...typography.h2, fontSize: 20, textAlign: "center", marginTop: spacing.sm },
  text: { fontSize: 14, lineHeight: 20, color: colors.textSoft, textAlign: "center", marginTop: 6 },
  buttonWrap: { marginTop: spacing.md, borderRadius: radius.pill, overflow: "hidden" },
  button: { paddingHorizontal: spacing.lg, paddingVertical: 12 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
