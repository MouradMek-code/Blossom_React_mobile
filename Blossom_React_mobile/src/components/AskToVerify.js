import { useState } from "react";
import { Text, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { requestVerification } from "../api/verification";
import { formatDeadline } from "../api/offers";
import { parseServerDate } from "../api/chatTime";
import { VERIFIED_BLUE } from "./VerifiedBadge";
import { radius } from "../theme";

// Admin, on a suspicious profile: "Ask to verify". The member is told by
// notification and email to verify within 48 hours, or the profile will be
// deleted - by the admin, by hand (database/db_verification.py). Shows where
// it stands instead once asked, once the deadline has passed, or verified.
export default function AskToVerify({ profile, name, onAsked }) {
  const { t, i18n } = useTranslation();
  const [sending, setSending] = useState(false);

  if (profile.verified) return <Text style={styles.verified}>✓ {t("verified.verifiedLabel")}</Text>;
  if (profile.verify_by) {
    // Nothing is deleted automatically: past the deadline, the admin decides.
    if (parseServerDate(profile.verify_by) < new Date()) {
      return <Text style={styles.expired}>⌛ {t("verified.askExpired")}</Text>;
    }
    return <Text style={styles.asked}>⏳ {t("verified.asked", { date: formatDeadline(profile.verify_by, i18n.language) })}</Text>;
  }

  function confirm() {
    Alert.alert(t("verified.askTitle", { name }), t("verified.askText", { name }), [
      { text: t("offers.cancel"), style: "cancel" },
      { text: t("verified.askConfirm"), style: "destructive", onPress: send },
    ]);
  }

  async function send() {
    setSending(true);
    const result = await requestVerification(profile.id);
    setSending(false);
    if (result.ok) onAsked(result.data.deadline);
    else Alert.alert(t("verified.askFailed"), result.message);
  }

  return (
    <Pressable
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.75 }]}
      onPress={confirm}
      disabled={sending}
      hitSlop={6}
      accessibilityRole="button"
    >
      {sending ? (
        <ActivityIndicator size="small" color={VERIFIED_BLUE} />
      ) : (
        <Text style={styles.buttonText}>🛡️ {t("verified.askButton")}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: VERIFIED_BLUE,
  },
  buttonText: { color: VERIFIED_BLUE, fontWeight: "700", fontSize: 13 },
  asked: { color: "#B4581E", fontWeight: "700", fontSize: 12.5 },
  expired: { color: "#C0392B", fontWeight: "800", fontSize: 12.5 },
  verified: { color: VERIFIED_BLUE, fontWeight: "800", fontSize: 12.5 },
});
