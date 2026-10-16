import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const root = path.resolve(__dirname, "../../..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const pngSize = (p) => { const b = fs.readFileSync(path.join(root, p)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };

describe("Session 43 — app icon + launch splash (Claude Design 4a / 4b)", () => {
  it("icons are the final purple 'Ybex.' tile at the right sizes", () => {
    expect(pngSize("public/pwa-192x192.png")).toEqual([192, 192]);
    expect(pngSize("public/pwa-512x512.png")).toEqual([512, 512]);
    expect(pngSize("public/pwa-maskable-512x512.png")).toEqual([512, 512]);
    expect(pngSize("public/apple-touch-icon.png")).toEqual([180, 180]);
    const svg = read("public/icon.svg");
    expect(svg).toContain("#9B00FF");
    expect(svg).toContain("#2E0066");
  });

  it("every iPhone launch image linked in index.html exists with the size its name says", () => {
    const html = read("index.html");
    const links = [...html.matchAll(/rel="apple-touch-startup-image" href="\/(splash\/launch-(\d+)x(\d+)\.png)"/g)];
    expect(links.length).toBeGreaterThanOrEqual(13);
    for (const [, file, w, h] of links) expect(pngSize(`public/${file}`)).toEqual([+w, +h]);
  });

  it("the purple intro only runs in the installed app, once per session, and can never get stuck", () => {
    const html = read("index.html");
    expect(html).toContain('id="yb-splash"');
    expect(html).toContain("(display-mode: standalone)");
    expect(html).toContain("window.navigator.standalone");
    expect(html).toContain('sessionStorage.getItem("yb_splash_seen")');
    expect(html).toContain("prefers-reduced-motion");
    expect(html).toMatch(/setTimeout\(remove, \d+\)/);
    // v297 (Ravi): the launch image is plain purple (no word) and the page plays the Claude Design
    // "Ybex App Flow" intro at once (camera -> flash -> "Ybex." -> shine) — the logo shows only once.
    expect(html).toContain('class="cm"');
    expect(html).toContain('class="bu"');
    expect(html).toContain('el.className = reduce ? "st" : "";');
    expect(html).toContain("var HOLD = 40, INTRO = reduce ? 200 : HOLD + 1210;");
    expect(html).toContain('"go p1"');
  });

  it("v297: no word on the launch image or on the page's first frame (logo shows once)", () => {
    const html = read("index.html");
    expect(html).not.toContain('el.className = "st";');
    const gen = read("scripts/brand/generate_brand_assets.py");
    expect(gen).not.toContain('class="st"');
    expect(gen).toContain("--launch-only");
  });

  it("the tilted 'e' keeps its design, with the upper-right cut fixed, everywhere", () => {
    for (const f of ["index.html", "public/icon.svg", "scripts/brand/generate_brand_assets.py"]) {
      const t = read(f);
      expect(t).toContain("translate(1419 504) rotate(-45) scale(.67)");
      expect(t).toContain("M-155 0H196M155 0A155 155 0 1 0 127 89"); // crossbar runs flush into the bowl
      expect(t).not.toContain("M155 0A155 155 0 1 0 127 89M-155 0L155 0"); // the old stepped version
    }
  });

  it("launch images come from the page's own splash, and the live address is ybexapp.ai.studio", () => {
    expect(read("scripts/brand/generate_brand_assets.py")).toContain("_splash_html()");
    expect(read("twa-manifest.json")).toContain('"host": "ybexapp.ai.studio"');
    expect(read("src/lib/publicUrl.js")).toContain('"https://ybexapp.ai.studio"');
    expect(read("index.html")).toContain("https://ybexapp.ai.studio/og-image.jpg");
    expect(read("index.html")).not.toContain("version80.ai.studio");
  });

  it("the app hands off: mounted in App, shrinks into the home hero banner", () => {
    expect(read("src/App.jsx")).toContain("<AppLaunchSplash />");
    expect(read("src/components/layout/AppLaunchSplash.jsx")).toContain("window.__ybSplash.exit");
    expect(read("src/components/layout/AppLaunchSplash.jsx")).toContain('"[data-splash-up]"');
    expect(read("index.html")).toContain('new Event("ybex:splash-up")');
    expect(read("src/pages/creator/CreatorHomeMobile.jsx")).toContain('data-splash-target="hero"');
    expect(read("src/pages/brand/BrandHomeMobile.jsx")).toContain('data-splash-target="hero"');
    expect(read("src/components/layout/StatusBarSync.jsx")).toContain("ybex:splash-done");
  });

  it("Android launch colour matches the splash", () => {
    expect(JSON.parse(read("public/manifest.json")).background_color).toBe("#7E00DC");
    expect(JSON.parse(read("twa-manifest.json")).backgroundColor).toBe("#7E00DC");
  });
});
