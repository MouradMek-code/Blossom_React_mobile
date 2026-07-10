import { createContext, useContext } from "react";

const colors = {
  primary: "#C1466B",
  primaryDark: "#A3395A",
  primaryDeep: "#7E2A44",
  primarySoft: "#F7E6EC",
  primaryTint: "#FBF1F4",
  accent: "#D6547B",
  gold: "#B08D57",
  success: "#3BA776",
  danger: "#C0392B",
  text: "#2A2420",
  textSoft: "#574D46",
  textMuted: "#8A7E76",
  border: "#ECE2DA",
  borderStrong: "#DCCEC3",
  surface: "#FFFFFF",
  surfaceMuted: "#F7F1EC",
  background: "#FBF8F6",
};

const ThemeContext = createContext({ colors });

export function ThemeProvider({ children }) {
  return (
    <ThemeContext.Provider value={{ colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
