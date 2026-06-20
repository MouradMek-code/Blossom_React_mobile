import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { BASE_URL } from "../api/config";
import { setToken } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function FormSignUp({ setRegistered, error, setError, verify, setVerified }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  async function handleSignUp() {
    setError("");
    try {
      const resp = await fetch(`${BASE_URL}/user/send_email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          phone_number: phoneNumber,
        }),
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(`error happeneded on sign up : ${data.detail}`);
      }
      setVerified((c) => !c);
      await setToken(data.access_token);
    } catch (err) {
      setError(err.toString());
    }
  }

  return (
    <View style={styles.container}>
      {verify === false && (
        <View>
          <Text style={styles.eyebrow}>JOIN BLOSSOM</Text>
          <Text style={styles.title}>Create Account</Text>

          {error !== "" && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <View style={styles.group}>
            <Text style={styles.label}>NAME</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

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

          <View style={styles.group}>
            <Text style={styles.label}>PHONE NUMBER</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+381690156360"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSignUp}
          >
            <Text style={styles.buttonText}>Create Account</Text>
          </Pressable>
        </View>
      )}

      {verify === true && (
        <VerificationForm
          username={username}
          email={email}
          password={password}
          phoneNumber={phoneNumber}
          setError={setError}
          setRegistered={setRegistered}
        />
      )}
    </View>
  );
}

function VerificationForm({ username, email, password, phoneNumber, setError, setRegistered }) {
  const [code, setCode] = useState("");

  async function signUp() {
    setError("");
    try {
      const resp1 = await fetch(`${BASE_URL}/user/verify-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, otp: code, email }),
      });
      const data1 = await resp1.json();
      if (resp1.status !== 200) {
        throw new Error(`error happeneded on sign up : ${data1.detail}`);
      }

      const resp = await fetch(`${BASE_URL}/user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password, phone_number: phoneNumber }),
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(`error happeneded on sign up : ${data.detail}`);
      }

      setRegistered((c) => !c);
      await setToken(data.access_token);
    } catch (err) {
      setError(err.toString());
    }
  }

  return (
    <View style={styles.verifyCard}>
      <View style={styles.verifyIconWrap}>
        <Text style={styles.verifyIcon}>🔐</Text>
      </View>
      <Text style={styles.verifyTitle}>Verify your email/phone</Text>
      <Text style={styles.verifySubtitle}>
        Enter the 6-digit verification code sent to your phone/email
      </Text>

      <TextInput
        style={styles.codeInput}
        placeholder="••••••"
        placeholderTextColor={colors.textMuted}
        value={code}
        maxLength={6}
        onChangeText={setCode}
        keyboardType="number-pad"
      />

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={signUp}
      >
        <Text style={styles.buttonText}>Continue</Text>
      </Pressable>

      <Text style={styles.footerText}>
        Didn't receive the code? <Text style={styles.footerLink}>Resend</Text>
      </Text>
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
  verifyCard: {
    alignItems: "center",
    padding: spacing.md,
  },
  verifyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  verifyIcon: { fontSize: 32 },
  verifyTitle: { ...typography.h2, marginBottom: spacing.sm, textAlign: "center" },
  verifySubtitle: {
    ...typography.bodyMuted,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  codeInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    fontSize: 22,
    letterSpacing: 10,
    textAlign: "center",
    marginBottom: spacing.lg,
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  footerText: { marginTop: spacing.md, ...typography.bodyMuted },
  footerLink: { color: colors.primary, fontWeight: "700" },
});
