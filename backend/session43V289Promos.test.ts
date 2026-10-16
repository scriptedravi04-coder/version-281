import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { cleanPromo, pickPromo, POSTER_SIZES } from "./promo_routes";
import { cleanFeedback } from "./feedback_routes";

// Session 43 (v289, Ravi): promo popups + feedback screenshot fix.
const P = (o: any) => ({ id: o.id || "x", is_active: true, image_url: "https://a/p.png", audience: "all", priority: 0, created_at: "2026-10-01", ...o });

describe("v289 · promo popups", () => {
  it("needs a poster; link must be an app page or https; unknown values fall back", () => {
    expect(cleanPromo({}).error).toBeTruthy();
    expect(cleanPromo({ image_url: "https://a/p.png", link_url: "javascript:alert(1)" }).error).toBeTruthy();
    expect(cleanPromo({ image_url: "https://a/p.png", link_url: "http://plain.com" }).error).toBeTruthy();
    const it = cleanPromo({ image_url: "/api/files/file_ab12", link_url: "/creator/refer", layout: "weird", audience: "x", frequency: "y" }).item;
    expect([it.layout, it.audience, it.frequency]).toEqual(["fullscreen", "all", "once"]);
    expect(cleanPromo({ image_url: "https://a/p.png", starts_at: "2026-10-10", ends_at: "2026-10-09" }).error).toBeTruthy();
  });

  it("picks the live one for my group, highest priority first", () => {
    const now = new Date("2026-10-15").getTime();
    const rows = [
      P({ id: "a", priority: 1 }),
      P({ id: "b", priority: 5, audience: "brand" }),
      P({ id: "c", priority: 9, ends_at: "2026-10-01" }),         // ended
      P({ id: "d", priority: 9, starts_at: "2026-11-01" }),       // not started
      P({ id: "e", priority: 9, is_active: false }),              // off
      P({ id: "g", priority: 2, audience: "guest" }),
    ];
    expect(pickPromo(rows, "brand", now)?.id).toBe("b");
    expect(pickPromo(rows, "creator", now)?.id).toBe("a");
    expect(pickPromo(rows, "guest", now)?.id).toBe("g");
    expect(pickPromo(rows, "other", now)).toBeNull(); // admins don't get promos
  });

  it("designer sizes are fixed per layout", () => {
    expect(POSTER_SIZES.fullscreen).toMatchObject({ w: 1080, h: 2340 });
    expect(POSTER_SIZES.card).toMatchObject({ w: 960, h: 1400 });
    expect(POSTER_SIZES.sheet).toMatchObject({ w: 1080, h: 1200 });
  });

  it("the SQL is ready for Ravi; the server is wired", () => {
    const sql = readFileSync("scripts/sql/session43_promos.sql", "utf8");
    expect(sql).toContain("create table if not exists public.promo_popups");
    expect(sql).toContain("enable row level security");
    expect(readFileSync("backend/server.ts", "utf8")).toContain("setupPromoRoutes(router");
  });
});

describe("v289 · feedback bot screenshots", () => {
  it("uploads answer /api/files/<id> or a public link — both are kept now", () => {
    expect(cleanFeedback({ message: "x", attachments: ["/api/files/file_abc123", "https://x.supabase.co/a.png"] }).item.attachments)
      .toEqual(["/api/files/file_abc123", "https://x.supabase.co/a.png"]);
  });
});
