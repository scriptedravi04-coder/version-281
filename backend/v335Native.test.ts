import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { makeState, readState } from "./oauth_routes";

// Session 58 v335 (Ravi: iPhone App Store app with the files inside — Capacitor shell in ios-app/).
const read = (p: string) => readFileSync(p, "utf8");

describe("v335 — iPhone app (Capacitor)", () => {
  it("sign-in state remembers it started inside the app; the website state is unchanged", () => {
    expect(readState(makeState("creator", 1000, "s", true), 2000, "s")?.native).toBe(true);
    const web = readState(makeState("creator", 1000, "s"), 2000, "s");
    expect(web?.r).toBe("creator");
    expect(web?.native).toBeUndefined();
  });
  it("the server sends app sign-ins back through com.ybex.app://", () => {
    const s = read("backend/oauth_routes.ts");
    expect(s).toContain("com.ybex.app://oauth#");
    expect(s).toContain('String(req.query.app || "") === "native"');
  });
  it("one helper knows the server address; api, media, socket and sign-in use it", () => {
    expect(read("src/lib/native.js")).toContain("VITE_API_ORIGIN");
    expect(read("src/lib/api.js")).toContain("apiUrl(normalizeApiUrl(config.url))");
    expect(read("src/lib/mediaUrl.js")).toContain("apiUrl(`/api/media?");
    expect(read("src/lib/sharedSocket.js")).toContain("io(serverOrigin()");
    expect(read("src/pages/app/AppContinue.jsx")).toContain("openOAuth(data.url)");
    expect(read("src/index.jsx")).toContain("!isNative()");
  });
  it("the iPhone shell carries the web build and opens on plain purple", () => {
    const cfg = JSON.parse(read("ios-app/capacitor.config.json"));
    expect(cfg.appId).toBe("com.ybex.app");
    expect(cfg.webDir).toBe("../dist/client");
    expect(cfg.plugins.SplashScreen.launchShowDuration).toBe(0);
    expect(read("index.html")).toContain("!!window.Capacitor");
  });
});
