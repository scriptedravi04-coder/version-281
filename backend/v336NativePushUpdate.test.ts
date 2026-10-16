import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { readFileSync } from "fs";
import { apnsJwt, apnsBody, apnsConfig, isApnsToken } from "./apns";
import { decideUpdate, cmpVersion } from "./appUpdate";
import { zipFiles } from "../scripts/ota-bundle.mjs";

// Session 58 v336 (Ravi): Apple push for the iPhone App Store app + live update of its web build.
describe("v336 — Apple push (APNs)", () => {
  it("signs Apple's provider token with the .p8 key (ES256)", () => {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
    const t = apnsJwt({ key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), keyId: "K1", teamId: "T1" }, 1000);
    const [h, b, s] = t.split(".");
    expect(JSON.parse(Buffer.from(h, "base64").toString()).kid).toBe("K1");
    expect(crypto.verify("sha256", Buffer.from(`${h}.${b}`), { key: publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64"))).toBe(true);
  });
  it("is off without keys; payload keeps the screen link", () => {
    expect(apnsConfig({} as any)).toBeNull();
    expect(apnsConfig({ APNS_KEY: "x", APNS_KEY_ID: "k", APNS_TEAM_ID: "t", APNS_PRODUCTION: "false" } as any)?.host).toContain("sandbox");
    expect(apnsBody({ title: "Paid", body: "₹11,700", url: "/earnings" })).toMatchObject({ aps: { alert: { title: "Paid" } }, url: "/earnings" });
    expect(isApnsToken("ab".repeat(32))).toBe(true);
    expect(isApnsToken("https://fcm.googleapis.com/x")).toBe(false);
  });
  it("push_routes sends apns: rows through Apple and web rows through web push; app registers its token", () => {
    const s = readFileSync("backend/push_routes.ts", "utf8");
    expect(s).toContain("startsWith(APNS_PREFIX)");
    expect(s).toContain('router.post("/push/native-register"');
    expect(readFileSync("src/lib/nativePush.js", "utf8")).toContain('api.post("push/native-register"');
    expect(readFileSync("src/lib/push.js", "utf8")).toContain("releaseNativePushOnLogout()");
  });
});

describe("v336 — iPhone app live update", () => {
  const latest = { version: "1.0.0-wabc", file: "bundle-1.0.0-wabc.zip" };
  it("offers a newer web build, nothing when already on it, respects pause / minimum app version", () => {
    expect(decideUpdate({ version_name: "builtin" }, latest, "https://ybexmedia.in", {} as any)).toEqual({ version: "1.0.0-wabc", url: "https://ybexmedia.in/ota/bundle-1.0.0-wabc.zip" });
    expect(decideUpdate({ version_name: "1.0.0-wabc" }, latest, "o", {} as any)).toHaveProperty("message");
    expect(decideUpdate({ version_name: "x" }, latest, "o", { IOS_OTA_OFF: "true" } as any)).toHaveProperty("message");
    expect(decideUpdate({ version_name: "x", version_build: "1.0.1" }, latest, "o", { IOS_OTA_MIN_BUILD: "1.0.3" } as any)).toHaveProperty("message");
    expect(decideUpdate({ version_name: "x" }, null, "o", {} as any)).toHaveProperty("message");
    expect(cmpVersion("1.0.10", "1.0.9")).toBe(1);
  });
  it("packs a valid zip and runs after every build without failing the deploy", () => {
    const z: Buffer = zipFiles([{ name: "index.html", data: Buffer.from("<html></html>") }]);
    expect(z.readUInt32LE(0)).toBe(0x04034b50);
    expect(z.readUInt32LE(z.length - 22)).toBe(0x06054b50);
    expect(JSON.parse(readFileSync("package.json", "utf8")).scripts.build).toContain("node scripts/ota-bundle.mjs");
    const cfg = JSON.parse(readFileSync("ios-app/capacitor.config.json", "utf8"));
    expect(cfg.plugins.CapacitorUpdater.updateUrl).toContain("/api/app/ios-update");
    expect(readFileSync("src/lib/native.js", "utf8")).toContain("notifyAppReady");
  });
});
