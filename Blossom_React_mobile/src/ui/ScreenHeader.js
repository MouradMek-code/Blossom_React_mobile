import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import Icon from "./Icon";
import { colors, spacing, typography } from "../theme";

// The bar at the top of every screen opened on top of the tabs: back arrow,
// title, and an optional action on the right. `onBack` replaces "go back".
export default function ScreenHeader({ title, onBack, right }) {
  const navigation = useNavigation();
  const { t } = useTranslation();
  function back() {
    if (onBack) onBack();
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.reset({ index: 0, routes: [{ name: "Main" }] });
  }
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={back}
        hitSlop={10}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={t("settings.back")}
      >
        <Icon name="arrow-left" size={22} />
      </Pressable>
      <Text style={styles.title} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 56,
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pressed: { backgroundColor: colors.primaryTint },
  title: { ...typography.h3, fontSize: 18, flex: 1 },
  right: { marginLeft: "auto", paddingRight: spacing.xs },
});
