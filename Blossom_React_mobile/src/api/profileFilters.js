function ageInRange(age, bucket) {
  if (age === undefined || age === null) return false;
  const num = Number(age);
  if (bucket.endsWith("+")) {
    return num >= Number(bucket.replace("+", ""));
  }
  const [min, max] = bucket.split("-").map(Number);
  return num >= min && num <= max;
}

export function matchesFilters(profile, filters) {
  return Object.entries(filters).every(([field, value]) => {
    if (field === "language_name") {
      const selected = value;
      if (selected.length === 0) return true;
      const profileLanguages = (profile.languages || []).map((l) => l.language_name || l);
      return selected.some((lang) => profileLanguages.includes(lang));
    }

    if (field === "age") {
      return ageInRange(profile.age, value);
    }

    if (field === "height_cm") {
      const target = Number(String(value).replace(" cm", ""));
      return Number(profile.height_cm) === target;
    }

    return profile[field] === value;
  });
}
