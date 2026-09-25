import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
  StyleSheet,
  Dimensions,
} from "react-native";
import { useTranslation } from "react-i18next";
import { IMG } from "../api/images";
import { CONNECTION_EMOJI, CONNECTION_TYPES, connectionLabel, connectionOf } from "../api/connection";
import { colors, radius, spacing, shadow, typography } from "../theme";

// Height is stored as a string that already includes the unit (e.g. "170 cm"),
// so strip any trailing "cm" before re-adding exactly one to avoid "170 cm cm".
function formatHeight(value) {
  if (!value) return null;
  return `${String(value).replace(/\s*cm\s*$/i, "").trim()} cm`;
}

export default function ProfileView({
  profile,
  showLocationLine = true,
  editable = false,
  onSaveBio,
  onAddPhotoPress,
  onDeletePhoto,
  uploadingPhoto = false,
  onBlock,
  onReport,
  blocking = false,
  // Only for a match (profile opened from the chat).
  onUnmatch,
  unmatching = false,
  // Only on your own profile: the way into Settings.
  onOpenSettings,
  // Only on your own profile: switch between dating, language exchange, both.
  onChangeConnection,
}) {
  const { t } = useTranslation();
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile.bio || "");
  const [savingBio, setSavingBio] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [savingConnection, setSavingConnection] = useState(null);
  const [connectionError, setConnectionError] = useState("");

  const connection = connectionOf(profile);
  // Dating questions weren't asked of someone only here for language exchange.
  const datingProfile = connection !== "language";

  async function chooseConnection(type) {
    if (type === connection || savingConnection) return;
    setSavingConnection(type);
    setConnectionError("");
    try {
      await onChangeConnection(type);
    } catch {
      setConnectionError(t("connection.changeFailed"));
    } finally {
      setSavingConnection(null);
    }
  }

  async function handleSaveBio() {
    setSavingBio(true);
    try {
      await onSaveBio?.(bioDraft);
      setEditingBio(false);
    } finally {
      setSavingBio(false);
    }
  }

  const coverPhoto = IMG.full(profile.photos?.[0]?.image_url);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

      {/* HERO COVER PHOTO */}
      {coverPhoto && (
        <View style={styles.heroWrap}>
          <Image source={{ uri: coverPhoto }} style={styles.heroCover} />
          <View style={styles.heroGradient} />
          <View style={styles.heroInfo}>
            <Text style={styles.heroName}>
              {profile.first_name}
              <Text style={styles.heroAge}>, {profile.age}</Text>
            </Text>
            <View style={styles.heroBadges}>
              <Text style={[styles.heroBadge, styles.heroConnection]}>
                {connectionLabel(connection, t)}
              </Text>
              {profile.city ? (
                <Text style={styles.heroBadge}>📍 {profile.city}</Text>
              ) : null}
              {profile.relationship_goal ? (
                <Text style={styles.heroBadge}>💘 {profile.relationship_goal}</Text>
              ) : null}
              {profile.occupation ? (
                <Text style={styles.heroBadge}>💼 {profile.occupation}</Text>
              ) : null}
            </View>
          </View>
        </View>
      )}

      {/* Fallback header (no photo) */}
      {!coverPhoto && (
        <View style={styles.heroCard}>
          <Text style={styles.name}>
            {profile.first_name}
            <Text style={styles.age}>, {profile.age}</Text>
          </Text>
          {showLocationLine && (
            <Text style={styles.location}>
              📍 {profile.city || "Location not set"}, {profile.country || ""}
            </Text>
          )}
          <View style={styles.badges}>
            <Text style={styles.badge}>{connectionLabel(connection, t)}</Text>
            <Text style={styles.badge}>💘 {profile.relationship_goal || "Not specified"}</Text>
            {profile.occupation ? <Text style={styles.badge}>💼 {profile.occupation}</Text> : null}
            {profile.education ? <Text style={styles.badge}>🎓 {profile.education}</Text> : null}
          </View>
        </View>
      )}

      {/* Settings, spelled out and right under your name - a gear alone in
          the corner was easy to miss. */}
      {onOpenSettings && (
        <Pressable
          style={({ pressed }) => [styles.settingsRow, pressed && styles.settingsRowPressed]}
          onPress={onOpenSettings}
          accessibilityRole="button"
        >
          <Image
            source={require("../../assets/images/tabs/settings.png")}
            style={styles.settingsIcon}
          />
          <View style={styles.settingsText}>
            <Text style={styles.settingsTitle}>{t("settings.title")}</Text>
            <Text style={styles.settingsSubtitle} numberOfLines={1}>
              {t("settings.subtitle")}
            </Text>
          </View>
          <Text style={styles.settingsChevron}>›</Text>
        </Pressable>
      )}

      {/* Safety buttons */}
      {(onBlock || onReport || onUnmatch) && (
        <View style={styles.safetyRow}>
          {onUnmatch && (
            <Pressable style={styles.unmatchButton} onPress={onUnmatch} disabled={unmatching}>
              {unmatching ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.unmatchButtonText}>💔 {t("messages.unmatch")}</Text>
              )}
            </Pressable>
          )}
          {onReport && (
            <Pressable style={styles.reportButton} onPress={onReport}>
              <Text style={styles.reportButtonText}>⚠️ {t("safety.report")}</Text>
            </Pressable>
          )}
          {onBlock && (
            <Pressable style={styles.blockButton} onPress={onBlock} disabled={blocking}>
              {blocking ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.blockButtonText}>🚫 {t("safety.block")}</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* Your own profile: dating, language exchange or both - one tap. */}
      {editable && onChangeConnection ? (
        <Section title={t("connection.title")}>
          {CONNECTION_TYPES.map((type, index) => {
            const isSelected = connection === type;
            return (
              <Pressable
                key={type}
                style={({ pressed }) => [
                  styles.connectionRow,
                  index < CONNECTION_TYPES.length - 1 && styles.factDivider,
                  pressed && styles.connectionRowPressed,
                ]}
                onPress={() => chooseConnection(type)}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={styles.connectionEmoji}>{CONNECTION_EMOJI[type]}</Text>
                <View style={styles.connectionText}>
                  <Text style={[styles.connectionTitle, isSelected && styles.connectionTitleSelected]}>
                    {t(`connection.${type}`)}
                  </Text>
                  <Text style={styles.connectionDesc}>{t(`connection.${type}Desc`)}</Text>
                </View>
                {savingConnection === type ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <View style={styles.radioDot} /> : null}
                  </View>
                )}
              </Pressable>
            );
          })}
          {connectionError !== "" ? <Text style={styles.connectionError}>{connectionError}</Text> : null}
        </Section>
      ) : null}

      {/* Photos */}
      <Section
        title={t("photos.section")}
        action={
          editable && (
            <Pressable style={styles.actionButton} onPress={onAddPhotoPress} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.actionButtonText}>{t("photos.addButton")}</Text>
              )}
            </Pressable>
          )
        }
      >
        <View style={styles.photosGrid}>
          {profile.photos?.length ? (
            profile.photos.map((p) => (
              <Pressable key={p.id} style={styles.photoWrap} onPress={() => setLightboxPhoto(p.image_url)}>
                <Image source={{ uri: IMG.card(p.image_url) }} style={styles.photo} />
                {editable && (
                  <Pressable
                    style={styles.deletePhotoButton}
                    onPress={() => onDeletePhoto?.(p.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={t("photos.remove")}
                  >
                    <Text style={styles.deletePhotoButtonText}>✕</Text>
                  </Pressable>
                )}
              </Pressable>
            ))
          ) : (
            <Text style={styles.bodyMuted}>{t("photos.none")}</Text>
          )}
        </View>
      </Section>

      {/* About */}
      <Section
        title={`About ${profile.first_name}`}
        action={
          editable && !editingBio && (
            <Pressable style={styles.actionButtonOutline} onPress={() => { setBioDraft(profile.bio || ""); setEditingBio(true); }}>
              <Text style={styles.actionButtonOutlineText}>Edit</Text>
            </Pressable>
          )
        }
      >
        {editingBio ? (
          <View>
            <TextInput
              style={styles.bioInput}
              multiline
              value={bioDraft}
              onChangeText={setBioDraft}
            />
            <View style={styles.bioActions}>
              <Pressable style={styles.actionButton} onPress={handleSaveBio} disabled={savingBio}>
                {savingBio ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.actionButtonText}>Save</Text>}
              </Pressable>
              <Pressable style={styles.actionButtonOutline} onPress={() => setEditingBio(false)}>
                <Text style={styles.actionButtonOutlineText}>Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={styles.bio}>{profile.bio || "No bio added yet."}</Text>
        )}
      </Section>

      <Section title="Basic Information">
        <Fact label="Gender" value={profile.gender} />
        <Fact label="Orientation" value={profile.sexual_orientation} />
        <Fact label="Height" value={formatHeight(profile.height_cm)} />
        <Fact label="Occupation" value={profile.occupation} />
        <Fact label="Education" value={profile.education} />
        <Fact label="Personality" value={profile.personality_type} last />
      </Section>

      <Section title="Lifestyle">
        <Fact label="Smoking" value={profile.smoking} />
        <Fact label="Drinking" value={profile.drinking} />
        <Fact label="Exercise" value={profile.exercise_frequency} />
        <Fact label="Pets" value={profile.has_pets} last />
      </Section>

      {/* Not asked of someone only here for language exchange. */}
      {datingProfile ? (
        <>
          <Section title="Family & Future">
            <Fact label="Children" value={profile.has_children} />
            <Fact label="Wants children" value={profile.wants_children} />
            <Fact label="Goal" value={profile.relationship_goal} last />
          </Section>

          <Section title="Dating Preferences">
            <Fact label="Ideal first date" value={profile.first_date_preference} />
            <Fact label="Past relationships" value={profile.past_relationships_count} />
            <Fact label="Last breakup reason" value={profile.last_breakup_reason} last />
          </Section>
        </>
      ) : null}

      <Section title="Speaks">
        <View style={styles.tags}>
          {profile.languages?.length ? (
            profile.languages.map((l, i) => (
              <Text key={i} style={styles.tag}>{l.language_name || l}</Text>
            ))
          ) : (
            <Text style={styles.bodyMuted}>No languages listed</Text>
          )}
        </View>
      </Section>

      {profile.learning_languages?.length > 0 && (
        <Section
          title="📚 Learning"
          cardStyle={styles.learningCard}
          titleStyle={styles.learningCardTitle}
        >
          <View style={styles.tags}>
            {profile.learning_languages.map((l, i) => (
              <Text key={i} style={[styles.tag, styles.learningTag]}>{l.language_name || l}</Text>
            ))}
          </View>
        </Section>
      )}

      <Modal visible={!!lightboxPhoto} transparent animationType="fade" onRequestClose={() => setLightboxPhoto(null)}>
        <Pressable style={styles.lightboxOverlay} onPress={() => setLightboxPhoto(null)}>
          {lightboxPhoto && (
            <Image source={{ uri: IMG.full(lightboxPhoto) }} style={styles.lightboxImage} resizeMode="contain" />
          )}
          <Pressable style={styles.lightboxClose} onPress={() => setLightboxPhoto(null)}>
            <Text style={styles.lightboxCloseText}>✕</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

function Section({ title, children, action, cardStyle, titleStyle }) {
  return (
    <View style={[styles.card, cardStyle]}>
      <View style={styles.cardHeader}>
        <Text style={[styles.cardTitle, titleStyle]}>{title}</Text>
        {action || null}
      </View>
      {children}
    </View>
  );
}

function Fact({ label, value, last }) {
  return (
    <View style={[styles.fact, !last && styles.factDivider]}>
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 120 },

  /* Hero */
  heroWrap: { position: "relative", height: 340 },
  heroCover: { width: "100%", height: "100%", resizeMode: "cover" },
  heroGradient: {
    position: "absolute",
    bottom: 0, left: 0, right: 0, height: "65%",
    backgroundColor: "transparent",
    // Simulated gradient via opacity layers
  },
  heroInfo: {
    position: "absolute",
    bottom: 20, left: 20, right: 20,
  },
  heroName: { fontFamily: "serif", fontSize: 32, fontWeight: "700", letterSpacing: -0.5, color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 10 },
  heroAge: { fontSize: 22, fontWeight: "400", color: "rgba(255,255,255,0.9)" },
  heroBadges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },

  /* Fallback hero */
  heroCard: {
    margin: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.sm,
  },
  name: { ...typography.h1 },
  age: { fontWeight: "400", color: colors.textMuted },
  location: { ...typography.bodyMuted, marginTop: spacing.xs },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.sm },
  badge: {
    backgroundColor: colors.primarySoft,
    color: colors.primaryDark,
    fontWeight: "600",
    fontSize: 13,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },

  /* Dating / language exchange / both (own profile) */
  heroConnection: { backgroundColor: "rgba(193,70,107,0.85)", borderColor: "rgba(255,255,255,0.5)" },
  connectionRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: 12 },
  connectionRowPressed: { opacity: 0.7 },
  connectionEmoji: { fontSize: 24, width: 40, textAlign: "center" },
  connectionText: { flex: 1 },
  connectionTitle: { fontSize: 15, fontWeight: "700", color: colors.text },
  connectionTitleSelected: { color: colors.primary },
  connectionDesc: { ...typography.bodyMuted, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  connectionError: { color: colors.danger, fontSize: 13, marginTop: spacing.sm },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: { borderColor: colors.primary },
  radioDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.primary },

  /* Settings entry (own profile) */
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.primarySoft,
    ...shadow.sm,
  },
  settingsRowPressed: { backgroundColor: colors.primaryTint },
  settingsIcon: { width: 26, height: 26, tintColor: colors.primary },
  settingsText: { flex: 1 },
  settingsTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  settingsSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  settingsChevron: { fontSize: 24, color: colors.textMuted },

  /* Safety */
  safetyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    margin: spacing.md,
    marginTop: spacing.sm,
  },
  unmatchButton: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  unmatchButtonText: { color: colors.primaryDeep, fontWeight: "700", fontSize: 13 },
  reportButton: {
    borderWidth: 1.5,
    borderColor: "#ddd",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  reportButtonText: { color: "#888", fontWeight: "600", fontSize: 13 },
  blockButton: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: radius.pill,
  },
  blockButtonText: { color: "#dc2626", fontWeight: "700", fontSize: 13 },

  /* Cards */
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm },
  cardTitle: { fontSize: 11, fontWeight: "700", color: colors.primary, textTransform: "uppercase", letterSpacing: 0.8 },

  /* Photos */
  photosGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  photoWrap: { position: "relative", width: "48%", aspectRatio: 1 },
  photo: { width: "100%", height: "100%", borderRadius: radius.md, resizeMode: "cover" },
  deletePhotoButton: {
    position: "absolute", top: 6, right: 6,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center", justifyContent: "center",
  },
  deletePhotoButtonText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  /* Bio */
  bioInput: {
    borderWidth: 1.5, borderColor: colors.border, borderRadius: radius.sm,
    padding: spacing.md, minHeight: 100, textAlignVertical: "top",
    color: colors.text, ...typography.body,
  },
  bioActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  bio: { ...typography.body, lineHeight: 22 },
  bodyMuted: { ...typography.bodyMuted },

  /* Buttons */
  actionButton: { backgroundColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionButtonOutline: { borderWidth: 1.5, borderColor: colors.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
  actionButtonOutlineText: { color: colors.primary, fontWeight: "700", fontSize: 13 },

  /* Facts */
  fact: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  factDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  factLabel: { color: colors.textMuted, fontSize: 13 },
  factValue: { fontWeight: "700", color: colors.text, fontSize: 13, flexShrink: 1, textAlign: "right", maxWidth: "55%" },

  /* Tags */
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    backgroundColor: colors.primarySoft, color: colors.primaryDark,
    fontSize: 13, fontWeight: "600",
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill,
  },
  learningTag: {
    backgroundColor: "#ede9fe", color: "#6d28d9", borderWidth: 1, borderColor: "#c4b5fd",
  },
  learningCard: {
    backgroundColor: "#f5f0ff",
    borderWidth: 1.5,
    borderColor: "#d8b4fe",
  },
  learningCardTitle: {
    color: "#7c3aed",
  },

  /* Lightbox */
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.93)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxImage: {
    width: Dimensions.get("window").width,
    height: Dimensions.get("window").height * 0.85,
  },
  lightboxClose: {
    position: "absolute",
    top: 52,
    right: 20,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  lightboxCloseText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
