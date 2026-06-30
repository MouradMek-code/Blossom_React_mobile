function ageInRange(age, bucket) {
  if (age === undefined || age === null) return false;
  const num = Number(age);
  if (bucket.endsWith("+")) {
    return num >= Number(bucket.replace("+", ""));
  }
  const [min, max] = bucket.split("-").map(Number);
  return num >= min && num <= max;
}

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

    if (field === "age") {
      return selected.some((bucket) => ageInRange(profile.age, bucket));
    }

    return selected.includes(profile[field]);
  });
}
