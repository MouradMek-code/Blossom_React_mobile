import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { BASE_URL, PRIVACY_POLICY_URL } from "../api/config";
import { setToken, saveSignupDraft, clearSignupDraft } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function FormSignUp({ setRegistered, error, setError, verify, setVerified, prefill }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState(prefill?.username || "");
  const [email, setEmail] = useState(prefill?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(prefill?.phoneNumber || "");
  const [dateOfBirth, setDateOfBirth] = useState(prefill?.dateOfBirth || "");

  async function handleSignUp() {
    setError("");

    const birth = new Date(dateOfBirth);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || isNaN(birth.getTime())) {
      setError("Please enter your date of birth as YYYY-MM-DD");
      return;
    }
    const today = new Date();
    const age =
      today.getFullYear() -
      birth.getFullYear() -
      (today.getMonth() < birth.getMonth() ||
      (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
        ? 1
        : 0);
    if (age < 18) {
      setError("You must be at least 18 years old to sign up");
      return;
    }

    try {
      const resp = await fetch(`${BASE_URL}/user/send_email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          email,
          password,
          phone_number: phoneNumber,
          date_of_birth: dateOfBirth,
        }),
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(`error happeneded on sign up : ${data.detail}`);
      }
      // No token until the OTP is verified - save just enough (no
      // password) to resume straight at the verification screen if the
      // app is closed now.
      await saveSignupDraft({ stage: "verify_otp", username, email, phoneNumber, dateOfBirth });
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
          <Text style={styles.eyebrow}>{t("signup.eyebrow")}</Text>
          <Text style={styles.title}>{t("signup.title")}</Text>

          {error !== "" && (
            <View style={styles.errorBox}>
              <Text style={styles.error}>{error}</Text>
            </View>
          )}

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.nameLabel")}</Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="Your name"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.emailLabel")}</Text>
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
            <Text style={styles.label}>{t("signup.passwordLabel")}</Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.phoneLabel")}</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+381690156360"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.dobLabel")}</Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder={t("signup.dobPlaceholder")}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={handleSignUp}
          >
            <Text style={styles.buttonText}>{t("signup.button")}</Text>
          </Pressable>

          <Text style={styles.policyText}>
            {t("signup.privacyPolicy")}{" "}
            <Text
              style={styles.policyLink}
              onPress={() => Linking.openURL(PRIVACY_POLICY_URL)}
            >
              {t("signup.privacyPolicyLink")}
            </Text>
            .
          </Text>
        </View>
      )}

      {verify === true && (
        <VerificationForm
          username={username}
          email={email}
          password={password}
          phoneNumber={phoneNumber}
          dateOfBirth={dateOfBirth}
          setError={setError}
          setRegistered={setRegistered}
        />
      )}
    </View>
  );
}

function VerificationForm({ username, email, password, phoneNumber, dateOfBirth, setError, setRegistered }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const needsPassword = !password;
  const [resendState, setResendState] = useState("idle");
  const [cooldown, setCooldown] = useState(0);

  async function handleResend() {
    if (resendState === "sending" || cooldown > 0) return;
    setResendState("sending");
    try {
      const url = BASE_URL + "/user/resend_email?email=" + encodeURIComponent(email) + "&phone_number=" + encodeURIComponent(phoneNumber);
      const resp = await fetch(url, { method: "POST" });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to resend");
      }
      setResendState("sent");
      let s = 60;
      setCooldown(s);
      const timer = setInterval(() => {
        s -= 1;
        setCooldown(s);
        if (s <= 0) { clearInterval(timer); setResendState("idle"); }
      }, 1000);
    } catch (err) {
      setResendState("error");
      setError(err.message || "Could not resend code. Please try again.");
    }
  }

  async function signUp() {
    setError("");
    const effectivePassword = password || passwordInput;
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
        body: JSON.stringify({
          username,
          email,
          password: effectivePassword,
          phone_number: phoneNumber,
          date_of_birth: dateOfBirth,
        }),
      });
      const data = await resp.json();
      if (resp.status !== 200) {
        throw new Error(`error happeneded on sign up : ${data.detail}`);
      }

      await clearSignupDraft();
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
      <Text style={styles.verifyTitle}>{t("verify.title")}</Text>
      <Text style={styles.verifySubtitle}>{t("verify.subtitle")}</Text>

      <TextInput
        style={styles.codeInput}
        placeholder="••••••"
        placeholderTextColor={colors.textMuted}
        value={code}
        maxLength={6}
        onChangeText={setCode}
        keyboardType="number-pad"
      />

      {needsPassword && (
        <TextInput
          style={[styles.codeInput, styles.passwordResumeInput]}
          placeholder={t("verify.reenterPassword")}
          placeholderTextColor={colors.textMuted}
          value={passwordInput}
          onChangeText={setPasswordInput}
          secureTextEntry
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={signUp}
      >
        <Text style={styles.buttonText}>{t("verify.button")}</Text>
      </Pressable>

      <Text style={styles.footerText}>
        {t("verify.resend")}{" "}
        {cooldown > 0 ? (
          <Text style={styles.resendCooldown}>{cooldown}s</Text>
        ) : (
          <Text
            style={[styles.footerLink, resendState === "sending" && { opacity: 0.4 }]}
            onPress={handleResend}
          >
            {resendState === "sending" ? "..." : resendState === "sent" ? t("verify.resendSent") : t("verify.resendLink")}
          </Text>
        )}
      </Text>
      <Text style={styles.spamHint}>📬 {t("verify.spamHint")}</Text>
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
  passwordWrap: { position: "relative", justifyContent: "center" },
  passwordInput: { paddingRight: 48 },
  eyeBtn: { position: "absolute", right: 12, padding: 4 },
  eyeText: { fontSize: 18 },
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
  policyText: {
    marginTop: spacing.md,
    textAlign: "center",
    fontSize: 12,
    color: colors.textMuted,
  },
  policyLink: { color: colors.primary, fontWeight: "700" },
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
  passwordResumeInput: {
    fontSize: 16,
    letterSpacing: 0,
  },
  footerText: { marginTop: spacing.md, ...typography.bodyMuted },
  spamHint: { marginTop: spacing.xs, fontSize: 11, color: "#bbb", textAlign: "center" },
  resendCooldown: { color: "#aaa", fontSize: 12 },
  footerLink: { color: colors.primary, fontWeight: "700" },
});
