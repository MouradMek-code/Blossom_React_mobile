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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <Text style={styles.name}>
          {profile.first_name}
          <Text style={styles.age}>, {profile.age}</Text>
        </Text>

        {showLocationLine && (
          <Text style={styles.location}>
            📍 {profile.city || "Location not set"}, {profile.country || "Location not set"}
          </Text>
        )}

        <View style={styles.badges}>
          <Text style={styles.badge}>💘 {profile.relationship_goal || "Not specified"}</Text>
          {profile.occupation ? <Text style={styles.badge}>💼 {profile.occupation}</Text> : null}
          {profile.education ? <Text style={styles.badge}>🎓 {profile.education}</Text> : null}
        </View>
      </View>

      <Section
        title="Photos"
        action={
          editable && (
            <Pressable
              style={styles.actionButton}
              onPress={onAddPhotoPress}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.actionButtonText}>+ Add Photo</Text>
              )}
            </Pressable>
          )
        }
      >
        <View style={styles.photosColumn}>
          {profile.photos?.length ? (
            profile.photos.map((p) => (
              <View key={p.id}>
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

      <Section
        title={`About ${profile.first_name}`}
        action={
          editable &&
          !editingBio && (
            <Pressable
              style={styles.actionButtonOutline}
              onPress={() => {
                setBioDraft(profile.bio || "");
                setEditingBio(true);
              }}
            >
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
                {savingBio ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.actionButtonText}>Save</Text>
                )}
              </Pressable>
              <Pressable
                style={styles.actionButtonOutline}
                onPress={() => setEditingBio(false)}
              >
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

      <Section title="Languages">
        <View style={styles.tags}>
          {profile.languages?.length ? (
            profile.languages.map((l, i) => (
              <Text key={i} style={styles.tag}>
                {l.language_name || l}
              </Text>
            ))
          ) : (
            <Text style={styles.bodyMuted}>No languages listed</Text>
          )}
        </View>
      </Section>
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
      <Text style={styles.factValue}>{value || "-"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, paddingBottom: spacing.xl },
  heroCard: {
    marginBottom: spacing.md,
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.sm,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  cardTitle: { ...typography.h3 },
  photosColumn: { gap: spacing.sm },
  photo: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  deletePhotoButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  deletePhotoButtonText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  actionButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  actionButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionButtonOutline: {
    borderWidth: 1.5,
    borderColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  actionButtonOutlineText: { color: colors.primary, fontWeight: "700", fontSize: 13 },
  bioInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
    color: colors.text,
    ...typography.body,
  },
  bioActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  bio: { ...typography.body, lineHeight: 22 },
  bodyMuted: { ...typography.bodyMuted },
  fact: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10 },
  factDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  factLabel: { color: colors.textMuted, fontSize: 14 },
  factValue: { fontWeight: "700", color: colors.text, fontSize: 14 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tag: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
