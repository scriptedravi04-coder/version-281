import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { adminTargetBlock, countFullAdmins, isAdminAccount, isFullAdmin } from "./adminTargetGuard";
import { wipePlan } from "./accountWipe";

// Session 43 (v288, Ravi): delete / complete wipe for admin + sub-admin accounts (rule 56, updated).
const full = { user_id: "a1", role: "admin" };
const full2 = { user_id: "a2", role: "admin" };
const sub = { user_id: "s1", role: "admin", team_role: "sub_admin" };
const creator = { user_id: "c1", role: "creator" };

describe("admin accounts can be removed — safely", () => {
  it("who is an admin / a full admin", () => {
    expect(isAdminAccount(sub)).toBe(true);
    expect(isFullAdmin(sub)).toBe(false);
    expect(isFullAdmin(full)).toBe(true);
    expect(isAdminAccount(creator)).toBe(false);
  });

  it("a full admin can remove a sub-admin or another full admin", () => {
    expect(adminTargetBlock(full, sub, 2)).toBeNull();
    expect(adminTargetBlock(full, full2, 2)).toBeNull();
  });

  it("never yourself, never by a sub-admin, never the last full admin", () => {
    expect(adminTargetBlock(full, full, 3)?.code).toBe("SELF");
    expect(adminTargetBlock(sub, full, 3)?.code).toBe("ONLY_FULL_ADMIN");
    expect(adminTargetBlock(sub, { user_id: "s2", role: "sub_admin" }, 3)?.code).toBe("ONLY_FULL_ADMIN");
    expect(adminTargetBlock(full, full2, 1)?.code).toBe("LAST_ADMIN");
  });

  it("normal users are not affected", () => {
    expect(adminTargetBlock(sub, creator, 1)).toBeNull();
  });

  it("counts only active full admins", async () => {
    const db = { users: [full, full2, sub, { user_id: "a3", role: "admin", banned: true }, { user_id: "a4", role: "admin", is_deleted: true }] };
    expect(await countFullAdmins(null, db)).toBe(2);
  });

  it("wipe removes the admin's permissions; routes use the guard", () => {
    expect(wipePlan({ userIds: ["a2"], threadIds: [], dealIds: [], campaignIds: [], orderIds: [], email: "" }).some((s) => s.table === "admin_permissions")).toBe(true);
    expect(readFileSync("backend/admin_wipe_routes.ts", "utf8")).toContain("adminTargetBlock(admin, targetUser");
    expect(readFileSync("backend/admin_wipe_routes.ts", "utf8")).not.toContain("TARGET_IS_ADMIN");
    expect(readFileSync("backend/admin_campaigns_settings_routes.ts", "utf8")).toContain("adminTargetBlock(user, target");
    expect(readFileSync("src/components/admin/UserEnforcementPanel.jsx", "utf8")).toContain("const profile = fullData?.profile || {};");
  });
});
