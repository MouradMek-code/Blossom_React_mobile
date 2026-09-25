import { parseServerDate } from "./chatTime";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The "New" badge on Browse cards: the profile was created less than a week
// ago. created_at comes from the server in UTC (see parseServerDate).
export function isNewMember(profile, now = Date.now()) {
  const created = parseServerDate(profile?.created_at);
  return Boolean(created) && now - created.getTime() < WEEK_MS;
}
