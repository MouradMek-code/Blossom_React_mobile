import { Image } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import ProfilesScreen from "../screens/ProfilesScreen";
import LikedYouScreen from "../screens/LikedYouScreen";
import DateSpotsScreen from "../screens/DateSpotsScreen";
import MessagesScreen from "../screens/MessagesScreen";
import ProfileScreen from "../screens/ProfileScreen";
import { useNavBadges } from "./useNavBadges";
import { colors } from "../theme";

const Tab = createBottomTabNavigator();

const ICONS = {
  Profiles: require("../../assets/images/tabs/browse.png"),
  LikedYou: require("../../assets/images/tabs/likes.png"),
  Spots: require("../../assets/images/tabs/spots.png"),
  Messages: require("../../assets/images/tabs/chats.png"),
  Profile: require("../../assets/images/tabs/profile.png"),
};

// Black line art, tinted by the tab bar: rose when the tab is open, grey
// otherwise.
function tabIcon(name) {
  return function TabIcon({ color, size }) {
    return (
      <Image
        source={ICONS[name]}
        style={{ width: size, height: size, tintColor: color }}
        resizeMode="contain"
      />
    );
  };
}

function badgeValue(count) {
  if (!count) return undefined;
  return count > 9 ? "9+" : count;
}

// The whole app once you're logged in: five tabs within thumb reach, nothing
// else in the way. Anything that opens on top of them - a chat, someone's
// profile, settings - is a screen of the root stack instead (RootNavigator).
export default function MainTabs() {
  const { t } = useTranslation();
  const { badges, markSeen } = useNavBadges();
  const insets = useSafeAreaInsets();
  // Room under the labels for the phone's navigation buttons. A floor of 10
  // in case a phone reports no inset, so the labels never sit on the edge.
  const bottomSpace = Math.max(insets.bottom, 10);

  return (
    <Tab.Navigator
      initialRouteName="Profiles"
      screenListeners={({ route }) => ({
        focus: () => {
          if (route.name === "LikedYou") markSeen("likes");
          // New matches are shown at the top of the chats list.
          if (route.name === "Messages") markSeen("matches");
        },
      })}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        // The height is set here rather than left to the default: the icon and
        // its label need the full 60, and everything below that is the phone's
        // own buttons.
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          height: 60 + bottomSpace,
          paddingTop: 7,
          paddingBottom: bottomSpace,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        // A phone set to large text would otherwise push the labels off the bar.
        tabBarAllowFontScaling: false,
        tabBarBadgeStyle: { backgroundColor: "#ff2d55", fontSize: 11, fontWeight: "700" },
        // Typing a message or searching a city shouldn't leave the bar
        // sitting on top of the keyboard.
        tabBarHideOnKeyboard: true,
      }}
    >
      <Tab.Screen
        name="Profiles"
        component={ProfilesScreen}
        options={{ title: t("tabs.browse"), tabBarIcon: tabIcon("Profiles") }}
      />
      <Tab.Screen
        name="LikedYou"
        component={LikedYouScreen}
        options={{
          title: t("tabs.likes"),
          tabBarIcon: tabIcon("LikedYou"),
          tabBarBadge: badgeValue(badges.likes),
        }}
      />
      <Tab.Screen
        name="Spots"
        component={DateSpotsScreen}
        options={{ title: t("tabs.spots"), tabBarIcon: tabIcon("Spots") }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          title: t("tabs.chats"),
          tabBarIcon: tabIcon("Messages"),
          // Unread chats and new matches both live on this tab.
          tabBarBadge: badgeValue(badges.messages + badges.matches),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: t("tabs.profile"), tabBarIcon: tabIcon("Profile") }}
      />
    </Tab.Navigator>
  );
}

