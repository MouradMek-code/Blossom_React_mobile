import { useEffect, useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { findCountryByName, flagEmoji, loadCountries } from "../api/geo";
import { openLocationPicker } from "../api/locationPicker";
import { colors, radius, spacing } from "../theme";

// Country + city fields, used at sign-up and on the profile, so people say
// where they live instead of sharing their GPS position. Each field opens
// LocationPickerScreen. `country` and `city` are the stored names; onChange
// receives both.
export default function LocationFields({ country, city, onChange }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [countries, setCountries] = useState(null);

  useEffect(() => {
    let alive = true;
    loadCountries()
      .then((list) => alive && setCountries(list))
      .catch(() => alive && setCountries([]));
    return () => {
      alive = false;
    };
  }, []);

  // Profiles from before the picker may hold a name that isn't in the list
  // (e.g. "Deutschland"); they just choose again.
  const selected = findCountryByName(countries, country);

  function chooseCountry() {
    openLocationPicker(navigation, { mode: "country", current: country }, (picked) => {
      onChange({ country: picked.name, city: picked.name === country ? city : "" });
    });
  }

  function chooseCity() {
    if (!selected) return;
    openLocationPicker(
      navigation,
      { mode: "city", countryCode: selected.code, countryName: selected.name, current: city },
      (picked) => onChange({ country, city: picked }),
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t("location.country")}</Text>
      <Pressable
        onPress={chooseCountry}
        style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
        accessibilityRole="button"
      >
        <Text style={[styles.value, !selected && styles.placeholder]} numberOfLines={1}>
          {selected ? `${flagEmoji(selected.code)}  ${selected.name}` : t("location.chooseCountry")}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <Text style={styles.label}>{t("location.city")}</Text>
      <Pressable
        onPress={chooseCity}
        disabled={!selected}
        style={({ pressed }) => [styles.field, !selected && styles.fieldDisabled, pressed && styles.fieldPressed]}
        accessibilityRole="button"
      >
        <Text style={[styles.value, !city && styles.placeholder]} numberOfLines={1}>
          {city || (selected ? t("location.chooseCity") : t("location.countryFirst"))}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  label: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  fieldPressed: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  fieldDisabled: { opacity: 0.55 },
  value: { flex: 1, fontSize: 16, color: colors.text },
  placeholder: { color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textMuted, marginLeft: spacing.sm },
});
