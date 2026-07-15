// Suggest a sensible default gender filter based on the user's own gender and
// sexual orientation. Users can always change it in the filter modal.
export function getDefaultFilters(ownProfile) {
  if (!ownProfile) return {};

  const isMan = ownProfile.gender === "Man";
  const isWoman = ownProfile.gender === "Woman";
  const orientation = ownProfile.sexual_orientation;

  // Attracted to the opposite gender.
  if (orientation === "Straight") {
    if (isMan) return { gender: ["Woman"] };
    if (isWoman) return { gender: ["Man"] };
    return {};
  }

  // Attracted to the same gender.
  if (orientation === "Gay") {
    if (isMan) return { gender: ["Man"] };
    if (isWoman) return { gender: ["Woman"] };
    return {};
  }
  if (orientation === "Lesbian") {
    return { gender: ["Woman"] };
  }

  // Bisexual / Pansexual / Queer / anything else: no default filter, so they
  // browse everyone and can narrow it down themselves.
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
