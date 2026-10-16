// v328: brand Eva — parser / intent / builder fixes.
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  numOf, parseCreatorQuery, detectBrandIntent, readCampaignAnswer, parseCloseDate, scoreApplicant, computeAlerts, appCountOf, isMoneyAsk,
  nextCampaignQuestion,
} from "./brandLogic";

describe("v328 · numbers: a unit must be a whole word right after the number", () => {
  it("keeps the usual forms", () => {
    expect(numOf("10k")).toBe(10000);
    expect(numOf("₹15k")).toBe(15000);
    expect(numOf("1.5 lakh")).toBe(150000);
    expect(numOf("2 lac")).toBe(200000);
    expect(numOf("5,000")).toBe(5000);
    expect(numOf("₹5,000")).toBe(5000);
    expect(numOf("2m")).toBe(2000000);
    expect(numOf("2.5k")).toBe(2500);
  });
  it("never reads the next word's first letter as a unit", () => {
    expect(numOf("8000 male")).toBe(8000);
    expect(numOf("10000 max")).toBe(10000);
    expect(numOf("3000 lucknow")).toBe(3000);
    expect(parseCreatorQuery("creators under 8000 male").maxRate).toBe(8000);
    expect(parseCreatorQuery("creators under 8000 male").gender).toBe("male");
    expect(parseCreatorQuery("fashion creators budget 10000 max").maxRate).toBe(10000);
    const f = parseCreatorQuery("creators under 3000 lucknow");
    expect(f.maxRate).toBe(3000);
    expect(f.city).toBe("Lucknow");
  });
  it("old parses still hold", () => {
    expect(parseCreatorQuery("Jaipur ke fashion creators 10k-50k ₹15k tak")).toMatchObject({ followersMin: 10000, followersMax: 50000, maxRate: 15000 });
    expect(parseCreatorQuery("fashion creators 50k+ followers").followersMin).toBe(50000);
    expect(parseCreatorQuery("Jaipur fashion creators 10k–50k, under ₹15k")).toMatchObject({ followersMin: 10000, followersMax: 50000, maxRate: 15000 });
  });
});

describe("v328 · intents", () => {
  it("'create a campaign for my brand' starts the builder; a status question doesn't", () => {
    expect(detectBrandIntent("Create a campaign for my brand")?.intent).toBe("campaignCreate");
    expect(detectBrandIntent("I want to create a campaign for my new product")?.intent).toBe("campaignCreate");
    expect(detectBrandIntent("meri campaign ka status chahiye")?.intent).toBe("status");
    expect(detectBrandIntent("meri campaigns ka kya haal hai")?.intent).toBe("status");
  });
  it("money questions are status + money", () => {
    expect(detectBrandIntent("how much have I paid so far")?.intent).toBe("status");
    expect(isMoneyAsk("how much have I paid so far")).toBe(true);
    expect(isMoneyAsk("payment hold kitna hai")).toBe(true);
    expect(isMoneyAsk("meri campaigns ka kya haal hai")).toBe(false);
  });
});

describe("v328 · applications", () => {
  it("counts the `applicants` array from /campaigns?mine=true", () => {
    expect(appCountOf({ applicants: [{ application_id: "a" }, { application_id: "b" }] })).toBe(2);
    expect(appCountOf({ applications_count: 3 })).toBe(3);
    expect(appCountOf({})).toBe(0);
    const items = computeAlerts({ campaigns: [{ status: "live", id: "c1", title: "Diwali", applicants: [{}, {}] }] });
    expect(items.map((i) => i.text)).toContain('2 applications on "Diwali"');
  });
  it("fits budget uses the applicant's own bid before the card rate", () => {
    const camp = { budget_max: 10000 };
    const creator = { rate_reel: 30000 };
    expect(scoreApplicant(camp, { proposed_amount: 8000 }, creator).why).toContain("fits budget");
    expect(scoreApplicant(camp, { proposed_amount: 15000 }, { rate_reel: 5000 }).why).toContain("over budget");
    // the amount itself is never in the reasons
    expect(scoreApplicant(camp, { proposed_amount: 8000 }, creator).why.join(" ")).not.toMatch(/8,?000/);
  });
});

describe("v328 · campaign builder answers", () => {
  it("payout: lakh / lac / k and ranges", () => {
    expect(readCampaignAnswer("payout", "1.5 lakh").c).toMatchObject({ budget: "150000", isBudgetRange: false });
    expect(readCampaignAnswer("payout", "50000 to 1 lakh").c).toMatchObject({ isBudgetRange: true, budgetMin: "50000", budgetMax: "100000" });
    expect(readCampaignAnswer("payout", "8000-18000").c).toMatchObject({ budgetMin: "8000", budgetMax: "18000" });
    expect(readCampaignAnswer("payout", "₹8k–₹18k").c).toMatchObject({ budgetMin: "8000", budgetMax: "18000" });
    expect(readCampaignAnswer("payout", "10,000").c).toMatchObject({ budget: "10000", isBudgetRange: false });
    expect(readCampaignAnswer("payout", "2 lac").c.budget).toBe("200000");
    expect(readCampaignAnswer("payout", "no idea").error).toBeTruthy();
  });
  it("niche: exact chip, else whole words", () => {
    expect(readCampaignAnswer("selectedCategories", "Lifestyle").c.selectedCategories).toEqual(["Lifestyle"]);
    expect(readCampaignAnswer("selectedCategories", "Fashion").c.selectedCategories).toEqual(["Fashion"]);
    expect(readCampaignAnswer("selectedCategories", "fashion and food").c.selectedCategories).toEqual(["Fashion", "Food"]);
    expect(readCampaignAnswer("selectedCategories", "lifestyle vlogs").c.selectedCategories).toEqual(["Lifestyle"]);
  });
  it("close date: weeks, months, dates, bare days (IST)", () => {
    const now = Date.parse("2026-10-16T20:00:00Z"); // 17 Oct 01:30 IST
    expect(parseCloseDate("10", now)).toBe("2026-10-27");
    expect(parseCloseDate("2 weeks", now)).toBe("2026-10-31");
    expect(parseCloseDate("in 1 month", now)).toBe("2026-11-16");
    expect(parseCloseDate("30 Nov", now)).toBe("2026-11-30");
    expect(parseCloseDate("Nov 30", now)).toBe("2026-11-30");
    expect(parseCloseDate("30/11", now)).toBe("2026-11-30");
    expect(parseCloseDate("5 Jan", now)).toBe("2027-01-05"); // next occurrence
    expect(parseCloseDate("31 Feb", now)).toBe("");
    expect(parseCloseDate("sometime soon", now)).toBe("");
    expect(readCampaignAnswer("deadline", "whenever").error).toBeTruthy();
    expect(readCampaignAnswer("deadline", "2026-12-01").c.deadline).toBe("2026-12-01");
  });
  it("date chips are India dates", () => {
    const realNow = Date.now;
    try {
      Date.now = () => Date.parse("2026-10-16T20:00:00Z"); // already 17 Oct in India
      const q = nextCampaignQuestion({ campaignTitle: "x", requirementsText: "a long enough brief text", selectedCategories: ["Food"], selectedPlatforms: ["Instagram"], selectedFollowerRanges: ["Micro"], budget: "5000", deliverablesText: "1 Reel" });
      expect(q.field).toBe("deadline");
      expect(q.chips[0].value).toBe("2026-10-24");
    } finally { Date.now = realNow; }
  });
});

// ── brain (chat flow) with the server calls mocked ────────────────────────────────────────────────
const SETTINGS = { deals: true, money: true, lang: "en" };
const calls = { search: [], status: 0 };
const POOL = Array.from({ length: 30 }, (_, i) => ({ user_id: String(i + 1), name: `C${i + 1}`, category: "Fashion", city: "Jaipur" }));
vi.mock("../../feedback/evaSettings", () => ({
  readEvaSettings: () => ({ ...SETTINGS }),
  blockedSwitch: (role, intent, s = { ...SETTINGS }) => { const need = { applicants: "deals", alerts: "deals", status: "deals", report: "money" }[intent]; return need && s[need] === false ? need : null; },
  blockedReply: (role, which) => `switch on "${which === "money" ? "Payments & reports" : "Deals & offers"}"`,
}));
vi.mock("./tools", () => ({
  searchCreators: async (f) => { calls.search.push(f); return POOL; },
  askAi: async () => null,
  alertsNow: async () => [],
  statusSummary: async () => { calls.status++; return { campaigns: 1, live: 1, applications: 2, briefs: 0, orders: 0, byStage: {}, held: 5000 }; },
  rankApplicants: async () => ({ campaign: null, rows: [] }),
  newInSavedSearches: async () => [],
  currentDraft: () => null,
}));
vi.mock("./memory", () => ({ clearHistory: async () => true }));

describe("v328 · brain flows", () => {
  let brain;
  beforeEach(async () => { brain = await import("./brain"); Object.assign(SETTINGS, { deals: true, money: true, lang: "en" }); calls.search = []; calls.status = 0; });

  it("show more pages by 12 and skips nobody", async () => {
    const r1 = await brain.handleBrandMessage("Jaipur fashion creators", brain.initialBrandState());
    expect(r1.card.items.map((c) => c.user_id)).toEqual(POOL.slice(0, 12).map((c) => c.user_id));
    const r2 = await brain.handleBrandMessage("show more", r1.state);
    expect(r2.card.items[0].user_id).toBe("13");
    expect(r2.reply).toContain("13–24");
  });
  it("'more creators in Delhi' is a new search, not the next page", async () => {
    const r1 = await brain.handleBrandMessage("Jaipur fashion creators", brain.initialBrandState());
    const r2 = await brain.handleBrandMessage("more creators in Delhi", r1.state);
    expect(calls.search.at(-1).city).toBe("Delhi");
    expect(r2.card.items[0].user_id).toBe("1");
  });
  it("UGC budget '2.5k' is ₹2,500; requirements don't change the video count", async () => {
    let st = { ...brain.initialBrandState(), awaiting: "ugc", ugc: { product_name: "Serum", deliverable_type: "ugc_video_edited", max_creators: 3 } };
    let r = await brain.handleBrandMessage("2.5k", st);
    expect(r.state.ugc.budget).toBe(2500);
    r = await brain.handleBrandMessage("show 2 creators using it in the morning", r.state);
    expect(r.state.ugc.max_creators).toBe(3);
    expect(r.state.ugc.detailed_requirements).toBe("show 2 creators using it in the morning");
  });
  it("a half-done flow lets new chat and a clear switch through", async () => {
    const st = { ...brain.initialBrandState(), awaiting: "campaign", camp: { campaignTitle: "Diwali" } };
    expect((await brain.handleBrandMessage("new chat", st)).newChat).toBe(true);
    const r = await brain.handleBrandMessage("find fashion creators in Delhi", st);
    expect(r.reply.split("\n")[0]).toBe("Okay, leaving the campaign draft for now.");
    expect(r.card.type).toBe("creators");
    expect(r.state.camp).toBeNull();
    const ans = await brain.handleBrandMessage("A 30s reel showing the glow serum in a morning routine", { ...st, camp: { campaignTitle: "Diwali" } });
    expect(ans.state.camp.requirementsText).toContain("30s reel");
  });
  it("question cards are tagged; only the open one is live", async () => {
    const r = await brain.handleBrandMessage("I want to create a campaign", brain.initialBrandState());
    expect(r.card).toMatchObject({ type: "question", flow: "campaign", field: "campaignTitle" });
    expect(brain.isLiveQuestion("campaign", "campaignTitle")).toBe(true);
    await brain.handleBrandMessage("Diwali launch", r.state);
    expect(brain.isLiveQuestion("campaign", "campaignTitle")).toBe(false);
    expect(brain.isLiveQuestion("campaign", "requirementsText")).toBe(true);
    expect(brain.isLiveQuestion("ugc", "requirementsText")).toBe(false);
  });
  it("money status questions follow the Payments & reports switch", async () => {
    SETTINGS.money = false;
    const r = await brain.handleBrandMessage("how much have I paid so far", brain.initialBrandState());
    expect(r.reply).toContain("Payments & reports");
    expect(calls.status).toBe(0);
    const ok = await brain.handleBrandMessage("meri campaigns ka kya haal hai", brain.initialBrandState());
    expect(ok.reply).not.toContain("payment hold");
    expect(calls.status).toBe(1);
  });
  it("English replies stay English; the Hinglish setting switches them", async () => {
    const r = await brain.handleBrandMessage("show me creators", brain.initialBrandState());
    expect(r.reply).toContain("under ₹15k");
    expect(r.reply).not.toMatch(/\btak\b/);
    SETTINGS.lang = "hinglish";
    const h = await brain.handleBrandMessage("show me creators", brain.initialBrandState());
    expect(h.reply).toMatch(/^Kaise creators/);
  });
});
