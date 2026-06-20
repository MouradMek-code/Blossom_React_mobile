import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import LoginScreen from "../screens/LoginScreen";
import SignUpScreen from "../screens/SignUpScreen";
import ProfileScreen from "../screens/ProfileScreen";
import ProfilesScreen from "../screens/ProfilesScreen";
import ProfileDetailsScreen from "../screens/ProfileDetailsScreen";
import MatchedListScreen from "../screens/MatchedListScreen";
import LikedYouScreen from "../screens/LikedYouScreen";
import ChatScreen from "../screens/ChatScreen";
import NotFoundScreen from "../screens/NotFoundScreen";

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SignUp" component={SignUpScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Profiles" component={ProfilesScreen} />
      <Stack.Screen name="ProfileDetails" component={ProfileDetailsScreen} />
      <Stack.Screen name="MatchedList" component={MatchedListScreen} />
      <Stack.Screen name="LikedYou" component={LikedYouScreen} />
      <Stack.Screen name="Chat" component={ChatScreen} />
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  );
}
