// Fill in FIREBASE_API_KEY with the same value as VITE_FIREBASE_API_KEY in Netlify.
// This is the Firebase Web API key — it's a public client identifier, not a secret
// (it's already embedded in the deployed web app's JS bundle too), so it's fine to
// ship inside the extension.
const CONFIG = {
  FIREBASE_API_KEY: "PASTE_VITE_FIREBASE_API_KEY_HERE",
  SITE_URL: "https://elegant-bombolone-70cbfe.netlify.app"
};
