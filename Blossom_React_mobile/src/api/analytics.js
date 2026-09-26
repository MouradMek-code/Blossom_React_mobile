import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "./config";
import { getToken } from "./storage";
import i18n from "../i18n";

// Visits for the admin dashboard. The phone keeps a random id (no personal
// data) so a visitor without a profile can be told apart from another; the
// server decides what counts (admins never, a member once, others per visit).
const DEVICE_KEY = "@blossom_device_id";

let cachedId = null;

function randomId() {
  const part = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${part()}${part()}`;
}

async function deviceId() {
  if (cachedId) return cachedId;
  try {
    cachedId = await AsyncStorage.getItem(DEVICE_KEY);
    if (!cachedId) {
      cachedId = randomId();
      await AsyncStorage.setItem(DEVICE_KEY, cachedId);
    }
  } catch {
    cachedId = cachedId || randomId();
  }
  return cachedId;
}

function timezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

// entry: the screen the visit starts on. Never throws.
export async function trackVisit(entry) {
  try {
    const token = await getToken();
    const headers = { "Content-Type": "application/json" };
    if (token && token !== "null") headers.Authorization = `Bearer ${token}`;
    await fetch(`${BASE_URL}/analytics/visit`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        device_id: await deviceId(),
        platform: "app",
        entry: entry || null,
        language: (i18n.language || "").slice(0, 2) || null,
        timezone: timezone(),
      }),
    });
  } catch {
    // Offline: this visit just isn't counted.
  }
}
