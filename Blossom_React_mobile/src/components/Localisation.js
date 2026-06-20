import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import * as Location from "expo-location";

export default function Localisation({ setlocated, setAnswer, answer }) {
  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [locationData, setLocationData] = useState(null);
  const [error, setError] = useState("");

  async function handleGetPosition() {
    setError("");
    setStatus("loading");

    try {
      const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
      if (permStatus !== "granted") {
        setError("Location permission denied.");
        setStatus("error");
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;

      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`,
        {
          headers: {
            "User-Agent": "my-blossom-app/1.0",
            Accept: "application/json",
          },
        },
      );
      const raw = await res.text();
      let data;
      try {
        data = JSON.parse(raw);
      } catch {
        console.log("Nominatim non-JSON response:", raw.slice(0, 200));
        throw new Error(`Unexpected response from location service (status ${res.status})`);
      }

      const city = data.address?.city || data.address?.town || data.address?.village;
      const country = data.address?.country;

      setLocationData({ city, country });
      setAnswer({ ...answer, city, country });
      setStatus("success");
    } catch (err) {
      console.log("Localisation error:", err);
      setError(`Failed to fetch location: ${err?.message || err}`);
      setStatus("error");
    }
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.heading}>Enable Location</Text>
        <Text style={styles.subtitle}>We use your location to improve your experience.</Text>

        {status !== "success" && (
          <Pressable
            style={styles.button}
            onPress={handleGetPosition}
            disabled={status === "loading"}
          >
            {status === "loading" ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Allow Location</Text>
            )}
          </Pressable>
        )}

        {error !== "" && <Text style={styles.error}>{error}</Text>}

        {locationData && (
          <View style={styles.result}>
            <Text>
              📍 {locationData.city}, {locationData.country}
            </Text>
            <Pressable style={styles.button} onPress={() => setlocated(true)}>
              <Text style={styles.buttonText}>Continue</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", padding: 24 },
  card: { alignItems: "center", width: "100%" },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  subtitle: { textAlign: "center", color: "#555", marginBottom: 16 },
  button: {
    backgroundColor: "#d6336c",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginTop: 12,
    minWidth: 160,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
  error: { color: "red", marginTop: 12 },
  result: { alignItems: "center", marginTop: 16 },
});
