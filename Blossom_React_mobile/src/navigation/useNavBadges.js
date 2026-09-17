import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { BASE_URL } from "../api/config";
import { peekCache, writeCache } from "../api/cache";
import { clearSession, getToken } from "../api/storage";

const REFRESH_MS = 30000;

// Backends from before /user/badges: the old three requests.
async function legacyBadges(headers) {
  const [matched, liked, unread] = await Promise.all([
    fetch(`${BASE_URL}/matches/unseen_count`, { headers }).then((r) => (r.ok ? r.json() : {})),
    fetch(`${BASE_URL}/likes/profile_likes/unseen_count`, { headers }).then((r) => (r.ok ? r.json() : {})),
    fetch(`${BASE_URL}/messages/unread_count`, { headers }).then((r) => (r.ok ? r.json() : {})),
  ]);
  return { matches: matched.count, likes: liked.count, messages: unread.count };
}

// The red numbers on the tab bar - new likes, unread chats and new matches -
// in a single request, asked for in one place instead of by every screen.
// Starts from the numbers the last screen saw, so the bar never flickers.
export function useNavBadges() {
  const cached = peekCache("nav");
  const [badges, setBadges] = useState(() => ({
    likes: cached?.likes || 0,
    messages: cached?.messages || 0,
    matches: cached?.matches || 0,
  }));
  const loadingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const token = await getToken();
      if (!token || token === "null") return;
      const headers = { Authorization: `Bearer ${token}` };
      const resp = await fetch(`${BASE_URL}/user/badges`, { headers });
      if (resp.status === 401) {
        // The session itself is invalid; the screens send the user to login.
        await clearSession();
        return;
      }
      // An old backend reads "badges" as a user id (422) or doesn't know it.
      const nav = resp.ok ? await resp.json() : await legacyBadges(headers);
      writeCache("nav", nav);
      setBadges({
        likes: nav.likes || 0,
        messages: nav.messages || 0,
        matches: nav.matches || 0,
      });
    } catch {
      // Offline or a server hiccup: keep the last known numbers.
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Opening the tab that shows them counts as seen: drop the number now
  // rather than a refresh later, since the screen is telling the server too.
  const markSeen = useCallback((kind) => {
    setBadges((cur) => (cur[kind] ? { ...cur, [kind]: 0 } : cur));
    const nav = peekCache("nav");
    if (nav) writeCache("nav", { ...nav, [kind]: 0 });
  }, []);

  // Only while the tabs are the screen on display, plus whenever the app
  // comes back to the foreground.
  useFocusEffect(
    useCallback(() => {
      refresh();
      const interval = setInterval(refresh, REFRESH_MS);
      const sub = AppState.addEventListener("change", (state) => {
        if (state === "active") refresh();
      });
      return () => {
        clearInterval(interval);
        sub.remove();
      };
    }, [refresh]),
  );

  return { badges, refresh, markSeen };
}
