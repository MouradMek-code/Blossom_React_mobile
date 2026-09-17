import { View, Text, Pressable, Linking, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FINDREWARD_URL, HELPREWARD_URL } from "../api/config";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Home screen section pointing to the founder's other community projects.
// Mirrors the web homepage's FounderProjects section.
export default function FounderProjects() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const projects = [
    {
      icon: "🐾",
      name: "findreward.net",
      url: FINDREWARD_URL,
      description: t("founder.findreward"),
    },
    {
      icon: "🤝",
      name: "helpreward.com",
      url: HELPREWARD_URL,
      description: t("founder.helpreward"),
    },
  ];

  return (
    // Last section on the screen, so keep it clear of the phone's nav bar.
    <View style={[styles.section, { paddingBottom: Math.max(insets.bottom, 16) + 32 }]}>
      <Text style={styles.eyebrow}>{t("founder.eyebrow")}</Text>
      <Text style={styles.title}>{t("founder.title")}</Text>
      <Text style={styles.subtitle}>{t("founder.subtitle")}</Text>

      {projects.map((p) => (
        <Pressable
          key={p.name}
          accessibilityRole="link"
          onPress={() => Linking.openURL(p.url)}
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        >
          <View style={styles.icon}>
            <Text style={styles.iconText}>{p.icon}</Text>
          </View>
          <View style={styles.text}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={styles.description}>{p.description}</Text>
            <Text style={styles.visit}>{t("founder.visit")} ↗</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    paddingTop: 44,
    paddingHorizontal: 20,
    backgroundColor: colors.background,
  },
  eyebrow: {
    ...typography.label,
    color: colors.primary,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
  title: {
    ...typography.h2,
    fontSize: 24,
    textAlign: "center",
    marginTop: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    padding: 18,
    marginBottom: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    ...shadow.sm,
  },
  cardPressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primaryTint,
  },
  iconText: { fontSize: 26 },
  text: { flex: 1 },
  name: { fontFamily: "serif", fontSize: 18, fontWeight: "700", color: colors.text },
  description: { fontSize: 14.5, lineHeight: 21, color: colors.textMuted, marginTop: 3 },
  visit: { fontSize: 13, fontWeight: "700", color: colors.primary, marginTop: 8 },
});
