// v294 (Ravi): Platform Settings split per tab for sub-admins (designer: Banners + Promo popups only).
import { describe, it, expect, vi } from "vitest";
import { requiredAdminPermission, adminPermissionGate } from "./adminPermissions";

const run = async (user: any, perms: string[], method: string, p: string) => {
  const gate = adminPermissionGate({ parseAuthUser: async () => user, checkAdminPerm: async (_u, perm) => perms.includes(perm) });
  const res: any = { code: 0, status(c: number) { this.code = c; return this; }, json() { return this; } };
  const next = vi.fn();
  await gate({ path: p, method }, res, next);
  return { passed: next.mock.calls.length === 1, code: res.code };
};
const sub = { role: "admin", team_role: "sub_admin" };

describe("v294 sub-admin Platform Settings tabs", () => {
  it("each settings area maps to its own key; promos + whats-new are mapped now", () => {
    expect(requiredAdminPermission("POST", "/admin/banners")).toBe("settings_banners");
    expect(requiredAdminPermission("POST", "/admin/promos")).toBe("settings_promos");
    expect(requiredAdminPermission("POST", "/admin/whats-new")).toBe("settings_whats_new");
    expect(requiredAdminPermission("PUT", "/admin/fee-config")).toBe("settings_fees");
    expect(requiredAdminPermission("POST", "/admin/maintenance")).toBe("settings_maintenance");
  });
  it("designer with banners + promos only: can upload, cannot touch fees / coupons / maintenance", async () => {
    const perms = ["settings_banners", "settings_promos"];
    expect((await run(sub, perms, "POST", "/admin/banners")).passed).toBe(true);
    expect((await run(sub, perms, "POST", "/admin/promos")).passed).toBe(true);
    expect((await run(sub, perms, "DELETE", "/admin/promos/abc")).passed).toBe(true);
    expect((await run(sub, perms, "PUT", "/admin/fee-config")).code).toBe(403);
    expect((await run(sub, perms, "POST", "/admin/coupons")).code).toBe(403);
    expect((await run(sub, perms, "POST", "/admin/maintenance")).code).toBe(403);
    expect((await run(sub, perms, "POST", "/admin/escrow/x/release-payout")).code).toBe(403);
  });
  it("old keys still work: manage_settings = every tab, manage_banners = banners", async () => {
    expect((await run(sub, ["manage_settings"], "PUT", "/admin/fee-config")).passed).toBe(true);
    expect((await run(sub, ["manage_settings"], "POST", "/admin/promos")).passed).toBe(true);
    expect((await run(sub, ["manage_banners"], "POST", "/admin/banners")).passed).toBe(true);
    expect((await run(sub, ["manage_banners"], "POST", "/admin/promos")).code).toBe(403);
  });
});
