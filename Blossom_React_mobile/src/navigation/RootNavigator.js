import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabs from "./MainTabs";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import ProfileDetailsScreen from "../screens/ProfileDetailsScreen";
import DateSpotsScreen from "../screens/DateSpotsScreen";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen";
import ChatScreen from "../screens/ChatScreen";
import SettingsScreen from "../screens/SettingsScreen";
import LocationPickerScreen from "../screens/LocationPickerScreen";
import NotFoundScreen from "../screens/NotFoundScreen";

const Stack = createNativeStackNavigator();

// Two levels: "Main" holds the five tabs someone logged in lives in, and the
// stack below holds everything that opens on top of them (a chat, someone's
// profile, settings) plus the screens for visitors who aren't logged in.
//
// initialRouteName is decided in App.js from the saved session: the tabs for
// someone logged in, sign-up for someone mid-way through it, Home otherwise.
export default function RootNavigator({ initialRouteName = "Home" }) {
  return (
    <Stack.Navigator initialRouteName={initialRouteName} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      {/* Visitors browse date spots without a tab bar; from a chat invite it
          also opens here, so Back returns to the conversation. */}
      <Stack.Screen name="DateSpots" component={DateSpotsScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="LocationPicker" component={LocationPickerScreen} />
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  );
}
