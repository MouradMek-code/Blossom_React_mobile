// Turns a backend error response into a single clean, human-friendly message.
// Mirrors the web app's src/api/errors.js so both clients behave the same.
//
// FastAPI's `detail` can be a string (our own messages), an array (Pydantic
// validation errors), or an object (a wrapped provider result). Anything
// unrecognised falls back to a message based on the HTTP status.

function fieldLabel(loc) {
  const key = Array.isArray(loc) ? loc[loc.length - 1] : loc;
  const labels = {
    email: "Email",
    username: "Username",
    password: "Password",
    phone_number: "Phone number",
    date_of_birth: "Date of birth",
  };
  return labels[key] || null;
}

function fromValidation(arr) {
  const first = arr[0];
  if (!first) return "Please check the information you entered.";
  const label = fieldLabel(first.loc);
  const msg = (first.msg || "").replace(/^Value error,\s*/i, "");
  if (/valid email/i.test(msg)) return "Please enter a valid email address.";
  if (label) return `${label}: ${msg}`;
  return msg || "Please check the information you entered.";
}

function fromStatus(status) {
  if (status === 409) return "An account with these details already exists.";
  if (status === 400) return "Please check the information you entered.";
  if (status === 401 || status === 403) return "Incorrect login details. Please try again.";
  if (status === 404) return "We couldn't find what you were looking for.";
  if (status === 429) return "Too many attempts. Please wait a moment and try again.";
  if (status >= 500) return "Our server had a problem. Please try again in a moment.";
  return "Something went wrong. Please try again.";
}

export function friendlyError(data, resp) {
  const detail = data && data.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) return fromValidation(detail);
  if (detail && typeof detail === "object") {
    if (typeof detail.error === "string") return detail.error;
    if (typeof detail.message === "string") return detail.message;
  }
  return fromStatus(resp ? resp.status : 0);
}

export const NETWORK_ERROR =
  "Can't reach the server. Check your internet connection and try again.";

// Runs a fetch and returns { ok, data, message }. Never throws; `message` is a
// clean string when something went wrong, ready to show straight to the user.
export async function postJson(url, options) {
  let resp;
  try {
    resp = await fetch(url, options);
  } catch {
    return { ok: false, data: null, message: NETWORK_ERROR };
  }
  let data = null;
  try {
    data = await resp.json();
  } catch {
    data = null;
  }
  if (!resp.ok) {
    return { ok: false, data, resp, message: friendlyError(data, resp) };
  }
  return { ok: true, data, resp, message: "" };
}
