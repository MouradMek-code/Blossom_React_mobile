import { useCallback, useEffect, useRef } from "react";
import { Alert, AppState } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { askPermission, getAutoLocation, setAutoLocation, syncLocation } from "../api/autoLocation";
import { clearSession } from "../api/storage";
import { invalidate } from "./useAutoRefresh";

// Once logged in (the tabs): the first time, explain and ask (never before
// the profile exists, never in a way that blocks anything); then keep the
// profile's city up to date when the app opens or comes back. If the server
// removed the account (a country Blossom isn't open to), say so and log out.
export function useAutoLocation() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const asked = useRef(false);

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
    const setting = await getAutoLocation();
    if (setting === null && !asked.current) {
      asked.current = true;
      // The explanation comes first; the phone's own permission window only
      // if they say yes.
      Alert.alert(t("location.autoTitle"), t("location.autoText"), [
        {
          text: t("location.autoNotNow"),
          style: "cancel",
          onPress: () => setAutoLocation(false),
        },
        {
          text: t("location.autoAllow"),
          onPress: async () => {
            const granted = await askPermission();
            await setAutoLocation(granted);
            if (granted) handle(await syncLocation({ force: true }));
          },
        },
      ]);
      return;
    }
    handle(await syncLocation());
  }, [handle, t]);

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
