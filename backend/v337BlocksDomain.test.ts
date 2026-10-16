// v337 (Session 59): block a user + ybexmedia.in Cloudflare proxy + iPhone server address.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { blockSide, threadOtherId, filterThreadsForBlocks, filterByPerson, blockMessage, blockerIdFor } from "./blockUsers";
import { applyDomainProxyIp } from "./domainProxy";

const state = { byMe: new Set(["c_blocked"]), byThem: new Set(["b_blocker"]) };

describe("v337 block a user", () => {
  it("knows which side blocked", () => {
    expect(blockSide(state, "c_blocked")).toBe("by_me");
    expect(blockSide(state, "b_blocker")).toBe("by_them");
    expect(blockSide(state, "someone")).toBe(null);
    expect(blockSide(null, "c_blocked")).toBe(null);
  });
  it("brand team members block for the parent brand", () => {
    expect(blockerIdFor({ user_id: "m1", parent_brand_id: "b1" })).toBe("b1");
    expect(blockerIdFor({ user_id: "c1" })).toBe("c1");
  });
  it("finds the other person in a thread", () => {
    const me = new Set(["b1"]);
    expect(threadOtherId({ creator_id: "c1", brand_id: "b1" }, me)).toBe("c1");
    expect(threadOtherId({ creator_id: "b1", brand_id: "x" }, me)).toBe("x");
    expect(threadOtherId({ creator_id: "c1", brand_id: "b2" }, me)).toBe("");
  });
  it("hides blocked chats but keeps a paid one, marked", () => {
    const me = new Set(["b1"]);
    const out = filterThreadsForBlocks([
      { id: "1", creator_id: "c_blocked", brand_id: "b1" },
      { id: "2", creator_id: "c_blocked", brand_id: "b1", payment_funded: true },
      { id: "3", creator_id: "c_ok", brand_id: "b1" },
    ], state, me);
    expect(out.map((t) => t.id)).toEqual(["2", "3"]);
    expect(out[0].blocked).toBe("by_me");
  });
  it("filters invitations / applicants by person", () => {
    expect(filterByPerson([{ brand_id: "b_blocker" }, { brand_id: "b_ok" }], state, (r) => [r.brand_id])).toEqual([{ brand_id: "b_ok" }]);
    const empty = { byMe: new Set<string>(), byThem: new Set<string>() };
    const rows = [{ brand_id: "b_blocker" }];
    expect(filterByPerson(rows, empty, (r) => [r.brand_id])).toBe(rows);
  });
  it("messages never say who blocked whom to the blocked person", () => {
    expect(blockMessage("by_them", "message")).not.toMatch(/blocked/i);
    expect(blockMessage("by_me", "message", "Asha")).toContain("You blocked Asha");
  });
  it("is registered before the locked chat / creators / campaign routes", () => {
    const s = readFileSync("backend/server.ts", "utf8");
    const at = s.indexOf("setupBlockRoutes(router");
    expect(at).toBeGreaterThan(0);
    for (const k of ["setupChatCoreRoutes(app", "setupCreatorsRoutes(app", "setupCampaignManageRoutes(router", "setupCampaignsRoutes(app"]) {
      expect(s.indexOf(k)).toBeGreaterThan(at);
    }
  });
});

describe("v337 domain proxy", () => {
  const SECRET = "x".repeat(32);
  it("adds the real visitor IP only with the right secret", () => {
    const req: any = { headers: { "x-forwarded-for": "1.1.1.1, 104.16.0.1", "x-ybex-proxy-key": SECRET, "x-ybex-client-ip": "49.36.10.20" } };
    applyDomainProxyIp(req, SECRET);
    expect(req.headers["x-forwarded-for"].split(",").pop().trim()).toBe("49.36.10.20");
    expect(req.headers["x-ybex-proxy-key"]).toBeUndefined();
  });
  it("ignores a wrong / missing secret and junk IPs", () => {
    const a: any = { headers: { "x-forwarded-for": "9.9.9.9", "x-ybex-proxy-key": "nope", "x-ybex-client-ip": "1.2.3.4" } };
    applyDomainProxyIp(a, SECRET);
    expect(a.headers["x-forwarded-for"]).toBe("9.9.9.9");
    const b: any = { headers: { "x-ybex-proxy-key": SECRET, "x-ybex-client-ip": "1.2.3.4, 5.6.7.8" } };
    applyDomainProxyIp(b, SECRET);
    expect(b.headers["x-forwarded-for"]).toBeUndefined();
    const c: any = { headers: { "x-ybex-proxy-key": SECRET, "x-ybex-client-ip": "1.2.3.4" } };
    applyDomainProxyIp(c, "short");
    expect(c.headers["x-forwarded-for"]).toBeUndefined();
  });
});

describe("v337 iPhone server address", () => {
  it("defaults to ybexapp.ai.studio and can move by live update", () => {
    const n = readFileSync("src/lib/native.js", "utf8");
    expect(n).toContain('DEFAULT_ORIGIN = "https://ybexapp.ai.studio"');
    expect(n).not.toMatch(/VITE_API_ORIGIN \|\| import\.meta\.env\.VITE_PUBLIC_SITE_URL/);
    expect(n).toContain("setUpdateUrl");
    const cfg = JSON.parse(readFileSync("ios-app/capacitor.config.json", "utf8"));
    expect(cfg.plugins.CapacitorUpdater.updateUrl).toBe("https://ybexapp.ai.studio/api/app/ios-update");
    expect(cfg.plugins.CapacitorUpdater.allowModifyUrl).toBe(true);
    expect(cfg.server.allowNavigation).toContain("ybexapp.ai.studio");
  });
});
