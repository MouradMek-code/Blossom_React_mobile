import { useEffect, useRef } from "react";
import { Animated, Dimensions, ScrollView, View, StyleSheet } from "react-native";
import PageNav from "../components/PageNav";
import StartHome from "../components/StartHome";
import HowItWorks from "../components/HowItWorks";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function HomeScreen() {
  const scale = useRef(new Animated.Value(1)).current;

  // Slow "Ken Burns" zoom, looping back and forth - mirrors the same
  // effect added to the web app's homepage background.
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.15,
          duration: 10000,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 10000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <View style={[styles.hero, { minHeight: SCREEN_HEIGHT }]}>
        <Animated.Image
          source={require("../../assets/images/blossom.png")}
          style={[styles.bgImage, { transform: [{ scale }] }]}
          resizeMode="cover"
        />
        <View style={styles.overlay} />
        <PageNav variant="transparent" />
        <StartHome />
      </View>
      <HowItWorks />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: {
    width: "100%",
    overflow: "hidden",
    position: "relative",
  },
  bgImage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
