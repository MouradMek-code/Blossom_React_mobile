import { useMemo } from "react";
import { Modal, View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import questions from "../data/questions.json";
import { colors, radius, spacing, shadow, typography } from "../theme";

const FILTERABLE = questions.filter((q) => q.field !== "bio" && q.field !== "occupation");

export default function ProfileFilterModal({
  visible,
  filters,
  onChange,
  onApply,
  onClose,
  profiles = [],
}) {
  const locationSections = useMemo(() => {
    const countries = [...new Set(profiles.map((p) => p.country).filter(Boolean))].sort();
    const cities = [...new Set(profiles.map((p) => p.city).filter(Boolean))].sort();
    return [
      { field: "country", question: "Country", options: countries },
      { field: "city", question: "City", options: cities },
    ].filter((section) => section.options.length > 0);
  }, [profiles]);

  const allSections = [...locationSections, ...FILTERABLE];

  function toggleSingle(field, option) {
    onChange((prev) => {
      const next = { ...prev };
      if (next[field] === option) {
        delete next[field];
      } else {
        next[field] = option;
      }
      return next;
    });
  }

  function toggleMultiple(field, option) {
    onChange((prev) => {
      const current = prev[field] || [];
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option];
      const next = { ...prev };
      if (updated.length === 0) {
        delete next[field];
      } else {
        next[field] = updated;
      }
      return next;
    });
  }

  function resetFilters() {
    onChange({});
  }

  const activeCount = Object.keys(filters).length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>Filters</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {allSections.map((q) => (
            <View key={q.field} style={styles.section}>
              <Text style={styles.sectionTitle}>{q.question}</Text>
              <View style={styles.optionGrid}>
                {q.options.map((option) => {
                  const selected = q.multiple
                    ? (filters[q.field] || []).includes(option)
                    : filters[q.field] === option;
                  return (
                    <Pressable
                      key={option}
                      style={[styles.optionChip, selected && styles.optionChipSelected]}
                      onPress={() =>
                        q.multiple
                          ? toggleMultiple(q.field, option)
                          : toggleSingle(q.field, option)
                      }
                    >
                      <Text style={selected ? styles.optionTextSelected : styles.optionText}>
                        {option}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable style={styles.resetButton} onPress={resetFilters}>
            <Text style={styles.resetButtonText}>Reset {activeCount > 0 ? `(${activeCount})` : ""}</Text>
          </Pressable>
          <Pressable style={styles.applyButton} onPress={onApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 50,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { ...typography.h2 },
  closeText: { fontSize: 20, color: colors.textMuted },
  scroll: { padding: spacing.md },
  section: { marginBottom: spacing.lg },
  sectionTitle: { ...typography.h3, fontSize: 15, marginBottom: spacing.sm },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  optionChip: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm - 2,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: colors.surfaceMuted,
  },
  optionChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.sm,
  },
  optionText: { color: colors.text, fontSize: 13 },
  optionTextSelected: { color: "#fff", fontSize: 13, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    alignItems: "center",
  },
  resetButtonText: { color: colors.primary, fontWeight: "700" },
  applyButton: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md - 2,
    alignItems: "center",
    ...shadow.sm,
  },
  applyButtonText: { color: "#fff", fontWeight: "700" },
});
