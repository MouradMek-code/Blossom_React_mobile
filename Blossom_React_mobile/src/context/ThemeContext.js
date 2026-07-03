import { createContext, useContext, useEffect, useState } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const THEME_KEY = "@blossom_theme";

const lightColors = {
  primary: "#E0245A",
  primaryDark: "#B5174A",
  primarySoft: "#FDE6ED",
  accent: "#FF7A9C",
  success: "#2ecc71",
  danger: "#e74c3c",
  text: "#1F1B24",
  textMuted: "#7A7480",
  border: "#F0E3E8",
  surface: "#FFFFFF",
  surfaceMuted: "#FBF7F9",
  background: "#FFFFFF",
};

const darkColors = {
  primary: "#E0245A",
  primaryDark: "#B5174A",
  primarySoft: "#2D1020",
  accent: "#FF7A9C",
  success: "#2ecc71",
  danger: "#e74c3c",
  text: "#F1E6EE",
  textMuted: "#9D8FA8",
  border: "#3D2F45",
  surface: "#1A1220",
  surfaceMuted: "#251830",
  background: "#0F0A12",
};

const ThemeContext = createContext({
  dark: false,
  colors: lightColors,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const saved = await AsyncStorage.getItem(THEME_KEY);
        if (saved !== null) {
          setDark(saved === "dark");
        } else {
          setDark(Appearance.getColorScheme() === "dark");
        }
      } catch (_) {
        setDark(Appearance.getColorScheme() === "dark");
      }
    }
    load();
  }, []);

  async function toggleTheme() {
    const next = !dark;
    setDark(next);
    try {
      await AsyncStorage.setItem(THEME_KEY, next ? "dark" : "light");
    } catch (_) {}
  }

  return (
    <ThemeContext.Provider value={{ dark, colors: dark ? darkColors : lightColors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
