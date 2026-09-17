import AsyncStorage from "@react-native-async-storage/async-storage";
import { BASE_URL } from "./config";
import { clearSession, getToken, setToken } from "./storage";

// People stay logged in until they tap Logout.
//
// A session lasts a year on the backend, and whenever the app is opened (at
// most once a day) it's swapped for a fresh one, so anyone who uses the app
// is never logged out. The only other way out is the server saying the
// session is no longer valid (401): password reset, deleted account, or an
// old 15-minute session from before this update.

const REFRESHED_AT_KEY = "token_refreshed_at";
const REFRESH_EVERY_MS = 24 * 60 * 60 * 1000;
let refreshing = false;

export async function refreshSessionIfNeeded() {
  if (refreshing) return;
  const token = await getToken();
  if (!token || token === "null") return;
  const last = Number(await AsyncStorage.getItem(REFRESHED_AT_KEY)) || 0;
  if (Date.now() - last < REFRESH_EVERY_MS) return;

  refreshing = true;
  try {
    const resp = await fetch(`${BASE_URL}/refresh_token`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (resp.status === 401) {
      await clearSession();
      return;
    }
    // Server hiccup (or a backend without /refresh_token yet): keep the
    // session and try again next time.
    if (!resp.ok) return;
    const data = await resp.json();
    // Don't overwrite a session that changed meanwhile (logout / new login).
    if (data?.access_token && (await getToken()) === token) {
      await setToken(data.access_token);
      await AsyncStorage.setItem(REFRESHED_AT_KEY, String(Date.now()));
    }
  } catch {
    // Offline: keep the session.
  } finally {
    refreshing = false;
  }
}

// For screens: call only when the server answered 401. Network errors and
// other failures must never log anyone out - show a retry instead.
export async function endSessionAndGoToLogin(navigation) {
  await clearSession();
  navigation.navigate("Login");
}
