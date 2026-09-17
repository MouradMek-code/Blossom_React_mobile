import { useCallback, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, FlatList, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  GEONAMES_CREDIT,
  filterCountries,
  flagEmoji,
  fold,
  loadCountries,
  searchCities,
  tidyCity,
} from "../api/geo";
import { deliverLocationPick } from "../api/locationPicker";
import { colors, radius, spacing, typography } from "../theme";

// Full-screen search list for choosing a country or a city. A screen rather
// than a <Modal>: lists inside a Modal don't scroll reliably on Android, and
// here the results sit right under the search box, clear of the keyboard.
//
// params: { mode: "country" | "city", countryCode, countryName, current }
export default function LocationPickerScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { mode = "country", countryCode, countryName, current } = useRoute().params || {};
  const [query, setQuery] = useState("");
  const [countries, setCountries] = useState(null);
  const [cities, setCities] = useState(null);
  const [loadError, setLoadError] = useState(false);

  const fetchCountries = useCallback(() => {
    setLoadError(false);
    loadCountries()
      .then(setCountries)
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (mode === "country") fetchCountries();
  }, [mode, fetchCountries]);

  // City suggestions - debounced, with stale requests cancelled.
  useEffect(() => {
    if (mode !== "city" || !countryCode) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        searchCities(countryCode, query, controller.signal)
          .then((names) => {
            setCities(names);
            setLoadError(false);
          })
          .catch((err) => {
            if (err?.name !== "AbortError") setLoadError(true);
          });
      },
      query ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mode, countryCode, query]);

  function pick(value) {
    deliverLocationPick(value);
    navigation.goBack();
  }

  let items;
  let loading;
  if (mode === "country") {
    loading = countries === null && !loadError;
    items = filterCountries(countries, query).map((c) => ({
      key: c.code,
      label: `${flagEmoji(c.code)}  ${c.name}`,
      selected: fold(c.name) === fold(current),
      onPress: () => pick(c),
    }));
  } else {
    loading = cities === null && !loadError;
    const typed = query.trim();
    const names = cities || [];
    items = names.map((name) => ({
      key: name,
      label: `📍  ${name}`,
      selected: fold(name) === fold(current),
      onPress: () => pick(name),
    }));
    // A town that isn't listed can still be used as typed - offered last, so
    // a half-typed name isn't the first thing under the finger.
    if (typed && cities !== null && !names.some((name) => fold(name) === fold(typed))) {
      items.push({
        key: "__typed",
        label: `✏️  ${t("location.useTyped", { name: tidyCity(typed) })}`,
        typed: true,
        onPress: () => pick(tidyCity(typed)),
      });
    }
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("location.cancel")}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {mode === "country" ? t("location.chooseCountry") : t("location.chooseCity")}
          </Text>
          {mode === "city" && countryName ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {flagEmoji(countryCode)} {countryName}
            </Text>
          ) : null}
        </View>
      </View>

      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder={mode === "country" ? t("location.searchCountry") : t("location.searchCity")}
        placeholderTextColor={colors.textMuted}
        autoFocus
        autoCorrect={false}
        autoCapitalize="words"
        maxLength={50}
        returnKeyType="search"
      />

      {loadError ? (
        <View style={styles.message}>
          <Text style={styles.messageText}>{t("location.loadError")}</Text>
          {mode === "country" ? (
            <Pressable style={styles.retry} onPress={fetchCountries}>
              <Text style={styles.retryText}>{t("location.retry")}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.xl }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.key}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + spacing.lg }}
          ListEmptyComponent={<Text style={styles.empty}>{t("location.noResults")}</Text>}
          ListFooterComponent={
            mode === "city" ? (
              <View style={styles.footer}>
                <Text style={styles.footerText}>{t("location.notListed")}</Text>
                <Text style={styles.credit}>{GEONAMES_CREDIT}</Text>
              </View>
            ) : (
              <Text style={[styles.credit, styles.footer]}>{GEONAMES_CREDIT}</Text>
            )
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={item.onPress}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            >
              <Text
                style={[styles.rowText, item.typed && styles.rowTextTyped, item.selected && styles.rowTextSelected]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.selected ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: colors.text },
  headerText: { flex: 1 },
  title: { ...typography.h2, fontSize: 21 },
  subtitle: { color: colors.textMuted, fontSize: 13.5, marginTop: 1 },
  search: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    fontSize: 16,
    color: colors.text,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.primaryTint },
  rowText: { flex: 1, fontSize: 16, color: colors.text },
  rowTextTyped: { color: colors.primary, fontWeight: "600" },
  rowTextSelected: { color: colors.primary, fontWeight: "700" },
  check: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  empty: { textAlign: "center", color: colors.textMuted, marginTop: spacing.lg },
  message: { alignItems: "center", padding: spacing.lg },
  messageText: { textAlign: "center", color: colors.textMuted, lineHeight: 21 },
  retry: {
    marginTop: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  footer: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 6 },
  footerText: { color: colors.textMuted, fontSize: 13 },
  credit: { color: colors.textMuted, fontSize: 11 },
});
