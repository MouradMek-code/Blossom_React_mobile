// Human labels and small maths for the admin dashboard (same file on the website).

const LANGUAGES = { en: "English", fr: "Français", zh: "中文", ar: "العربية", es: "Español", de: "Deutsch", it: "Italiano", pt: "Português" };

// Pages of the website and screens of the app, as the tracker records them.
const PLACES = {
  "/": "Home page",
  "/sign_up": "Sign up",
  "/login": "Log in",
  "/date-spots": "Date spots",
  "/date-spots/:id": "A date spot",
  "/profiles": "Browse",
  "/profile": "Own profile",
  "/profile/:id": "A profile",
  "/privacy-policy": "Privacy policy",
  "/terms": "Terms",
  "/forgot_password": "Forgot password",
  Home: "Home screen",
  SignUp: "Sign up",
  Login: "Log in",
  Main: "Browse",
  Profiles: "Browse",
  DateSpots: "Date spots",
  ProfileDetails: "A profile",
  Chat: "A chat",
  Messages: "Chats",
  LikedYou: "Likes",
  ForgotPassword: "Forgot password",
};

export function breakdownLabel(kind, key, t) {
  if (key === "unknown") return t("dashboard.unknown");
  if (key === "other") return t("dashboard.other");
  if (kind === "platforms") return t(`dashboard.${key}`);
  if (kind === "languages") return LANGUAGES[key] || key.toUpperCase();
  if (kind === "timezones") {
    // "Europe/Paris" -> "Paris · Europe", "America/Argentina/Buenos_Aires" -> "Buenos Aires · America"
    const parts = key.split("/");
    if (parts.length < 2) return key;
    return `${parts[parts.length - 1].replace(/_/g, " ")} · ${parts[0]}`;
  }
  return PLACES[key] || key;
}

// Change vs the previous period: { text: "+12%", direction: "up" | "down" | "flat" }.
export function delta(value, previous, { points = false, t } = {}) {
  if (value == null || previous == null) return null;
  const diff = value - previous;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  if (points) {
    const pts = t ? t("dashboard.pts") : "pts";
    return { text: `${diff > 0 ? "+" : ""}${diff.toFixed(1)} ${pts}`, direction };
  }
  if (previous === 0) {
    return value === 0 ? { text: "0%", direction } : { text: t ? t("dashboard.deltaNew") : "new", direction: "up" };
  }
  const pct = Math.round((diff / previous) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, direction };
}

// A round top for a chart's scale: 7 -> 8, 23 -> 30, 140 -> 150.
export function niceMax(value) {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((m) => m * power >= value);
  return step * power;
}

// 1,284 / 12.9K
export function compact(n) {
  if (n == null) return "—";
  if (n >= 10000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K`;
  return n.toLocaleString("en-US");
}

// "26 Sep" in the viewer's language.
export function shortDate(iso, language) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(language, { day: "numeric", month: "short" });
  } catch {
    return iso.slice(5);
  }
}

// Busiest hours are counted in the admin's time: minutes ahead of UTC.
export function tzOffsetMinutes() {
  return -new Date().getTimezoneOffset();
}
