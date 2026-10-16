import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { shouldOpenOutside, chromeIntentUrl } from "../src/lib/externalLinks";

const read = (p: string) => readFileSync(p, "utf8");
const a = (attrs: Record<string, string>) => ({
  getAttribute: (k: string) => (k in attrs ? attrs[k] : null),
  hasAttribute: (k: string) => k in attrs,
});
const O = "https://ybexapp.ai.studio";

// v333 (requirement change — Ravi: "now start working on this" with the Claude Design landing handoff): the v305
// landing was replaced by the designed page. Its text is the design's own (CLAUDE_CODE_GUIDE: "keep the text exactly").
describe("v333 · landing page (Claude Design handoff)", () => {
  it("mobile below 768px, desktop from 768px, each its own chunk; no design-tool preview chrome", () => {
    const s = read("src/pages/dashboard/Landing.jsx");
    expect(s).toContain('data-testid="landing-v2"');
    expect(s).toContain("window.innerWidth < 768");
    expect(s).toContain('import("../../components/landing/v2/LandingMobileView")');
    const d = read("src/components/landing/v2/LandingDesktopView.jsx");
    expect(d).not.toContain(">Preview</span>"); // the design tool's Desktop / Mobile 390 switch
    expect(d).not.toContain("#FF5F57"); // the fake browser-window dots
  });
  it("Safari fallback + reduced motion; photos are local files, not bundled base64", () => {
    for (const f of ["src/components/landing/v2/landingMobile.css", "src/components/landing/v2/landingDesktop.css"]) {
      const c = read(f);
      expect(c).toContain("@supports not (animation-timeline: view())");
      expect(c).toContain("prefers-reduced-motion");
    }
    expect(read("src/components/landing/v2/LandingMobileView.jsx")).not.toContain("data:image/png;base64");
  });
});

describe("v305 · Install the app never freezes", () => {
  it("one shared install event, an 8s limit, and the guide when the popup can't show", () => {
    const h = read("src/hooks/usePWAInstall.js");
    expect(h).toContain("const ev = current();");
    expect(h).toContain("dropPrompt();");
    expect(h).toContain("const TIMEOUT_MS = 8000;");
    expect(h).toContain("return 'failed';");
    const b = read("src/components/install/InstallAppButton.jsx");
    expect(b).toContain('if (result === "failed") setGuideOpen(true);');
  });
});

describe("v305 · policy links leave the installed app", () => {
  it("only same-site policy/help links that ask for a new tab", () => {
    expect(shouldOpenOutside(a({ href: "/info/terms", target: "_blank" }), O)).toBe(true);
    expect(shouldOpenOutside(a({ href: "/privacy-policy", target: "_blank" }), O)).toBe(true);
    expect(shouldOpenOutside(a({ href: "/info/terms" }), O)).toBe(false);
    expect(shouldOpenOutside(a({ href: "/dashboard", target: "_blank" }), O)).toBe(false);
    expect(shouldOpenOutside(a({ href: "/privacy-policyx", target: "_blank" }), O)).toBe(false);
    expect(shouldOpenOutside(a({ href: "https://instagram.com/x", target: "_blank" }), O)).toBe(false);
    expect(shouldOpenOutside(a({ href: "mailto:support@ybexmedia.in", target: "_blank" }), O)).toBe(false);
  });
  it("Android opens Chrome with a fallback to the normal browser", () => {
    const u = chromeIntentUrl(`${O}/info/terms`);
    expect(u.startsWith("intent://ybexapp.ai.studio/info/terms#Intent;scheme=https;package=com.android.chrome;")).toBe(true);
    expect(u).toContain(`S.browser_fallback_url=${encodeURIComponent(`${O}/info/terms`)}`);
    expect(read("src/index.jsx")).toContain("installExternalLinks();");
  });
});

describe("v333 · landing reads admin content, payment logos are local", () => {
  it("brand wall + reviews come from Admin → Landing content; no outside logo links", () => {
    const c = read("src/components/landing/v2/landingContent.js");
    expect(c).toContain('api.get("/landing-brands")');
    expect(c).toContain('api.get("/landing-reviews")');
    for (const f of ["src/components/landing/v2/LandingMobileView.jsx", "src/components/landing/v2/LandingDesktopView.jsx"]) {
      const s = read(f);
      expect(s).toContain("loadLandingContent()");
      expect(s).toContain("hasReviews: REVIEWS.length > 0");
      expect(s).not.toMatch(/wikimedia|ibb\.co|leegality/i);
      expect(s).toContain("/landing/pay/visa.svg");
    }
  });
});
