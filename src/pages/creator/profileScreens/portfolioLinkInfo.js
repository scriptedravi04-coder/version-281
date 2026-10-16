// Session 49 (clean-up): moved out of CreatorMobileProfile.jsx unchanged.
// Session 40: what a pasted portfolio link is (Instagram reel/post, YouTube video, other link).
export function portfolioLinkInfo(raw) {
  const t = String(raw || "").trim();
  if (!t) return { ok: false };
  const url = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  let u;
  try { u = new URL(url); } catch (e) { return { ok: false }; }
  const host = u.hostname.toLowerCase().replace(/^www\.|^m\./, "");
  if (!host.includes(".")) return { ok: false };
  if (host === "instagram.com" || host === "instagr.am") {
    const kind = /\/(reel|reels)\//i.test(u.pathname) ? "Instagram reel" : /\/p\//i.test(u.pathname) ? "Instagram post" : "Instagram";
    return { ok: true, url, platform: "instagram", label: kind };
  }
  if (host === "youtube.com" || host === "youtu.be") {
    return { ok: true, url, platform: "youtube", label: /\/shorts\//.test(u.pathname) ? "YouTube Short" : "YouTube video" };
  }
  if (host.endsWith("drive.google.com")) return { ok: true, url, platform: "drive", label: "Google Drive" };
  return { ok: true, url, platform: "other", label: host };
}

