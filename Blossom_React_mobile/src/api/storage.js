import AsyncStorage from "@react-native-async-storage/async-storage";

export async function getToken() {
  return AsyncStorage.getItem("token");
}

export async function setToken(token) {
  if (token === null || token === undefined) {
    return AsyncStorage.removeItem("token");
  }
  return AsyncStorage.setItem("token", String(token));
}

export async function getProfileId() {
  return AsyncStorage.getItem("profile_id");
}

export async function setProfileId(id) {
  return AsyncStorage.setItem("profile_id", String(id));
}

export async function clearSession() {
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("profile_id");
}

// Persists in-progress signup state (location + question answers + which
// question we're on) so a user who closes the app mid-signup can resume
// where they left off instead of restarting from question 1.
const SIGNUP_DRAFT_KEY = "signup_draft";

export async function getSignupDraft() {
  const raw = await AsyncStorage.getItem(SIGNUP_DRAFT_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function saveSignupDraft(partial) {
  const current = (await getSignupDraft()) || {};
  await AsyncStorage.setItem(SIGNUP_DRAFT_KEY, JSON.stringify({ ...current, ...partial }));
}

export async function clearSignupDraft() {
  await AsyncStorage.removeItem(SIGNUP_DRAFT_KEY);
}
