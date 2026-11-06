import { View, StyleSheet } from "react-native";
import { colors, radius, spacing, shadow } from "../theme";

// The white rounded box used for every section. `tone="danger"` for the
// irreversible ones, `tone="info"` for the blue (verification) ones.
export default function Card({ children, tone, style }) {
  return <View style={[styles.card, tone && styles[tone], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.sm,
  },
  danger: { borderWidth: 1.5, borderColor: "#F3B7B0" },
  info: { borderWidth: 1.5, borderColor: "#BFD6FA", backgroundColor: "#F5F9FF" },
});
