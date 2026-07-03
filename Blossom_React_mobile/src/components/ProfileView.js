import { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
} from "react-native";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function ProfileView({
  profile,
  showLocationLine = true,
  editable = false,
  onSaveBio,
  onAddPhotoPress,
  onDeletePhoto,
  uploadingPhoto = false,
  onDeleteAccount,
  deletingAccount = false,
  onBlock,
  onReport,
  blocking = false,
}) {
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState(profile.bio || "");
  const [savingBio, setSavingBio] = useState(false);

  async function handleSaveBio() {
    setSavingBio(true);
    try {
      await onSaveBio?.(bioDraft);
      setEditingBio(false);
    } finally {
      setSavingBio(false);
    }
  }

  const coverPhoto = profile.photos?.[0]?.image_url;

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
            <Text style={styles.badge}>💘 {profile.relationship_goal || "Not specified"}</Text>
            {profile.occupation ? <Text style={styles.badge}>💼 {profile.occupation}</Text> : null}
            {profile.education ? <Text style={styles.badge}>🎓 {profile.education}</Text> : null}
          </View>
        </View>
      )}

      {/* Safety buttons */}
      {(onBlock || onReport) && (
        <View style={styles.safetyRow}>
          {onReport && (
            <Pressable style={styles.reportButton} onPress={onReport}>
              <Text style={styles.reportButtonText}>⚠️ Report</Text>
            </Pressable>
          )}
          {onBlock && (
            <Pressable style={styles.blockButton} onPress={onBlock} disabled={blocking}>
              {blocking ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.blockButtonText}>🚫 Block</Text>
              )}
            </Pressable>
          )}
        </View>
      )}

      {/* Photos */}
      <Section
        title="Photos"
        action={
          editable && (
            <Pressable style={styles.actionButton} onPress={onAddPhotoPress} disabled={uploadingPhoto}>
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.actionButtonText}>+ Add Photo</Text>
              )}
            </Pressable>
          )
        }
      >
        <View style={styles.photosGrid}>
          {profile.photos?.length ? (
            profile.photos.map((p) => (
              <View key={p.id} style={styles.photoWrap}>
                <Image source={{ uri: p.image_url }} style={styles.photo} />
                {editable && (
                  <Pressable style={styles.deletePhotoButton} onPress={() => onDeletePhoto?.(p.id)}>
                    <Text style={styles.deletePhotoButtonText}>✕</Text>
                  </Pressable>
                )}
              </View>
            ))
          ) : (
            <Text style={styles.bodyMuted}>No photos added yet.</Text>
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
        <Fact label="Height" value={profile.height_cm ? `${profile.height_cm} cm` : null} />
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

      <Section title="Languages">
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

      {editable && (
        <Section title="Danger Zone">
          <Text style={styles.bodyMuted}>
            Permanently delete your account, profile, photos, matches, and messages.
          </Text>
          <Pressable style={styles.deleteAccountButton} onPress={onDeleteAccount} disabled={deletingAccount}>
            {deletingAccount ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>Delete Account</Text>
            )}
          </Pressable>
        </Section>
      )}
    </ScrollView>
  );
}

function Section({ title, children, action }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
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
  heroName: { fontSize: 28, fontWeight: "800", color: "#fff", textShadowColor: "rgba(0,0,0,0.5)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
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

  /* Safety */
  safetyRow: { flexDirection: "row", gap: spacing.sm, margin: spacing.md, marginTop: spacing.sm },
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
  deleteAccountButton: {
    backgroundColor: colors.danger, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: radius.pill, alignItems: "center", marginTop: spacing.sm,
  },

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
});
