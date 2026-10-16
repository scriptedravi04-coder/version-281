// v286 (Ravi): one rule for "which creators may a brand see" — Explore, the dashboard's
// "Meet the Creators" and the creator panel's "Top creators" all use it. Only creators approved
// from the waitlist (profile_status "approved"), never deleted / test / developer-bypass accounts.
const nameOf = (c) => String(c?.full_name || c?.name || "").trim();

export function visibleCreators(list) {
  return (list || []).filter((c) => {
    if (!c || c.is_deleted) return false;
    const st = String(c.profile_status || "approved").toLowerCase();
    if (st !== "approved") return false;
    const n = nameOf(c).toLowerCase();
    if (n.length < 2 || n === "c" || n.startsWith("test")) return false;
    const h = String(c.instagram_handle || c.handle || "").toLowerCase();
    return !n.includes("developer bypass") && !h.includes("dev_bypass");
  });
}
