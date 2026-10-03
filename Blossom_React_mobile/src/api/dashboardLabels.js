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
  "/messages": "Chats",
  "/chat/:id": "A chat",
  "/liked_you": "Likes",
  "/settings": "Settings",
  "/promotions": "My gifts",
  "/partner": "Partner form (venues)",
  "/business": "For venues",
  "/venue": "Venue code check",
  "/venue/manage/:token": "Venue manager page",
  "/poster/:id": "Venue poster",
  "/claim/:token": "Friend profile activation",
  "/delete-account": "Delete account",
  "/events": "Events",
  "/events/:id": "An event",
  "/events/new": "Creating an event",
  "/events/:id/edit": "Editing an event",
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
  Spots: "Date spots",
  Profile: "Own profile",
  Settings: "Settings",
  Vouchers: "My gifts",
  LocationPicker: "Choosing a city",
  Events: "Events",
  EventDetail: "An event",
  EventForm: "Creating an event",
  NotFound: "Page not found",
};

// A page or screen's human name (an unknown one as it is).
export function placeLabel(key) {
  return PLACES[key] || key;
}

// What a member did on a day (counts from GET /analytics/day), in order:
// [key, icon, shows a count].
export const DAY_ACTIONS = [
  ["signed_up", "🆕", false],
  ["profile_created", "📝", false],
  ["profile_finished", "🌸", false],
  ["likes", "❤️", true],
  ["matches", "💞", true],
  ["messages", "💬", true],
  ["invites", "📍", true],
  ["gift_codes", "🎁", true],
  ["gifts_used", "✅", true],
  ["spots_shared", "📌", true],
  ["events_created", "📅", true],
  ["event_interests", "🙋", true],
  ["event_comments", "🗨️", true],
  ["reports", "🚩", true],
];

// "❤️ Likes: 3", "🌸 Finished profile"
export function actionChips(actions, t) {
  return DAY_ACTIONS.filter(([key]) => actions?.[key]).map(([key, icon, counted]) =>
    counted ? `${icon} ${t(`dashboard.act_${key}`)}: ${actions[key]}` : `${icon} ${t(`dashboard.act_${key}`)}`,
  );
}

// 42 s -> "< 1 min", 1500 s -> "25 min", 4800 s -> "1 h 20".
export function durationLabel(seconds, t) {
  const minutes = Math.round((seconds || 0) / 60);
  if (minutes < 1) return t("dashboard.underMinute");
  if (minutes < 60) return t("dashboard.minutes", { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

// "2026-09-29" in the viewer's time zone.
export function localDay(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// The day before / after a "2026-09-29".
export function shiftDay(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDay(date);
}

// "Monday 29 September" in the viewer's language.
export function longDate(iso, language) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(language, { weekday: "long", day: "numeric", month: "long" });
  } catch {
    return iso;
  }
}

// "14:05" for a time sent by the server (UTC, with a Z).
export function clockTime(iso, language) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso.slice(11, 16);
  }
}

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
