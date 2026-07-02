import { View, Text, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";

const STEPS = [
  { icon: "🌹", titleKey: "howItWorks.step1Title", textKey: "howItWorks.step1Text" },
  { icon: "💘", titleKey: "howItWorks.step2Title", textKey: "howItWorks.step2Text" },
  { icon: "📅", titleKey: "howItWorks.step3Title", textKey: "howItWorks.step3Text" },
];

export default function HowItWorks() {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>{t("howItWorks.heading")}</Text>
      {STEPS.map((step) => (
        <View key={step.titleKey} style={styles.card}>
          <Text style={styles.icon}>{step.icon}</Text>
          <Text style={styles.cardTitle}>{t(step.titleKey)}</Text>
          <Text style={styles.cardText}>{t(step.textKey)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    width: "100%",
    paddingVertical: 48,
    paddingHorizontal: 20,
    backgroundColor: "#2a1f26",
  },
  heading: {
    textAlign: "center",
    color: "#fff",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 24,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
    marginBottom: 10,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  cardText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
});
