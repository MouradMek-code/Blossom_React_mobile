// Vibe tags for date spots. Mirrors the backend's CATEGORIES list, which is
// itself the place-shaped subset of a profile's first_date_preference options
// so a spot's tag and a person's preference stay directly comparable.
//
// IMPORTANT: these English strings are the canonical values - they're what gets
// stored and what the backend validates against. Only the *label* is
// translated, via the slug below. Never send a translated string to the API.
export const CATEGORIES = [
  "Coffee",
  "Restaurant",
  "Drinks / Bar",
  "Walk / Outdoors",
  "Hiking / Nature",
  "Bowling",
  "Mini Golf",
  "Arcade / Gaming",
  "Movie",
  "Museum / Art Gallery",
  "Beach",
  "Concert / Live Music",
];

const EMOJI = {
  "Coffee": "☕",
  "Restaurant": "🍽️",
  "Drinks / Bar": "🍸",
  "Walk / Outdoors": "🌳",
  "Hiking / Nature": "🥾",
  "Bowling": "🎳",
  "Mini Golf": "⛳",
  "Arcade / Gaming": "🕹️",
  "Movie": "🎬",
  "Museum / Art Gallery": "🖼️",
  "Beach": "🏖️",
  "Concert / Live Music": "🎵",
};

// i18n keys can't contain "/" or spaces, so map each canonical value to a slug.
const SLUG = {
  "Coffee": "coffee",
  "Restaurant": "restaurant",
  "Drinks / Bar": "drinks",
  "Walk / Outdoors": "outdoors",
  "Hiking / Nature": "hiking",
  "Bowling": "bowling",
  "Mini Golf": "minigolf",
  "Arcade / Gaming": "arcade",
  "Movie": "movie",
  "Museum / Art Gallery": "museum",
  "Beach": "beach",
  "Concert / Live Music": "concert",
};

export function categoryEmoji(category) {
  return EMOJI[category] || "📍";
}

// Translated display name. Falls back to the raw value so a category added on
// the backend before the locales catch up still renders something sensible.
export function categoryName(category, t) {
  const slug = SLUG[category];
  if (!slug || !t) return category;
  return t(`dateSpots.categories.${slug}`, { defaultValue: category });
}

// "☕ Café" - emoji + translated name, for chips and tags.
export function categoryLabel(category, t) {
  if (!category) return "";
  return `${categoryEmoji(category)} ${categoryName(category, t)}`;
}
