import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { autoHomePicks, isShowableCreator } from "./creatorHomePicks";

// v291 (Ravi): approval mails, website Google sign-in = app sign-in, password in Settings, top creators.
describe("v291 backend", () => {
  it("KYC / profile mails get their own subject, not 'Content Approved by Brand'", () => {
    const s = readFileSync("backend/notificationService.ts", "utf8");
    const kyc = s.indexOf("normalizedType.includes('KYC')");
    const prof = s.indexOf("normalizedType.includes('PROFILE')");
    const content = s.indexOf("Content Approved");
    expect(kyc).toBeGreaterThan(-1);
    expect(prof).toBeGreaterThan(-1);
    expect(kyc).toBeLessThan(content);
    expect(prof).toBeLessThan(content);
    expect(s).toContain("Your Ybex KYC is approved");
    expect(s).toContain("Your Ybex profile is approved");
  });

  it("website Google pop-up uses the same Supabase lookup as the app", () => {
    const a = readFileSync("backend/auth_routes.ts", "utf8");
    const o = readFileSync("backend/oauth_routes.ts", "utf8");
    expect(a).toContain("oauthSignInCore(");
    expect(o).toContain("export async function oauthSignInCore");
    expect(o).toContain('error: "admin"');
    expect(o).toContain("login_hint");
  });

  it("password can be set from Settings with an emailed code", () => {
    const s = readFileSync("backend/account_routes.ts", "utf8");
    expect(s).toContain("/account/password/send-otp");
    expect(s).toContain("/account/password/set");
    expect(s).toContain("password_hash: hash");
  });

  it("top creators fall back to approved creators when admin ticked nobody", () => {
    const rows = [
      { user_id: "a", name: "Asha K", profile_status: "approved", picture: "x", followers_instagram: 500 },
      { user_id: "b", name: "Test User", profile_status: "approved", picture: "x", followers_instagram: 9999 },
      { user_id: "c", name: "Ravi M", profile_status: "pending", picture: "x", followers_instagram: 9999 },
      { user_id: "d", name: "Dev S", profile_status: "approved", picture: "", followers_instagram: 9000 },
      { user_id: "me", name: "Viewer V", profile_status: "approved", picture: "x", followers_instagram: 1 },
      { user_id: "e", name: "Eena P", profile_status: "approved", picture: "y", followers_instagram: 800 },
    ];
    const out = autoHomePicks(rows, "me").map((p) => p.user_id);
    expect(out).toEqual(["e", "a", "d"]);
    expect(isShowableCreator({ name: "Developer Bypass" })).toBe(false);
  });
});
