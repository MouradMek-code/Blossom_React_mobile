import { useState } from "react";
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet, Linking } from "react-native";
import { useTranslation } from "react-i18next";
import { BASE_URL, PRIVACY_POLICY_URL } from "../api/config";
import { setToken, saveSignupDraft, clearSignupDraft } from "../api/storage";
import { postJson } from "../api/errors";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function FormSignUp({ setRegistered, error, setError, verify, setVerified, prefill }) {
  const { t } = useTranslation();
  const [username, setUsername] = useState(prefill?.username || "");
  const [email, setEmail] = useState(prefill?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState(prefill?.phoneNumber || "");
  const [dateOfBirth, setDateOfBirth] = useState(prefill?.dateOfBirth || "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    if (submitting) return;
    setError("");

    // Instant, clear client-side validation before hitting the server.
    if (!username.trim()) return setError("Please enter a username.");
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return setError("Please enter a valid email address.");
    if (!password || password.length < 6)
      return setError("Password must be at least 6 characters.");
    if (!phoneNumber.trim() || !/^\+?[0-9\s-]{7,}$/.test(phoneNumber.trim()))
      return setError("Please enter a valid phone number, including country code (e.g. +33…).");

    const birth = new Date(dateOfBirth);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || isNaN(birth.getTime())) {
      return setError("Please enter your date of birth as YYYY-MM-DD.");
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
      return setError("You must be at least 18 years old to sign up.");
    }

    setSubmitting(true);
    const result = await postJson(`${BASE_URL}/user/send_email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: username.trim(),
        email: email.trim(),
        password,
        phone_number: phoneNumber.trim(),
        date_of_birth: dateOfBirth,
      }),
    });
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    // No token until the OTP is verified - save just enough (no
    // password) to resume straight at the verification screen if the
    // app is closed now.
    await saveSignupDraft({ stage: "verify_otp", username, email, phoneNumber, dateOfBirth });
    setVerified((c) => !c);
    await setToken(result.data.access_token);
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

          <Text style={styles.requiredNote}>All fields are required.</Text>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.nameLabel")} <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              placeholder="e.g. sofia_martin"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.emailLabel")} <Text style={styles.req}>*</Text></Text>
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
            <Text style={styles.label}>{t("signup.passwordLabel")} <Text style={styles.req}>*</Text></Text>
            <View style={styles.passwordWrap}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={colors.textMuted}
              />
              <Pressable style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁️"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.phoneLabel")} <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+33 6 12 34 56 78"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
            <Text style={styles.hint}>Include your country code (e.g. +33).</Text>
          </View>

          <View style={styles.group}>
            <Text style={styles.label}>{t("signup.dobLabel")} <Text style={styles.req}>*</Text></Text>
            <TextInput
              style={styles.input}
              value={dateOfBirth}
              onChangeText={setDateOfBirth}
              placeholder="YYYY-MM-DD (e.g. 1998-05-20)"
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
            <Text style={styles.hint}>Format: YYYY-MM-DD · You must be 18 or older.</Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, submitting && { opacity: 0.7 }]}
            onPress={handleSignUp}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>{t("signup.button")}</Text>
            )}
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
          setEmail={setEmail}
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

function VerificationForm({ username, email, setEmail, password, phoneNumber, dateOfBirth, setError, setRegistered }) {
  const { t } = useTranslation();
  const [code, setCode] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const needsPassword = !password;
  const [resendState, setResendState] = useState("idle");
  const [cooldown, setCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  // Lets the user correct a mistyped address without restarting signup.
  const [editingEmail, setEditingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState(email);
  const [savingEmail, setSavingEmail] = useState(false);

  async function handleChangeEmail() {
    if (savingEmail) return;
    setError("");
    const next = emailDraft.trim();
    if (!next || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      return setError("Please enter a valid email address.");
    }
    if (next.toLowerCase() === email.trim().toLowerCase()) {
      setEditingEmail(false);
      return;
    }

    setSavingEmail(true);
    const url =
      BASE_URL +
      "/user/resend_email?email=" +
      encodeURIComponent(next) +
      "&phone_number=" +
      encodeURIComponent(phoneNumber);
    const result = await postJson(url, { method: "POST" });
    setSavingEmail(false);

    if (!result.ok) {
      return setError(result.message);
    }

    // Point the rest of the flow (verify + account creation) at the new
    // address, and keep the resume draft in sync.
    setEmail(next);
    await saveSignupDraft({ stage: "verify_otp", username, email: next, phoneNumber, dateOfBirth });
    setEditingEmail(false);
    setCode("");
    setResendState("sent");
  }

  async function handleResend() {
    if (resendState === "sending" || cooldown > 0) return;
    setResendState("sending");
    const url = BASE_URL + "/user/resend_email?email=" + encodeURIComponent(email) + "&phone_number=" + encodeURIComponent(phoneNumber);
    const result = await postJson(url, { method: "POST" });
    if (!result.ok) {
      setResendState("error");
      setError(result.message);
      return;
    }
    setResendState("sent");
    let s = 60;
    setCooldown(s);
    const timer = setInterval(() => {
      s -= 1;
      setCooldown(s);
      if (s <= 0) { clearInterval(timer); setResendState("idle"); }
    }, 1000);
  }

  async function signUp() {
    if (submitting) return;
    setError("");
    const effectivePassword = password || passwordInput;

    if (!code.trim() || code.trim().length < 6) {
      return setError("Please enter the 6-digit code we sent you.");
    }
    if (needsPassword && (!passwordInput || passwordInput.length < 6)) {
      return setError("Please re-enter your password (at least 6 characters).");
    }

    setSubmitting(true);

    // Step 1 — confirm the emailed OTP.
    const verifyResult = await postJson(`${BASE_URL}/user/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone_number: phoneNumber, otp: code.trim(), email }),
    });
    if (!verifyResult.ok) {
      setSubmitting(false);
      return setError(verifyResult.message);
    }

    // Step 2 — create the account now that the email is verified.
    const createResult = await postJson(`${BASE_URL}/user`, {
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
    setSubmitting(false);
    if (!createResult.ok) {
      return setError(createResult.message);
    }

    await clearSignupDraft();
    setRegistered((c) => !c);
    await setToken(createResult.data.access_token);
  }

  return (
    <View style={styles.verifyCard}>
      <View style={styles.verifyIconWrap}>
        <Text style={styles.verifyIcon}>🔐</Text>
      </View>
      <Text style={styles.verifyTitle}>{t("verify.title")}</Text>
      <Text style={styles.verifySubtitle}>{t("verify.subtitle")}</Text>

      {editingEmail ? (
        <View style={styles.emailEditBox}>
          <Text style={styles.emailEditLabel}>Send the code to</Text>
          <TextInput
            style={styles.emailInput}
            value={emailDraft}
            onChangeText={setEmailDraft}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />
          <View style={styles.emailEditActions}>
            <Pressable
              style={styles.emailCancelBtn}
              onPress={() => { setEmailDraft(email); setEditingEmail(false); }}
            >
              <Text style={styles.emailCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.emailSaveBtn, savingEmail && { opacity: 0.7 }]}
              onPress={handleChangeEmail}
              disabled={savingEmail}
            >
              {savingEmail ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.emailSaveText}>Send new code</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.emailRow}>
          <Text style={styles.emailValue} numberOfLines={1}>{email}</Text>
          <Text style={styles.emailChangeLink} onPress={() => { setEmailDraft(email); setEditingEmail(true); }}>
            Change
          </Text>
        </View>
      )}

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
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed, submitting && { opacity: 0.7 }]}
        onPress={signUp}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>{t("verify.button")}</Text>
        )}
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
  /* Verification: email display + inline editor */
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: spacing.md,
  },
  emailValue: { fontSize: 14, fontWeight: "600", color: colors.text, flexShrink: 1 },
  emailChangeLink: { fontSize: 13, fontWeight: "700", color: colors.primary },
  emailEditBox: {
    width: "100%",
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  emailEditLabel: { ...typography.label, marginBottom: spacing.xs },
  emailInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  emailEditActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  emailCancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: "center",
  },
  emailCancelText: { color: colors.textMuted, fontWeight: "600", fontSize: 14 },
  emailSaveBtn: {
    flex: 2,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: "center",
  },
  emailSaveText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  requiredNote: { ...typography.bodyMuted, fontSize: 12.5, marginBottom: spacing.sm },
  req: { color: colors.primary, fontWeight: "700" },
  hint: { ...typography.bodyMuted, fontSize: 11.5, marginTop: 5 },
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
