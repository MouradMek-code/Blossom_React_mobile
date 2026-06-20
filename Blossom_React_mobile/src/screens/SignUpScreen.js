import { useEffect, useState } from "react";
import { ImageBackground, View, ScrollView, StyleSheet } from "react-native";
import PageNav from "../components/PageNav";
import FormSignUp from "../components/FormSignUp";
import StartProfile from "../components/StartProfile";
import MultiImageUpload from "../components/MultiImageUpload";
import Localisation from "../components/Localisation";
import { BASE_URL } from "../api/config";
import { getToken, setProfileId } from "../api/storage";

export default function SignUpScreen() {
  const [isregistered, setRegistered] = useState(false);
  const [error, setError] = useState("");
  const [questionEnded, setQuestionEnded] = useState(false);
  const [answer, setAnswer] = useState({});
  const [photos, setPhoto] = useState(false);
  const [located, setlocated] = useState(false);
  const [verify, setVerified] = useState(false);

  async function createLanguage(token) {
    await Promise.all(
      (answer?.language_name || []).map((ln) =>
        fetch(`${BASE_URL}/profile_language`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ language_name: ln }),
        }),
      ),
    );
  }

  async function createProfile(token) {
    const resp = await fetch(`${BASE_URL}/profile`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        age: answer?.age,
        bio: answer?.bio,
        drinking: answer?.drinking,
        education: answer?.education,
        exercise_frequency: answer?.exercise_frequency,
        gender: answer?.gender,
        has_children: answer?.has_children,
        has_pets: answer?.has_pets,
        height_cm: answer?.height_cm,
        occupation: answer?.occupation,
        personality_type: answer?.personality_type,
        relationship_goal: answer?.relationship_goal,
        sexual_orientation: answer?.sexual_orientation,
        smoking: answer?.smoking,
        wants_children: answer?.wants_children,
        city: answer?.city,
        country: answer?.country,
      }),
    });
    const data = await resp.json();
    await setProfileId(data.id);
  }

  useEffect(() => {
    async function submit() {
      if (!questionEnded) return;
      const token = await getToken();
      if (!token || token === "null") return;
      await createProfile(token);
      await createLanguage(token);
      setQuestionEnded(false);
      setPhoto(true);
    }
    submit();
  }, [questionEnded]);

  return (
    <ImageBackground
      source={require("../../assets/images/blossom.png")}
      style={styles.head}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <PageNav variant="transparent" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {isregistered === false && (
            <FormSignUp
              setRegistered={setRegistered}
              error={error}
              setError={setError}
              setVerified={setVerified}
              verify={verify}
            />
          )}
          {isregistered === true && located === false && (
            <Localisation setlocated={setlocated} setAnswer={setAnswer} answer={answer} />
          )}
          {located === true &&
            isregistered === true &&
            questionEnded === false &&
            photos === false && (
              <StartProfile
                answer={answer}
                setAnswer={setAnswer}
                setQuestionEnded={setQuestionEnded}
              />
            )}
          {photos === true && <MultiImageUpload />}
        </View>
      </ScrollView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
});
