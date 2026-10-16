// v336 (Ravi: phone notifications in the iPhone App Store app). Inside the App Store app there is no web push —
// Apple delivers through APNs. The Capacitor plugin @capacitor/push-notifications (added in ios-app/) gives this phone
// an Apple token; we save it on the server (POST /push/native-register) and the server sends through APNs
// (backend/apns.ts). On the website / Android / Home Screen app nothing here runs (isNative() is false).
import { api } from "./api";
import { isNative } from "./native";

const TOKEN_KEY = "ybex_apns_token";
const plugin = () => {
  try { return window.Capacitor?.Plugins?.PushNotifications || null; } catch { return null; }
};

export const nativePushAvailable = () => isNative() && Boolean(plugin());

/** "granted" | "denied" | "prompt" | "unsupported" */
export async function nativePushState() {
  const P = plugin();
  if (!isNative() || !P) return "unsupported";
  try {
    const r = await P.checkPermissions();
    const v = String(r?.receive || "prompt");
    return v === "granted" ? "granted" : v === "denied" ? "denied" : "prompt";
  } catch { return "unsupported"; }
}

/** From a button tap: Apple's popup, then (if allowed) get a token — the listener below saves it. */
export async function askNativePush() {
  const P = plugin();
  if (!isNative() || !P) return "unsupported";
  try {
    const r = await P.requestPermissions();
    if (r?.receive === "granted") { await P.register(); return "granted"; }
    return r?.receive === "denied" ? "denied" : "default";
  } catch { return "default"; }
}

/** Already allowed → ask Apple for the token again so it's saved under whoever is signed in now. */
export async function refreshNativePush() {
  const P = plugin();
  if (!P || (await nativePushState()) !== "granted") return;
  try { await P.register(); } catch { /* next open */ }
}

/** Logout: this phone goes back to "guest" (announcements only), like web push. Never throws. */
export async function releaseNativePushOnLogout() {
  try {
    if (!isNative()) return;
    const t = window.localStorage.getItem(TOKEN_KEY);
    if (t) await api.post("push/unsubscribe", { endpoint: `apns:${t}`, to_guest: true }, { timeout: 4000 });
  } catch { /* logout must never wait on this */ }
}

let installed = false;
/** Once at start-up (src/index.jsx). Saves tokens and opens the right screen when a notification is tapped. */
export function installNativePush() {
  const P = plugin();
  if (installed || !isNative() || !P) return;
  installed = true;
  try {
    P.addListener("registration", async (tok) => {
      const token = String(tok?.value || "").toLowerCase();
      if (!token) return;
      try { window.localStorage.setItem(TOKEN_KEY, token); } catch { /* private */ }
      try { await api.post("push/native-register", { token, platform: "ios" }, { timeout: 8000 }); } catch { /* retried next open */ }
    });
    P.addListener("registrationError", (e) => { console.warn("[push] iPhone registration failed:", e?.error || e); });
    P.addListener("pushNotificationActionPerformed", (ev) => {
      const url = ev?.notification?.data?.url;
      const target = typeof url === "string" && url.startsWith("/") ? url : "/notifications";
      try {
        window.history.pushState(null, "", target);
        window.dispatchEvent(new PopStateEvent("popstate"));
      } catch { window.location.href = target; }
    });
  } catch { /* plugin missing in this build */ }
  refreshNativePush();
}
