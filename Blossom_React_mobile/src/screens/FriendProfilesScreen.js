import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import PageNav from "../components/PageNav";
import KeyboardAwareScroll from "../components/KeyboardAwareScroll";
import LocationFields from "../components/LocationFields";
import { ProfileQuestion } from "../components/StartProfile";
import allQuestions from "../data/questions.json";
import { questionsFor } from "../api/connection";
import { BASE_URL } from "../api/config";
import { getToken } from "../api/storage";
import { IMG } from "../api/images";
import { postJson } from "../api/errors";
import { ageFromIso, birthDateToIso, formatBirthDate } from "../api/birthDate";
import { pickPhotos, shrink } from "../api/photoUpload";
import { parseServerDate } from "../api/chatTime";
import { useAutoRefresh } from "../navigation/useAutoRefresh";
import { useBottomInset } from "../navigation/useBottomInset";
import { colors, radius, spacing, shadow, typography } from "../theme";

const LANGUAGES = [
  ["en", "English"],
  ["fr", "Français"],
  ["zh", "中文"],
  ["ar", "العربية"],
];
const MIN_PHOTOS = 2;
const MAX_PHOTOS = 6;
// The answers the server takes as they are (languages go in their own lists).
const ANSWER_FIELDS = [
  "bio", "age", "gender", "sexual_orientation", "height_cm", "occupation", "education",
  "smoking", "drinking", "exercise_frequency", "has_pets", "relationship_goal",
  "first_date_preference", "past_relationships_count", "last_breakup_reason",
  "has_children", "wants_children", "personality_type",
];

function answered(question, answer) {
  const value = answer[question.field];
  return Array.isArray(value) ? value.length > 0 : Boolean(String(value ?? "").trim());
}

function shortDate(value) {
  const date = parseServerDate(value);
  return date ? date.toLocaleDateString() : "";
}

async function authHeaders() {
  return { Authorization: `Bearer ${await getToken()}` };
}

async function uploadFriendPhoto(userId, asset) {
  const form = new FormData();
  form.append("image", await shrink(asset));
  return postJson(`${BASE_URL}/friend_profiles/${userId}/photos`, {
    method: "POST",
    headers: await authHeaders(),
    body: form,
  });
}

// Admin > Members > "Profiles for friends": make a profile from the answers
// and photos a friend gave. The friend gets an email to check it and choose
// their password on the website; until then nobody sees it (see the server's
// db_friend_profiles.py). Same as blossom-date.com/admin/friends.
export default function FriendProfilesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const bottomInset = useBottomInset();
  const [rows, setRows] = useState(null);
  const [listError, setListError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    const result = await postJson(`${BASE_URL}/friend_profiles`, { headers: await authHeaders() });
    if (result.resp?.status === 403) {
      navigation.goBack();
      return;
    }
    if (!result.ok) {
      setListError(result.message);
      return;
    }
    setListError("");
    setRows(result.data);
  }, [navigation]);

  useAutoRefresh(() => load(), { minIntervalMs: 30000 });

  return (
    <View style={styles.screen}>
      <PageNav />
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={styles.back}
          accessibilityRole="button"
          accessibilityLabel={t("settings.back")}
        >
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>👯 {t("friends.title")}</Text>
      </View>

      <KeyboardAwareScroll contentContainerStyle={[styles.scroll, { paddingBottom: bottomInset + spacing.xl * 2 }]}>
        <Text style={styles.intro}>{t("friends.intro")}</Text>
        <View style={styles.steps}>
          {["step1", "step2", "step3"].map((key, i) => (
            <Text key={key} style={styles.step}>
              {i + 1}. {t(`friends.${key}`)}
            </Text>
          ))}
        </View>

        {notice !== "" && <Text style={styles.notice}>{notice}</Text>}

        {formOpen ? (
          <FriendForm
            onCancel={() => setFormOpen(false)}
            onDone={(message) => {
              setFormOpen(false);
              setNotice(message);
              load();
            }}
            onChanged={load}
          />
        ) : (
          <Pressable
            style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
            onPress={() => {
              setNotice("");
              setFormOpen(true);
            }}
          >
            <Text style={styles.primaryBtnText}>➕ {t("friends.new")}</Text>
          </Pressable>
        )}

        <Text style={styles.section}>{t("friends.listTitle")}</Text>
        {listError !== "" && <Text style={styles.error}>{listError}</Text>}
        {rows === null ? (
          listError === "" && <ActivityIndicator color={colors.primary} style={{ marginTop: spacing.md }} />
        ) : rows.length === 0 ? (
          <Text style={styles.muted}>{t("friends.empty")}</Text>
        ) : (
          rows.map((row) => <FriendRow key={row.user_id} row={row} onChanged={load} />)
        )}
      </KeyboardAwareScroll>
    </View>
  );
}

// ---- The form ------------------------------------------------------------
function FriendForm({ onCancel, onDone, onChanged }) {
  const { t, i18n } = useTranslation();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [dobText, setDobText] = useState("");
  const [language, setLanguage] = useState(() =>
    LANGUAGES.some(([code]) => i18n.language?.startsWith(code)) ? i18n.language.slice(0, 2) : "en",
  );
  const [place, setPlace] = useState({ country: "", city: "" });
  const [answer, setAnswer] = useState({});
  const [photos, setPhotos] = useState([]); // { key, asset, uploaded }
  // Once the profile exists on the server, only its photos and the email are
  // left to do - a retry must not create it twice.
  const [createdId, setCreatedId] = useState(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const dateOfBirth = birthDateToIso(dobText) || "";
  const questions = useMemo(() => questionsFor(allQuestions, answer.connection_type), [answer.connection_type]);
  const titleOf = (question) => (question.field === "connection_type" ? t("connection.question") : question.question);

  function pick(question, value) {
    setAnswer((cur) => ({ ...cur, [question.field]: value }));
  }

  async function addPhotos() {
    const assets = await pickPhotos({ max: MAX_PHOTOS - photos.length });
    if (!assets.length) return;
    setPhotos((cur) => [
      ...cur,
      ...assets.slice(0, MAX_PHOTOS - cur.length).map((asset, i) => ({
        key: `${Date.now()}-${i}`,
        asset,
        uploaded: false,
      })),
    ]);
  }

  function payload() {
    const body = {
      first_name: firstName.trim(),
      email: email.trim(),
      date_of_birth: dateOfBirth,
      language,
      city: place.city,
      country: place.country,
      connection_type: answer.connection_type || "both",
      languages: answer.language_name || [],
      learning_languages: answer.learning_language_name || [],
    };
    ANSWER_FIELDS.forEach((field) => {
      if (answer[field] !== undefined) body[field] = answer[field];
    });
    return body;
  }

  async function submit() {
    if (busy) return;
    setError("");
    if (!createdId) {
      if (!firstName.trim() || !email.trim() || !dateOfBirth || !place.country || !place.city) {
        return setError(t("friends.errFields"));
      }
      if (ageFromIso(dateOfBirth) < 18) return setError(t("friends.errAge"));
      const missing = questions.filter((q) => !answered(q, answer)).map(titleOf);
      if (missing.length) return setError(t("friends.errMissing", { list: missing.join(" · ") }));
    }
    if (photos.length < MIN_PHOTOS) return setError(t("friends.errPhotos", { count: MIN_PHOTOS }));

    let id = createdId;
    if (!id) {
      setBusy(t("friends.stepCreating"));
      const result = await postJson(`${BASE_URL}/friend_profiles`, {
        method: "POST",
        headers: { ...(await authHeaders()), "Content-Type": "application/json" },
        body: JSON.stringify(payload()),
      });
      if (!result.ok) {
        setBusy("");
        return setError(result.message);
      }
      id = result.data.user_id;
      setCreatedId(id);
      onChanged();
    }

    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      if (photo.uploaded) continue;
      setBusy(t("friends.stepPhoto", { n: i + 1, total: photos.length }));
      const result = await uploadFriendPhoto(id, photo.asset);
      if (!result.ok) {
        setBusy("");
        onChanged();
        return setError(`${result.message} ${t("friends.retryHint")}`);
      }
      setPhotos((cur) => cur.map((p) => (p.key === photo.key ? { ...p, uploaded: true } : p)));
    }

    setBusy(t("friends.stepSending"));
    const sent = await postJson(`${BASE_URL}/friend_profiles/${id}/send`, {
      method: "POST",
      headers: { ...(await authHeaders()), "Content-Type": "application/json" },
      body: JSON.stringify({ language }),
    });
    setBusy("");
    if (!sent.ok) {
      onChanged();
      return setError(`${sent.message} ${t("friends.retryHint")}`);
    }
    onDone(t("friends.done", { email: sent.data.email, name: sent.data.first_name }));
  }

  return (
    <View style={styles.form}>
      <View style={styles.formHead}>
        <Text style={styles.formTitle}>{t("friends.new")}</Text>
        <Pressable onPress={onCancel} disabled={busy !== ""} hitSlop={8}>
          <Text style={styles.linkText}>{t("friends.close")}</Text>
        </Pressable>
      </View>
      <Text style={styles.consent}>🤝 {t("friends.consentNote")}</Text>

      {createdId ? (
        <Text style={styles.notice}>{t("friends.savedFinish")}</Text>
      ) : (
        <>
          <Text style={styles.blockTitle}>1. {t("friends.sectionAbout")}</Text>
          <Text style={styles.label}>{t("friends.firstName")}</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            maxLength={60}
            autoCorrect={false}
          />
          <Text style={styles.label}>{t("friends.birthDate")}</Text>
          <TextInput
            style={styles.input}
            value={dobText}
            onChangeText={(text) => setDobText(formatBirthDate(text))}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={10}
          />
          <Text style={styles.label}>{t("friends.email")}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.hint}>{t("friends.emailHint")}</Text>
          <Text style={styles.label}>{t("friends.emailLanguage")}</Text>
          <View style={styles.chips}>
            {LANGUAGES.map(([code, label]) => (
              <Pressable
                key={code}
                style={[styles.chip, language === code && styles.chipActive]}
                onPress={() => setLanguage(code)}
              >
                <Text style={[styles.chipText, language === code && styles.chipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>{t("friends.location")}</Text>
          <LocationFields country={place.country} city={place.city} onChange={setPlace} />

          <Text style={styles.blockTitle}>2. {t("friends.sectionAnswers")}</Text>
          {questions.map((question, i) => (
            <View key={question.field} style={styles.question}>
              <View style={styles.questionTitleRow}>
                <Text style={styles.questionNumber}>{i + 1}</Text>
                <Text style={styles.questionTitle}>{titleOf(question)}</Text>
                {answered(question, answer) && <Text style={styles.tick}>✓</Text>}
              </View>
              <ProfileQuestion
                question={question}
                handleClicked={pick}
                answer={answer}
                setAnswer={setAnswer}
                setClicked={() => {}}
              />
            </View>
          ))}
        </>
      )}

      <Text style={styles.blockTitle}>
        {createdId ? "" : "3. "}
        {t("friends.sectionPhotos")}
      </Text>
      <Text style={styles.hint}>{t("friends.photosHint", { min: MIN_PHOTOS, max: MAX_PHOTOS })}</Text>
      <View style={styles.photoGrid}>
        {photos.map((photo, i) => (
          <View key={photo.key} style={styles.photo}>
            <Image source={{ uri: photo.asset.uri }} style={styles.photoImage} />
            {i === 0 && <Text style={styles.mainTag}>{t("friends.mainPhoto")}</Text>}
            {photo.uploaded ? (
              <Text style={[styles.photoBadge, styles.uploadedBadge]}>✓</Text>
            ) : (
              <Pressable
                style={[styles.photoBadge, styles.removeBadge]}
                onPress={() => setPhotos((cur) => cur.filter((p) => p.key !== photo.key))}
                disabled={busy !== ""}
                hitSlop={6}
                accessibilityLabel={t("friends.removePhoto")}
              >
                <Text style={styles.removeText}>✕</Text>
              </Pressable>
            )}
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <Pressable style={[styles.photo, styles.addPhoto]} onPress={addPhotos} disabled={busy !== ""}>
            <Text style={styles.addPhotoIcon}>📷</Text>
            <Text style={styles.addPhotoText}>{t("friends.addPhotos")}</Text>
          </Pressable>
        )}
      </View>

      {error !== "" && <Text style={styles.error}>{error}</Text>}

      <Pressable
        style={({ pressed }) => [styles.primaryBtn, styles.submitBtn, (pressed || busy !== "") && styles.pressed]}
        onPress={submit}
        disabled={busy !== ""}
      >
        {busy !== "" ? (
          <View style={styles.busyRow}>
            <ActivityIndicator color="#fff" size="small" />
            <Text style={styles.primaryBtnText}>{busy}</Text>
          </View>
        ) : (
          <Text style={styles.primaryBtnText}>
            {createdId ? t("friends.finish") : `✉️ ${t("friends.submit")}`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

// ---- One friend in the list ---------------------------------------------------
function FriendRow({ row, onChanged }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const pending = row.status !== "active";
  const enoughPhotos = row.photos.length >= MIN_PHOTOS;

  async function send() {
    setBusy(true);
    setError("");
    setMessage("");
    const result = await postJson(`${BASE_URL}/friend_profiles/${row.user_id}/send`, {
      method: "POST",
      headers: await authHeaders(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    setMessage(t("friends.resent", { email: row.email }));
    onChanged();
  }

  function confirmDelete() {
    Alert.alert(t("friends.delete"), t("friends.deleteConfirm", { name: row.first_name }), [
      { text: t("dateSpots.cancel"), style: "cancel" },
      { text: t("friends.delete"), style: "destructive", onPress: remove },
    ]);
  }

  async function remove() {
    setBusy(true);
    const result = await postJson(`${BASE_URL}/friend_profiles/${row.user_id}`, {
      method: "DELETE",
      headers: await authHeaders(),
    });
    setBusy(false);
    if (!result.ok) return setError(result.message);
    onChanged();
  }

  async function addPhotos() {
    const assets = await pickPhotos({ max: MAX_PHOTOS - row.photos.length });
    if (!assets.length) return;
    setBusy(true);
    setError("");
    for (const asset of assets) {
      const result = await uploadFriendPhoto(row.user_id, asset);
      if (!result.ok) {
        setError(result.message);
        break;
      }
    }
    setBusy(false);
    onChanged();
  }

  const status =
    row.status === "active"
      ? t("friends.status_active", { date: shortDate(row.claimed_at) })
      : row.status === "sent"
        ? t("friends.status_sent", { date: shortDate(row.sent_at), name: row.first_name })
        : t("friends.status_draft");

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        {row.photos[0] ? (
          <Image source={{ uri: IMG.thumb(row.photos[0].image_url) }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]}>
            <Text>🌸</Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {row.first_name}
          </Text>
          <Text style={styles.rowEmail} numberOfLines={1}>
            {row.email}
          </Text>
          <Text style={[styles.status, styles[`status_${row.status}`]]}>{status}</Text>
        </View>
        {busy && <ActivityIndicator color={colors.primary} />}
      </View>
      {pending && !enoughPhotos && <Text style={styles.warn}>{t("friends.needPhotos", { count: MIN_PHOTOS })}</Text>}
      {message !== "" && <Text style={styles.ok}>{message}</Text>}
      {error !== "" && <Text style={styles.error}>{error}</Text>}
      <View style={styles.rowActions}>
        {row.status === "active" && row.profile_id ? (
          <Pressable
            style={styles.smallBtn}
            onPress={() => navigation.navigate("ProfileDetails", { id: row.profile_id })}
          >
            <Text style={styles.smallBtnText}>{t("friends.view")}</Text>
          </Pressable>
        ) : null}
        {pending && row.photos.length < MAX_PHOTOS && (
          <Pressable style={styles.smallBtn} onPress={addPhotos} disabled={busy}>
            <Text style={styles.smallBtnText}>📷 {t("friends.addPhotos")}</Text>
          </Pressable>
        )}
        {pending && enoughPhotos && (
          <Pressable style={[styles.smallBtn, styles.smallBtnPrimary]} onPress={send} disabled={busy}>
            <Text style={[styles.smallBtnText, styles.smallBtnPrimaryText]}>
              ✉️ {row.status === "sent" ? t("friends.resend") : t("friends.send")}
            </Text>
          </Pressable>
        )}
        {pending && (
          <Pressable style={[styles.smallBtn, styles.smallBtnDanger]} onPress={confirmDelete} disabled={busy}>
            <Text style={[styles.smallBtnText, styles.smallBtnDangerText]}>{t("friends.delete")}</Text>
          </Pressable>
        )}
      </View>
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
  title: { ...typography.h3, fontSize: 18, flexShrink: 1 },
  scroll: { padding: spacing.md },
  intro: { fontSize: 15, lineHeight: 22, color: colors.textSoft },
  steps: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    padding: spacing.md,
    gap: 6,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  step: { fontSize: 14, lineHeight: 20, color: colors.textSoft },
  notice: {
    marginBottom: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: "#E9F7EF",
    borderWidth: 1,
    borderColor: "#BFE6CF",
    color: "#1F5C3D",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  section: { ...typography.h3, fontSize: 19, marginTop: spacing.xl, marginBottom: spacing.sm },
  muted: { color: colors.textMuted, fontSize: 14 },
  error: { color: colors.danger, fontSize: 14, fontWeight: "600", marginTop: spacing.sm, lineHeight: 20 },
  ok: { color: "#1F7A4D", fontSize: 13, fontWeight: "700", marginTop: 6 },
  warn: { color: "#9A5B00", fontSize: 13, fontWeight: "600", marginTop: 6 },
  primaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    ...shadow.md,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15, textAlign: "center" },
  pressed: { opacity: 0.8 },
  submitBtn: { marginTop: spacing.lg, paddingVertical: 16 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  linkText: { color: colors.textSoft, fontWeight: "600", fontSize: 14 },

  form: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    ...shadow.sm,
  },
  formHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm },
  formTitle: { ...typography.h3, fontSize: 18, flexShrink: 1 },
  consent: { marginTop: spacing.sm, fontSize: 13, lineHeight: 19, color: colors.textMuted },
  blockTitle: {
    ...typography.h3,
    fontSize: 17,
    color: colors.primaryDeep,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  label: { fontSize: 13.5, fontWeight: "700", color: colors.textSoft, marginTop: spacing.sm, marginBottom: 6 },
  hint: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 4, lineHeight: 18 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 14, fontWeight: "600", color: colors.textSoft },
  chipTextActive: { color: "#fff" },
  question: { paddingVertical: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  questionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },
  questionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryDeep,
    backgroundColor: colors.primarySoft,
    overflow: "hidden",
  },
  questionTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.text },
  tick: { color: "#1F7A4D", fontWeight: "800", fontSize: 16 },

  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: spacing.sm },
  photo: { width: "30%", aspectRatio: 3 / 4, borderRadius: radius.md, overflow: "hidden" },
  photoImage: { width: "100%", height: "100%", backgroundColor: colors.surfaceMuted },
  mainTag: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.55)",
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  photoBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  removeBadge: { backgroundColor: "rgba(0,0,0,0.6)" },
  removeText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  uploadedBadge: {
    backgroundColor: "#1F7A4D",
    color: "#fff",
    textAlign: "center",
    lineHeight: 26,
    fontWeight: "800",
  },
  addPhoto: {
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.primarySoft,
    backgroundColor: colors.primaryTint,
  },
  addPhotoIcon: { fontSize: 24 },
  addPhotoText: { fontSize: 12.5, fontWeight: "700", color: colors.primaryDeep, textAlign: "center" },

  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: 12,
    marginBottom: spacing.sm,
    ...shadow.sm,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarEmpty: { backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" },
  rowInfo: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: "700", color: colors.text },
  rowEmail: { fontSize: 13, color: colors.textMuted, marginTop: 1 },
  status: {
    alignSelf: "flex-start",
    marginTop: 5,
    paddingHorizontal: 9,
    paddingVertical: 2,
    borderRadius: radius.pill,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "700",
  },
  status_draft: { color: colors.textSoft, backgroundColor: colors.surfaceMuted },
  status_sent: { color: "#8A5300", backgroundColor: "#FFF4E0" },
  status_active: { color: "#1F5C3D", backgroundColor: "#E3F5EA" },
  rowActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: spacing.sm },
  smallBtn: {
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  smallBtnText: { fontSize: 13, fontWeight: "700", color: colors.textSoft },
  smallBtnPrimary: { backgroundColor: colors.primary, borderColor: colors.primary },
  smallBtnPrimaryText: { color: "#fff" },
  smallBtnDanger: { borderColor: "#F2C4C0" },
  smallBtnDangerText: { color: colors.danger },
});
