import { BASE_URL } from "./config";

// The public date spots (no login needed), fetched once and shared: the home
// screen's spots wallpaper and its gifts section both use them. A failed
// fetch is retried the next time it's asked for.
let pending = null;

export function loadPublicSpots() {
  if (!pending) {
    pending = fetch(`${BASE_URL}/date_spots`)
      .then((resp) => (resp.ok ? resp.json() : []))
      .then((spots) => (Array.isArray(spots) ? spots : []))
      .catch(() => {
        pending = null;
        return [];
      });
  }
  return pending;
}

// "Spot of the week" (picked by an admin, or the most saved this week), or
// null. Fetched once, like the list.
let pendingFeatured = null;

export function loadFeaturedSpot() {
  if (!pendingFeatured) {
    pendingFeatured = fetch(`${BASE_URL}/date_spots/featured`)
      .then((resp) => (resp.ok ? resp.json() : null))
      .then((data) => data?.spot || null)
      .catch(() => {
        pendingFeatured = null;
        return null;
      });
  }
  return pendingFeatured;
}
