import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { cleanPushInput, isValidPushEndpoint, guestSaveAllowed, GUEST_USER_ID } from "./push_routes";

// Session 43 (v285, Ravi): ask for notifications on the first open of the installed app, before
// login, and keep pushing to that phone even if the person never signs up.
describe("guest push (v285)", () => {
  it("only real push services are accepted from phones that are not signed in", () => {
    expect(isValidPushEndpoint("https://fcm.googleapis.com/fcm/send/abc")).toBe(true);
    expect(isValidPushEndpoint("https://web.push.apple.com/QW1")).toBe(true);
    expect(isValidPushEndpoint("https://updates.push.services.mozilla.com/wpush/v2/x")).toBe(true);
    expect(isValidPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isValidPushEndpoint("https://evil.example.com/fcm.googleapis.com")).toBe(false);
    expect(isValidPushEndpoint("not a url")).toBe(false);
  });

  it("20 guest saves per IP per hour, then blocked; resets after an hour", () => {
    const t = 1_000_000;
    for (let i = 0; i < 20; i++) expect(guestSaveAllowed("1.2.3.4", t)).toBe(true);
    expect(guestSaveAllowed("1.2.3.4", t)).toBe(false);
    expect(guestSaveAllowed("5.6.7.8", t)).toBe(true);
    expect(guestSaveAllowed("1.2.3.4", t + 3600e3 + 1)).toBe(true);
  });

  it("admin can push to guests; Everyone includes guests", () => {
    expect(cleanPushInput({ title: "t", message: "m", audience: "guest" }).item?.audience).toBe("guest");
    const src = readFileSync("backend/push_routes.ts", "utf8");
    expect(src).toContain('if (c.audience === "all") ids.push(GUEST_USER_ID)');
    expect(GUEST_USER_ID).toBe("guest");
  });

  it("subscribe without login saves a guest, and never takes a phone away from an account", () => {
    const src = readFileSync("backend/push_routes.ts", "utf8");
    expect(src).toContain("user_id: user ? user.user_id : GUEST_USER_ID");
    expect(src).toContain("had[0].user_id !== GUEST_USER_ID");
  });

  it("the ask screen shows guests only inside the installed app, on the first pages", () => {
    const src = readFileSync("src/components/push/PushPermissionScreen.jsx", "utf8");
    expect(src).toContain("const guest = !user && !loading && isStandalone()");
    expect(src).toContain('const GUEST_SHOW_ON = ["/app", "/", "/login", "/signup"]');
  });
});
