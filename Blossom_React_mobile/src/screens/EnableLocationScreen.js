import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { enableAutoLocation } from "../api/autoLocation";
import { clearSession } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

// The last sign-up step, after the photos, as on Bumble: one page, one button.
// It leads to the phone's own permission window; whatever happens there
// (refused, no signal, too slow), the person carries on to Browse. Members
// who were never asked see it once too (useAutoLocation).
export default function EnableLocationScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function enable() {
    setBusy(true);
    const result = await enableAutoLocation();
    if (result?.removed) {
      await clearSession();
      Alert.alert(t("location.removedTitle"), t("location.removedText"));
      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.middle}>
        <View style={styles.circle}>
          <Text style={styles.pin}>📍</Text>
        </View>
        <Text style={styles.title}>{t("location.pageTitle")}</Text>
        <Text style={styles.text}>{t("location.pageText")}</Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, (pressed || busy) && styles.pressed]}
        onPress={enable}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.buttonText}>{t("location.pageBusy")}</Text>
          </View>
        ) : (
          <Text style={styles.buttonText}>{t("location.pageButton")}</Text>
        )}
      </Pressable>
      <Text style={styles.note}>{t("location.pageNote")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.lg },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  circle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  pin: { fontSize: 60 },
  title: { ...typography.h2, fontSize: 27, textAlign: "center" },
  text: { fontSize: 16, lineHeight: 24, color: colors.textSoft, textAlign: "center", maxWidth: 340 },
  button: {
    alignItems: "center",
    paddingVertical: 16,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    ...shadow.md,
  },
  pressed: { opacity: 0.8 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  buttonText: { color: "#fff", fontWeight: "800", fontSize: 16.5 },
  note: {
    marginTop: spacing.sm,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: "center",
  },
});
