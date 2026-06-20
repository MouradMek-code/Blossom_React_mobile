import { ImageBackground, View, StyleSheet } from "react-native";
import PageNav from "../components/PageNav";
import StartHome from "../components/StartHome";

export default function HomeScreen() {
  return (
    <ImageBackground
      source={require("../../assets/images/blossom.png")}
      style={styles.head}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <PageNav variant="transparent" />
      <StartHome />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  head: { flex: 1 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
});
