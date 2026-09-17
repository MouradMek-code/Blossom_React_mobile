// On a physical device (phone via Expo Go), the app must reach the backend
// over the LAN, so this must be your PC's LAN IP - "localhost"/"10.0.2.2"
// only work from an emulator running on the same machine as the backend.
export const BASE_URL = "https://blossom-backend-x2wv.onrender.com";

export const SITE_URL = "https://blossom-date.com";

// Expo project (app.json extra.eas.projectId) - identifies the app to Expo's
// push service. Not a secret. Hard-coded rather than read from expo-constants
// so it works the same in locally built release bundles.
export const EAS_PROJECT_ID = "47d54433-caae-4942-9ef3-9f804bfaa761";
export const PRIVACY_POLICY_URL = `${SITE_URL}/privacy-policy`;

// Other projects by Blossom's founder, featured on the home screen.
export const FINDREWARD_URL = "https://findreward.net";
export const HELPREWARD_URL = "https://helpreward.com";
