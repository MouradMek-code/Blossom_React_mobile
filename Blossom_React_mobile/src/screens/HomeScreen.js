import { Dimensions, ImageBackground, ScrollView, View, StyleSheet } from "react-native";
import PageNav from "../components/PageNav";
import StartHome from "../components/StartHome";
import HowItWorks from "../components/HowItWorks";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function HomeScreen() {
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
      <ImageBackground
        source={require("../../assets/images/blossom.png")}
        style={[styles.hero, { minHeight: SCREEN_HEIGHT }]}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <PageNav variant="transparent" />
        <StartHome />
      </ImageBackground>
      <HowItWorks />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { width: "100%" },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
