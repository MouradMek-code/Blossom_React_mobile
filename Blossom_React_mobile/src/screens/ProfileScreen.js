import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import * as ImagePicker from "expo-image-picker";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { endSessionAndGoToLogin } from "../api/session";
import { getToken, setProfileId } from "../api/storage";
import { peekCache, readCache, writeCache } from "../api/cache";
import { colors } from "../theme";

export default function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  // Last copy from this session, shown immediately while it refreshes.
  const [profile, setProfile] = useState(() => peekCache("ownProfile"));
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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

  // Back from Settings, where the city can be changed: pick up the new copy.
  useFocusEffect(
    useCallback(() => {
      const cached = peekCache("ownProfile");
      if (cached) setProfile(cached);
    }, []),
  );

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

  // Language, location, logging out and deleting the account all live one tap
  // away, in Settings.
  const settingsButton = (
    <Pressable
      onPress={() => navigation.navigate("Settings")}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t("settings.title")}
    >
      <Image source={require("../../assets/images/tabs/settings.png")} style={styles.settingsIcon} />
    </Pressable>
  );

  if (!profile) {
    return (
      <View style={styles.head}>
        <PageNav right={settingsButton} />
        {loadError ? (
          <LoadError onRetry={() => setReloadKey((k) => k + 1)} />
        ) : (
          <Text style={styles.loading}>{t("loading")}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.head}>
      <PageNav right={settingsButton} />
      <ProfileView
        profile={profile}
        editable
        onSaveBio={handleSaveBio}
        onAddPhotoPress={handleAddPhotoPress}
        onDeletePhoto={handleDeletePhoto}
        uploadingPhoto={uploadingPhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: "#FBF8F6" },
  loading: { textAlign: "center", marginTop: 40 },
  settingsIcon: { width: 24, height: 24, tintColor: colors.textSoft },
});
