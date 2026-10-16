// v329: in-chat card glitches (brand + creator cards) — pinned so they don't come back.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

const brand = readFileSync("src/components/assist/brand/AssistCards.jsx", "utf8");
const creator = readFileSync("src/components/assist/creator/CreatorCards.jsx", "utf8");

describe("v329 · Eva card UI fixes", () => {
  it("swipe rows stay inside the chat's padding (no sideways drag of the whole chat)", () => {
    expect(brand).toContain('margin: "-20px -22px -24px", marginRight: -18');
    expect(creator).toContain('margin: "-16px -22px -22px", marginRight: -18');
  });
  it("dead photos / logos fall back to the initial, never a broken image", () => {
    expect(brand).not.toContain('e.currentTarget.style.display = "none"');
    expect(creator).not.toContain('e.currentTarget.style.display = "none"');
    expect(brand.match(/onError=\{\(\) => setBad\(true\)\}/g)?.length).toBe(2);
    expect(creator).toContain("<Logo src={logo} text={brand} />");
  });
  it("no ₹NaN / undefined on brand money cards; copy waits for the clipboard", () => {
    expect(brand).toContain("const rs = (n) => inr(num(n));");
    expect(brand).not.toMatch(/inr\(r\.spent\)|inr\(p\.(ugcShare|creatorsShare)\)|inr\(sub1\)/);
    expect(brand).not.toContain("navigator.clipboard.writeText(d.text); toast.success");
  });
  it("buttons can't double-submit and show what happened", () => {
    expect(brand).toContain('{alertSt === "on" ? "✓ Alert on"');
    expect(brand).toContain("setSel(new Set()); /* v329");
    expect(brand).toContain('{saved ? "✓ Saved" : "Save as draft"}');
    expect(creator).toContain("const sent = useSentApps();");
  });
  it("question box: 16px input, n/15 counter for the brief, IST close date", () => {
    expect(brand).toContain("font: \"600 16px 'DM Sans',sans-serif\"");
    expect(brand).toContain('data-testid="assist-question-count"');
    expect(brand).toContain('timeZone: "Asia/Kolkata"');
  });
  it("earnings: zero state with a next step; 'paid jobs' counts only paid ones", () => {
    expect(creator).toContain("No earnings yet");
    expect(creator).toContain("const paid = s.paidCount ?? s.deals;");
  });
  it("Save as draft stays left, Review & Publish right; Decline left, Accept right", () => {
    expect(brand.indexOf('data-testid="assist-campaign-save"')).toBeLessThan(brand.indexOf('data-testid="assist-campaign-open"'));
    expect(creator.indexOf('data-testid="eva-invite-decline"')).toBeLessThan(creator.indexOf('data-testid="eva-invite-accept"'));
  });
});
