import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import LocationFields from "./LocationFields";
import { tidyCity } from "../api/geo";
import { saveSignupDraft } from "../api/storage";
import { colors, radius, spacing, typography } from "../theme";

// Sign-up step: where do you live? Chosen from lists rather than detected by
// GPS - some people don't want to share their position, and with GPS there
// was no way past this step for anyone who said no.
export default function Localisation({ setlocated, setAnswer, answer }) {
  const { t } = useTranslation();
  const [location, setLocation] = useState({
    country: answer?.country || "",
    city: answer?.city || "",
  });

  const ready = Boolean(location.country && location.city.trim());

  function next() {
    const updated = { ...answer, country: location.country, city: tidyCity(location.city) };
    setAnswer(updated);
    saveSignupDraft({ located: true, answer: updated });
    setlocated(true);
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.icon}>📍</Text>
      <Text style={styles.heading}>{t("location.title")}</Text>
      <Text style={styles.subtitle}>{t("location.subtitle")}</Text>

      <LocationFields country={location.country} city={location.city} onChange={setLocation} />

      <Pressable
        style={({ pressed }) => [styles.button, !ready && styles.buttonDisabled, pressed && styles.buttonPressed]}
        onPress={next}
        disabled={!ready}
      >
        <Text style={styles.buttonText}>{t("location.continue")}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", padding: spacing.lg },
  icon: { fontSize: 36, marginBottom: 4 },
  heading: { ...typography.h2, fontSize: 23, textAlign: "center", marginBottom: 6 },
  subtitle: { textAlign: "center", color: colors.textMuted, lineHeight: 21, marginBottom: spacing.sm },
  button: {
    alignSelf: "stretch",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { backgroundColor: colors.primaryDark, transform: [{ scale: 0.98 }] },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
