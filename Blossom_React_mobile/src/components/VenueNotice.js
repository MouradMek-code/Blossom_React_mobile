import { Text, Linking, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { SITE_URL } from "../api/config";

// On sign-up and log-in: accounts are for people who want to date. A café
// owner who took the wrong door is sent to the venue pages (no account).
export default function VenueNotice() {
  const { t } = useTranslation();
  return (
    <Text style={styles.notice}>
      {t("business.membersOnly")}{" "}
      <Text style={styles.link} onPress={() => Linking.openURL(`${SITE_URL}/business`)}>
        🏪 {t("business.venueNoAccount")} → {t("business.navLink")}
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    marginTop: 8,
    marginBottom: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#FFF8EC",
    borderWidth: 1,
    borderColor: "#F3DCB3",
    color: "#574D46",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    overflow: "hidden",
  },
  link: { color: "#7E2A44", fontWeight: "700" },
});
