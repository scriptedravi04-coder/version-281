import React, { useEffect, useState } from "react";
import { WifiOff } from "lucide-react";

// v333 (Ravi: "net nahi ho tab bhi chale, app already loaded show ho" — App Store 4.2 / Play): a calm pill at
// the top while the phone is offline. Screens keep showing what was loaded last time (lib/api.js offline
// fallback); this says so, and disappears by itself when the internet is back.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && navigator.onLine === false);
  const [stale, setStale] = useState(false);
  const [backOnline, setBackOnline] = useState(false);
  useEffect(() => {
    let t = 0;
    const off = () => { setOffline(true); setBackOnline(false); };
    const on = () => { setOffline(false); setStale(false); setBackOnline(true); clearTimeout(t); t = setTimeout(() => setBackOnline(false), 2500); };
    const old = () => setStale(true);
    window.addEventListener("offline", off);
    window.addEventListener("online", on);
    window.addEventListener("ybex:offline-data", old);
    return () => { window.removeEventListener("offline", off); window.removeEventListener("online", on); window.removeEventListener("ybex:offline-data", old); clearTimeout(t); };
  }, []);
  if (!offline && !stale && !backOnline) return null;
  const good = backOnline && !offline;
  return (
    <div role="status" aria-live="polite" data-testid="offline-banner"
      style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", top: "calc(env(safe-area-inset-top, 0px) + 8px)", zIndex: 3000,
        display: "flex", alignItems: "center", gap: 8, maxWidth: "calc(100vw - 24px)", padding: "8px 14px", borderRadius: 999,
        background: good ? "#ECFDF5" : "#1F1B2E", color: good ? "#047857" : "#FFFFFF", boxShadow: "0 10px 30px -12px rgba(15,11,31,.45)",
        font: "600 12.5px/1.3 'DM Sans', sans-serif", pointerEvents: "none" }}>
      {good ? <span aria-hidden="true">✓</span> : <WifiOff size={14} aria-hidden="true" />}
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        {good ? "Back online" : offline ? "You're offline · showing your last saved screens" : "Connection is slow · showing saved data"}
      </span>
    </div>
  );
}
