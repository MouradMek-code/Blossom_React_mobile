import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";

// Screens (by `key`) whose next visit must refresh at once, however recent
// their data - e.g. Browse after changing what you're on Blossom for.
const staleKeys = new Set();

export function invalidate(key) {
  staleKeys.add(key);
}

// Keeps what a screen shows up to date without anyone asking for it.
//
// Tab screens stay alive for the whole session, so loading "when the screen
// opens" happens once and never again. This calls `refresh`:
//  - when the screen first appears (unless `skipFirst`: the screen already
//    loads on its own when it opens),
//  - when the user comes back to it - another tab, a chat - and the data is
//    older than `minIntervalMs`,
//  - when the phone brings the app back from the background while the screen
//    is on display, under the same condition.
export function useAutoRefresh(refresh, { minIntervalMs = 30000, skipFirst = false, key } = {}) {
  const lastRun = useRef(skipFirst ? Date.now() : 0);
  const latest = useRef(refresh);
  latest.current = refresh;
  const isFocused = useIsFocused();

  const runIfStale = useCallback(() => {
    const forced = key ? staleKeys.delete(key) : false;
    if (!forced && Date.now() - lastRun.current < minIntervalMs) return;
    lastRun.current = Date.now();
    latest.current();
  }, [minIntervalMs, key]);

  useFocusEffect(
    useCallback(() => {
      runIfStale();
    }, [runIfStale]),
  );

  useEffect(() => {
    if (!isFocused) return undefined;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") runIfStale();
    });
    return () => sub.remove();
  }, [isFocused, runIfStale]);
}
