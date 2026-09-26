import { useEffect } from "react";
import { AppState } from "react-native";
import { peekToken } from "../api/storage";
import { trackVisit } from "../api/analytics";

// The server ends a visit after 30 minutes without activity; checking in a
// bit sooner keeps a long visit as one.
const KEEP_ALIVE_MS = 25 * 60 * 1000;

let lastSentAt = 0;
let lastToken;

function routeName(navigationRef) {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;
}

// Tells the server about visits for the admin dashboard: when the app opens,
// comes back after a while, or someone logs in (so that visit counts as
// theirs). Mounted once at the app root.
export default function VisitTracker({ navigationRef, navReady }) {
  useEffect(() => {
    if (!navReady) return undefined;

    function check() {
      const token = peekToken();
      const loggedIn = token && token !== "null" && token !== lastToken;
      const due = Date.now() - lastSentAt > KEEP_ALIVE_MS;
      lastToken = token;
      if (!loggedIn && !due) return;
      lastSentAt = Date.now();
      trackVisit(routeName(navigationRef));
    }

    check();
    const unsubscribeNav = navigationRef.addListener("state", check);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => {
      unsubscribeNav();
      appStateSub.remove();
    };
  }, [navReady, navigationRef]);

  return null;
}
