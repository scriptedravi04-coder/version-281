import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAuth } from "../../contexts/AuthContext";
import { prefetchProfileBanner } from "./ProfileBanner";

// Session 43 (v289, Ravi): the promo poster that shows when the app opens (Hopr / Swiggy style).
// Three layouts — full-screen poster, centre card, bottom sheet. The whole poster is the button
// (tap anywhere → its link), a ✕ closes it; no other button. One popup per app open: while it is up,
// What's New waits for the next open and the feedback bot stays tucked in.
// Admin: Platform tools → Promo popups (backend/promo_routes.ts).

const SKIP = ["/admin", "/onboarding", "/reset-password", "/verify", "/app/continue", "/app/oauth", "/login", "/signup"];
const OPEN_KEY = "ybex_promo_open";
const seenKey = (p) => `ybex_promo_seen:${p.id}:${p.updated_at || ""}`;
const DAY = 24 * 3600 * 1000;

/** Should this promo show now, given when it was last shown on this phone? */
export function dueByFrequency(frequency, lastShownAt, now = Date.now()) {
  if (frequency === "every_open") return true;
  if (!lastShownAt) return true;
  if (frequency === "daily") return now - Number(lastShownAt) >= DAY;
  return false; // "once"
}

const store = {
  get: (k, s = localStorage) => { try { return s.getItem(k); } catch { return null; } },
  set: (k, v, s = localStorage) => { try { s.setItem(k, v); } catch { /* private mode */ } },
};
const otherPopupUp = () => Boolean(window.__ybFullScreenAsk || document.getElementById("yb-splash") ||
  document.querySelector('[aria-modal="true"]:not([data-promo]),[data-testid="logo-cropper"]'));

export default function PromoPopup() {
  const { user, loading } = useAuth() || {};
  const location = useLocation();
  const navigate = useNavigate();
  const [promo, setPromo] = useState(null);
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const lastCheck = useRef(0);
  const busy = useRef(false);
  const shownRef = useRef(false);
  shownRef.current = shown;

  // Session 48 (Ravi: "a popup I upload from admin goes live very late"): before, the app asked the
  // server ONCE per app open and then locked itself for the rest of that open. The installed app stays
  // open in the background for days, so a new popup waited until the app was fully closed. Now it asks
  // again when the app comes back to the screen (and at most once a minute while moving between pages).
  // Still one popup per app open — but a NEW / EDITED popup counts as new and may show once.
  const check = async (force = false) => {
    if (loading || busy.current || shownRef.current) return;
    if (window.innerWidth >= 768) return; // phones only — the admin works on a computer
    if (SKIP.some((p) => window.location.pathname.startsWith(p))) return;
    if (!force && Date.now() - lastCheck.current < 60000) return;
    lastCheck.current = Date.now();
    busy.current = true;
    try {
      let p = null;
      try { const { data } = await api.get("promos/active", { bypassCache: true }); p = data?.promo || null; } catch { return; }
      if (!p) return;
      if (store.get(OPEN_KEY, sessionStorage) === seenKey(p)) return; // this exact popup already showed this open
      if (!dueByFrequency(p.frequency, store.get(seenKey(p)))) return;
      // Load the poster first — never show an empty box.
      await new Promise((res) => { const im = new Image(); im.onload = res; im.onerror = () => { p = null; res(); }; im.src = p.image_url; });
      if (!p) return;
      const pr = p;
      const tryShow = (left = 20) => {
        if (shownRef.current || window.__ybWhatsNewShown || document.visibilityState === "hidden") return;
        if (otherPopupUp()) { if (left > 0) setTimeout(() => tryShow(left - 1), 800); return; }
        window.__ybPromoShown = true;
        store.set(OPEN_KEY, seenKey(pr), sessionStorage);
        store.set(seenKey(pr), String(Date.now()));
        setPromo(pr); setShown(true);
        api.post(`promos/${pr.id}/event`, { type: "view" }).catch(() => {});
      };
      setTimeout(() => tryShow(), 1200);
    } finally { busy.current = false; }
  };
  const checkRef = useRef(check);
  checkRef.current = check;

  // First check as soon as login state is known, then on page changes (throttled to once a minute).
  useEffect(() => { checkRef.current(lastCheck.current === 0); }, [loading, user?.user_id, location.pathname]);
  // Session 48: get the My Profile banner + its picture ready in the background, so the profile page
  // shows it on the first frame instead of a moment later.
  useEffect(() => {
    if (!loading && (user?.role === "creator" || user?.role === "brand")) prefetchProfileBanner();
  }, [loading, user?.user_id, user?.role]);
  // App comes back to the screen → ask again right away.
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") checkRef.current(true); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, []);

  useEffect(() => {
    if (!shown) return undefined;
    const onKey = (e) => { if (e.key === "Escape") close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps

  const close = (then) => {
    setLeaving(true);
    setTimeout(() => { setShown(false); setLeaving(false); window.__ybPromoShown = false; if (then) then(); }, 260);
  };
  const tap = () => {
    if (!promo) return;
    api.post(`promos/${promo.id}/event`, { type: "click" }).catch(() => {});
    const link = String(promo.link_url || "");
    if (!link) return close();
    if (link.startsWith("/")) return close(() => navigate(link));
    close(() => { try { window.open(link, "_blank", "noopener"); } catch { window.location.href = link; } });
  };

  if (!shown || !promo) return null;
  const L = promo.layout;
  const on = !leaving;
  const X = (
    <button type="button" aria-label="Close" data-testid="promo-close" onClick={(e) => { e.stopPropagation(); close(); }}
      style={{ position: "absolute", zIndex: 2, top: L === "fullscreen" ? "calc(env(safe-area-inset-top, 0px) + 14px)" : 12, right: 12, width: 40, height: 40, borderRadius: 20 /* v332: 40px tap target */, border: "none",
        background: "rgba(255,255,255,.92)", boxShadow: "0 6px 18px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.6" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
    </button>
  );
  const poster = (style) => (
    <img src={promo.image_url} alt="" draggable={false} onClick={tap} data-testid="promo-poster"
      style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", cursor: promo.link_url ? "pointer" : "default", userSelect: "none", WebkitUserSelect: "none", ...style }} />
  );
  const backdrop = {
    position: "fixed", inset: 0, zIndex: 2200, background: "rgba(10,10,20,.62)", backdropFilter: "blur(3px)", WebkitBackdropFilter: "blur(3px)",
    opacity: on ? 1 : 0, transition: "opacity .26s ease", animation: on ? "ybPromoBg .26s ease" : undefined,
  };

  const ui = L === "fullscreen" ? (
    <div role="dialog" aria-modal="true" data-promo data-popup-open="true" data-testid="promo-fullscreen" data-statusbar="#000000"
      style={{ position: "fixed", inset: 0, zIndex: 2200, background: "#000", opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(.97)", transition: "opacity .3s ease, transform .32s cubic-bezier(.2,.8,.2,1)", animation: on ? "ybPromoFade .32s cubic-bezier(.2,.8,.2,1)" : undefined }}>
      {X}{poster()}
    </div>
  ) : L === "card" ? (
    <div role="dialog" aria-modal="true" data-promo data-popup-open="true" data-testid="promo-card" style={{ ...backdrop, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }} onClick={() => close()}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "min(88vw, 400px)", aspectRatio: "960 / 1400", maxHeight: "82vh", borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 70px -20px rgba(0,0,0,.6)",
        transform: on ? "scale(1)" : "scale(.86)", transition: "transform .42s cubic-bezier(.34,1.56,.64,1)", animation: on ? "ybPromoPop .42s cubic-bezier(.34,1.56,.64,1)" : undefined }}>
        {X}{poster()}
      </div>
    </div>
  ) : (
    <div role="dialog" aria-modal="true" data-promo data-popup-open="true" data-testid="promo-sheet" style={backdrop} onClick={() => close()}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: 0, right: 0, bottom: 0, aspectRatio: "1080 / 1200", maxHeight: "78vh", borderRadius: "28px 28px 0 0", overflow: "hidden",
        boxShadow: "0 -20px 50px -20px rgba(0,0,0,.5)", transform: on ? "translateY(0)" : "translateY(100%)", transition: "transform .42s cubic-bezier(.22,1,.36,1)", animation: on ? "ybPromoUp .42s cubic-bezier(.22,1,.36,1)" : undefined, paddingBottom: "env(safe-area-inset-bottom, 0px)", background: "#fff" }}>
        <div style={{ position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)", width: 40, height: 5, borderRadius: 3, background: "rgba(255,255,255,.85)", zIndex: 2 }} />
        {X}{poster()}
      </div>
    </div>
  );
  return createPortal(<>
    <style>{`@keyframes ybPromoBg{from{opacity:0}}@keyframes ybPromoFade{from{opacity:0;transform:scale(.97)}}@keyframes ybPromoPop{from{transform:scale(.86)}}@keyframes ybPromoUp{from{transform:translateY(100%)}}`}</style>
    {ui}
  </>, document.body);
}
