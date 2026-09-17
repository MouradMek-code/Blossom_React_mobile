import { useContext } from "react";
import { BottomTabBarHeightContext } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// How much room a screen needs under its content so nothing hides behind the
// phone's navigation buttons. Inside the tab bar that's already taken care of
// (the bar sits over that area), so the screen itself needs none.
export function useBottomInset() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = useContext(BottomTabBarHeightContext);
  return tabBarHeight === undefined ? insets.bottom : 0;
}
