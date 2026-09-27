// Venue promotions for couples ("🎁 -20% for Blossom couples"): shared bits
// for Date spots, the chat, My promotions and the admin screen. The rules live
// on the server (database/db_offers.py). Same file on the website.
import { parseServerDate } from "./chatTime";

// "Sat 12 Oct, 18:00" in the viewer's language and time.
export function formatDeadline(value, language) {
  const date = parseServerDate(value);
  if (!date) return "";
  try {
    return date.toLocaleString(language, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date.toISOString().slice(0, 16).replace("T", " ");
  }
}

// 50 -> "2 d 2 h", 48 -> "2 d", 5 -> "5 h".
export function formatHours(hours, t) {
  const days = Math.floor(hours / 24);
  const rest = hours % 24;
  const parts = [];
  if (days) parts.push(t("offers.days", { count: days }));
  if (rest || !days) parts.push(t("offers.hours", { count: rest }));
  return parts.join(" ");
}

// "For matched couples who go together · 3 left · valid 7 d after you both
// say yes" - only what matters to the couple (their own deadline comes with
// their code).
export function offerTerms(offer, t) {
  const parts = [t("offers.forCouples")];
  if (offer.remaining != null) parts.push(t("offers.left", { count: offer.remaining }));
  parts.push(t("offers.validAfterYes", { time: formatHours(offer.valid_hours, t) }));
  return parts.join(" · ");
}

// Local date "DD/MM/YYYY" + time "HH:MM" -> ISO in UTC, or null if not valid.
export function localToIso(dateText, timeText) {
  const d = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dateText || "");
  const h = /^(\d{1,2}):(\d{2})$/.exec(timeText || "");
  if (!d || !h) return null;
  const [day, month, year, hour, minute] = [+d[1], +d[2], +d[3], +h[1], +h[2]];
  if (hour > 23 || minute > 59) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date.toISOString();
}

// Typing a time: "1830" -> "18:30".
export function formatTimeInput(text) {
  const digits = String(text || "").replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
