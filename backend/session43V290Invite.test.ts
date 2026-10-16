import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { INVITE_DEFAULTS, normaliseInvite, inviteWallet, profileComplete, fundedAmount } from "./inviteRewards";
import { normaliseConfig, DEFAULTS } from "./referralProgram";
import { pickPromo } from "./promo_routes";

// Session 43 (v290, Ravi): ₹21 per friend (both sides, on 100% profile, cap ₹1,000), ₹500 per brand
// (first funded deal ≥ ₹5,000, max 10, locked until 2 own deals, 7 days Featured), wallet from ₹11.
const cfg = { ...normaliseInvite({}) };
const base = { friendsComplete: [] as string[], brandQualified: [] as any[], iAmComplete: false, iWasReferred: false, myCompletedDeals: 0 };

describe("v290 · invite wallet", () => {
  it("defaults are Ravi's numbers; wallet pays out from ₹11", () => {
    expect(INVITE_DEFAULTS).toMatchObject({ friend_reward: 21, friend_reward_cap: 1000, brand_invite_reward: 500, brand_invite_max_brands: 10, brand_invite_min_deal: 5000, brand_invite_unlock_deals: 2, brand_invite_featured_days: 7 });
    expect(DEFAULTS.min_withdraw).toBe(11);
    expect(normaliseConfig({}).friend_reward).toBe(21); // config carries the invite numbers
  });

  it("₹21 per completed friend, stops at ₹1,000; my own ₹21 only if I was invited and I am complete", () => {
    const ids = Array.from({ length: 60 }, (_, i) => `f${i}`);
    expect(inviteWallet(cfg, { ...base, friendsComplete: ids.slice(0, 3) }).friend_earned).toBe(63);
    const w = inviteWallet(cfg, { ...base, friendsComplete: ids });
    expect(w.friend_earned).toBe(1000);
    expect(w.friend_cap_reached).toBe(true);
    expect(inviteWallet(cfg, { ...base, iWasReferred: true, iAmComplete: true }).welcome).toBe(21);
    expect(inviteWallet(cfg, { ...base, iWasReferred: true, iAmComplete: false }).welcome).toBe(0);
  });

  it("₹500 per qualified brand, max 10, locked until 2 own deals; ₹21 never locked", () => {
    const brands = Array.from({ length: 12 }, (_, i) => ({ id: `b${i}`, at: `2026-10-${String(i + 1).padStart(2, "0")}` }));
    const locked = inviteWallet(cfg, { ...base, friendsComplete: ["f1"], brandQualified: brands, myCompletedDeals: 1 });
    expect(locked.brand_total).toBe(5000);
    expect(locked.locked).toBe(5000);
    expect(locked.available).toBe(21);
    expect(locked.deals_to_unlock).toBe(1);
    const open = inviteWallet(cfg, { ...base, brandQualified: brands, myCompletedDeals: 2 });
    expect(open.available).toBe(5000);
    expect(open.locked).toBe(0);
  });

  it("7 days Featured after a brand qualifies", () => {
    const now = Date.parse("2026-10-05");
    expect(inviteWallet(cfg, { ...base, brandQualified: [{ id: "b", at: "2026-10-01" }] }, now).featured_until).toBe("2026-10-08T00:00:00.000Z");
  });

  it("100% profile = details + KYC (+ creators: portfolio, rate, social)", () => {
    const creator = { user_id: "c", role: "creator", kyc_verified: true };
    const prof = { photo: "x", bio: "hi", primary_niche: "Food", instagram_handle: "@a", story_rate: 500 };
    expect(profileComplete(creator, prof, 1)).toBe(true);
    expect(profileComplete(creator, prof, 0)).toBe(false);                       // no portfolio
    expect(profileComplete({ ...creator, kyc_verified: false }, prof, 1)).toBe(false); // no KYC
    const brand = { user_id: "b", role: "brand", kyc_status: "approved" };
    expect(profileComplete(brand, { company_name: "MMT", logo: "l", industry: "Travel" }, 0)).toBe(true);
    expect(profileComplete(brand, { company_name: "MMT", logo: "l" }, 0)).toBe(false);
  });

  it("only money that reached the payment hold counts; refunds don't", () => {
    expect(fundedAmount({ amount: 6000, payment_status: "ESCROW_HELD" }, "deal")).toBe(6000);
    expect(fundedAmount({ amount: 6000, status: "PENDING" }, "deal")).toBe(0);
    expect(fundedAmount({ amount: 6000, payment_status: "PAID", status: "REFUNDED" }, "deal")).toBe(0);
    expect(fundedAmount({ total_amount: 8000, payment_status: "PAID" }, "order")).toBe(8000);
  });
});

describe("v290 · withdrawals, banner, terms, SQL", () => {
  it("withdrawal needs a UPI id and stores it; admin list shows name + UPI", () => {
    const s = readFileSync("backend/referralProgram.ts", "utf8");
    expect(s).toContain('code: "NO_UPI"');
    expect(s).toContain("upi_id: w.upi_id || (u ? await payoutUpiOf(deps, u) : \"\")");
  });
  it("profile banner never shows as a popup and vice versa", () => {
    const rows = [{ id: "p", is_active: true, image_url: "https://a", audience: "all", layout: "card" }, { id: "b", is_active: true, image_url: "https://b", audience: "all", layout: "banner" }];
    expect(pickPromo(rows, "creator", Date.now(), "popup")?.id).toBe("p");
    expect(pickPromo(rows, "creator", Date.now(), "banner")?.id).toBe("b");
  });
  it("terms have the invite rules and the version moved to 1.3 on both sides", () => {
    expect(readFileSync("src/lib/legal/legalContent.js", "utf8")).toContain('"10. Referral and invite rewards"');
    expect(readFileSync("backend/consents.ts", "utf8")).toContain('TERMS_VERSION = "1.4"'); // v332 requirement change: Terms bumped (was 1.3)
  });
  it("one SQL file + a ready prompt for the Supabase-connected Claude", () => {
    const sql = readFileSync("scripts/sql/session43_all.sql", "utf8");
    expect(sql).toContain("check (layout in ('fullscreen','card','sheet','banner'))");
    expect(sql).toContain("add column if not exists friend_reward");
    expect(sql).toContain("referral_withdrawals add column if not exists upi_id");
    expect(readFileSync("docs/database/SUPABASE_PROMPT_SESSION43.md", "utf8")).toContain("Do NOT drop, truncate or delete");
  });
});
