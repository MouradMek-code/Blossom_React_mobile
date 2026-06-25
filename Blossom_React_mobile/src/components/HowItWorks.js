import { View, Text, StyleSheet } from "react-native";

const STEPS = [
  {
    icon: "🌹",
    title: "Build your profile",
    text: "Tell us who you are, what you're into, and what you're looking for.",
  },
  {
    icon: "💘",
    title: "Match with intent",
    text: "Browse profiles and like the ones who share your vibe - no endless swiping.",
  },
  {
    icon: "📅",
    title: "Plan a real date",
    text: "Matched? Chat for a bit, then take it offline - that's the whole point.",
  },
];

export default function HowItWorks() {
  return (
    <View style={styles.section}>
      <Text style={styles.heading}>How Blossom works</Text>
      {STEPS.map((step) => (
        <View key={step.title} style={styles.card}>
          <Text style={styles.icon}>{step.icon}</Text>
          <Text style={styles.cardTitle}>{step.title}</Text>
          <Text style={styles.cardText}>{step.text}</Text>
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
