import axios from "axios";
import { safeStorage } from "../utils/storage";
import { normalizeApiUrl } from "./apiUrl";
import { apiUrl } from "./native";
import { rememberResponse, peekApi } from "./apiSnapshot";
import { isOffline, makeOfflineError, userJustActed, showOfflineToast } from "./offline";

export const API = "/api";

export { normalizeApiUrl };

export const api = axios.create({
  baseURL: "",
  withCredentials: true,
  timeout: 30000,
});

const getCache = new Map();

export const clearApiCache = () => {
  getCache.clear();
};
// v334: back online → no saved (offline) answer is reused from the 10-second cache; screens read fresh data.
if (typeof window !== "undefined") window.addEventListener("online", () => clearApiCache());

// Session 43 (v284, Supabase quota): a page that is not on screen (another browser tab, the app in
// the background, a laptop left open) kept every timer running — inbox, badges, orders, tickets —
// and each tick made the server read Supabase. That was most of the egress / log usage with no real
// users. Now a GET asked while the page is hidden waits until the page is visible again, and the
// same URL asked many times while hidden becomes ONE request. Nothing is dropped or turned into an
// error, the screen just refreshes when the person comes back. POST / PUT / DELETE are never held.
const isPageHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
let visibleWaiter = null;
const waitUntilVisible = () => {
  if (!visibleWaiter) {
    visibleWaiter = new Promise((resolve) => {
      const onChange = () => {
        if (isPageHidden()) return;
        document.removeEventListener("visibilitychange", onChange);
        visibleWaiter = null;
        resolve();
      };
      document.addEventListener("visibilitychange", onChange);
    });
  }
  return visibleWaiter;
};
const heldWhileHidden = new Map();
export const __heldGetCount = () => heldWhileHidden.size; // tests

// v333 (offline app): with no internet a GET answers with the last saved answer for that screen (same login),
// so the app opens "already loaded" on iPhone and Android instead of an error. Only network failures — a real
// server answer (401, 503 PAYMENTS_UNAVAILABLE, 404…) is never replaced. The OfflineBanner says it is old data.
export const isNetworkFailure = (err) => !err?.response && (
  err?.message === "Network Error" || err?.code === "ERR_NETWORK" || err?.code === "ECONNABORTED" ||
  (typeof navigator !== "undefined" && navigator.onLine === false));
function offlineFallback(url, err) {
  if (!isNetworkFailure(err)) throw err;
  const data = peekApi(url);
  if (data === undefined) throw err;
  try { window.dispatchEvent(new CustomEvent("ybex:offline-data", { detail: { url } })); } catch { /* old browser */ }
  return { data, status: 200, headers: {}, config: err?.config || {}, fromSnapshot: true, offline: true };
}

// Override api.get to implement lightweight in-memory caching
const originalGet = api.get;
api.get = async function(url, config) {
  const normalizedUrl = normalizeApiUrl(url);

  if (isPageHidden() && !config?.allowWhileHidden) {
    const holdKey = normalizedUrl + (config ? JSON.stringify(config) : "");
    if (heldWhileHidden.has(holdKey)) return heldWhileHidden.get(holdKey);
    const self = this;
    const held = waitUntilVisible()
      .then(() => api.get.call(self, url, config))
      .finally(() => heldWhileHidden.delete(holdKey));
    heldWhileHidden.set(holdKey, held);
    return held;
  }

  // v334: the phone says it is offline → the saved answer opens at once (no 500 ms retry, no waiting for the
  // request to fail). Nothing saved → the request goes out and fails as before (the screen shows OfflineState).
  if (isOffline()) {
    const saved = peekApi(normalizedUrl);
    if (saved !== undefined) {
      try { window.dispatchEvent(new CustomEvent("ybex:offline-data", { detail: { url: normalizedUrl } })); } catch { /* old browser */ }
      return { data: saved, status: 200, headers: {}, config: config || {}, fromSnapshot: true, offline: true };
    }
  }

  // Allow bypassing cache if explicitly requested
  if (config?.bypassCache || config?.useCache === false) {
    return originalGet.call(this, normalizedUrl, config).then((res) => {
      rememberResponse(normalizedUrl, res?.data);
      return res;
    }).catch((err) => offlineFallback(normalizedUrl, err)); // v333
  }

  const cacheKey = normalizedUrl + (config ? JSON.stringify(config) : '');
  const cached = getCache.get(cacheKey);
  const now = Date.now();

  // Keep cache valid for 10 seconds
  if (cached && (now - cached.timestamp < 10000)) {
    return cached.promise;
  }

  const promise = originalGet.call(this, normalizedUrl, config).then((res) => {
    // Session 42: keep the last good answer for instant screens (src/lib/apiSnapshot.js).
    rememberResponse(normalizedUrl, res?.data);
    return res;
  }).catch((err) => offlineFallback(normalizedUrl, err));
  getCache.set(cacheKey, {
    promise,
    timestamp: now,
  });

  // If the promise fails, delete it from the cache immediately
  promise.catch(() => {
    getCache.delete(cacheKey);
  });

  return promise;
};

// Interceptor to normalize URL, attach Bearer token & auto-clear cache on mutations
api.interceptors.request.use((config) => {
  if (config.url) {
    config.url = apiUrl(normalizeApiUrl(config.url)); // v335: live server inside the iPhone app (src/lib/native.js)
    config.baseURL = "";
  }

  // If request contains FormData or multipart payload (e.g. large video deliverables), extend timeout to 10 minutes
  const isMultipart = (typeof FormData !== 'undefined' && config.data instanceof FormData) || 
    (config.headers && (
      (config.headers['Content-Type'] && String(config.headers['Content-Type']).includes('multipart')) ||
      (config.headers['content-type'] && String(config.headers['content-type']).includes('multipart'))
    ));
  
  if (isMultipart) {
    if (!config.timeout || config.timeout === 15000) {
      config.timeout = 600000; // 10 minutes for video & file uploads
    }
  }

  // Extend timeout for AI generation endpoints (Gemini long-form generation can take 20-60s)
  const isAiRoute = config.url && (
    config.url.includes('/admin/blog/generate') ||
    config.url.includes('/ai/') ||
    config.url.includes('generate-ai') ||
    config.url.includes('/ai-') ||
    config.url.includes('predict-roi') ||
    config.url.includes('profile-suggestions')
  );

  if (isAiRoute) {
    if (!config.timeout || config.timeout === 15000) {
      config.timeout = 120000; // 2 minutes for AI generation
    }
  }

  try {
    const t = safeStorage.getItem("ybex_token");
    if (t) config.headers.Authorization = `Bearer ${t}`;
  } catch (e) {
    console.error("Error accessing token in request interceptor:", e);
  }

  // Clear cache on write operations
  const method = config.method?.toLowerCase();
  // v334 (offline app): an action (send message, apply, pay, upload, save) tapped with no internet never leaves the
  // phone — it is refused here with code OFFLINE and the calm line "You're offline — try again when you're back
  // online" (src/lib/offline.js), which the screen's own error toast shows. Payment: the Razorpay order is never
  // created, so the Razorpay window never opens offline. A toast here only when the person just tapped something.
  if (method && method !== "get" && method !== "head" && method !== "options" && isOffline()) {
    // Logout (works locally), push and signup-source bookkeeping stay quiet — the person isn't waiting on them.
    if (userJustActed() && !/\/(auth\/logout|auth\/signup-source|push\/|db\/own|onboarding\/progress)/.test(config.url || "")) showOfflineToast();
    return Promise.reject(makeOfflineError(config));
  }
  if (method && ["post", "put", "delete", "patch"].includes(method)) {
    clearApiCache();
  }

  return config;
});

export default api;

api.interceptors.response.use(
  (response) => {
    if (typeof response.data === 'string' && response.data.trim().startsWith('<')) {
      console.warn("Received HTML instead of JSON for API URL:", response.config?.url);
      const isGet = (response.config?.method || 'get').toLowerCase() === 'get';
      // If it's a GET request, fallback to empty array/null to prevent UI crash, but for mutations (POST/PUT/DELETE) reject properly
      if (!isGet) {
        const err = new Error("API endpoint returned HTML instead of JSON");
        err.response = {
          ...response,
          status: 404,
          data: { detail: "API endpoint returned an unexpected HTML response", code: "INVALID_RESPONSE" }
        };
        return Promise.reject(err);
      }
      return { ...response, data: [] };
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    // Retry once on transient network errors if not already retried
    // GET only. Retrying a POST after a network error can double-submit — a second escrow
    // hold, a duplicate message — because the first request may well have reached the
    // server and only the response was lost. GETs are safe to repeat; nothing else is.
    const isIdempotent = String(originalRequest?.method || "get").toLowerCase() === "get";
    const isTransientNetwork =
      error.message === "Network Error" || error.code === "ERR_NETWORK" || error.code === "ECONNABORTED";
    if (isTransientNetwork && isIdempotent && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        return await api(originalRequest);
      } catch (retryErr) {
        console.warn("API Network Error retry failed:", originalRequest.url);
        return Promise.reject(retryErr);
      }
    }
    if (error.response && typeof error.response.data === 'string' && error.response.data.trim().startsWith('<')) {
      console.warn("Received HTML error response instead of JSON for URL:", error.config?.url);
      error.response.data = {
        detail: `Server returned an error (${error.response.status}). Please try again.`,
        error: error.response.statusText || "Server error",
        code: "SERVER_ERROR"
      };
    }
    return Promise.reject(error);
  }
);
