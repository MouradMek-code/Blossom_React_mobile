import { useCallback, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Image,
  Modal,
  ActivityIndicator,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import { BASE_URL, SITE_URL } from "../api/config";
import { postJson } from "../api/errors";
import { getToken } from "../api/storage";
import { IMG } from "../api/images";
import { formatDeadline } from "../api/offers";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { colors, radius, spacing, shadow, typography } from "../theme";

// My promotions: the codes a match and I got by saying yes to a spot with a
// venue promotion. At the venue, the staff type their code here to mark it
// used - once only.
export default function VouchersScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute();
  const highlight = route.params?.highlight;
  const bottomInset = useBottomInset();
  const [vouchers, setVouchers] = useState(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [staffFor, setStaffFor] = useState(null); // the voucher being marked used
  const [staffCode, setStaffCode] = useState("");
  const [staffError, setStaffError] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const resp = await fetch(`${BASE_URL}/offers/vouchers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`vouchers ${resp.status}`);
      setVouchers(await resp.json());
      setError("");
    } catch {
      setError(t("offers.loadFailed"));
    } finally {
      setRefreshing(false);
    }
  }, [t]);

  useAutoRefresh(load, { minIntervalMs: 10000 });

  async function redeem() {
    if (!staffCode.trim() || redeeming) return;
    setRedeeming(true);
    setStaffError("");
    const token = await getToken();
    const result = await postJson(`${BASE_URL}/offers/vouchers/${staffFor.id}/redeem`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ staff_code: staffCode.trim() }),
    });
    setRedeeming(false);
    if (!result.ok) {
      setStaffError(result.message);
      return;
    }
    setVouchers((cur) => cur.map((v) => (v.id === result.data.id ? result.data : v)));
    setStaffFor(null);
    setStaffCode("");
  }

  const deadline = (value) => formatDeadline(value, i18n.language);

  return (
    <View style={styles.screen}>
      <PageNav />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityRole="button">
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>🎁 {t("offers.myPromosTitle")}</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            colors={[colors.primary]}
          />
        }
      >
        {error !== "" && <Text style={styles.error}>{error}</Text>}
        {vouchers === null ? (
          !error && <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
        ) : vouchers.length === 0 ? (
          <Text style={styles.empty}>{t("offers.noPromos")}</Text>
        ) : (
          vouchers.map((v) => {
            const active = v.status === "active";
            return (
              <View key={v.id} style={[styles.card, v.id === highlight && styles.cardHighlight, !active && styles.cardDone]}>
                <View style={styles.cardTop}>
                  {v.spot?.image_url ? (
                    <Image source={{ uri: IMG.thumb(v.spot.image_url) }} style={styles.spotImage} />
                  ) : (
                    <View style={[styles.spotImage, styles.spotImageEmpty]}>
                      <Text style={{ fontSize: 22 }}>📍</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.spotName} numberOfLines={1}>{v.spot?.name}</Text>
                    {v.partner ? (
                      <Text style={styles.muted}>{t("offers.withPartner", { name: v.partner.first_name })}</Text>
                    ) : null}
                  </View>
                  <Text style={[styles.status, styles[`status_${v.status}`]]}>{t(`offers.status_${v.status}`)}</Text>
                </View>

                <Text style={styles.offerTitle}>🎁 {v.title}</Text>
                {v.details ? <Text style={styles.muted}>{v.details}</Text> : null}

                <View style={styles.codeBox}>
                  {active ? <Text style={styles.codeLabel}>{t("offers.showCounter")}</Text> : null}
                  <Text style={[styles.code, !active && styles.codeDone]}>{v.code}</Text>
                  <Text style={styles.deadline}>
                    {v.status === "used"
                      ? t("offers.usedOn", { date: deadline(v.used_at) })
                      : v.status === "expired"
                        ? t("offers.expiredOn", { date: deadline(v.expires_at) })
                        : t("offers.useBefore", { date: deadline(v.expires_at) })}
                  </Text>
                </View>

                {active ? (
                  <Pressable
                    style={styles.staffBtn}
                    onPress={() => {
                      setStaffFor(v);
                      setStaffCode("");
                      setStaffError("");
                    }}
                  >
                    <Text style={styles.staffBtnText}>{t("offers.staffButton")}</Text>
                  </Pressable>
                ) : null}
                {active ? (
                  <Text style={styles.venueHint}>
                    {t("offers.venueHint", { url: `${SITE_URL.replace(/^https?:\/\//, "")}/venue` })}
                  </Text>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* The venue's staff type their code on this phone. */}
      <Modal visible={!!staffFor} transparent animationType="fade" onRequestClose={() => setStaffFor(null)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>🔒 {t("offers.staffTitle")}</Text>
            <Text style={styles.muted}>{t("offers.staffText")}</Text>
            <TextInput
              value={staffCode}
              onChangeText={(v) => setStaffCode(v.replace(/\D/g, "").slice(0, 8))}
              placeholder={t("offers.staffPlaceholder")}
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              autoFocus
              style={styles.input}
              onSubmitEditing={redeem}
            />
            {staffError !== "" && <Text style={styles.error}>{staffError}</Text>}
            <View style={styles.modalRow}>
              <Pressable style={styles.cancelBtn} onPress={() => setStaffFor(null)}>
                <Text style={styles.cancelText}>{t("offers.cancel")}</Text>
              </Pressable>
              <Pressable
                style={[styles.confirmBtn, (!staffCode || redeeming) && { opacity: 0.6 }]}
                onPress={redeem}
                disabled={!staffCode || redeeming}
              >
                {redeeming ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.confirmText}>{t("offers.confirm")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 22, color: colors.text },
  title: { ...typography.h3, fontSize: 18 },
  content: { padding: spacing.md },
  error: { color: colors.danger, fontSize: 13, marginVertical: spacing.sm, textAlign: "center" },
  empty: { color: colors.textMuted, fontSize: 14.5, textAlign: "center", marginTop: 40, lineHeight: 21, paddingHorizontal: spacing.md },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardHighlight: { borderWidth: 1.5, borderColor: colors.primary },
  cardDone: { opacity: 0.7 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  spotImage: { width: 44, height: 44, borderRadius: 10 },
  spotImageEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  spotName: { fontSize: 16, fontWeight: "700", color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted, marginTop: 2, lineHeight: 18 },
  status: { fontSize: 11.5, fontWeight: "800", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill, overflow: "hidden" },
  status_active: { color: "#1F7A4D", backgroundColor: "#E3F4EA" },
  status_used: { color: colors.textSoft, backgroundColor: colors.surfaceMuted },
  status_expired: { color: colors.danger, backgroundColor: "#FDECEA" },
  offerTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  codeBox: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    backgroundColor: colors.primaryTint,
  },
  codeLabel: { fontSize: 11.5, color: colors.textMuted, textTransform: "uppercase", letterSpacing: 0.6 },
  code: { fontSize: 30, fontWeight: "800", color: colors.primaryDeep, letterSpacing: 3, marginTop: 4 },
  codeDone: { textDecorationLine: "line-through", color: colors.textMuted },
  deadline: { fontSize: 13.5, color: colors.textSoft, marginTop: 6, fontWeight: "600" },
  staffBtn: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: 11,
    alignItems: "center",
  },
  staffBtnText: { color: colors.textSoft, fontWeight: "700", fontSize: 14 },
  venueHint: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: spacing.lg },
  modal: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg },
  modalTitle: { fontSize: 18, fontWeight: "800", color: colors.text, marginBottom: 4 },
  input: {
    marginTop: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 22,
    letterSpacing: 6,
    textAlign: "center",
    color: colors.text,
  },
  modalRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  cancelBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelText: { color: colors.textSoft, fontWeight: "700" },
  confirmBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 12, alignItems: "center" },
  confirmText: { color: "#fff", fontWeight: "800" },
});
