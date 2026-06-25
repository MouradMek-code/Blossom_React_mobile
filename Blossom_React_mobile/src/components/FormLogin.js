import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { BASE_URL } from "../api/config";
import { setToken } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function FormLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigation = useNavigation();

  async function handleLogin() {
    setError("");
    const formData = new URLSearchParams();
    formData.append("username", username);
    formData.append("password", password);

    try {
      const resp = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData.toString(),
      });
      const data = await resp.json();
      await setToken(data.access_token);
      if (resp.status !== 200) {
        throw new Error(`error happeneded on login : ${data.detail?.[0]?.msg}`);
      }
      navigation.navigate("Profile");
    } catch (err) {
      setError(err.toString());
    } finally {
      setUsername("");
      setPassword("");
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>WELCOME BACK</Text>
      <Text style={styles.title}>Log In</Text>

      {error !== "" && (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
        </View>
      )}

      <View style={styles.group}>
        <Text style={styles.label}>USERNAME OR EMAIL</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="Your username or email"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>PASSWORD</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={colors.textMuted}
        />
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={handleLogin}
      >
        <Text style={styles.buttonText}>Log In</Text>
      </Pressable>

      <Pressable
        style={styles.forgotLink}
        onPress={() => navigation.navigate("ForgotPassword")}
      >
        <Text style={styles.forgotLinkText}>Forgot password?</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.lg },
  eyebrow: {
    ...typography.label,
    textAlign: "center",
    letterSpacing: 1.5,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.h1,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  errorBox: {
    backgroundColor: "#FDEEEE",
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, fontSize: 13 },
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
  forgotLink: { marginTop: spacing.md, alignItems: "center" },
  forgotLinkText: { color: colors.primary, fontWeight: "600", fontSize: 14 },
});
