import { useEffect, useRef, useState } from "react";
import { ImageBackground, View, ScrollView, KeyboardAvoidingView, Platform, Text, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageNav from "../components/PageNav";
import FormSignUp from "../components/FormSignUp";
import StartProfile from "../components/StartProfile";
import MultiImageUpload from "../components/MultiImageUpload";
import Localisation from "../components/Localisation";
import { BASE_URL } from "../api/config";
import { getToken, setProfileId, getSignupDraft, clearSignupDraft } from "../api/storage";

export default function SignUpScreen() {
  const [isregistered, setRegistered] = useState(false);
  const [error, setError] = useState("");
  const [questionEnded, setQuestionEnded] = useState(false);
  const [answer, setAnswer] = useState({});
  const [photos, setPhoto] = useState(false);
  const [located, setlocated] = useState(false);
  const [verify, setVerified] = useState(false);
  const [checkingResume, setCheckingResume] = useState(true);
  const [resumeIndex, setResumeIndex] = useState(0);
  const [resumeAutoStart, setResumeAutoStart] = useState(false);
  const [prefill, setPrefill] = useState(null);
  const [questionReady, setQuestionReady] = useState(false);
  const startProfileRef = useRef(null);
  const insets = useSafeAreaInsets();

  // A token alone means signup + email/OTP verification already
  // succeeded in a previous session - figure out how much further the
  // user got before resuming instead of restarting at the signup form.
  useEffect(() => {
    async function checkResume() {
      const token = await getToken();
      if (!token || token === "null") {
        // No real token yet, but they may have already sent themselves
        // an OTP and abandoned the verification screen - resume straight
        // there instead of having them retype name/email/phone.
        const draft = await getSignupDraft();
        if (draft?.stage === "verify_otp") {
          setVerified(true);
          setPrefill({
            username: draft.username,
            email: draft.email,
            phoneNumber: draft.phoneNumber,
            dateOfBirth: draft.dateOfBirth,
          });
        }
        setCheckingResume(false);
        return;
      }
      try {
        const resp = await fetch(`${BASE_URL}/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 200) {
          // Profile already exists, so localisation + every question were
          // already answered (createProfile only runs after the last
          // question) - only the photo step could still be unfinished.
          await clearSignupDraft();
          setRegistered(true);
          setlocated(true);
          setPhoto(true);
        } else {
          const draft = await getSignupDraft();
          setRegistered(true);
          if (draft) {
            setAnswer(draft.answer || {});
            setlocated(!!draft.located);
            setResumeIndex(draft.questionIndex || 0);
            setResumeAutoStart(!!draft.started);
          }
        }
      } catch (err) {
        // Network hiccup while checking resume state - fall back to a
        // fresh start rather than getting stuck on a loading screen.
      } finally {
        setCheckingResume(false);
      }
    }
    checkResume();
  }, []);

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
        first_date_preference: answer?.first_date_preference,
        past_relationships_count: answer?.past_relationships_count,
        last_breakup_reason: answer?.last_breakup_reason,
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
      await clearSignupDraft();
      setQuestionEnded(false);
      setPhoto(true);
    }
    submit();
  }, [questionEnded]);

  if (checkingResume) {
    return (
      <View style={styles.loadingHead}>
        <PageNav variant="transparent" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <ImageBackground
      source={require("../../assets/images/blossom.png")}
      style={styles.head}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <PageNav variant="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, questionReady && { paddingBottom: 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          {isregistered === false && (
            <FormSignUp
              setRegistered={setRegistered}
              error={error}
              setError={setError}
              setVerified={setVerified}
              verify={verify}
              prefill={prefill}
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
                ref={startProfileRef}
                answer={answer}
                setAnswer={setAnswer}
                setQuestionEnded={setQuestionEnded}
                initialIndex={resumeIndex}
                autoStart={resumeAutoStart}
                onReadyChange={setQuestionReady}
              />
            )}
          {photos === true && <MultiImageUpload />}
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {located === true &&
        isregistered === true &&
        questionEnded === false &&
        photos === false &&
        questionReady && (
          <View style={[styles.stickyFooter, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
            <Pressable
              style={({ pressed }) => [styles.nextButton, pressed && styles.nextButtonPressed]}
              onPress={() => startProfileRef.current?.next()}
            >
              <Text style={styles.nextButtonText}>NEXT</Text>
            </Pressable>
          </View>
        )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1 },
  loadingHead: { flex: 1, backgroundColor: "#fff" },
  loadingText: { textAlign: "center", marginTop: 40 },
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
  stickyFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  nextButton: {
    backgroundColor: "#d6336c",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
  },
  nextButtonPressed: {
    backgroundColor: "#b5174a",
    transform: [{ scale: 0.98 }],
  },
  nextButtonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.5 },
});
