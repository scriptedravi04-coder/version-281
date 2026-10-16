// Session 48 (Ravi + testing team, v298).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { toColumns, gridHeight, MAX } from "./components/dashboard/MeetCreatorsGrid";
import { dueByFrequency } from "./components/promo/PromoPopup";

const read = (p) => readFileSync(p, "utf8");

describe("v298 · Meet the creators grid (brand + creator home)", () => {
  // Session 58 (Ravi, requirement change: "isko vesa hi kro"): back to filling column by column.
  it("fills column by column — 3 creators go down the first column", () => {
    const cols = toColumns([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(cols.map((c) => c.length)).toEqual([3, 0, 0]);
    expect(toColumns([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((id) => ({ id }))).map((c) => c.length)).toEqual([3, 3, 3]);
    expect(MAX).toBe(9);
  });
  it("box height follows the tallest column, so the call-to-action sits under the cards", () => {
    expect(gridHeight(1)).toBeLessThan(gridHeight(3));
    expect(gridHeight(3)).toBe(30 + 3 * 164 + 120);
    expect(gridHeight(9)).toBe(gridHeight(3));
  });
  it("both homes use it; the creator one cheers the creator on", () => {
    expect(read("src/pages/brand/BrandHomeMobile.jsx")).toContain("<MeetCreatorsGrid");
    const c = read("src/pages/creator/CreatorHomeMobile.jsx");
    expect(c).toContain("<MeetCreatorsGrid");
    expect(c).toContain("You could be our next top creator");
    expect(c).toContain("Meet our top creators");
  });
});

describe("v298 · profile screens", () => {
  it("Account opens on brand and creator (it was missing from the allowed screens)", () => {
    expect(read("src/components/profile/mobile/BrandProfileMobile.jsx")).toMatch(/"refer", "help", "account",\n\];/);
    expect(read("src/pages/creator/CreatorSettings.jsx")).toContain('"refer", "help", "account"];');
  });
  it("Refer & earn shows once on the brand profile (no purple card under Log out)", () => {
    expect(read("src/components/profile/mobile/BrandProfileMobile.jsx")).not.toContain("Credited when their first campaign completes.");
  });
  it("profile banner is prefetched and drawn from memory on the first frame", () => {
    const s = read("src/components/promo/ProfileBanner.jsx");
    expect(s).toContain("export function prefetchProfileBanner");
    expect(s).toContain("useState(() => cachedProfileBanner())");
    expect(read("src/components/promo/PromoPopup.jsx")).toContain("prefetchProfileBanner()");
  });
  it("every screen change starts at the top before the first paint", () => {
    expect(read("src/components/layout/Layout.jsx")).toContain("useLayoutEffect(() => {\n    const cancel = scrollAppToTopSettled();");
    expect(read("src/components/account/AccountPanel.jsx")).toContain("scrollAppToTop(); }, [edit, del]);");
  });
  it("brand KYC page falls back to the brand's own details instead of 'Not provided'", () => {
    expect(read("src/components/profile/mobile/brand/KycScreen.jsx")).toContain("firstFilled(docs.company_name, profile?.company_name)");
    expect(read("backend/misc_routes.ts")).toContain("documents: fillBrandKycDocs({");
  });
});

describe("v298 · login, promos, bot, deliverables", () => {
  it("an account with a password opens on the password box; OTP is the small link", () => {
    const s = read("src/pages/app/AppContinue.jsx");
    expect(s).toContain('setStage(data.has_password ? "password" : "account");');
    expect(s).toContain("Log in with OTP instead");
  });
  it("promo popup asks again when the app comes back; frequency rules unchanged", () => {
    const s = read("src/components/promo/PromoPopup.jsx");
    expect(s).toContain('document.addEventListener("visibilitychange", onVis)');
    expect(s).toContain("store.set(OPEN_KEY, seenKey(pr), sessionStorage)");
    expect(dueByFrequency("once", null)).toBe(true);
    expect(read("backend/promo_routes.ts")).toContain("Date.now() - cache.at < 10000");
    expect(read("src/components/admin/AdminPromoPopups.jsx")).toContain('data-testid="promo-help"');
  });
  it("bot bubble is lime with green text (no white-on-green)", () => {
    const s = read("src/components/feedback/FeedbackBot.jsx");
    expect(s).toContain('bubInk: "#14532D"');
    expect(s).toContain("color: TH.bubInk");
  });
  it("Deliverables starts empty (example only in the grey hint)", () => {
    expect(read("src/components/campaigns/mobile/MobileCampaignCreate.jsx")).toContain('getInitial("deliverablesText", "")');
  });
});
