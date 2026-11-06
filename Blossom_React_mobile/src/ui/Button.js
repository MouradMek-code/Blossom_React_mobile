import { Pressable, Text, ActivityIndicator, View, StyleSheet } from "react-native";
import Icon from "./Icon";
import { colors, radius } from "../theme";

const VARIANTS = {
  primary: { bg: colors.primary, border: colors.primary, text: "#fff" },
  secondary: { bg: colors.surface, border: colors.primary, text: colors.primary },
  quiet: { bg: colors.surface, border: colors.borderStrong, text: colors.textSoft },
  danger: { bg: colors.surface, border: colors.danger, text: colors.danger },
  dangerSolid: { bg: colors.danger, border: colors.danger, text: "#fff" },
  // The blue of the ✓ verified badge.
  info: { bg: "#2F80ED", border: "#2F80ED", text: "#fff" },
  ghost: { bg: "transparent", border: "transparent", text: colors.textSoft },
};

// The one button: primary (filled rose), secondary (rose outline), quiet
// (grey outline), danger / dangerSolid, info (verification blue), ghost
// (text only). Always at least 44 px tall, so it's easy to tap; `small` for
// rows of actions.
export default function Button({
  title,
  onPress,
  variant = "primary",
  icon,
  loading = false,
  disabled = false,
  small = false,
  full = false,
  style,
  accessibilityLabel,
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: loading }}
      accessibilityLabel={accessibilityLabel || title}
      hitSlop={small ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : styles.normal,
        full && styles.full,
        { backgroundColor: v.bg, borderColor: v.border },
        disabled && !loading && styles.disabled,
        pressed && !off && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={small ? 15 : 18} color={v.text} /> : null}
          {title ? (
            <Text style={[styles.text, small && styles.textSmall, { color: v.text }]} numberOfLines={2} maxFontSizeMultiplier={1.4}>
              {title}
            </Text>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1.5,
  },
  normal: { minHeight: 48, paddingHorizontal: 22, paddingVertical: 12 },
  small: { minHeight: 36, paddingHorizontal: 14, paddingVertical: 7 },
  full: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  text: { fontSize: 15.5, fontWeight: "800", textAlign: "center" },
  textSmall: { fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8, transform: [{ scale: 0.98 }] },
});
