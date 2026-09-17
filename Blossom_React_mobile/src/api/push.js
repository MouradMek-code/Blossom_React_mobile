import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { StackActions } from "@react-navigation/native";
import { BASE_URL, EAS_PROJECT_ID } from "./config";
import i18n from "../i18n";

// Phone notifications (new message, match, like). The backend sends them via
// Expo's push service, which delivers through Firebase; the app's part is to
// ask permission and tell the backend this phone's push token.

const PUSH_TOKEN_KEY = "push_token";

// Must match the channelId the backend sends with (database/db_push.py).
const CHANNEL_ID = "default";

// Returns the Expo push token once registered, or null if the user declined
// notifications. Throws on network/Firebase problems, so the caller can retry.
export async function registerForPushNotifications(authToken) {
  if (Platform.OS === "android") {
    // Android 8+ shows nothing without a channel; HIGH makes it pop down.
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "Messages & matches",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 200, 120, 200],
      lightColor: "#C1466B",
    });
  }

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    // Android 13+ shows the "Allow notifications?" dialog here.
    ({ status } = await Notifications.requestPermissionsAsync());
  }
  if (status !== "granted") return null;

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });

  const resp = await fetch(`${BASE_URL}/push/register`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token: pushToken, language: (i18n.language || "en").slice(0, 2) }),
  });
  if (!resp.ok) throw new Error(`push register ${resp.status}`);

  await AsyncStorage.setItem(PUSH_TOKEN_KEY, pushToken);
  return pushToken;
}

// On logout: stop this phone getting the account's notifications. Never
// throws - logging out must work even offline.
export async function unregisterPushNotifications(authToken) {
  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (pushToken && authToken && authToken !== "null") {
      await fetch(`${BASE_URL}/push/unregister`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: pushToken }),
      });
    }
  } catch {
    // Offline: the token just stays until the next login re-assigns it.
  }
  await AsyncStorage.removeItem(PUSH_TOKEN_KEY).catch(() => {});
}

// The server writes notifications in the language saved with this phone, so
// changing the language in Settings has to update it. Never throws - the
// language is cosmetic, and the next login registers it again anyway.
export async function updatePushLanguage(authToken, language) {
  try {
    const pushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
    if (!pushToken || !authToken || authToken === "null") return;
    await fetch(`${BASE_URL}/push/register`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: pushToken, language: (language || "en").slice(0, 2) }),
    });
  } catch {
    // Offline: notifications stay in the previous language until next login.
  }
}

// Where tapping a notification should take you. Chats and likes live in the
// tab bar, which sits inside the root stack's "Main" screen - popTo goes back
// down to it rather than stacking a second tab bar on whatever is open.
export function openNotificationTarget(navigationRef, data = {}) {
  if (!navigationRef.isReady()) return;
  if (data.type === "message" && data.conversationId) {
    navigationRef.navigate("Chat", { conversationId: Number(data.conversationId) });
  } else if (data.type === "match") {
    navigationRef.dispatch(StackActions.popTo("Main", { screen: "Messages" }));
  } else if (data.type === "like") {
    navigationRef.dispatch(StackActions.popTo("Main", { screen: "LikedYou" }));
  }
}
