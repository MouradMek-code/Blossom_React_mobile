import { useEffect } from "react";
import { AppState } from "react-native";
import * as Notifications from "expo-notifications";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { openNotificationTarget, registerForPushNotifications } from "../api/push";

// Session-wide state, kept outside React so remounts don't re-prompt.
let registeredFor = null; // auth token this phone was registered (or declined) for
let registering = false;
let lastAttempt = 0;
const handledResponses = new Set();

// Is this account ready for notifications? A finished profile - not during
// sign-up, so the permission prompt doesn't interrupt it - or an admin, who
// gets "new profile" notifications even without a dating profile.
async function readyForPush(authToken) {
  const headers = { Authorization: `Bearer ${authToken}` };
  const resp = await fetch(`${BASE_URL}/user/badges`, { headers });
  if (resp.ok) {
    const nav = await resp.json();
    return Boolean(nav.has_profile || nav.is_admin);
  }
  // Older backend without /user/badges.
  return (await fetch(`${BASE_URL}/profile`, { headers })).status === 200;
}

// Registers the phone once the account is ready (see above). Checked on
// start, on every screen change (covers logging in and finishing sign-up)
// and when the app returns to the foreground.
async function registerIfNeeded() {
  const authToken = await getToken();
  if (!authToken || authToken === "null") return;
  if (registeredFor === authToken || registering) return;
  if (Date.now() - lastAttempt < 15000) return;

  registering = true;
  lastAttempt = Date.now();
  try {
    if (!(await readyForPush(authToken))) return; // still signing up
    await registerForPushNotifications(authToken);
    // Registered, or the user said no: either way, don't ask again this session.
    registeredFor = authToken;
  } catch {
    // Offline or a Firebase hiccup - the throttle lets a later check retry.
  } finally {
    registering = false;
  }
}

// Mounted once at the app root, outside the screens.
export default function PushNotifications({ navigationRef, navReady }) {
  // Notifications arriving while the app is open still show - except a new
  // message for the chat you're already looking at.
  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data || {};
        const route = navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
        const readingThatChat =
          data.type === "message" &&
          route?.name === "Chat" &&
          Number(route.params?.conversationId) === Number(data.conversationId);
        const show = !readingThatChat;
        return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: false };
      },
    });
  }, [navigationRef]);

  useEffect(() => {
    if (!navReady) return undefined;
    registerIfNeeded();
    const unsubscribeNav = navigationRef.addListener("state", registerIfNeeded);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") registerIfNeeded();
    });
    return () => {
      unsubscribeNav();
      appStateSub.remove();
    };
  }, [navReady, navigationRef]);

  // Tapping a notification - including the one that launched the app - opens
  // the chat / Messages / Likes You.
  const lastResponse = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!navReady || !lastResponse) return;
    if (lastResponse.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id = lastResponse.notification.request.identifier;
    if (handledResponses.has(id)) return;
    handledResponses.add(id);
    openNotificationTarget(navigationRef, lastResponse.notification.request.content.data || {});
    if (typeof Notifications.clearLastNotificationResponseAsync === "function") {
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
    }
  }, [navReady, lastResponse, navigationRef]);

  return null;
}
