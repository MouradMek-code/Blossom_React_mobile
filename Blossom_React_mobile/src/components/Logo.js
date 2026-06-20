import { Image, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function Logo({ size = 52 }) {
  const navigation = useNavigation();
  return (
    <Pressable
      onPress={() => navigation.navigate("Home")}
      style={({ pressed }) => [
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          overflow: "hidden",
          backgroundColor: "#fff",
          borderWidth: 2,
          borderColor: "#d6336c",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 4,
          elevation: 3,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Image
        source={require("../../assets/images/LogoBlossom.png")}
        style={{ width: "100%", height: "100%" }}
        resizeMode="cover"
      />
    </Pressable>
  );
}
