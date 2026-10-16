// v328: creator Eva — routing, parsing and money fixes.
import { describe, it, expect } from "vitest";
import {
  detectCreatorIntent, applyCount, applyAmount, pickByName, earningsSummary, quoteCheck, suggestedAmount, fairQuote,
  rankOpportunities, dueItems, profileScore, explainBrief, shortNum, reportClearsIntent,
} from "./creatorLogic";
import { classify } from "../../feedback/assistBrain";

const intent = (t) => detectCreatorIntent(t)?.intent ?? null;

describe("v328 · routing", () => {
  it("alerts off in either order, plurals", () => {
    for (const t of ["alert band karo", "notifications off", "stop notifications", "turn off alerts", "disable campaign alerts", "alerts mat bhejo please stop"]) expect(intent(t), t).toBe("alertsOff");
    expect(intent("naye campaign aaye to batana")).toBe("alertsOn");
  });
  it("brand offers → invites", () => {
    for (const t of ["offers from brands", "brand offers dikhao", "kya brand ne bheja kuch"]) expect(intent(t), t).toBe("invites");
  });
  it("money questions → payout check, not campaigns", () => {
    for (const t of ["Paise kab milenge", "paisa kab aayega", "when will I get my money", "when do I get paid", "when will I get paid for the Boat campaign"]) expect(intent(t), t).toBe("kyc");
  });
  it("to do, platform fee, rate my profile, how does it work", () => {
    expect(intent("what's on my to do")).toBe("due");
    expect(intent("to-do list")).toBe("due");
    expect(intent("What is Ybex's platform fee?")).toBe(null);
    expect(intent("how much should I charge")).toBe("rate");
    expect(intent("rate my profile")).toBe("profile");
    expect(intent("how does it work?")).toBe(null);
    expect(intent("any work for me")).toBe("campaigns");
    expect(intent("features")).toBe(null);
    expect(intent("what can you do")).toBe("caps");
  });
  it("feature ideas reach the team; a rate question is still answered", () => {
    for (const t of ["please add a dark mode feature", "suggestion: add a feature to export my invoices"]) expect(reportClearsIntent(classify(t), t), t).toBe(true);
    expect(reportClearsIntent(classify("mera rate kitna hona chahiye"), "mera rate kitna hona chahiye")).toBe(false);
  });
});

describe("v328 · apply parsing", () => {
  it("amounts are stripped before the count and read as the quote", () => {
    expect(applyCount("apply for ₹5,000")).toBe(1);
    expect(applyCount("apply for 5k")).toBe(1);
    expect(applyCount("top 3 pe apply karo 4500 mein")).toBe(3);
    expect(applyAmount("apply for ₹5,000")).toBe(5000);
    expect(applyAmount("apply for 5k")).toBe(5000);
    expect(applyAmount("apply at 1.5 lakh")).toBe(150000);
    expect(applyAmount("apply rs 4500")).toBe(4500);
    expect(applyAmount("top 3 pe apply")).toBe(0);
  });
  it("a named brand or title word picks that campaign", () => {
    const list = [{ id: "a", brand: "Rangrez", title: "Diwali ethnic wear" }, { id: "b", brand: "boAt", title: "Earbuds launch" }];
    expect(pickByName(list, "apply to boat for 5k")?.id).toBe("b");
    expect(pickByName(list, "diwali wale pe apply karo")?.id).toBe("a");
    expect(pickByName(list, "top 3 pe apply karo")).toBe(null);
  });
});

describe("v328 · money", () => {
  const now = new Date("2026-10-31T20:00:00Z"); // 1 Nov 01:30 IST
  it("RELEASED is approved, not paid; deals count paid / approved only; IST month", () => {
    const s = earningsSummary([
      { creator_net_amount: 1000, payout_status: "PAID", payout_completed_at: "2026-10-31T19:00:00Z" }, // 1 Nov IST
      { creator_net_amount: 2000, payout_status: "PENDING", payout_reference: "UTR123", updated_at: "2026-10-10T10:00:00Z" },
      { creator_net_amount: 3000, payout_status: "RELEASED" },
      { creator_net_amount: 4000, payout_status: "PENDING", status: "ESCROW_HELD" },
    ], now);
    expect(s.total).toBe(3000);
    expect(s.month).toBe(1000);
    expect(s.approved).toBe(3000);
    expect(s.approvedCount).toBe(1);
    expect(s.pending).toBe(4000);
    expect(s.deals).toBe(3);
    expect("nextPayout" in s).toBe(false);
  });
  it("Eva's suggested quote passes her own check; +10% is still ✅", () => {
    const p = { followers_instagram: 24000, avg_views_30d: 15000, category: "Fashion" };
    const amt = suggestedAmount({ budget: 0 }, p);
    expect(amt).toBe(fairQuote(15000));
    expect(quoteCheck(15000, amt).level).toBe("good");
    expect(quoteCheck(15000, Math.round(fairQuote(15000) * 1.1)).level).toBe("good");
    expect(quoteCheck(15000, fairQuote(15000) * 1.2).level).toBe("warn");
    expect(suggestedAmount({ budget: 3000 }, p)).toBe(3000);
  });
  it("brief budget label, no 'You get'", () => {
    const b = explainBrief({ budget: 2500 });
    expect(b.lines.join(" ")).toContain("Brief budget: ₹2,500");
    expect(b.lines.join(" ")).not.toContain("You get");
  });
  it("profile score without KYC / payout items when money is off", () => {
    expect(profileScore({}, { money: false }).items.map((i) => i.key)).not.toContain("kyc");
    expect(profileScore({}, {}).items.map((i) => i.key)).toContain("payout");
  });
});

describe("v328 · lists", () => {
  it("paused / closed campaigns are skipped; finished deals aren't to-do", () => {
    const me = { category: "Fashion" };
    const camps = [{ campaign_id: "x", categories: ["Fashion"], status: "live", applications_paused: true }, { campaign_id: "y", categories: ["Fashion"], status: "live", closed_at: "2026-10-01" }, { campaign_id: "z", categories: ["Fashion"], status: "live" }];
    expect(rankOpportunities({ campaigns: camps }, me).map((o) => o.id)).toEqual(["z"]);
    const due = dueItems({ applications: [{ id: 1, thread_id: "t1", status: "ACCEPTED", deal: { status: "COMPLETED" } }, { id: 2, thread_id: "t2", status: "ACCEPTED", deal: { status: "CANCELLED" } }, { id: 3, thread_id: "t3", status: "ACCEPTED" }] });
    expect(due.map((d) => d.key)).toEqual(["a-3"]);
  });
  it("shortNum is Indian style", () => {
    expect(shortNum(15000)).toBe("15K");
    expect(shortNum(150000)).toBe("1.5L");
    expect(shortNum(1500000)).toBe("15L");
    expect(shortNum(12000000)).toBe("1.2Cr");
  });
});
