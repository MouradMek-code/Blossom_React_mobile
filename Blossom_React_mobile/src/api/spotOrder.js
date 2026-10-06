// The order of the date spots list and its search by name (same file on the website).
import { seededShuffle } from "./shuffle";

const NEW_DAYS = 14;
const MAX_NEW = 6;
const DAY_MS = 24 * 3600 * 1000;

function addedAt(spot) {
  return Date.parse(spot?.created_at || "") || 0;
}

// Added in the last two weeks: shown on top, with a "New" badge.
export function isNewSpot(spot, now = Date.now()) {
  const added = addedAt(spot);
  return added > 0 && now - added < NEW_DAYS * DAY_MS;
}

// The newest spots on top (those of the last two weeks, at most 6 - or at
// least the latest one), then the others in random order. `seed` is picked
// once when the page opens: a new order on each visit, but nothing moves
// while someone is looking. Spots without a photo come last.
export function orderSpots(spots, seed, now = Date.now()) {
  const newest = [...spots].sort((a, b) => addedAt(b) - addedAt(a));
  let top = newest.filter((spot) => isNewSpot(spot, now)).slice(0, MAX_NEW);
  if (top.length === 0) top = newest.slice(0, 1);
  const topIds = new Set(top.map((spot) => spot.id));
  const others = seededShuffle(spots.filter((spot) => !topIds.has(spot.id)), seed);
  return [...top, ...others.filter((spot) => spot.image_url), ...others.filter((spot) => !spot.image_url)];
}

// "cafe flore" finds "Café de Flore": no accents, no case, every word.
function fold(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function matchesName(spot, query) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const name = fold(spot?.name);
  return words.every((word) => name.includes(word));
}
