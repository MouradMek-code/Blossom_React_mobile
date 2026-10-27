import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { BASE_URL } from "./config";
import { getToken } from "./storage";

// The profile's city follows the phone: with the member's permission, the
// app reads its approximate location (never the exact position), asks the
// phone's own map service which city and country that is, and tells the
// server. Blossom's server decides: it updates the profile - or, in a
// country Blossom isn't open to, removes the account.
const SETTING_KEY = "blossom_auto_location"; // "on" | "off" | null = never asked
const EVERY_MS = 3 * 3600 * 1000; // at most every 3 hours
let lastRun = 0;

export async function getAutoLocation() {
  try {
    return await AsyncStorage.getItem(SETTING_KEY);
  } catch {
    return null;
  }
}

export async function setAutoLocation(on) {
  await AsyncStorage.setItem(SETTING_KEY, on ? "on" : "off").catch(() => {});
}

// Asks the phone for permission (the system's own window). True if granted.
export async function askPermission() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === "granted";
  } catch {
    return false;
  }
}

// { removed, updated, city, country } from the server, or null when nothing
// could be checked (no permission, no position, offline...). `force` skips
// the "every 3 hours" rule (e.g. right after the member turned it on).
export async function syncLocation({ force = false } = {}) {
  if (!force && Date.now() - lastRun < EVERY_MS) return null;
  if ((await getAutoLocation()) !== "on") return null;
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== "granted") return null;
    lastRun = Date.now();
    const position =
      (await Location.getLastKnownPositionAsync({ maxAge: EVERY_MS })) ||
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    if (!position) return null;
    const [place] = await Location.reverseGeocodeAsync({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    if (!place?.isoCountryCode) return null;
    const token = await getToken();
    if (!token || token === "null") return null;
    const resp = await fetch(`${BASE_URL}/profile/location`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        country_code: place.isoCountryCode,
        city: place.city || place.subregion || place.region || null,
      }),
    });
    return resp.ok ? await resp.json() : null;
  } catch {
    return null; // never in the way: the city just stays as it was
  }
}
