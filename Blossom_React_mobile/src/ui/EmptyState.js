import { View, Text, StyleSheet } from "react-native";
import Icon from "./Icon";
import Button from "./Button";
import { colors, spacing } from "../theme";

// What a list shows when there's nothing in it yet: an icon in a soft circle,
// a title, a line of help, and what to do next.
export default function EmptyState({ icon = "inbox", title, text, actionTitle, onAction, actionIcon, style }) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.circle}>
        <Icon name={icon} size={34} color={colors.primary} />
      </View>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} icon={actionIcon} onPress={onAction} style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primarySoft,
    marginBottom: spacing.sm,
  },
  title: { fontSize: 19, fontWeight: "800", color: colors.text, textAlign: "center" },
  text: { fontSize: 14.5, lineHeight: 21, color: colors.textMuted, textAlign: "center", maxWidth: 300 },
  action: { marginTop: spacing.md },
});
