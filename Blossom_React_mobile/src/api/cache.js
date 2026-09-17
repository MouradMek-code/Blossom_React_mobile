import AsyncStorage from "@react-native-async-storage/async-storage";

// Last successful data per screen (Browse deck, matches, inbox, chats...), so
// a screen can show something instantly and refresh in the background
// instead of spinning while the server answers. Kept in memory for instant
// screen switches, and on disk so it survives closing the app.
// Cleared on logout (clearSession), so another account never sees it.

const PREFIX = "cache:";
const memory = new Map();

// Synchronous, memory only - for a screen's initial state.
export function peekCache(key) {
  return memory.has(key) ? memory.get(key) : null;
}

// Memory, then disk (after an app restart).
export async function readCache(key) {
  if (memory.has(key)) return memory.get(key);
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw == null) return null;
    const value = JSON.parse(raw);
    memory.set(key, value);
    return value;
  } catch {
    return null;
  }
}

export function writeCache(key, value) {
  memory.set(key, value);
  AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
}

export async function clearCache() {
  memory.clear();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch {
    // Nothing cached, or storage unavailable - fine either way.
  }
}
