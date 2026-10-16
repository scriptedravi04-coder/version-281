import { describe, it, expect } from "vitest";
import crypto from "crypto";
import { readFileSync } from "fs";
import { makeState, readState, verifyAppleIdToken, isIosUserAgent } from "./oauth_routes";
import { onlyAfterJoin } from "./whats_new_routes";

// Session 43 (v286, Ravi's list).
const b64u = (b: Buffer | string) => Buffer.from(b).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

describe("v286 · Google / Apple sign-in", () => {
  it("state is signed, carries the tapped role and expires", () => {
    const st = makeState("brand", 1000, "s");
    expect(readState(st, 2000, "s")?.r).toBe("brand");
    expect(readState(st, 2000, "other")).toBeNull();            // forged
    expect(readState(st, 1000 + 16 * 60 * 1000, "s")).toBeNull(); // too old
    expect(readState(makeState("admin", 1000, "s"), 2000, "s")?.r).toBeNull(); // only creator / brand
    expect(readState("garbage", 2000, "s")).toBeNull();
  });

  it("Apple id_token: right key + issuer + audience passes; anything else fails", async () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk: any = { ...publicKey.export({ format: "jwk" }), kid: "k1", alg: "RS256" };
    const sign = (claims: any, kid = "k1") => {
      const h = b64u(JSON.stringify({ alg: "RS256", kid })), p = b64u(JSON.stringify(claims));
      return `${h}.${p}.${b64u(crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), privateKey))}`;
    };
    const keys = async () => [jwk];
    const good = { iss: "https://appleid.apple.com", aud: "in.ybex.signin", exp: 2e9, email: "a@b.com" };
    expect((await verifyAppleIdToken(sign(good), "in.ybex.signin", keys, 1e12)).email).toBe("a@b.com");
    await expect(verifyAppleIdToken(sign({ ...good, aud: "other" }), "in.ybex.signin", keys, 1e12)).rejects.toThrow();
    await expect(verifyAppleIdToken(sign({ ...good, iss: "https://evil" }), "in.ybex.signin", keys, 1e12)).rejects.toThrow();
    await expect(verifyAppleIdToken(sign({ ...good, exp: 1 }), "in.ybex.signin", keys, 1e12)).rejects.toThrow();
    await expect(verifyAppleIdToken(sign(good, "zz"), "in.ybex.signin", keys, 1e12)).rejects.toThrow();
    const t = sign(good); const tampered = t.split(".").map((x, i) => (i === 1 ? b64u(JSON.stringify({ ...good, email: "x@y.com" })) : x)).join(".");
    await expect(verifyAppleIdToken(tampered, "in.ybex.signin", keys, 1e12)).rejects.toThrow();
  });

  it("iPhone detection; the app shows Apple only on iPhone, Google everywhere", () => {
    expect(isIosUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)")).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (Linux; Android 14)")).toBe(false);
    const src = readFileSync("src/pages/app/AppContinue.jsx", "utf8");
    expect(src).toContain('data-testid="app-oauth-google"');
    expect(src).toContain("{showApple && (");
    expect(readFileSync("src/App.jsx", "utf8")).toContain('path="/app/oauth"');
  });

  it("new OAuth accounts are saved in the database and get a real session", () => {
    const src = readFileSync("backend/oauth_routes.ts", "utf8");
    expect(src).toContain('c.from("users").insert(user)');
    expect(src).toContain('c.from("user_sessions").insert(session)');
    expect(src).toContain("/app/oauth#");
  });
});

describe("v286 · Ravi's list", () => {
  it("What's New skips updates older than the account", () => {
    const items = [{ id: "a", published_at: "2026-10-01T00:00:00Z" }, { id: "b", published_at: "2026-10-20T00:00:00Z" }];
    expect(onlyAfterJoin(items, { created_at: "2026-10-10T00:00:00Z" }).map((i) => i.id)).toEqual(["b"]);
  });

  it("Meet the Creators uses the Explore rule, no direct creator_profiles read", () => {
    const src = readFileSync("src/pages/brand/BrandHomeMobile.jsx", "utf8");
    expect(src).toContain("visibleCreators(results[8].value.data)");
    expect(src).not.toContain("supabase.from('creator_profiles').select('*').limit(15)");
  });

  it("brand signup asks the person's name; KYC pending is red; trust line has no grey half", () => {
    expect(readFileSync("src/pages/app/AppContinue.jsx", "utf8")).not.toContain("Company or brand name");
    const brand = readFileSync("src/pages/brand/BrandHomeMobile.jsx", "utf8");
    expect(brand).toContain('label: "KYC PENDING", bg: "#FEE2E2", color: "#DC2626"');
    expect(brand).not.toContain("BRAND_TRUST_ITEMS[trustIdx]?.text");
  });

  it("profile footer is on <body>; cropper has pinch + visible zoom bar", () => {
    expect(readFileSync("src/components/profile/mobile/CreatorProfileBrandMobile.jsx", "utf8")).toContain("createPortal(");
    const crop = readFileSync("src/components/common/LogoCropper.jsx", "utf8");
    expect(crop).toContain("e.touches.length === 2");
    expect(crop).toContain('data-testid="logo-cropper-zoom-in"');
  });

  it("splash: fonts don't block first paint, strip stays purple under the splash", () => {
    const html = readFileSync("index.html", "utf8");
    expect(html).toContain(`media="print" onload="this.media='all'"`);
    expect(html).toContain('el.className = reduce ? "st" : "";'); // v297: plain purple first frame (no word), the intro starts at once
    expect(readFileSync("src/components/layout/StatusBarSync.jsx", "utf8")).toContain('getElementById("yb-splash")');
  });
});
