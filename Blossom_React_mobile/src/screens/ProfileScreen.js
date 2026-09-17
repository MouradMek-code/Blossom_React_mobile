import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken, setProfileId, clearSession } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";

export default function ProfileScreen() {
  const navigation = useNavigation();
  // Last copy from this session, shown immediately while it refreshes.
  const [profile, setProfile] = useState(() => peekCache("ownProfile"));
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }

      // Instant start from the saved copy (disk, after an app restart).
      const cached = await readCache("ownProfile");
      if (cached && isMounted) setProfile((cur) => cur || cached);

      try {
        setLoadError(false);
        const resp = await fetch(`${BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 401) {
          await endSessionAndGoToLogin(navigation);
          return;
        }
        if (resp.status === 404) {
          // Token valid but no profile yet — resume signup flow
          navigation.navigate("SignUp");
          return;
        }
        if (resp.status !== 200) throw new Error(`profile failed with ${resp.status}`);
        const data = await resp.json();
        if (isMounted) setProfile(data);
        await setProfileId(data.id);
      } catch (err) {
        // No internet / server trouble: stay logged in. With the saved copy on
        // screen just keep it; otherwise offer a retry.
        if (isMounted && !cached) setLoadError(true);
      }
    }
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [reloadKey]);

  // Keep the saved copy current after every change (bio, photos, location).
  useEffect(() => {
    if (profile) writeCache("ownProfile", profile);
  }, [profile]);

  async function handleSaveBio(bio) {
    const token = await getToken();
    const resp = await fetch(`${BASE_URL}/profile/bio`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ bio }),
    });
    const data = await resp.json();
    if (resp.status !== 200) throw new Error("Failed to update bio");
    setProfile(data);
  }

  // Throws with a readable message on failure; ProfileView shows it.
  async function handleSaveLocation({ country, city }) {
    const token = await getToken();
    const query = `country=${encodeURIComponent(country)}&city=${encodeURIComponent(city)}`;
    const result = await postJson(`${BASE_URL}/profile/update_city_country?${query}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!result.ok) throw new Error(result.message);
    setProfile(result.data);
  }

  async function handleAddPhotoPress() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    setUploadingPhoto(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", {
        uri: asset.uri,
        name: asset.fileName || "photo.jpg",
        type: asset.mimeType || "image/jpeg",
      });

      const resp = await fetch(`${BASE_URL}/profile/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const newPhoto = await resp.json();
      if (resp.status !== 200) throw new Error("Failed to upload photo");
      setProfile((prev) => ({ ...prev, photos: [...(prev.photos || []), newPhoto] }));
    } catch (err) {
      console.log("Photo upload failed:", err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleDeletePhoto(photoId) {
    const token = await getToken();
    try {
      const resp = await fetch(`${BASE_URL}/profile/image/${photoId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.status !== 200) throw new Error("Failed to delete photo");
      setProfile((prev) => ({
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      }));
    } catch (err) {
      console.log("Photo delete failed:", err);
    }
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete account?",
      "This will permanently remove your profile, photos, matches, and messages. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingAccount(true);
            try {
              const token = await getToken();
              const resp = await fetch(`${BASE_URL}/user/me`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (resp.status !== 200) throw new Error("Failed to delete account");
              await clearSession();
              navigation.reset({ index: 0, routes: [{ name: "Home" }] });
            } catch (err) {
              console.log("Account delete failed:", err);
              setDeletingAccount(false);
            }
          },
        },
      ]
    );
  }

  if (!profile) {
    return (
      <View style={styles.head}>
        <PageNav />
        {loadError ? (
          <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <Text style={styles.loading}>Loading...</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.head}>
      <PageNav />
      <ProfileView
        profile={profile}
        editable
        onSaveBio={handleSaveBio}
        onSaveLocation={handleSaveLocation}
        onAddPhotoPress={handleAddPhotoPress}
        onDeletePhoto={handleDeletePhoto}
        uploadingPhoto={uploadingPhoto}
        onDeleteAccount={handleDeleteAccount}
        deletingAccount={deletingAccount}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: "#FBF8F6" },
  loading: { textAlign: "center", marginTop: 40 },
});
