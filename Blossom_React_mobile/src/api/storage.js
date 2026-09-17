import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearCache } from "./cache";

// Mirrors the stored token in memory, so a screen can tell straight away
// whether someone is logged in instead of drawing a logged-out header for a
// frame while AsyncStorage answers.
let tokenInMemory = null;

export function peekToken() {
  return tokenInMemory;
}

export async function getToken() {
  tokenInMemory = await AsyncStorage.getItem("token");
  return tokenInMemory;
}

export async function setToken(token) {
  if (token === null || token === undefined) {
    tokenInMemory = null;
    return AsyncStorage.removeItem("token");
  }
  tokenInMemory = String(token);
  return AsyncStorage.setItem("token", String(token));
}

export async function getProfileId() {
  return AsyncStorage.getItem("profile_id");
}

export async function setProfileId(id) {
  return AsyncStorage.setItem("profile_id", String(id));
}

export async function clearSession() {
  tokenInMemory = null;
  await AsyncStorage.removeItem("token");
  await AsyncStorage.removeItem("profile_id");
  // Cached screens belong to this account - never show them to the next one.
  await clearCache();
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
