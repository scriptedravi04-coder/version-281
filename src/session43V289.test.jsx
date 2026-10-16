import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { dueByFrequency } from "./components/promo/PromoPopup";
import { BUBBLE_TEXT } from "./components/feedback/FeedbackBot";

describe("v289", () => {
  it("promo frequency", () => {
    const now = 10 * 24 * 3600 * 1000;
    expect(dueByFrequency("once", null, now)).toBe(true);
    expect(dueByFrequency("once", now - 1, now)).toBe(false);
    expect(dueByFrequency("daily", now - 25 * 3600 * 1000, now)).toBe(true);
    expect(dueByFrequency("daily", now - 3600 * 1000, now)).toBe(false);
    expect(dueByFrequency("every_open", now - 1, now)).toBe(true);
  });
  it("whole poster is the button, ✕ closes, no other button; one popup per open", () => {
    const s = readFileSync("src/components/promo/PromoPopup.jsx", "utf8");
    expect(s).toContain('onClick={tap} data-testid="promo-poster"');
    expect(s).toContain('data-testid="promo-close"');
    expect(s).toContain("window.__ybWhatsNewShown");
    expect(readFileSync("src/components/whatsNew/WhatsNewPopup.jsx", "utf8")).toContain("window.__ybPromoShown");
  });
  it("bot bubble types \"Any issue..?\" after the dots; screenshots use the public link", () => {
    expect(BUBBLE_TEXT).toBe("Any issue..?");
    const s = readFileSync("src/components/feedback/FeedbackBot.jsx", "utf8");
    expect(s).toContain("}, 1650);");
    expect(s).toContain("data?.public_url || data?.url");
  });
});
