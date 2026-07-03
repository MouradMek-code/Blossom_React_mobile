import { createContext, useContext } from "react";

const colors = {
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
