import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { deviceInfo, CHIPS, FIRST_REPLY, NEXT_REPLY } from "./components/feedback/FeedbackBot";
import { ybHaptic, HAPTIC_PATTERNS } from "./lib/haptics";

describe("v287 · Ybex Assist (design Turn 27)", () => {
  it("scripted replies are the design's", () => {
    expect(CHIPS.bug[1]).toBe("Oh no — what happened, and on which screen?");
    expect(CHIPS.feature[1]).toBe("Love that. What should Ybex do for you?");
    expect(FIRST_REPLY).toContain("just went to the Ybex team");
    expect(NEXT_REPLY).toBe("Added to your report. Anything else on your mind?");
  });
  it("design timings / easings are kept", () => {
    const s = readFileSync("src/components/feedback/FeedbackBot.jsx", "utf8");
    expect(s).toContain("transform .75s cubic-bezier(.34,1.56,.64,1)");
    expect(s).toContain("transform .42s cubic-bezier(.34,1.56,.64,1)");
    expect(s).toContain("clip-path .62s cubic-bezier(.65,0,.35,1)");
    expect(s).toContain('"translateX(30px) rotate(-14deg)"');
    expect(s).toContain('"scale(1.14,0.9)"');
    expect(s).toContain("const SPOTS = [118, 300, 480];");
    expect(s).toContain("const MAX_MOVES = 4;");
  });
  it("device info from the user agent", () => {
    expect(deviceInfo({ userAgent: "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit" })).toEqual({ os: "Android 14", device_model: "SM-S918B" });
    expect(deviceInfo({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X)" })).toEqual({ os: "iOS 18.1", device_model: "iPhone" });
  });
  it("haptic: the Ybex heartbeat — native impacts when the app has them, else the vibration rhythm", () => {
    const vibrate = vi.fn(() => true);
    expect(ybHaptic("open", { navigator: { vibrate }, matchMedia: () => ({ matches: false }) })).toBe(true);
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_PATTERNS.open.web);
    const impact = vi.fn();
    vi.useFakeTimers();
    ybHaptic("open", { Capacitor: { Plugins: { Haptics: { impact } } }, navigator: {}, matchMedia: () => ({ matches: false }) });
    vi.runAllTimers();
    expect(impact.mock.calls.map((c) => c[0].style)).toEqual(["LIGHT", "MEDIUM"]);
    vi.useRealTimers();
    expect(ybHaptic("open", { navigator: { vibrate }, matchMedia: () => ({ matches: true }) })).toBe(false); // reduce motion
  });
  it("mounted on both dashboards; admin has a Feedback tab", () => {
    expect(readFileSync("src/pages/brand/BrandHomeMobile.jsx", "utf8")).toContain('<FeedbackBot role="brand"');
    expect(readFileSync("src/pages/creator/CreatorHomeMobile.jsx", "utf8")).toContain('<FeedbackBot role="creator"');
    expect(readFileSync("src/pages/admin/Admin.jsx", "utf8")).toContain("case 'feedback':");
  });
});
