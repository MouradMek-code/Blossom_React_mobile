import { BASE_URL } from "./config";
import { postJson } from "./errors";
import { getToken } from "./storage";
import { shrink } from "./photoUpload";

// The ✓ verified badge (server: database/db_verification.py). The server
// picks the pose to copy, so an old photo can't be used; the emoji shows it.
export const POSE_EMOJI = {
  peace: "✌️",
  thumb: "👍",
  wave: "👋",
  point: "☝️",
  ok: "👌",
  chin: "🤔",
};

async function authHeaders() {
  return { Authorization: `Bearer ${await getToken()}` };
}

// { status: "none" | "pending" | "approved" | "rejected", pose, reason }
export async function fetchVerification() {
  return postJson(`${BASE_URL}/verification/me`, { headers: await authHeaders() });
}

export async function sendSelfie(asset) {
  const form = new FormData();
  form.append("selfie", await shrink(asset));
  return postJson(`${BASE_URL}/verification`, { method: "POST", headers: await authHeaders(), body: form });
}

// Admins: "Ask to verify" a suspicious profile - 48 hours or it's deleted.
export async function requestVerification(profileId) {
  return postJson(`${BASE_URL}/verification/admin/request/${profileId}`, {
    method: "POST",
    headers: await authHeaders(),
  });
}

// Admins: the selfies waiting, and the decision.
export async function fetchPendingSelfies() {
  return postJson(`${BASE_URL}/verification/admin`, { headers: await authHeaders() });
}

export async function decideSelfie(id, approve, reason) {
  return postJson(`${BASE_URL}/verification/admin/${id}/${approve ? "approve" : "reject"}`, {
    method: "POST",
    headers: { ...(await authHeaders()), "Content-Type": "application/json" },
    body: approve ? undefined : JSON.stringify({ reason }),
  });
}
