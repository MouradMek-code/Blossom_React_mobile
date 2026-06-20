export const colors = {
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

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const shadow = {
  sm: {
    shadowColor: "#1F1B24",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  md: {
    shadowColor: "#1F1B24",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 14,
    elevation: 5,
  },
  lg: {
    shadowColor: "#1F1B24",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
};

export const typography = {
  h1: { fontSize: 30, fontWeight: "800", color: colors.text },
  h2: { fontSize: 22, fontWeight: "700", color: colors.text },
  h3: { fontSize: 17, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, fontWeight: "400", color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: "400", color: colors.textMuted },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
};
