import { Text, StyleSheet } from "react-native";

export default function Footer() {
  return <Text style={styles.footer}>copyright</Text>;
}

const styles = StyleSheet.create({
  footer: {
    textAlign: "center",
    padding: 12,
    color: "#888",
  },
});
