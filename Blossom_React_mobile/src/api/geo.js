import { BASE_URL } from "./config";

// Country and city lists for the location picker (backend: routers/geo.py,
// data from GeoNames). People pick where they live instead of sharing GPS.

export const GEONAMES_CREDIT = "City data © GeoNames (CC BY 4.0)";

// The country list never changes during a session - fetch it once.
let countriesPromise = null;

export function loadCountries() {
  if (!countriesPromise) {
    countriesPromise = fetch(`${BASE_URL}/geo/countries`)
      .then((resp) => {
        if (!resp.ok) throw new Error(`countries ${resp.status}`);
        return resp.json();
      })
      .catch((err) => {
        countriesPromise = null; // let the next attempt retry
        throw err;
      });
  }
  return countriesPromise;
}

// Biggest cities first; with an empty query, the country's biggest cities.
export async function searchCities(countryCode, query, signal) {
  const params = `country=${encodeURIComponent(countryCode)}&q=${encodeURIComponent(query || "")}&limit=20`;
  const resp = await fetch(`${BASE_URL}/geo/cities?${params}`, { signal });
  if (!resp.ok) throw new Error(`cities ${resp.status}`);
  return resp.json();
}

// "FR" -> 🇫🇷
export function flagEmoji(code) {
  if (!code || code.length !== 2) return "🏳️";
  const base = 0x1f1e6 - 65; // regional indicator "A" minus "A"
  return String.fromCodePoint(...code.toUpperCase().split("").map((c) => base + c.charCodeAt(0)));
}

// Comparison key ignoring case, accents and punctuation, like the backend's:
// "São Paulo" -> "sao paulo". (normalize() is checked because not every JS
// engine is guaranteed to ship it.)
export function fold(text) {
  let s = String(text || "").toLowerCase();
  if (typeof s.normalize === "function") {
    s = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  return s.replace(/[\s\-'’.,()/]+/g, " ").trim();
}

// Countries matching a search: name starts with it, a later word does
// ("kingdom" -> United Kingdom), or it's the ISO code ("us").
export function filterCountries(countries, query) {
  const q = fold(query);
  if (!q) return countries || [];
  return (countries || []).filter((c) => {
    const name = fold(c.name);
    return name.startsWith(q) || name.includes(` ${q}`) || c.code.toLowerCase() === q;
  });
}

export function findCountryByName(countries, name) {
  const key = fold(name);
  return key ? (countries || []).find((c) => fold(c.name) === key) || null : null;
}

// Typed city names are stored as typed, but tidied: "  new   york" -> "New york".
export function tidyCity(value) {
  const s = String(value || "").replace(/\s+/g, " ").trim().slice(0, 50);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
