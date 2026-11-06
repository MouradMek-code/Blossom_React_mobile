import { useEffect, useRef } from "react";
import { Animated, View, StyleSheet } from "react-native";
import { colors, radius, spacing } from "../theme";

// Grey shapes where the content will be, gently pulsing, instead of a
// spinner: the screen looks ready at once and feels faster.
export function Skeleton({ width = "100%", height = 14, round = 8, style }) {
  const pulse = useRef(new Animated.Value(0.55)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={[{ width, height, borderRadius: round, backgroundColor: colors.surfaceMuted, opacity: pulse }, style]}
    />
  );
}

// Browse: one big card.
export function SkeletonCard() {
  return (
    <View style={styles.card} accessibilityLabel="Loading">
      <Skeleton height="100%" round={radius.lg} style={StyleSheet.absoluteFill} />
      <View style={styles.cardText}>
        <Skeleton width="55%" height={30} round={10} style={styles.onPhoto} />
        <Skeleton width="38%" height={22} round={11} style={styles.onPhoto} />
      </View>
    </View>
  );
}

// Chats, likes, lists: rows with a round picture and two lines.
export function SkeletonRows({ count = 6 }) {
  return (
    <View style={styles.rows} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={54} height={54} round={27} />
          <View style={styles.rowText}>
            <Skeleton width={i % 2 ? "45%" : "60%"} height={15} />
            <Skeleton width={i % 2 ? "75%" : "55%"} height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Spots, events: cards with a picture on top.
export function SkeletonTiles({ count = 3 }) {
  return (
    <View style={styles.tiles} accessibilityLabel="Loading">
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.tile}>
          <Skeleton height={150} round={radius.md} />
          <Skeleton width="65%" height={16} />
          <Skeleton width="40%" height={12} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  cardText: { padding: spacing.lg, gap: 10 },
  onPhoto: { backgroundColor: "#E6DDD6" },
  rows: { padding: spacing.md, gap: spacing.md },
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  rowText: { flex: 1, gap: 8 },
  tiles: { padding: spacing.md, gap: spacing.lg },
  tile: { gap: 10 },
});
