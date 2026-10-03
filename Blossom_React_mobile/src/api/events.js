// Events organised by members (see the server's db_events.py): the three
// types, how dates are shown, and the date/time fields of the form.
export const EVENT_KINDS = ["date", "group", "language"];

export const KIND_EMOJI = { date: "💞", group: "👥", language: "🗣️" };

// Backdrop for events without a photo, by type.
export const KIND_GRADIENT = {
  date: ["#7E2A44", "#C1466B"],
  group: ["#27406F", "#5E80C2"],
  language: ["#2A5E46", "#6FA56E"],
};

// "Sat 12 Oct · 14:00" in the viewer's language and time zone.
export function eventWhen(iso, language) {
  if (!iso) return "";
  const date = new Date(iso);
  try {
    const day = date.toLocaleDateString(language, { weekday: "short", day: "numeric", month: "short" });
    const time = date.toLocaleTimeString(language, { hour: "2-digit", minute: "2-digit" });
    return `${day} · ${time}`;
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

// The date badge on a card: { day: "12", month: "OCT" }.
export function eventDay(iso, language) {
  const date = new Date(iso);
  let month = "";
  try {
    month = date.toLocaleDateString(language, { month: "short" }).replace(".", "");
  } catch {
    month = String(date.getMonth() + 1);
  }
  return { day: String(date.getDate()), month: month.toUpperCase() };
}

// A server time (UTC) -> the form's "DD/MM/YYYY" and "HH:MM", local time.
export function isoToDateText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function isoToTimeText(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
