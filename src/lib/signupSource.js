// Session 58 (Ravi: "han kro") — remember where a visitor first came from, so the Admin Growth page can
// show Instagram / Google / Meta ads / … signups. Only the first visit is kept (a later visit with ad
// tags replaces a plain one). After sign-in it is sent once; the server saves it only on a new account.
import { safeStorage } from "../utils/storage";

const KEY = "yb_signup_src";
const SENT = "yb_signup_src_sent";

function read() {
  try { return JSON.parse(safeStorage.getItem(KEY) || "null"); } catch { return null; }
}

/** Call once when the app starts. */
export function captureSignupSource() {
  if (typeof window === "undefined") return;
  try {
    const q = new URLSearchParams(window.location.search || "");
    const tag = (k) => (q.get(k) || "").slice(0, 120);
    const now = {
      utm_source: tag("utm_source"), utm_medium: tag("utm_medium"), utm_campaign: tag("utm_campaign"),
      gclid: q.get("gclid") ? 1 : 0, fbclid: q.get("fbclid") ? 1 : 0,
      referrer: String(document.referrer || "").slice(0, 200),
      app: (window.navigator.standalone === true || (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches)) ? 1 : 0,
      at: Date.now(),
    };
    // A referrer from our own site says nothing about where the person came from.
    // Nor does the Google / Apple sign-in page sending them back, or the payment window.
    if (/ybex|accounts\.google|appleid\.apple|razorpay/i.test(now.referrer) && !now.referrer.startsWith("android-app://")) now.referrer = "";
    const hasTags = !!(now.utm_source || now.gclid || now.fbclid);
    const old = read();
    const oldHasTags = !!(old && (old.utm_source || old.gclid || old.fbclid));
    if (!old || (hasTags && !oldHasTags)) safeStorage.setItem(KEY, JSON.stringify(now));
  } catch (e) {
    console.warn("[signupSource] not saved:", e?.message || e);
  }
}

/** Call after any sign-in. Sends once per browser; the server ignores old accounts. */
export function sendSignupSource(api, user) {
  if (!user?.user_id || !api) return;
  if (user.role === "admin" || user.role === "sub_admin") return;
  try {
    if (safeStorage.getItem(SENT) === String(user.user_id)) return;
    const created = new Date(user.created_at || 0).getTime();
    if (created && Date.now() - created > 2 * 24 * 60 * 60 * 1000) { safeStorage.setItem(SENT, String(user.user_id)); return; }
    safeStorage.setItem(SENT, String(user.user_id));
    api.post("auth/signup-source", read() || {}).catch((e) => console.warn("[signupSource] send failed:", e?.message || e));
  } catch (e) {
    console.warn("[signupSource] skipped:", e?.message || e);
  }
}
