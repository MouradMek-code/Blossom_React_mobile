import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { BASE_URL } from "./config";
import { getToken } from "./storage";
import { friendlyError } from "./errors";

// A phone photo is 3-5 MB. Sent as is, over mobile data, the upload could take
// so long that the connection dropped before the server answered - the photo
// was saved, yet the app said it failed. Shrunk to 1600px it is ~300 KB.
const MAX_SIDE = 1600;
const TIMEOUT_MS = 90000;

async function shrink(asset) {
  const original = {
    uri: asset.uri,
    name: asset.fileName || "photo.jpg",
    type: asset.mimeType || "image/jpeg",
  };
  try {
    const { width = 0, height = 0 } = asset;
    let context = ImageManipulator.manipulate(asset.uri);
    if (Math.max(width, height) > MAX_SIDE) {
      context = context.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    }
    const image = await context.renderAsync();
    const result = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    return { uri: result.uri, name: "photo.jpg", type: "image/jpeg" };
  } catch {
    return original; // can't shrink it: send the original rather than nothing
  }
}

export class PhotoUploadError extends Error {}

// The photos on the server right now.
export async function fetchOwnPhotos(token) {
  const resp = await fetch(`${BASE_URL}/profile`, {
    headers: { Authorization: `Bearer ${token || (await getToken())}` },
  });
  if (!resp.ok) throw new Error(`profile failed with ${resp.status}`);
  const profile = await resp.json();
  return profile.photos || [];
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A photo on the server that the app doesn't know about yet. The server keeps
// going when the connection drops, so give it a few seconds to finish.
export async function findSavedPhoto(knownIds, { waits = [0, 3000, 5000, 7000] } = {}) {
  const token = await getToken();
  for (const wait of waits) {
    if (wait) await sleep(wait);
    try {
      const fresh = (await fetchOwnPhotos(token)).filter((p) => !knownIds.has(p.id));
      if (fresh.length) return fresh.reduce((a, b) => (b.id > a.id ? b : a));
    } catch {
      // still offline - try again
    }
  }
  return null;
}

async function uploadNow(asset, knownIds) {
  const token = await getToken();
  // Without the list of photos already there, a lost answer can't be told
  // apart from an old photo - fetch it first.
  if (!knownIds) {
    knownIds = new Set((await fetchOwnPhotos(token).catch(() => [])).map((p) => p.id));
  }

  const form = new FormData();
  form.append("image", await shrink(asset));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let resp = null;
  try {
    resp = await fetch(`${BASE_URL}/profile/image`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch {
    // no answer (connection dropped, timed out): checked below
  } finally {
    clearTimeout(timer);
  }

  if (resp?.ok) {
    try {
      const photo = await resp.json();
      if (photo?.id) return photo;
    } catch {
      // answer cut short: checked below
    }
  }
  // A clear "no" from the server (not a photo, no profile yet...).
  if (resp && resp.status >= 400 && resp.status < 500 && resp.status !== 408 && resp.status !== 429) {
    const data = await resp.json().catch(() => null);
    throw new PhotoUploadError(friendlyError(data, resp));
  }
  // Otherwise the answer was lost: the photo may well be saved. Look before
  // telling the person it failed.
  const saved = await findSavedPhoto(knownIds);
  if (saved) return saved;
  throw new PhotoUploadError("");
}

// One upload at a time: quicker on a weak connection, and a photo found on the
// server after a lost answer can only belong to the upload that just ran.
let queue = Promise.resolve();

// Resolves with the saved photo ({ id, image_url }); rejects with a
// PhotoUploadError (message "" = connection trouble).
// knownIds: ids of the photos already shown (null if unknown).
export function uploadPhoto(asset, knownIds) {
  const run = queue.then(() => uploadNow(asset, knownIds));
  queue = run.catch(() => {});
  return run;
}

export async function deletePhoto(photoId) {
  const token = await getToken();
  const resp = await fetch(`${BASE_URL}/profile/image/${photoId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  // Already gone counts as deleted.
  if (!resp.ok && resp.status !== 404) throw new Error(`delete failed with ${resp.status}`);
}

export async function pickPhotos({ max = 1 } = {}) {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return [];
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsMultipleSelection: max > 1,
    selectionLimit: max,
  });
  if (result.canceled) return [];
  return (result.assets || []).slice(0, max);
}
