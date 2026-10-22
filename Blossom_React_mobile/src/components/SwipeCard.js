import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { IMG } from "../api/images";
import { isNewMember } from "../api/newMember";
import { CONNECTION_DOTS, connectionOf, languagesLine } from "../api/connection";
import { colors, radius, spacing, shadow } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.28;

// "170" or "170 cm" -> "170 cm".
function formatHeight(value) {
  if (!value) return null;
  return `${String(value).replace(/\s*cm\s*$/i, "").trim()} cm`;
}

// One person in Browse, Bumble-style: the first photo fills the card, and
// scrolling down inside it shows the rest of the profile - about, basics,
// languages, the other photos. Swipe right to like, left to pass: a sideways
// drag moves the card, an up-and-down one scrolls it.
export default function SwipeCard({ profile, onSwipeLeft, onSwipeRight, onOpenProfile, isTop }) {
  const { t, i18n } = useTranslation();
  // Small caps with letter spacing for Latin scripts only: spacing breaks
  // Arabic's joined letters, and Chinese has no capitals.
  const latinScript = !/^(ar|zh)/.test(i18n.language || "");
  const position = useRef(new Animated.Value(0)).current;
  const [cardHeight, setCardHeight] = useState(0);

  // PanResponder.create's callbacks close over whatever these refs pointed to
  // at creation time, so re-renders (e.g. isTop flipping false -> true when a
  // card moves to the top of the deck) must update the refs in place rather
  // than rely on fresh closures - the responder itself is only created once.
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;
  const onSwipeLeftRef = useRef(onSwipeLeft);
  onSwipeLeftRef.current = onSwipeLeft;
  const onSwipeRightRef = useRef(onSwipeRight);
  onSwipeRightRef.current = onSwipeRight;

  function flyAway(direction) {
    Animated.timing(position, {
      toValue: direction * SCREEN_WIDTH * 1.5,
      duration: 230,
      useNativeDriver: true,
    }).start(() => (direction > 0 ? onSwipeRightRef.current() : onSwipeLeftRef.current()));
  }

  function springBack() {
    Animated.spring(position, { toValue: 0, friction: 6, useNativeDriver: true }).start();
  }

  // Sideways and clearly more sideways than up/down: that's a swipe, taken
  // from the scroll inside the card. Anything else scrolls the profile.
  const isSideways = (g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.4;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, g) => isTopRef.current && isSideways(g),
      onMoveShouldSetPanResponder: (_, g) => isTopRef.current && isSideways(g),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => position.setValue(g.dx),
      onPanResponderRelease: (_, g) => {
        // Far enough, or a quick flick.
        if (g.dx > SWIPE_THRESHOLD || (g.vx > 0.9 && g.dx > 40)) flyAway(1);
        else if (g.dx < -SWIPE_THRESHOLD || (g.vx < -0.9 && g.dx < -40)) flyAway(-1);
        else springBack();
      },
      onPanResponderTerminate: springBack,
    }),
  ).current;

  // The scroll-down hint bobs gently, so it's clear there's more.
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!isTop) return undefined;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isTop, bob]);

  const rotate = position.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-12deg", "0deg", "12deg"],
    extrapolate: "clamp",
  });
  const likeOpacity = position.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });
  const nopeOpacity = position.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });
  // The "New" badge fades as the LIKE / NOPE stamps come in.
  const badgeOpacity = position.interpolate({
    inputRange: [-SWIPE_THRESHOLD / 2, 0, SWIPE_THRESHOLD / 2],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });

  const connection = connectionOf(profile);
  const dating = connection !== "language";
  // The languages matter to anyone open to language exchange.
  const languages = connection === "dating" ? "" : languagesLine(profile);
  const photos = (profile.photos || []).filter((p) => p?.image_url);
  const names = (list) => (list || []).map((l) => l?.language_name || l).filter(Boolean);
  const speaks = names(profile.languages);
  const learning = names(profile.learning_languages);
  const facts = [
    ["📏", "factHeight", formatHeight(profile.height_cm)],
    ["💼", "factWork", profile.occupation],
    ["🎓", "factEducation", profile.education],
    dating && ["💘", "factGoal", profile.relationship_goal],
    dating && ["☕", "factFirstDate", profile.first_date_preference],
    ["🚬", "factSmoking", profile.smoking],
    ["🍷", "factDrinking", profile.drinking],
    ["🏃", "factExercise", profile.exercise_frequency],
    ["🐾", "factPets", profile.has_pets],
    dating && ["👶", "factChildren", profile.has_children],
    dating && ["🍼", "factWantsChildren", profile.wants_children],
  ].filter((f) => f && f[2]);

  return (
    <Animated.View
      {...(isTop ? panResponder.panHandlers : {})}
      pointerEvents={isTop ? "auto" : "none"}
      onLayout={(e) => setCardHeight(e.nativeEvent.layout.height)}
      style={[styles.card, { transform: [{ translateX: position }, { rotate }] }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        scrollEnabled={isTop}
        nestedScrollEnabled
        bounces={false}
        overScrollMode="never"
      >
        {/* The first photo, the whole card. Screen readers get "Like" and
            "Pass" on it, without swiping. */}
        <View
          style={{ height: cardHeight || 520 }}
          accessible
          accessibilityLabel={[profile.first_name, profile.age, profile.city].filter(Boolean).join(", ")}
          accessibilityActions={[
            { name: "like", label: t("browse.like") },
            { name: "pass", label: t("browse.pass") },
          ]}
          onAccessibilityAction={(e) => flyAway(e.nativeEvent.actionName === "like" ? 1 : -1)}
        >
          {photos[0] ? (
            <Image source={{ uri: IMG.full(photos[0].image_url) }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.noPhoto]}>
              <Text style={styles.noPhotoEmoji}>🌸</Text>
            </View>
          )}
          <LinearGradient
            colors={["rgba(0,0,0,0.25)", "transparent", "transparent", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
            locations={[0, 0.16, 0.5, 0.75, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Joined less than a week ago. */}
          {isNewMember(profile) ? (
            <Animated.View style={[styles.newBadge, { opacity: badgeOpacity }]}>
              <View style={styles.newDot} />
              <Text style={[styles.newBadgeText, latinScript && styles.smallCaps]}>{t("browse.new")}</Text>
            </Animated.View>
          ) : null}
          {photos.length > 1 ? (
            <View style={styles.photoCount}>
              <Text style={styles.photoCountText}>📷 {photos.length}</Text>
            </View>
          ) : null}

          <View style={styles.overlay}>
            {/* What they're here for: dating, language exchange or both. */}
            <View style={styles.connection}>
              <View style={styles.dots}>
                {CONNECTION_DOTS[connection].map((color, i) => (
                  <View key={color} style={[styles.dot, { backgroundColor: color }, i > 0 && styles.dotOverlap]} />
                ))}
              </View>
              <Text style={styles.connectionText}>{t(`connection.${connection}`)}</Text>
            </View>
            <Text style={styles.name}>
              {profile.first_name}
              {profile.age ? <Text style={styles.age}>, {profile.age}</Text> : null}
            </Text>
            {profile.city || profile.country ? (
              <Text style={styles.location}>📍 {[profile.city, profile.country].filter(Boolean).join(", ")}</Text>
            ) : null}
            {languages ? (
              <Text style={styles.languages} numberOfLines={1}>{languages}</Text>
            ) : null}
            {profile.occupation ? <Text style={styles.tag}>💼 {profile.occupation}</Text> : null}

            <Animated.View
              style={[
                styles.more,
                { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }] },
              ]}
            >
              <Text style={styles.moreText}>⌄ {t("browse.moreAbout", { name: profile.first_name })}</Text>
            </Animated.View>
          </View>
        </View>

        {/* The rest of the profile, Bumble-style: just keep scrolling. */}
        <View style={styles.details}>
          {profile.bio ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>{t("browse.aboutMe")}</Text>
              <Text style={styles.bio}>{profile.bio}</Text>
            </View>
          ) : null}

          {facts.length > 0 ? (
            <View style={styles.block}>
              <Text style={styles.blockTitle}>{t("browse.basics")}</Text>
              <View style={styles.chips}>
                {facts.map(([emoji, key, value]) => (
                  <View key={key} style={styles.fact}>
                    <Text style={styles.factLabel}>{emoji} {t(`browse.${key}`)}</Text>
                    <Text style={styles.factValue}>{value}</Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {photos[1] ? <Image source={{ uri: IMG.card(photos[1].image_url) }} style={styles.extraPhoto} /> : null}

          {speaks.length > 0 || learning.length > 0 ? (
            <View style={styles.block}>
              {speaks.length > 0 ? (
                <>
                  <Text style={styles.blockTitle}>🗣️ {t("browse.speaks")}</Text>
                  <View style={styles.chips}>
                    {speaks.map((name) => (
                      <Text key={name} style={styles.lang}>{name}</Text>
                    ))}
                  </View>
                </>
              ) : null}
              {learning.length > 0 ? (
                <>
                  <Text style={[styles.blockTitle, speaks.length > 0 && { marginTop: spacing.md }]}>
                    📚 {t("browse.learning")}
                  </Text>
                  <View style={styles.chips}>
                    {learning.map((name) => (
                      <Text key={name} style={[styles.lang, styles.learning]}>{name}</Text>
                    ))}
                  </View>
                </>
              ) : null}
            </View>
          ) : null}

          {photos.slice(2).map((photo) => (
            <Image key={photo.id || photo.image_url} source={{ uri: IMG.card(photo.image_url) }} style={styles.extraPhoto} />
          ))}

          {onOpenProfile ? (
            <Pressable onPress={onOpenProfile} hitSlop={8} style={styles.report}>
              <Text style={styles.reportText}>⚠️ {t("browse.reportBlock")}</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>

      <Animated.View pointerEvents="none" style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={styles.likeStampText}>LIKE</Text>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={styles.nopeStampText}>NOPE</Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surface,
    ...shadow.lg,
  },
  noPhoto: { alignItems: "center", justifyContent: "center", backgroundColor: colors.primarySoft },
  noPhotoEmoji: { fontSize: 64 },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  name: {
    color: "#fff",
    fontFamily: "serif",
    fontWeight: "700",
    fontSize: 32,
    letterSpacing: -0.3,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  age: { fontWeight: "400", fontSize: 26 },
  location: { color: "#fff", fontSize: 15, fontWeight: "600", marginTop: 4 },
  // Dating / language exchange / both: a quiet dark-glass chip with a colour
  // dot, readable on any photo.
  connection: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    backgroundColor: "rgba(20,14,12,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    marginBottom: 8,
  },
  dots: { flexDirection: "row", alignItems: "center" },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "rgba(20,14,12,0.55)",
  },
  dotOverlap: { marginLeft: -3 },
  connectionText: { color: "#fff", fontSize: 12.5, fontWeight: "700", letterSpacing: 0.2 },
  languages: { color: "#fff", fontSize: 14, marginTop: 5 },
  tag: {
    color: "#fff",
    fontSize: 13.5,
    fontWeight: "700",
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: "rgba(20,14,12,0.5)",
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: radius.pill,
    overflow: "hidden",
  },
  more: { alignSelf: "center", marginTop: spacing.md },
  moreText: { color: "rgba(255,255,255,0.92)", fontSize: 13, fontWeight: "700" },
  photoCount: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: "rgba(20,14,12,0.55)",
  },
  photoCountText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },

  // Below the first photo.
  details: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md, backgroundColor: colors.background },
  block: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...shadow.sm,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primaryDeep,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  bio: { fontSize: 17, lineHeight: 25, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  fact: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  factLabel: { fontSize: 11.5, color: colors.textSoft, fontWeight: "600" },
  factValue: { fontSize: 15, color: colors.text, fontWeight: "700", marginTop: 2 },
  lang: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    color: colors.primaryDeep,
    fontSize: 14,
    fontWeight: "700",
    overflow: "hidden",
  },
  learning: { backgroundColor: "#EDE9FE", color: "#6D28D9" },
  extraPhoto: { width: "100%", aspectRatio: 4 / 5, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted },
  report: { alignSelf: "center", paddingVertical: spacing.sm },
  reportText: { color: colors.textMuted, fontSize: 13.5, fontWeight: "600" },

  // Joined this week: a small white label, rose dot, small caps.
  newBadge: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.94)",
    borderRadius: radius.pill,
    paddingHorizontal: 11,
    paddingVertical: 5,
    ...shadow.sm,
  },
  newDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  newBadgeText: { color: colors.primaryDeep, fontWeight: "700", fontSize: 12 },
  smallCaps: { textTransform: "uppercase", letterSpacing: 1, fontSize: 11 },
  stamp: {
    position: "absolute",
    top: 48,
    borderWidth: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  likeStamp: {
    left: spacing.lg,
    borderColor: colors.success,
    transform: [{ rotate: "-18deg" }],
  },
  likeStampText: { color: colors.success, fontSize: 32, fontWeight: "900" },
  nopeStamp: {
    right: spacing.lg,
    borderColor: colors.danger,
    transform: [{ rotate: "18deg" }],
  },
  nopeStampText: { color: colors.danger, fontSize: 32, fontWeight: "900" },
});
