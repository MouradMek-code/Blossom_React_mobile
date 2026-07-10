// Editorial palette — warm ivory + deep rose, shared with the web app.
export const colors = {
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

export const radius = {
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

// Warm-tinted shadows to match the ivory surfaces.
export const shadow = {
  sm: {
    shadowColor: "#3F2C26",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  md: {
    shadowColor: "#3F2C26",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 5,
  },
  lg: {
    shadowColor: "#3F2C26",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 30,
    elevation: 10,
  },
};

// Platform serif ("serif" → Noto Serif on Android, Georgia-family on iOS)
// gives the editorial display feel with no font dependency, keeping the
// release build free of native font-loading risk.
export const fonts = {
  display: "serif",
};

export const typography = {
  h1: { fontFamily: "serif", fontSize: 32, fontWeight: "700", color: colors.text, letterSpacing: -0.5 },
  h2: { fontFamily: "serif", fontSize: 24, fontWeight: "700", color: colors.text, letterSpacing: -0.3 },
  h3: { fontSize: 17, fontWeight: "700", color: colors.text },
  body: { fontSize: 15, fontWeight: "400", color: colors.text },
  bodyMuted: { fontSize: 14, fontWeight: "400", color: colors.textMuted },
  label: { fontSize: 13, fontWeight: "600", color: colors.textMuted },
};
