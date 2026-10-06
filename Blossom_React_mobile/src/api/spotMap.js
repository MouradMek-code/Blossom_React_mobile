// The date spots map (same file on the website): OpenStreetMap's free map, one
// pin per spot that has a position (see the server's db_spot_geo.py).
import { categoryEmoji } from "./categories";

export const TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>';

// Where the map opens when no spot has a position yet: Europe.
export const DEFAULT_VIEW = { lat: 47, lng: 6, zoom: 4 };

// What the map needs about each spot. 🎁 for the ones with a gift, else the
// category's emoji.
export function mapPoints(spots) {
  return spots
    .filter((spot) => typeof spot.lat === "number" && typeof spot.lng === "number")
    .map((spot) => ({
      id: spot.id,
      lat: spot.lat,
      lng: spot.lng,
      name: spot.name,
      gift: Boolean(spot.offer),
      emoji: spot.offer ? "🎁" : categoryEmoji(spot.category),
    }));
}

// Changes only when the pins change - not when the page redraws for
// something else (opening a spot), so the map keeps its zoom.
export function pointsKey(points) {
  return points.map((p) => `${p.id}:${p.lat}:${p.lng}:${p.gift ? 1 : 0}`).sort().join("|");
}
