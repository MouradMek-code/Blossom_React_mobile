// Timestamps for chat screens.
//
// The API sends naive UTC datetimes ("2026-09-15T10:00:00.123456"). Without a
// zone suffix JavaScript would read them as *local* time, shifting every
// message by the viewer's UTC offset - so add the "Z" ourselves. Fractions are
// trimmed to milliseconds, which every JS engine parses.
export function parseServerDate(value) {
  if (!value) return null;
  let s = String(value).replace(/(\.\d{3})\d+/, "$1");
  if (!/[zZ]$|[+-]\d\d:?\d\d$/.test(s)) s += "Z";
  const date = new Date(s);
  return Number.isNaN(date.getTime()) ? null : date;
}

// "14:05" for today, "15/09" earlier this year, "15/09/25" before that.
export function shortTime(value) {
  const date = parseServerDate(value);
  if (!date) return "";
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  if (date.toDateString() === now.toDateString()) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const day = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  return date.getFullYear() === now.getFullYear()
    ? day
    : `${day}/${String(date.getFullYear()).slice(2)}`;
}
