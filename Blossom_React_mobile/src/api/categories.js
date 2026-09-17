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

// What kind of date a place suits. A spot can have several.
export const BEST_FOR = ["First date", "Romantic", "Casual", "Adventurous"];

const BEST_FOR_EMOJI = {
  "First date": "💕",
  "Romantic": "🌹",
  "Casual": "😊",
  "Adventurous": "🧗",
};

const BEST_FOR_SLUG = {
  "First date": "firstDate",
  "Romantic": "romantic",
  "Casual": "casual",
  "Adventurous": "adventurous",
};

// "💕 First date" - emoji + translated name.
export function bestForLabel(value, t) {
  const slug = BEST_FOR_SLUG[value];
  const name = slug && t ? t(`dateSpots.bestForOptions.${slug}`, { defaultValue: value }) : value;
  return `${BEST_FOR_EMOJI[value] || "✨"} ${name}`;
}

// Backdrop colours for spots without a photo, tinted by vibe, so a page of
// photo-less starter spots still looks deliberate rather than broken. All are
// dark enough for white text.
const GRADIENT = {
  "Coffee": ["#6F4630", "#B98457"],
  "Restaurant": ["#8A3326", "#CF7550"],
  "Drinks / Bar": ["#4F2449", "#A8497A"],
  "Walk / Outdoors": ["#2A5E46", "#6FA56E"],
  "Hiking / Nature": ["#33512F", "#86AC66"],
  "Bowling": ["#27406F", "#5E80C2"],
  "Mini Golf": ["#2F6A4E", "#79B981"],
  "Arcade / Gaming": ["#33255F", "#7A52BE"],
  "Movie": ["#2A2130", "#7E3549"],
  "Museum / Art Gallery": ["#2E4262", "#8C77A6"],
  "Beach": ["#1C6480", "#C9A06A"],
  "Concert / Live Music": ["#431C48", "#B03F63"],
};

export function categoryGradient(category) {
  return GRADIENT[category] || ["#7E2A44", "#C1466B"];
}

// "Châtelet, Paris" when a neighborhood is set, otherwise "Paris, France".
export function shortPlace(spot) {
  if (!spot) return "";
  return spot.neighborhood
    ? `${spot.neighborhood}, ${spot.city}`
    : `${spot.city}, ${spot.country}`;
}

// "Châtelet, Paris, France"
export function fullPlace(spot) {
  if (!spot) return "";
  return [spot.neighborhood, spot.city, spot.country].filter(Boolean).join(", ");
}
