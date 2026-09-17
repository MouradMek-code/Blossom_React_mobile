import { Image, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";

// Tapping it goes to the home page, unless the screen says where else
// (logged in, PageNav sends it to Browse - there's no home page to go back to).
export default function Logo({ size = 52, onPress }) {
  const navigation = useNavigation();
  const height = size;
  const width = size * 1.5;
  return (
    <Pressable
      onPress={onPress || (() => navigation.navigate("Home"))}
      style={({ pressed }) => [
        {
          width,
          height,
          borderRadius: height / 4,
          overflow: "hidden",
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Image
        source={require("../../assets/images/LogoBlossom.png")}
        style={{ width: "100%", height: "100%" }}
        resizeMode="contain"
      />
    </Pressable>
  );
}
