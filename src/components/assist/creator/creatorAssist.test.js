// Session 54: Eva for creators — the rules brain (works with the AI off).
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  detectCreatorIntent, rankOpportunities, categoryMatches, fairRates, rateAdvice, profileScore, earningsSummary,
  dueItems, insightLines, pitchFor, suggestedAmount, explainBrief, draftChecklist, growthIdeas, applyCount,
} from "./creatorLogic";
import { matchWork, buildInsights, workAlertText } from "../../../../backend/assist_store";

const ME = { user_id: "c1", name: "Priya Mehta", category: "Fashion", city: "Jaipur", instagram_handle: "priya", followers_instagram: 24000, avg_views_30d: 15000, rate_reel: 3000, bio: "", portfolio: [] };
const CAMPS = [
  { campaign_id: "k1", title: "Diwali ethnic wear", brand_name: "Rangrez", categories: ["Fashion"], budget_min: 2000, budget_max: 8000, status: "live" },
  { campaign_id: "k2", title: "Protein bar", brand_name: "FitBar", categories: ["Fitness"], budget_max: 4000, status: "live" },
  { campaign_id: "k3", title: "Old one", categories: ["Fashion"], status: "live", deadline: "2020-01-01" },
  { campaign_id: "k4", title: "Draft", categories: ["Fashion"], status: "under_review" },
];
const BRIEFS = [{ id: "b1", title: "Serum glow UGC", product_name: "Glow serum", budget: 2500, status: "OPEN", max_creators: 3, claimed_count: 1 }];

describe("v304 · Eva for creators understands Hinglish", () => {
  it("routes common questions to the right helper", () => {
    const cases = {
      "mere liye campaigns dikhao": "campaigns", "brands dhundo mere niche ke": "campaigns", "ugc kaam hai kya": "campaigns",
      "top 3 pe apply kar do": "apply", "naye campaign aaye to batana": "alertsOn", "alert band karo": "alertsOff",
      "brands kya maang rahe hain": "insights", "mera rate kitna hona chahiye": "rate", "meri profile check karo": "profile",
      "bio likh do": "bio", "portfolio kaise likhu": "portfolio", "hook aur script likh do": "script",
      "brief samjhao": "brief", "submit karne se pehle checklist": "checklist", "kya baaki hai": "due",
      "meri kamai dikhao": "earnings", "payout kab aayega": "kyc", "content ideas do": "growth",
      "dost ko refer karna hai": "refer", "share card banao": "share", "tum kya kar sakti ho": "caps",
    };
    for (const [t, want] of Object.entries(cases)) expect(detectCreatorIntent(t)?.intent, t).toBe(want);
    expect(detectCreatorIntent("hi")).toBe(null);
    expect(applyCount("top 3 pe apply")).toBe(3);
    expect(applyCount("sab pe apply karo")).toBe(5);
  });
});

describe("v304 · matching, money and profile maths", () => {
  it("only live, not-expired campaigns in the creator's niche, best first; open UGC briefs with slots", () => {
    const list = rankOpportunities({ campaigns: CAMPS, briefs: BRIEFS }, ME);
    const ids = list.map((o) => o.id);
    expect(ids).toContain("k1");
    expect(ids).toContain("b1");
    expect(ids).not.toContain("k2");
    expect(ids).not.toContain("k3");
    expect(ids).not.toContain("k4");
    expect(categoryMatches(["Beauty & Fashion"], ["fashion"])).toBe(true);
    expect(categoryMatches(["Fitness"], ["fashion"])).toBe(false);
  });
  it("fair rate follows the onboarding benchmark; advice and suggested amount stay inside the campaign budget", () => {
    const r = fairRates(ME);
    expect(r.reach).toBe(15000);
    expect(r.reel.low).toBeLessThan(4500);
    expect(r.reel.high).toBeGreaterThan(4500);
    expect(rateAdvice(ME).notes.join(" ")).toContain("right range");
    expect(suggestedAmount({ budget: 2000, budget_min: 1000 }, ME)).toBe(2000);
    expect(suggestedAmount({ budget: 8000, budget_min: 5000 }, ME)).toBe(5000);
  });
  it("profile score lists what's missing with the screen that fixes it", () => {
    const ps = profileScore(ME, { kyc: "approved", hasPayout: true });
    expect(ps.score).toBeLessThan(100);
    expect(ps.missing.map((m) => m.key)).toEqual(["photo", "bio", "portfolio"]);
    expect(ps.missing[0].section).toBe("profile");
  });
  it("earnings split into paid / coming; due items flag urgent work", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    const s = earningsSummary([{ creator_net_amount: 4200, payout_status: "COMPLETED", payout_completed_at: "2026-10-10" }, { creator_net_amount: 1800, payout_status: "PENDING" }, { creator_net_amount: 999, status: "REFUNDED" }], now);
    expect(s.month).toBe(4200);
    expect(s.pending).toBe(1800);
    // v328 (requirement change): "N paid jobs" counts only paid / approved rows — a PENDING payout is not a paid job yet.
    expect(s.deals).toBe(1);
    const due = dueItems({ orders: [{ id: "o1", stage: "IN_PROGRESS", sla_deadline: "2026-10-15T15:00:00Z", brief: { title: "Lipstick" } }] }, now.getTime());
    expect(due[0].urgent).toBe(true);
    expect(due[0].text).toContain("Lipstick");
  });
  it("writing helpers work without AI", () => {
    expect(pitchFor({ title: "Diwali ethnic wear" }, ME)).toContain("Diwali ethnic wear");
    expect(pitchFor({ title: "X" }, ME).length).toBeGreaterThan(20);
    const b = explainBrief({ title: "T", deliverable_type: "collaboration_reel", video_duration: "30s", dos: ["Natural light"] });
    expect(b.lines[0]).toContain("reel posted on your Instagram");
    expect(draftChecklist({ deliverable_type: "collaboration_reel" }).join(" ")).toContain("#ad");
    expect(growthIdeas(ME, 0).ideas.length).toBe(3);
    expect(insightLines({}, ME)[0]).toContain("Not enough");
  });
});

describe("v304 · server: new-work alerts + market insight", () => {
  it("alerts match by niche and only live work", () => {
    const ids = matchWork(CAMPS, BRIEFS, { kind: "campaigns", niches: ["fashion"] }, Date.parse("2026-10-15"));
    expect(ids).toContain("c:k1");
    expect(ids).not.toContain("c:k2");
    expect(ids).not.toContain("c:k3");
    expect(ids).toContain("u:b1");
    expect(workAlertText(["c:k1"], CAMPS, BRIEFS).title).toBe("New work for you: 1 campaign");
  });
  it("insight counts niches and typical pay, without brand names", () => {
    const ins = buildInsights(CAMPS, BRIEFS, Date.parse("2026-10-15"));
    expect(ins.top_niches[0].niche).toBe("Fashion");
    expect(JSON.stringify(ins)).not.toContain("Rangrez");
    expect(ins.ugc.count).toBe(1);
  });
});

describe("v304 · what Eva may send for a creator", () => {
  it("only the campaign application (same call as the campaign page), alerts and AI", () => {
    const sends = [];
    for (const f of ["tools.js", "brain.js", "CreatorCards.jsx", "creatorLogic.js"]) {
      const s = readFileSync(`src/components/assist/creator/${f}`, "utf8");
      for (const m of s.matchAll(/api\.(post|put|patch|delete)\(\s*[`"']([^`"'$]+)/g)) sends.push(m[2].replace(/\/$/, ""));
      expect(s, f).not.toContain("razorpay");
      expect(s, f).not.toContain("ugc/orders/claim");
    }
    expect([...new Set(sends)].sort()).toEqual(["assist/ai", "assist/saved-searches", "campaigns/apply"]);
  });
});
