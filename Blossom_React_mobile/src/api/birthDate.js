// The birthday box on sign-up: people type only digits and the slashes
// appear by themselves - DD/MM/YYYY, like the date box on the website.
// The server gets YYYY-MM-DD.

export function formatBirthDate(text) {
  const value = String(text || "");
  // Pasted as the server writes it: 1998-05-20.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return isoToBirthDate(value.trim());
  let digits = value.replace(/\D/g, "");
  // A day can't start with 4-9, nor a month with 2-9: "5" means 05.
  if (digits.length >= 1 && Number(digits[0]) > 3) digits = `0${digits}`;
  if (digits.length >= 3 && Number(digits[2]) > 1) digits = `${digits.slice(0, 2)}0${digits.slice(2)}`;
  digits = digits.slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// "20/05/1998" -> "1998-05-20", or null when it isn't a real past date.
export function birthDateToIso(text, now = new Date()) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text || "");
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  const real =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real || year < 1900 || date.getTime() > now.getTime()) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

// A saved "1998-05-20" back into the box.
export function isoToBirthDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

// Age today for a "1998-05-20" birthday.
export function ageFromIso(iso, now = new Date()) {
  const [year, month, day] = iso.split("-").map(Number);
  const hadBirthday =
    now.getMonth() + 1 > month || (now.getMonth() + 1 === month && now.getDate() >= day);
  return now.getFullYear() - year - (hadBirthday ? 0 : 1);
}
