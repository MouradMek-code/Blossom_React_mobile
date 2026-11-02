import { useCallback, useEffect } from "react";
import { Alert, AppState } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { getAutoLocation, syncLocation } from "../api/autoLocation";
import { clearSession } from "../api/storage";
import { invalidate } from "./useAutoRefresh";

// Once logged in (the tabs): someone never asked gets the location page
// (EnableLocationScreen, also the last sign-up step); after that, keep the
// profile's city up to date when the app opens or comes back. If the server
// removed the account (a country Blossom isn't open to), say so and log out.
export function useAutoLocation() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  const handle = useCallback(
    async (result) => {
      if (!result) return;
      if (result.removed) {
        await clearSession();
        Alert.alert(t("location.removedTitle"), t("location.removedText"));
        navigation.reset({ index: 0, routes: [{ name: "Home" }] });
        return;
      }
      if (result.updated) invalidate("browse");
    },
    [navigation, t],
  );

  const run = useCallback(async () => {
    if ((await getAutoLocation()) === null) {
      navigation.reset({ index: 0, routes: [{ name: "EnableLocation" }] });
      return;
    }
    handle(await syncLocation());
  }, [handle, navigation]);

  useEffect(() => {
    // A moment after the tabs appear, not in the middle of their first paint.
    const timer = setTimeout(run, 2500);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") run();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [run]);
}
