import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { IMG } from "../api/images";
import { deletePhoto, fetchOwnPhotos, findSavedPhoto, pickPhotos, uploadPhoto } from "../api/photoUpload";
import { colors, radius, spacing, shadow } from "../theme";

const MAX = 6;
const MIN_REQUIRED = 2;

let nextKey = 0;

export default function MultiImageUpload() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  // [{ key, uri, status: "done" | "uploading" | "failed", id?, asset?, message? }]
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Ids of the photos already on the server (null until known).
  const knownIds = useRef(null);
  const mounted = useRef(true);

  function update(key, changes) {
    if (!mounted.current) return;
    setSlots((prev) => prev.map((s) => (s.key === key ? { ...s, ...changes } : s)));
  }

  // Photos already uploaded (coming back to this step, or saved after a
  // dropped connection) show straight away.
  useEffect(() => {
    mounted.current = true;
    fetchOwnPhotos()
      .then((photos) => {
        if (!mounted.current) return;
        knownIds.current = new Set(photos.map((p) => p.id));
        setSlots((prev) => [
          ...photos.slice(0, MAX).map((p) => ({ key: `s${p.id}`, id: p.id, uri: IMG.thumb(p.image_url), status: "done" })),
          ...prev.filter((s) => !knownIds.current.has(s.id)),
        ]);
      })
      .catch(() => {})
      .finally(() => mounted.current && setLoading(false));
    return () => {
      mounted.current = false;
    };
  }, []);

  function saved(key, photo) {
    knownIds.current?.add(photo.id);
    update(key, { status: "done", id: photo.id, message: "" });
  }

  async function send(key, asset) {
    update(key, { status: "uploading", message: "" });
    try {
      saved(key, await uploadPhoto(asset, knownIds.current));
    } catch (err) {
      update(key, { status: "failed", message: err.message || t("photos.connection") });
    }
  }

  async function addPhotos() {
    setError("");
    const free = MAX - slots.length;
    if (free <= 0) return;
    const assets = await pickPhotos({ max: free });
    const added = assets.map((asset) => ({ key: `n${nextKey++}`, uri: asset.uri, asset, status: "uploading" }));
    if (!added.length) return;
    setSlots((prev) => [...prev, ...added].slice(0, MAX));
    added.forEach((s) => send(s.key, s.asset));
  }

  // A photo that "failed" may have reached the server after all: look first,
  // then send it again. (Not while others are uploading - a new photo on the
  // server could be theirs.)
  async function retry(slot) {
    const othersUploading = slots.some((s) => s.status === "uploading" && s.key !== slot.key);
    update(slot.key, { status: "uploading", message: "" });
    if (knownIds.current && !othersUploading) {
      const found = await findSavedPhoto(knownIds.current, { waits: [0] });
      if (found) return saved(slot.key, found);
    }
    send(slot.key, slot.asset);
  }

  async function remove(slot) {
    setError("");
    setSlots((prev) => prev.filter((s) => s.key !== slot.key));
    if (slot.status !== "done") return;
    try {
      await deletePhoto(slot.id);
      knownIds.current?.delete(slot.id);
    } catch {
      // Still on the server: put it back and say so.
      if (!mounted.current) return;
      setSlots((prev) => [...prev, slot]);
      setError(t("photos.deleteFailed"));
    }
  }

  const doneCount = slots.filter((s) => s.status === "done").length;
  const uploading = slots.some((s) => s.status === "uploading");
  const missing = Math.max(0, MIN_REQUIRED - doneCount);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.title}>{t("photos.title")}</Text>
      <Text style={styles.subtitle}>{t("photos.subtitle", { min: MIN_REQUIRED, max: MAX })}</Text>

      <View style={styles.grid}>
        {Array.from({ length: MAX }).map((_, index) => {
          const slot = slots[index];
          if (!slot) {
            return (
              <Pressable
                key={`empty${index}`}
                style={({ pressed }) => [styles.box, styles.addBox, pressed && styles.addBoxPressed]}
                onPress={addPhotos}
                disabled={loading}
                accessibilityRole="button"
                accessibilityLabel={t("photos.add")}
              >
                {loading && index === 0 ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <Text style={styles.plus}>+</Text>
                )}
              </Pressable>
            );
          }
          return (
            <View key={slot.key} style={styles.box}>
              <Image source={{ uri: slot.uri }} style={styles.image} />
              {slot.status === "uploading" && (
                <View style={styles.overlay}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              {slot.status === "failed" && (
                <Pressable style={[styles.overlay, styles.failedOverlay]} onPress={() => retry(slot)}>
                  <Text style={styles.failedIcon}>↻</Text>
                  <Text style={styles.failedText}>{t("photos.tapToRetry")}</Text>
                </Pressable>
              )}
              {slot.status !== "uploading" && (
                <Pressable
                  style={styles.removeBtn}
                  onPress={() => remove(slot)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={t("photos.remove")}
                >
                  <Text style={styles.removeBtnText}>✕</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {slots.some((s) => s.status === "failed") && (
        <Text style={styles.error}>
          {slots.find((s) => s.status === "failed").message || t("photos.connection")}
        </Text>
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}

      {missing > 0 || uploading ? (
        <Text style={styles.hint}>
          {uploading ? t("photos.uploading") : t(missing === 1 ? "photos.addOne" : "photos.addMore", { count: missing })}
        </Text>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          // Sign-up is over: start the app fresh on the tabs.
          onPress={() => navigation.reset({ index: 0, routes: [{ name: "Main" }] })}
        >
          <Text style={styles.buttonText}>{t("photos.continue")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: "center", justifyContent: "center", padding: 24 },
  title: { fontSize: 22, fontWeight: "700", color: colors.text, textAlign: "center" },
  subtitle: {
    marginTop: 6,
    marginBottom: 20,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  box: {
    width: 100,
    height: 100,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
  },
  addBox: { borderStyle: "dashed", backgroundColor: colors.primaryTint },
  addBoxPressed: { backgroundColor: colors.primarySoft },
  image: { width: "100%", height: "100%" },
  plus: { fontSize: 30, fontWeight: "600", color: colors.primary },
  removeBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 11,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#fff", fontSize: 12 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  failedOverlay: { backgroundColor: "rgba(160,20,40,0.72)", paddingHorizontal: 6 },
  failedIcon: { color: "#fff", fontSize: 22, fontWeight: "700" },
  failedText: { color: "#fff", fontSize: 11, fontWeight: "600", textAlign: "center" },
  error: {
    marginTop: spacing.md,
    fontSize: 13,
    color: colors.danger,
    textAlign: "center",
  },
  hint: {
    marginTop: spacing.lg,
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted,
    textAlign: "center",
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    paddingHorizontal: 36,
    alignItems: "center",
    ...shadow.md,
  },
  buttonPressed: {
    backgroundColor: colors.primaryDark,
    transform: [{ scale: 0.98 }],
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16, letterSpacing: 0.3 },
});
