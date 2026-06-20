import { useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";

const MAX = 6;

export default function MultiImageUpload() {
  const [images, setImages] = useState([]);
  const navigation = useNavigation();

  async function handleUpload(index) {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;

    const asset = result.assets[0];

    setImages((prev) => {
      const updated = [...prev];
      updated[index] = { uri: asset.uri, uploading: true };
      return updated;
    });

    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("image", {
        uri: asset.uri,
        name: asset.fileName || `photo_${index}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });

      const resp = await fetch(`${BASE_URL}/profile/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!resp.ok) throw new Error(`Upload failed (status ${resp.status})`);

      setImages((prev) => {
        const updated = [...prev];
        updated[index] = { uri: asset.uri, uploading: false };
        return updated;
      });
    } catch (err) {
      console.log("Image upload failed:", err);
      setImages((prev) => {
        const updated = [...prev];
        updated[index] = { uri: asset.uri, uploading: false, failed: true };
        return updated;
      });
    }
  }

  function removeImage(index) {
    setImages((prev) => {
      const updated = [...prev];
      updated[index] = null;
      return updated;
    });
  }

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>Upload Images (max 6)</Text>

      <View style={styles.grid}>
        {Array.from({ length: MAX }).map((_, index) => {
          const img = images[index];
          return (
            <View key={index} style={styles.box}>
              {img ? (
                <>
                  <Image source={{ uri: img.uri }} style={styles.image} />
                  {img.uploading && (
                    <View style={styles.uploadingOverlay}>
                      <ActivityIndicator color="#fff" />
                    </View>
                  )}
                  {img.failed && (
                    <View style={styles.failedBadge}>
                      <Text style={styles.failedBadgeText}>Upload failed - tap ✕ and retry</Text>
                    </View>
                  )}
                  <Pressable style={styles.removeBtn} onPress={() => removeImage(index)}>
                    <Text style={styles.removeBtnText}>✕</Text>
                  </Pressable>
                </>
              ) : (
                <Pressable style={styles.addBox} onPress={() => handleUpload(index)}>
                  <Text style={styles.plus}>+</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      <Pressable style={styles.button} onPress={() => navigation.navigate("Profiles")}>
        <Text style={styles.buttonText}>Go Check Profiles</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", padding: 24 },
  title: { marginBottom: 20, fontSize: 22, fontWeight: "600" },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 12 },
  box: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
  },
  image: { width: "100%", height: "100%" },
  addBox: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  plus: { fontSize: 28, fontWeight: "bold", color: "#666" },
  removeBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 12 },
  uploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  failedBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(200,0,0,0.85)",
    padding: 4,
  },
  failedBadgeText: {
    color: "#fff",
    fontSize: 9,
    textAlign: "center",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#d6336c",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
