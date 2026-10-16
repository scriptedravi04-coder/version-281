// Session 46: the growth screens are wired to the server, stay read-only except the reminder,
// and never show the word "escrow" (Ravi, session 34).
import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { requiredAdminPermission } from "./adminPermissions";

const rd = (f: string) => fs.readFileSync(path.join(__dirname, f), "utf8");

describe("session 46: growth command center wiring", () => {
  it("the route file is registered and the area is open to staff for reading", () => {
    expect(rd("server.ts")).toContain("setupAdminGrowthRoutes(router");
    expect(requiredAdminPermission("GET", "/admin/growth")).toBeNull();
  });

  it("sending reminders needs manage_users and rebuilds the list on the server", () => {
    const s = rd("admin_growth_routes.ts");
    const i = s.indexOf('"/admin/growth/nudge"');
    const body = s.slice(i, i + 2500);
    expect(body).toContain('checkAdminPerm(user, "manage_users")');
    expect(body).toContain("nudgeTargets(raw, kind");
    expect(body).not.toContain("req.body?.user_ids");
  });

  it("the report route only reads: no insert / update / delete on any table", () => {
    const s = rd("admin_growth_routes.ts");
    expect(s).not.toMatch(/\.(insert|update|upsert|delete)\(/);
  });

  it("screens and reminder texts never say escrow (the page link key is not shown)", () => {
    const dir = path.join(__dirname, "../src/components/admin/growth");
    // Code names (isEscrowHeld, the ESCROW_HELD status, the page link key) are not shown to anyone.
    const strip = (x: string) => x.toLowerCase().replace(/escrow&view=requests|isescrowheld|escrow_held/g, "");
    for (const f of fs.readdirSync(dir)) expect(strip(fs.readFileSync(path.join(dir, f), "utf8"))).not.toContain("escrow");
    expect(strip(rd("adminGrowth.ts"))).not.toContain("escrow");
  });

  it("the Overview mounts every growth panel", () => {
    const a = fs.readFileSync(path.join(__dirname, "../src/components/admin/AdminAnalytics.jsx"), "utf8");
    for (const c of ["WherePanel", "PeoplePanel", "FunnelPanel", "MoneyPanel", "GrowPanel", "Answers", "Alerts"]) expect(a).toContain(`<${c}`);
  });
});
