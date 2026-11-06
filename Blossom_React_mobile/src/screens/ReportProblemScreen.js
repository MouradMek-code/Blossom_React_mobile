import { useEffect, useState } from "react";
import { View, Text, TextInput, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import KeyboardAwareScroll from "../components/KeyboardAwareScroll";
import { BASE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { useBottomInset } from "../navigation/useBottomInset";
import { colors, radius, spacing } from "../theme";
import { Button, Card, Chip, EmptyState, ScreenHeader } from "../ui";

// What the report is about; child safety first (Google Play's Child Safety
// Standards ask for an in-app way to report, without leaving the app).
const KINDS = [
  ["child_safety", "shield"],
  ["scam", "alert-triangle"],
  ["harassment", "slash"],
  ["bug", "tool"],
  ["other", "message-circle"],
];

// "Report a problem": from Settings, and from Home for visitors. It goes
// straight to the Blossom team (Admin → Reports), who are notified at once.
export default function ReportProblemScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  const [kind, setKind] = useState(null);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [loggedIn, setLoggedIn] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    getToken().then((token) => setLoggedIn(Boolean(token) && token !== "null"));
  }, []);

  const ready = kind && message.trim().length >= 5;

  async function send() {
    setSending(true);
    setError("");
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token && token !== "null" ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        kind,
        message: message.trim(),
        email: loggedIn ? null : email.trim() || null,
        language: (i18n.language || "en").slice(0, 2),
      }),
    });
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setSent(true);
  }

  return (
    <View style={styles.screen}>
      <PageNav />
      <ScreenHeader title={t("feedback.title")} />

      {sent ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}>
          <EmptyState
            icon="check-circle"
            title={t("feedback.doneTitle")}
            text={t("feedback.doneText")}
            actionTitle={t("feedback.back")}
            onAction={() => navigation.goBack()}
          />
        </ScrollView>
      ) : (
        <KeyboardAwareScroll contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}>
          <Text style={styles.intro}>{t("feedback.intro")}</Text>

          <Card>
            <Text style={styles.label}>{t("feedback.reasonLabel")}</Text>
            <View style={styles.kinds}>
              {KINDS.map(([key, icon]) => (
                <Chip
                  key={key}
                  icon={icon}
                  label={t(`feedback.kind_${key}`)}
                  selected={kind === key}
                  tone={key === "child_safety" ? "danger" : undefined}
                  onPress={() => setKind(key)}
                />
              ))}
            </View>
            {kind === "child_safety" ? <Text style={styles.childNote}>{t("feedback.childNote")}</Text> : null}
          </Card>

          <Card>
            <Text style={styles.label}>{t("feedback.messageLabel")}</Text>
            <TextInput
              style={[styles.input, styles.message]}
              value={message}
              onChangeText={setMessage}
              placeholder={t("feedback.messagePlaceholder")}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            {!loggedIn ? (
              <>
                <Text style={[styles.label, { marginTop: spacing.sm }]}>{t("feedback.emailLabel")}</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  maxLength={200}
                />
              </>
            ) : null}
          </Card>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title={t("feedback.send")} icon="send" onPress={send} disabled={!ready} loading={sending} full />
        </KeyboardAwareScroll>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, gap: spacing.md },
  intro: { fontSize: 15, lineHeight: 21, color: colors.textSoft, marginHorizontal: spacing.xs },
  label: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  childNote: {
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.danger,
    fontWeight: "600",
    marginTop: spacing.xs,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
  message: { minHeight: 130 },
  error: { color: colors.danger, fontWeight: "600", marginHorizontal: spacing.xs },
});
