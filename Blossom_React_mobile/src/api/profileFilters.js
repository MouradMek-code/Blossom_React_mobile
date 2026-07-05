export function getDefaultFilters(ownProfile) {
  if (!ownProfile || ownProfile.sexual_orientation !== "Straight") return {};
  if (ownProfile.gender === "Man") return { gender: ["Woman"] };
  if (ownProfile.gender === "Woman") return { gender: ["Man"] };
  return {};
}

export function matchesFilters(profile, filters) {
  return Object.entries(filters).every(([field, value]) => {
    const selected = Array.isArray(value) ? value : [value];
    if (selected.length === 0) return true;

    if (field === "language_name") {
      const profileLanguages = (profile.languages || []).map((l) => l.language_name || l);
      return selected.some((lang) => profileLanguages.includes(lang));
    }

    if (field === "learning_language_name") {
      const profileLearning = (profile.learning_languages || []).map((l) => l.language_name || l);
      return selected.some((lang) => profileLearning.includes(lang));
    }

    return selected.includes(profile[field]);
  });
}
