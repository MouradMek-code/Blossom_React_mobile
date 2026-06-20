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
