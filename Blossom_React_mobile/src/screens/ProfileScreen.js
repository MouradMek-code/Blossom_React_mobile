import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import { BASE_URL } from "../api/config";
import { getToken, setProfileId, setToken } from "../api/storage";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchProfile() {
      const token = await getToken();
      if (!token || token === "null") {
        navigation.navigate("Login");
        return;
      }

      try {
        const resp = await fetch(`${BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await resp.json();
        if (resp.status !== 200) {
          throw new Error(`error happeneded on login : ${data.detail?.[0]?.msg}`);
        }
        if (isMounted) setProfile(data);
        await setProfileId(data.id);
      } catch (err) {
        await setToken(null);
        navigation.navigate("Login");
      }
    }
    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, []);

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

  if (!profile) {
    return (
      <View style={styles.head}>
        <PageNav />
        <Text style={styles.loading}>Loading...</Text>
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
        onAddPhotoPress={handleAddPhotoPress}
        onDeletePhoto={handleDeletePhoto}
        uploadingPhoto={uploadingPhoto}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: "#fff" },
  loading: { textAlign: "center", marginTop: 40 },
});
