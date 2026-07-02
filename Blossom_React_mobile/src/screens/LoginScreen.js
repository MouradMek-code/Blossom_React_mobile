import { ImageBackground, View, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import PageNav from "../components/PageNav";
import FormLogin from "../components/FormLogin";

export default function LoginScreen() {
  return (
    <ImageBackground
      source={require("../../assets/images/blossom.png")}
      style={styles.head}
      resizeMode="cover"
    >
      <View style={styles.overlay} />
      <PageNav variant="transparent" />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <FormLogin />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
});
