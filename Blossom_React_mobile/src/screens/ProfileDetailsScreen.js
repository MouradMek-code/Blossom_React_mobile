import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRoute } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";

export default function ProfileDetailsScreen() {
  const route = useRoute();
  const { id } = route.params;
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/profile/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await resp.json();
      setProfile(data);
    }
    fetchProfile();
  }, [id]);

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
      <ProfileView profile={profile} showLocationLine={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: "#fff" },
  loading: { textAlign: "center", marginTop: 40 },
});
