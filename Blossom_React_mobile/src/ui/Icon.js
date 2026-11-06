import { I18nManager } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { colors } from "../theme";

// Blossom's one icon set: Feather line icons (the website uses Lucide, the
// same drawings). Names are Feather's - "map-pin", "arrow-left", "trash-2"...
// Emoji stay for the fun moments (gifts, matches), never as interface icons.

// Arrows and chevrons point the reading way: mirrored in Arabic.
const DIRECTIONAL = new Set(["arrow-left", "arrow-right", "chevron-left", "chevron-right"]);
const MIRROR = { transform: [{ scaleX: -1 }] };

export default function Icon({ name, size = 20, color = colors.text, style }) {
  const mirrored = I18nManager.isRTL && DIRECTIONAL.has(name);
  return <Feather name={name} size={size} color={color} style={mirrored ? [style, MIRROR] : style} />;
}
