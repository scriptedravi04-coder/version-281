import express from "express";
import { SESSION_MS } from "./authSecurity";
import crypto from "crypto";
import axios from "axios";
import { newSessionToken, escapeLike, pickLoginUser, sessionCookieOptions } from "./authSecurity";

// Session 43 (v286, Ravi): "Continue with Google" (iPhone + Android) and "Continue with Apple"
// (iPhone) on the app's login screen.
//
// Same-window redirect flow (works inside the installed app, where pop-ups don't come back):
//   1. GET  /auth/oauth/url?provider=google|apple&role=creator|brand → { url }
//   2. the app opens that url; Google / Apple send the person back to
//        GET  /api/auth/oauth/google/callback   (code)
//        POST /api/auth/oauth/apple/callback    (form_post: code + id_token + user)
//   3. we find the account by e-mail (or make one, already verified), start a normal session
//      (Supabase user_sessions, same as e-mail login) and redirect to /app/oauth#token=… —
//      the token is in the #fragment, so it never reaches any server log.
//
// Settings (env):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (already used by the old pop-up flow)
//   APPLE_CLIENT_ID = the Apple "Services ID" (e.g. in.ybexmedia.signin)
// Redirect URLs to register:  https://<host>/api/auth/oauth/google/callback  (Google Cloud)
//                             https://<host>/api/auth/oauth/apple/callback   (Apple Services ID)
// Apple's id_token is checked against Apple's public keys (no Apple private key needed).

const PROVIDERS = new Set(["google", "apple"]);
const ROLES = new Set(["creator", "brand"]);
const STATE_TTL_MS = 15 * 60 * 1000;

function stateSecret() {
  return process.env.OAUTH_STATE_SECRET || process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "ybex-oauth-state";
}
const b64u = (buf: Buffer | string) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const fromB64u = (s: string) => Buffer.from(String(s || "").replace(/-/g, "+").replace(/_/g, "/"), "base64");

/** Signed, short-lived state: which role the person tapped, and a nonce. */
export function makeState(role: string | null, now = Date.now(), secret = stateSecret(), native = false) {
  // v335: a = 1 → started inside the iPhone app (Capacitor); the callback sends the person back into the app.
  const body = b64u(JSON.stringify({ r: ROLES.has(String(role)) ? role : null, n: crypto.randomBytes(9).toString("hex"), t: now, ...(native ? { a: 1 } : {}) }));
  const sig = b64u(crypto.createHmac("sha256", secret).update(body).digest());
  return `${body}.${sig}`;
}
export function readState(state: string, now = Date.now(), secret = stateSecret()): { r: string | null; n: string; native?: boolean } | null {
  const [body, sig] = String(state || "").split(".");
  if (!body || !sig) return null;
  const want = b64u(crypto.createHmac("sha256", secret).update(body).digest());
  const a = Buffer.from(sig), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const p = JSON.parse(fromB64u(body).toString("utf8"));
    if (!p || typeof p.t !== "number" || now - p.t > STATE_TTL_MS || p.t - now > 60000) return null;
    return { r: ROLES.has(p.r) ? p.r : null, n: String(p.n || ""), ...(p.a === 1 ? { native: true } : {}) };
  } catch {
    return null;
  }
}

/** Checks an Apple id_token (RS256) against Apple's keys. Returns its claims or throws. */
export async function verifyAppleIdToken(idToken: string, clientId: string, getKeys: () => Promise<any[]>, now = Date.now()) {
  const [h, p, s] = String(idToken || "").split(".");
  if (!h || !p || !s) throw new Error("bad token");
  const header = JSON.parse(fromB64u(h).toString("utf8"));
  const claims = JSON.parse(fromB64u(p).toString("utf8"));
  if (header.alg !== "RS256") throw new Error("bad alg");
  const jwk = (await getKeys()).find((k: any) => k.kid === header.kid);
  if (!jwk) throw new Error("unknown key");
  const key = crypto.createPublicKey({ key: jwk, format: "jwk" } as any);
  const ok = crypto.verify("RSA-SHA256", Buffer.from(`${h}.${p}`), key, fromB64u(s));
  if (!ok) throw new Error("bad signature");
  if (claims.iss !== "https://appleid.apple.com") throw new Error("bad issuer");
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(clientId)) throw new Error("bad audience");
  if (!claims.exp || claims.exp * 1000 < now) throw new Error("expired");
  return claims;
}

let appleKeys: { at: number; keys: any[] } | null = null;
async function getAppleKeys() {
  if (appleKeys && Date.now() - appleKeys.at < 6 * 3600e3) return appleKeys.keys;
  const { data } = await axios.get("https://appleid.apple.com/auth/keys", { timeout: 8000 });
  appleKeys = { at: Date.now(), keys: Array.isArray(data?.keys) ? data.keys : [] };
  return appleKeys.keys;
}

export type OAuthDeps = { supabase: any; privilegedSupabase: any; getDb: () => any; saveDb: (db: any) => void };
export type OAuthProfile = { email: string; name: string; picture: string; provider: string; role: string | null };

/**
 * v291 (Ravi: "I am logged in on my phone with this Google account, but on the website 'Continue with
 * Google' offered to create a new account"): ONE place that turns a verified Google / Apple e-mail into
 * a session — used by the app's redirect flow AND the website's pop-up flow. The account is looked up
 * by e-mail in Supabase (the real user table), never only in the local JSON store, so an account made
 * on the phone is the same account on the website.
 */
export async function oauthSignInCore(
  { supabase, privilegedSupabase, getDb, saveDb }: OAuthDeps,
  p: OAuthProfile
): Promise<{ ok: boolean; token?: string; user?: any; created?: boolean; error?: string }> { // v295: type only — this project's tsc is not strict, so the old ok:true|false union did not narrow (4 tsc errors)
  const c = privilegedSupabase || supabase;
  const email = String(p.email || "").trim().toLowerCase();
  if (!email || !email.includes("@")) return { ok: false, error: "no_email" };
  let user: any = null;
  let created = false;
  if (c) {
    const { data, error } = await c.from("users").select("*").ilike("email", escapeLike(email)).limit(5);
    if (error) return { ok: false, error: "lookup" };
    user = pickLoginUser(Array.isArray(data) ? data : [], email);
  } else {
    user = (getDb().users || []).find((u: any) => String(u.email || "").toLowerCase() === email) || null;
  }
  if (user) {
    if (user.is_deleted) return { ok: false, error: "deleted" };
    if (user.banned) return { ok: false, error: "banned" };
    if (user.role === "admin" || user.is_admin === true) return { ok: false, error: "admin" };
    const patch: any = {};
    if (!user.role && p.role) patch.role = p.role;
    if (!user.verified) {
      patch.verified = true; // Google / Apple already proved the e-mail
      // Session 58 (security): a password set before the email was ever verified may not be the owner's — clear it.
      if (user.password_hash) patch.password_hash = null;
    }
    if (!user.name && p.name) patch.name = p.name;
    if (Object.keys(patch).length) {
      if (c) await c.from("users").update(patch).eq("user_id", user.user_id);
      user = { ...user, ...patch };
    }
  } else {
    created = true;
    user = {
      user_id: crypto.randomUUID(), email, name: p.name || email.split("@")[0], picture: p.picture || "",
      role: p.role || null, phone: "", auth_method: p.provider, created_at: new Date().toISOString(),
      onboarded: false, verified: true,
    };
    if (c) {
      const { error } = await c.from("users").insert(user);
      if (error) { console.error("[oauth] create user:", error.message); return { ok: false, error: "create" }; }
    }
    const db = getDb(); if (!db.users) db.users = []; db.users.push(user); saveDb(db);
  }
  const session = {
    user_id: user.user_id, session_token: newSessionToken(),
    expires_at: new Date(Date.now() + SESSION_MS).toISOString(), created_at: new Date().toISOString(), // Session 58: 30 days, renewed while the app is used
  };
  if (c) {
    const { error } = await c.from("user_sessions").insert(session);
    if (error) { console.error("[oauth] session:", error.message); return { ok: false, error: "session" }; }
  }
  const db = getDb(); if (!db.user_sessions) db.user_sessions = []; db.user_sessions.push(session); saveDb(db);
  return { ok: true, token: session.session_token, user, created };
}

export const isIosUserAgent = (ua: string) => /iPhone|iPad|iPod/i.test(String(ua || "")) || (/Macintosh/i.test(String(ua || "")) && /Mobile/i.test(String(ua || "")));

export function setupOAuthRoutes(
  router: express.Router,
  { supabase, privilegedSupabase, getDb, saveDb }: { supabase: any; privilegedSupabase: any; getDb: () => any; saveDb: (db: any) => void }
) {
  const origin = (req: express.Request) => {
    const host = req.get("host") || "";
    const proto = host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https";
    return `${proto}://${host}`;
  };
  // v335: native = the sign-in started inside the iPhone app → back through the app's own link (com.ybex.app://).
  const back = (req: express.Request, res: express.Response, params: Record<string, string>, native = false) =>
    res.redirect(302, native
      ? `com.ybex.app://oauth#${new URLSearchParams(params).toString()}`
      : `${origin(req)}/app/oauth#${new URLSearchParams(params).toString()}`);

  router.get("/auth/oauth/url", (req, res) => {
    const provider = String(req.query.provider || "");
    if (!PROVIDERS.has(provider)) return res.status(400).json({ error: "Unknown sign-in option." });
    const state = makeState(String(req.query.role || ""), Date.now(), stateSecret(), String(req.query.app || "") === "native");
    if (provider === "google") {
      const client_id = process.env.GOOGLE_CLIENT_ID;
      if (!client_id) return res.status(503).json({ error: "Google sign-in is not set up yet. Please use your email for now." });
      // v291 (Ravi: iPhone asks to type the Google ID, no account list): the installed iPhone app has
      // no Google cookies, so Google cannot list accounts. If the app knows an e-mail (last login, or the
      // one the person typed) it goes in as login_hint and Google opens straight on that account.
      const hint = String(req.query.hint || "").trim().toLowerCase();
      const validHint = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint) && hint.length <= 254;
      const q = new URLSearchParams({
        client_id, redirect_uri: `${origin(req)}/api/auth/oauth/google/callback`, response_type: "code",
        scope: "openid email profile", state,
        ...(validHint ? { login_hint: hint } : { prompt: "select_account" }),
      });
      return res.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}` });
    }
    const client_id = process.env.APPLE_CLIENT_ID;
    if (!client_id) return res.status(503).json({ error: "Apple sign-in is not set up yet. Please use your email for now." });
    const q = new URLSearchParams({
      client_id, redirect_uri: `${origin(req)}/api/auth/oauth/apple/callback`, response_type: "code id_token",
      response_mode: "form_post", scope: "name email", state,
    });
    return res.json({ url: `https://appleid.apple.com/auth/authorize?${q.toString()}` });
  });

  /** Finds the account by e-mail or makes a new verified one, then starts a session. */
  async function signIn(req: express.Request, res: express.Response, p: { email: string; name: string; picture: string; provider: string; role: string | null; native?: boolean }) {
    const r = await oauthSignInCore({ supabase, privilegedSupabase, getDb, saveDb }, p);
    if (!r.ok) return back(req, res, { error: r.error }, Boolean(p.native));
    res.cookie("session_token", r.token, sessionCookieOptions());
    res.cookie("has_session", "true", { ...sessionCookieOptions(), httpOnly: false });
    return back(req, res, { token: r.token, role: r.user.role || p.role || "" }, Boolean(p.native));
  }

  router.get("/auth/oauth/google/callback", async (req, res) => {
    const st = readState(String(req.query.state || ""));
    if (!st || !req.query.code) return back(req, res, { error: req.query.error ? "cancelled" : "state" }, Boolean(st?.native));
    try {
      const tok = await axios.post("https://oauth2.googleapis.com/token", {
        client_id: process.env.GOOGLE_CLIENT_ID, client_secret: process.env.GOOGLE_CLIENT_SECRET, code: String(req.query.code),
        redirect_uri: `${origin(req)}/api/auth/oauth/google/callback`, grant_type: "authorization_code",
      }, { timeout: 10000 });
      const info = await axios.get("https://www.googleapis.com/oauth2/v3/userinfo", { headers: { Authorization: `Bearer ${tok.data.access_token}` }, timeout: 10000 });
      const pr = info.data || {};
      if (!pr.email || pr.email_verified === false) return back(req, res, { error: "no_email" }, Boolean(st.native));
      return await signIn(req, res, { email: pr.email, name: pr.name || "", picture: pr.picture || "", provider: "google", role: st.r, native: Boolean(st.native) });
    } catch (e: any) {
      console.error("[oauth] google:", e?.response?.data || e?.message || e);
      return back(req, res, { error: "google" }, Boolean(st.native));
    }
  });

  router.post("/auth/oauth/apple/callback", express.urlencoded({ extended: false }), async (req, res) => {
    const body: any = req.body || {};
    const st = readState(String(body.state || ""));
    if (!st || !body.id_token) return back(req, res, { error: body.error ? "cancelled" : "state" }, Boolean(st?.native));
    try {
      const claims = await verifyAppleIdToken(String(body.id_token), String(process.env.APPLE_CLIENT_ID || ""), getAppleKeys);
      let name = "";
      try { const u = JSON.parse(String(body.user || "{}")); name = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(" "); } catch { /* only sent the first time */ }
      return await signIn(req, res, { email: String(claims.email || ""), name, picture: "", provider: "apple", role: st.r, native: Boolean(st.native) });
    } catch (e: any) {
      console.error("[oauth] apple:", e?.message || e);
      return back(req, res, { error: "apple" }, Boolean(st.native));
    }
  });
}
