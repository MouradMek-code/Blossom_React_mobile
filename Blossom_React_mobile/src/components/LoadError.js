import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { colors, radius, spacing } from "../theme";

// Shown when a screen couldn't load (no internet, server waking up...) -
// instead of logging the user out, which is what used to happen.
export default function LoadError({ onRetry, style }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.text}>{t("common.loadError")}</Text>
      <Pressable
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t("common.retry")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: "center",
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { textAlign: "center", color: colors.textMuted, lineHeight: 21 },
  button: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  buttonPressed: { backgroundColor: colors.primaryDark },
  buttonText: { color: "#fff", fontWeight: "700" },
});
