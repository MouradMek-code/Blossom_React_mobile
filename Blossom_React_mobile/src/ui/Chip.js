import { Pressable, Text, View, StyleSheet } from "react-native";
import Icon from "./Icon";
import { tap } from "./haptics";
import { colors, radius } from "../theme";

// A rounded pill: a choice to pick (pass onPress / selected), or a label.
export default function Chip({ label, icon, selected = false, tone, onPress, style }) {
  const color = tone === "danger" && selected ? colors.danger : selected ? colors.primary : colors.text;
  const body = (
    <View style={styles.row}>
      {icon ? <Icon name={icon} size={15} color={color} /> : null}
      <Text style={[styles.text, { color }, selected && styles.textOn]} maxFontSizeMultiplier={1.4}>{label}</Text>
    </View>
  );
  if (!onPress) return <View style={[styles.chip, style]}>{body}</View>;
  return (
    <Pressable
      onPress={() => {
        tap();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        selected && (tone === "danger" ? styles.onDanger : styles.on),
        pressed && styles.pressed,
        style,
      ]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  text: { fontSize: 14, fontWeight: "600" },
  textOn: { fontWeight: "800" },
  on: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  onDanger: { borderColor: colors.danger, backgroundColor: "#FDECEA" },
  pressed: { opacity: 0.8 },
});
