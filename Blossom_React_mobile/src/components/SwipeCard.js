import { useRef } from "react";
import {
  Animated,
  Dimensions,
  Image,
  PanResponder,
  Pressable,
  Text,
  View,
  StyleSheet,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radius, spacing, shadow } from "../theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

export default function SwipeCard({ profile, onSwipeLeft, onSwipeRight, onViewDetails, isTop }) {
  const position = useRef(new Animated.ValueXY()).current;

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

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        isTopRef.current && (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5),
      onPanResponderMove: (_, gesture) => {
        position.setValue({ x: gesture.dx, y: gesture.dy });
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: SCREEN_WIDTH * 1.5, y: gesture.dy },
            duration: 250,
            useNativeDriver: true,
          }).start(() => onSwipeRightRef.current());
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          Animated.timing(position, {
            toValue: { x: -SCREEN_WIDTH * 1.5, y: gesture.dy },
            duration: 250,
            useNativeDriver: true,
          }).start(() => onSwipeLeftRef.current());
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
          }).start();
        }
      },
    }),
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
    outputRange: ["-15deg", "0deg", "15deg"],
    extrapolate: "clamp",
  });

  const likeOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  return (
    <Animated.View
      {...(isTop ? panResponder.panHandlers : {})}
      style={[
        styles.card,
        {
          transform: [
            { translateX: position.x },
            { translateY: position.y },
            { rotate },
          ],
        },
      ]}
    >
      <Image source={{ uri: profile.photos?.[0]?.image_url }} style={styles.image} />

      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.78)"]}
        style={styles.gradient}
      />

      <Animated.View style={[styles.stamp, styles.likeStamp, { opacity: likeOpacity }]}>
        <Text style={styles.likeStampText}>LIKE</Text>
      </Animated.View>

      <Animated.View style={[styles.stamp, styles.nopeStamp, { opacity: nopeOpacity }]}>
        <Text style={styles.nopeStampText}>NOPE</Text>
      </Animated.View>

      <View style={styles.overlay}>
        <View style={styles.overlayRow}>
          <View style={styles.overlayInfo}>
            <Text style={styles.name}>
              {profile.first_name}, {profile.age}
            </Text>
            <Text style={styles.location}>
              📍 {profile.city}, {profile.country}
            </Text>
            {profile.occupation ? <Text style={styles.tag}>💼 {profile.occupation}</Text> : null}
          </View>

          {onViewDetails && (
            <Pressable style={styles.detailsButton} onPress={onViewDetails}>
              <Text style={styles.detailsButtonText}>View Profile</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    width: SCREEN_WIDTH - 32,
    height: "100%",
    borderRadius: radius.lg,
    overflow: "hidden",
    backgroundColor: colors.surfaceMuted,
    ...shadow.lg,
  },
  image: { width: "100%", height: "100%" },
  gradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: "45%",
  },
  overlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.lg,
  },
  overlayRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  overlayInfo: { flex: 1, marginRight: spacing.sm },
  name: { color: "#fff", fontWeight: "800", fontSize: 22 },
  location: { color: "rgba(255,255,255,0.92)", fontSize: 14, marginTop: 4 },
  tag: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginTop: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.18)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  detailsButton: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  detailsButtonText: { color: colors.primaryDark, fontWeight: "700", fontSize: 12 },
  stamp: {
    position: "absolute",
    top: 40,
    borderWidth: 4,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  likeStamp: {
    left: spacing.lg,
    borderColor: colors.success,
    transform: [{ rotate: "-20deg" }],
  },
  likeStampText: {
    color: colors.success,
    fontSize: 28,
    fontWeight: "800",
  },
  nopeStamp: {
    right: spacing.lg,
    borderColor: colors.danger,
    transform: [{ rotate: "20deg" }],
  },
  nopeStampText: {
    color: colors.danger,
    fontSize: 28,
    fontWeight: "800",
  },
});
