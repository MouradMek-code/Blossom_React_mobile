import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, createNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { I18nextProvider } from "react-i18next";
import RootNavigator from "./src/navigation/RootNavigator";
import PushNotifications from "./src/components/PushNotifications";
import { refreshSessionIfNeeded } from "./src/api/session";
import { getProfileId, getToken } from "./src/api/storage";
import i18n, { initI18n } from "./src/i18n";
import { ThemeProvider } from "./src/context/ThemeContext";

// Lets notification taps navigate from outside any screen.
const navigationRef = createNavigationContainerRef();

// Where the app opens. Someone logged in goes straight to Browse, like any
// dating app - landing on the Home page made it look like they'd been logged
// out. Decided from what's saved on the phone, so it's instant (no network).
// A saved profile id means the profile was finished; without one they're
// sent to sign-up, which resumes where they stopped (or forwards a finished
// account to Browse).
async function pickInitialRoute() {
  try {
    const [token, profileId] = await Promise.all([getToken(), getProfileId()]);
    if (!token || token === "null") return "Home";
    return profileId ? "Profiles" : "SignUp";
  } catch {
    return "Home";
  }
}

function AppInner({ initialRoute }) {
  const [navReady, setNavReady] = useState(false);

  // Keep people logged in: renew the session when the app starts and each
  // time it comes back to the foreground (at most once a day).
  useEffect(() => {
    refreshSessionIfNeeded();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refreshSessionIfNeeded();
    });
    return () => sub.remove();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} onReady={() => setNavReady(true)}>
          <RootNavigator initialRouteName={initialRoute} />
          <StatusBar style="dark" />
        </NavigationContainer>
        <PushNotifications navigationRef={navigationRef} navReady={navReady} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [i18nReady, setI18nReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState(null);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
    pickInitialRoute().then(setInitialRoute);
  }, []);

  // Render nothing until both are known, so the Home page never flashes
  // before Browse.
  if (!i18nReady || !initialRoute) return <View style={{ flex: 1 }} />;

  return (
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <AppInner initialRoute={initialRoute} />
      </ThemeProvider>
    </I18nextProvider>
  );
}
