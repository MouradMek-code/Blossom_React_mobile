import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Dimensions, Image, Pressable, Text, View, StyleSheet } from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { IMG } from "../api/images";
import { loadFeaturedSpot, loadPublicSpots } from "../api/publicSpots";
import { Icon, haptics } from "../ui";
import { colors, typography } from "../theme";

// How long each photo stays (the change itself is a 1 s cross-fade).
const SLIDE_MS = 3000;
const FADE_MS = 1000;
const MAX_SLIDES = 12;
const HEIGHT = Math.max(380, Math.round(Dimensions.get("window").height * 0.62));

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}


// The spot of the week first (else the list's first: gift spots lead), then
// the others in a new random order each time.
function wallOrder(all, weekly) {
  const withPhoto = all.filter((s) => s.image_url);
  const first = weekly?.image_url ? weekly : withPhoto[0];
  if (!first) return [];
  return [first, ...shuffle(withPhoto.filter((s) => s.id !== first.id))].slice(0, MAX_SLIDES);
}

// Home: a big wallpaper of real date spots, one photo after another, with
// "Spots for dating" on it - a tap opens the date spots. Same as the website.
// Photos load one ahead; it stops while the screen is hidden or the app is in
// the background, and stays on one photo with "reduce motion". No spot with
// a photo: nothing is shown.
export default function SpotsWallpaper() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const focused = useIsFocused();
  const [spots, setSpots] = useState([]);
  const [weeklyId, setWeeklyId] = useState(null);
  const [index, setIndex] = useState(0);
  const [needed, setNeeded] = useState(() => new Set([0, 1]));
  const [active, setActive] = useState(AppState.currentState === "active");
  const [calm, setCalm] = useState(false);
  // One fade and one zoom per photo: the old photo keeps its size while it
  // fades out under the new one.
  const fades = useRef([]);
  const zooms = useRef([]);

  useEffect(() => {
    let alive = true;
    Promise.all([loadPublicSpots(), loadFeaturedSpot()]).then(([all, weekly]) => {
      if (!alive) return;
      const picked = wallOrder(all, weekly);
      setWeeklyId(weekly?.image_url ? weekly.id : null);
      fades.current = picked.map((_, i) => new Animated.Value(i === 0 ? 1 : 0));
      zooms.current = picked.map(() => new Animated.Value(1.04));
      setSpots(picked);
    });
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => alive && setCalm(Boolean(on)))
      .catch(() => {});
    const sub = AppState.addEventListener("change", (state) => setActive(state === "active"));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  const count = spots.length;

  useEffect(() => {
    if (count < 2 || !focused || !active || calm) return undefined;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), SLIDE_MS);
    return () => clearInterval(timer);
  }, [count, focused, active, calm]);

  // Cross-fade to the new photo, with a slow zoom while it's shown; load the
  // one after it in the meantime.
  useEffect(() => {
    if (count === 0) return;
    const next = (index + 1) % count;
    setNeeded((cur) => (cur.has(index) && cur.has(next) ? cur : new Set([...cur, index, next])));
    Image.prefetch(IMG.full(spots[next].image_url)).catch(() => {});
    if (calm) return;
    Animated.parallel(
      fades.current.map((value, i) =>
        Animated.timing(value, { toValue: i === index ? 1 : 0, duration: FADE_MS, useNativeDriver: true }),
      ),
    ).start();
    const zoom = zooms.current[index];
    zoom.setValue(1.04);
    Animated.timing(zoom, { toValue: 1.12, duration: SLIDE_MS * 2, useNativeDriver: true }).start();
  }, [index, count, spots, calm]);

  if (count === 0) return null;
  const current = spots[index];

  function open() {
    haptics.tap();
    navigation.navigate("DateSpots");
  }

  return (
    <Pressable
      onPress={open}
      style={styles.wall}
      accessibilityRole="link"
      accessibilityLabel={`${t("spotsWall.title")}. ${t("spotsWall.button")}`}
    >
      {spots.map((spot, i) =>
        needed.has(i) ? (
          <Animated.Image
            key={spot.id}
            source={{ uri: IMG.full(spot.image_url) }}
            style={[
              StyleSheet.absoluteFill,
              styles.slide,
              { opacity: fades.current[i], transform: [{ scale: zooms.current[i] }] },
            ]}
            resizeMode="cover"
          />
        ) : null,
      )}
      <LinearGradient
        colors={["rgba(20,10,14,0.12)", "rgba(20,10,14,0.35)", "rgba(20,10,14,0.85)"]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Which place this is. */}
      {current.id === weeklyId ? (
        <View style={[styles.caption, styles.captionWeekly]}>
          <Text style={styles.captionText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {t("dateSpots.spotOfWeek")} · {current.name}
          </Text>
        </View>
      ) : (
        <View style={styles.caption}>
          <Icon name="map-pin" size={14} color="#fff" />
          <Text style={styles.captionText} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {[current.name, current.city].filter(Boolean).join(" · ")}
          </Text>
        </View>
      )}

      <View style={styles.content}>
        <Text style={styles.title} maxFontSizeMultiplier={1.3}>{t("spotsWall.title")}</Text>
        <Text style={styles.text} maxFontSizeMultiplier={1.4}>{t("spotsWall.text")}</Text>
        <View style={styles.cta}>
          <Text style={styles.ctaText} maxFontSizeMultiplier={1.3}>{t("spotsWall.button")}</Text>
          <Icon name="arrow-right" size={18} color={colors.primaryDeep} />
        </View>
      </View>

      {count > 1 ? (
        <View style={styles.dots}>
          {spots.map((spot, i) => (
            <View key={spot.id} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wall: { height: HEIGHT, overflow: "hidden", backgroundColor: "#2A2420" },
  slide: { width: "100%", height: "100%" },
  caption: {
    position: "absolute",
    top: 16,
    end: 16,
    maxWidth: "80%",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(20,14,12,0.55)",
  },
  captionWeekly: { backgroundColor: "rgba(193,70,107,0.9)" },
  captionText: { color: "#fff", fontSize: 13, fontWeight: "700", flexShrink: 1 },
  content: { position: "absolute", start: 0, end: 0, bottom: 0, paddingHorizontal: 20, paddingBottom: 46 },
  title: {
    ...typography.h1,
    color: "#fff",
    fontSize: 36,
    lineHeight: 40,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowRadius: 12,
  },
  text: { color: "rgba(255,255,255,0.94)", fontSize: 15.5, lineHeight: 22, marginTop: 8, marginBottom: 18 },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: 999,
    backgroundColor: "#fff",
  },
  ctaText: { color: colors.primaryDeep, fontWeight: "800", fontSize: 15.5 },
  dots: {
    position: "absolute",
    bottom: 18,
    alignSelf: "center",
    flexDirection: "row",
    gap: 6,
  },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.45)" },
  dotOn: { width: 20, backgroundColor: "#fff" },
});
