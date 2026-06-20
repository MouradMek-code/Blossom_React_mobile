import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import ProfileView from "../components/ProfileView";
import { BASE_URL } from "../api/config";
import { getToken, setProfileId, setToken } from "../api/storage";

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [profile, setProfile] = useState(null);

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
      <ProfileView profile={profile} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1, backgroundColor: "#fff" },
  loading: { textAlign: "center", marginTop: 40 },
});
