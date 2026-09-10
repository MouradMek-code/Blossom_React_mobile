// Vibe tags for date spots. Mirrors the backend's CATEGORIES list, which is
// itself the place-shaped subset of a profile's first_date_preference options
// so a spot's tag and a person's preference stay directly comparable.
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

export function categoryEmoji(category) {
  return EMOJI[category] || "📍";
}

export function categoryLabel(category) {
  if (!category) return "";
  return `${categoryEmoji(category)} ${category}`;
}
