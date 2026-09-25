import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, Alert, StyleSheet } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import LoadError from "../components/LoadError";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { invalidate, useAutoRefresh } from "../navigation/useAutoRefresh";
import { deletePhoto, pickPhotos, uploadPhoto } from "../api/photoUpload";
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

  const mounted = useRef(true);
  useEffect(() => () => {
    mounted.current = false;
  }, []);

  const loadProfile = useCallback(async () => {
    const token = await getToken();
    if (!token || token === "null") {
      navigation.navigate("Login");
      return;
    }

    // Instant start from the saved copy (disk, after an app restart).
    const cached = await readCache("ownProfile");
    if (cached && mounted.current) setProfile((cur) => cur || cached);

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
      if (mounted.current) setProfile(data);
      await setProfileId(data.id);
    } catch (err) {
      // No internet / server trouble: stay logged in. With the saved copy on
      // screen just keep it; otherwise offer a retry.
      if (mounted.current && !cached) setLoadError(true);
    }
  }, [navigation]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile, reloadKey]);

  // The tab stays open in the background: coming back to it (or to the app)
  // shows the latest copy - e.g. photos changed on the website.
  useAutoRefresh(loadProfile, { minIntervalMs: 30000, skipFirst: true });

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

  // Dating, language exchange or both. Throws on failure; ProfileView says so.
  async function handleChangeConnection(type) {
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/profile/connection`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ connection_type: type }),
    });
    if (!result.ok) throw new Error(result.message);
    setProfile(result.data);
    // Who shows up in Browse depends on it: reload it on the next visit.
    invalidate("browse");
  }

  // Each photo shows as soon as it is saved.
  async function handleAddPhotoPress() {
    const assets = await pickPhotos({ max: 6 });
    if (!assets.length) return;
    setUploadingPhoto(true);
    const known = new Set((profile?.photos || []).map((p) => p.id));
    let failure = null;
    for (const asset of assets) {
      try {
        const photo = await uploadPhoto(asset, known);
        known.add(photo.id);
        if (mounted.current) setProfile((prev) => withPhoto(prev, photo));
      } catch (err) {
        failure = err.message || t("photos.connection");
      }
    }
    if (!mounted.current) return;
    setUploadingPhoto(false);
    if (failure !== null) {
      Alert.alert(t("photos.failedTitle"), failure);
      loadProfile(); // show whatever did get saved
    }
  }

  function handleDeletePhoto(photoId) {
    Alert.alert(t("photos.deleteTitle"), t("photos.deleteText"), [
      { text: t("photos.cancel"), style: "cancel" },
      {
        text: t("photos.deleteConfirm"),
        style: "destructive",
        onPress: async () => {
          try {
            await deletePhoto(photoId);
            setProfile((prev) => ({
              ...prev,
              photos: (prev.photos || []).filter((p) => p.id !== photoId),
            }));
          } catch {
            Alert.alert(t("photos.deleteFailed"));
          }
        },
      },
    ]);
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
        onOpenSettings={() => navigation.navigate("Settings")}
        onChangeConnection={handleChangeConnection}
      />
    </View>
  );
}

function withPhoto(profile, photo) {
  const photos = profile?.photos || [];
  if (photos.some((p) => p.id === photo.id)) return profile;
  return { ...profile, photos: [...photos, { id: photo.id, image_url: photo.image_url }] };
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: "#FBF8F6" },
  loading: { textAlign: "center", marginTop: 40 },
  settingsIcon: { width: 24, height: 24, tintColor: colors.textSoft },
});
