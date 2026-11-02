import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

export const VERIFIED_BLUE = "#2F80ED";

// The ✓ next to a verified member's name: their selfie was checked by the
// Blossom team (see VerifyScreen).
export default function VerifiedBadge({ size = 18, style }) {
  const { t } = useTranslation();
  return (
    <View
      style={[styles.badge, { width: size, height: size, borderRadius: size / 2 }, style]}
      accessible
      accessibilityLabel={t("verified.badge")}
    >
      <Text style={[styles.check, { fontSize: Math.round(size * 0.6), lineHeight: Math.round(size * 0.75) }]}>✓</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: VERIFIED_BLUE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#fff",
  },
  check: { color: "#fff", fontWeight: "900", textAlign: "center" },
});
