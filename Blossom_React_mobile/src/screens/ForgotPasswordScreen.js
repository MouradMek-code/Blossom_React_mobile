import { useState } from "react";
import {
  ImageBackground,
  View,
  ScrollView,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [step, setStep] = useState("request"); // "request" | "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleRequestCode() {
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const resp = await fetch(`${BASE_URL}/user/forgot_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(data.detail || "Failed to send reset code");
      }
      setInfo(data.message || "If that email exists, a reset code has been sent.");
      setStep("reset");
    } catch (err) {
      setError(err.toString());
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const resp = await fetch(`${BASE_URL}/user/reset_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, new_password: newPassword }),
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(data.detail || "Failed to reset password");
      }
      navigation.navigate("Login");
    } catch (err) {
      setError(err.toString());
    } finally {
      setSubmitting(false);
    }
  }

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
          <Text style={styles.title}>
            {step === "request" ? "Forgot Password" : "Reset Password"}
          </Text>

          {error !== "" && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          {step === "request" ? (
            <View>
              <Text style={styles.subtitle}>
                Enter your account email and we'll send you a reset code.
              </Text>
              <View style={styles.group}>
                <Text style={styles.label}>EMAIL</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleRequestCode}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send Reset Code</Text>
                )}
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => navigation.navigate("Login")}>
                <Text style={styles.linkText}>Back to login</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              {info !== "" && <Text style={styles.info}>{info}</Text>}
              <View style={styles.group}>
                <Text style={styles.label}>RESET CODE</Text>
                <TextInput
                  style={styles.input}
                  value={otp}
                  onChangeText={setOtp}
                  maxLength={6}
                  keyboardType="number-pad"
                  placeholder="••••••"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <View style={styles.group}>
                <Text style={styles.label}>NEW PASSWORD</Text>
                <TextInput
                  style={styles.input}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <Pressable
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                onPress={handleResetPassword}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Update Password</Text>
                )}
              </Pressable>
              <Pressable style={styles.linkRow} onPress={() => setStep("request")}>
                <Text style={styles.linkText}>Didn't get a code? Try again</Text>
              </Pressable>
            </View>
          )}
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
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  title: { ...typography.h1, textAlign: "center", marginBottom: spacing.md },
  subtitle: { ...typography.bodyMuted, textAlign: "center", marginBottom: spacing.lg },
  info: { ...typography.bodyMuted, textAlign: "center", marginBottom: spacing.md },
  errorBox: {
    backgroundColor: "#FDEEEE",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13, textAlign: "center" },
  group: { marginBottom: spacing.md },
  label: { ...typography.label, letterSpacing: 0.5, marginBottom: spacing.xs },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surfaceMuted,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.md,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
  linkRow: { marginTop: spacing.md, alignItems: "center" },
  linkText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
});
