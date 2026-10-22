// Themed rows on the date spots page, Netflix-style ("☕ Cozy cafés for a
// first date"...), built from each spot's category, "best for" tags and price
// (same file on the website). The gifts have their own section above them.
export const COLLECTIONS = [
  { key: "cafes", emoji: "☕", test: (s) => s.category === "Coffee" },
  { key: "firstDate", emoji: "💞", test: (s) => (s.best_for || []).includes("First date") },
  { key: "drinks", emoji: "🍷", test: (s) => s.category === "Drinks / Bar" },
  { key: "outdoors", emoji: "🌅", test: (s) => ["Walk / Outdoors", "Hiking / Nature", "Beach"].includes(s.category) },
  { key: "restaurants", emoji: "🍽️", test: (s) => s.category === "Restaurant" },
  { key: "romantic", emoji: "🌹", test: (s) => (s.best_for || []).includes("Romantic") },
  { key: "culture", emoji: "🎨", test: (s) => ["Museum / Art Gallery", "Concert / Live Music", "Movie"].includes(s.category) },
  { key: "fun", emoji: "🎳", test: (s) => ["Bowling", "Mini Golf", "Arcade / Gaming"].includes(s.category) },
  { key: "free", emoji: "💸", test: (s) => s.price === "Free" },
];

// A row needs a few places to be worth showing.
export const MIN_IN_COLLECTION = 3;
const MAX_ROWS = 6;
const MAX_IN_ROW = 12;

// The rows that have enough places, each in the page's order (`spots` is
// already ordered: newest first, then random). Spots with a photo first: a
// row of colour blocks doesn't make anyone want to go.
export function buildCollections(spots) {
  return COLLECTIONS.map((c) => {
    const found = spots.filter(c.test);
    const withPhoto = [...found.filter((s) => s.image_url), ...found.filter((s) => !s.image_url)];
    return { key: c.key, emoji: c.emoji, spots: withPhoto.slice(0, MAX_IN_ROW) };
  })
    .filter((c) => c.spots.length >= MIN_IN_COLLECTION)
    .slice(0, MAX_ROWS);
}

// "♥ 3 · 📅 2 · 💞 5": only what's above zero.
export function proofParts(spot) {
  return [
    ["♥", "proofSaved", spot?.save_count || 0],
    ["📅", "proofEvents", spot?.events_count || 0],
    ["💞", "proofCouples", spot?.couples_count || 0],
  ].filter(([, , count]) => count > 0);
}
