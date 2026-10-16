// Session 46: the Admin growth report is built from real rows only. These tests feed it a small,
// hand-made marketplace and check every kind of number the screen shows.
import { describe, it, expect } from "vitest";
import { buildGrowthReport, cityKey, change, dealRank, nudgeTargets, median, GROWTH_RULES } from "./adminGrowth";

const NOW = new Date("2026-10-14T12:00:00.000Z");
const ago = (days: number, hours = 0) => new Date(NOW.getTime() - days * 86400000 - hours * 3600000).toISOString();

function market() {
  const creators = [
    { user_id: "j1", name: "Jaya", city: "jaipur", state: "Rajasthan", niche: "Fashion, Beauty", verified: true, rate_card: { reel: 5000 }, created_at: ago(40) },
    ...["j2", "j3", "j4", "j5", "j6"].map((id, i) => ({ user_id: id, name: "Jaipur " + id, city: "Jaipur ", state: "Rajasthan", niche: "", rate_card: {}, created_at: ago(30 - i) })),
    { user_id: "d1", name: "Dev", city: "Delhi, India", state: "Delhi", niche: "Fashion", rate_card: { reel: 8000 }, created_at: ago(50) },
    { user_id: "d2", name: "Disha", city: "", state: "", niche: "Go to Settings & select category", rate_card: null, created_at: ago(20) },
  ];
  const brands = [
    { user_id: "b1", company_name: "Acme", city: "Delhi", state: "Delhi", is_agency: false },
    { user_id: "b2", company_name: "AdAgency", city: "Delhi", state: "Delhi", is_agency: true },
    { user_id: "b3", company_name: "PinkCity", city: "Jaipur", state: "Rajasthan", is_agency: false },
  ];
  const users = [
    ...creators.map((c) => ({ user_id: c.user_id, role: "creator", created_at: c.created_at, name: c.name })),
    ...brands.map((b) => ({ user_id: b.user_id, role: "brand", created_at: ago(35), name: b.company_name, email: b.company_name.toLowerCase() + "@x.in" })),
  ];
  const campaigns = [
    { campaign_id: "c1", brand_user_id: "b1", status: "live", categories: ["fashion"], budget_max: 10000, created_at: ago(10), title: "C1" },
    { campaign_id: "c2", brand_user_id: "b1", status: "live", categories: ["Fashion", "Beauty"], budget_max: 6000, created_at: ago(9), title: "C2" },
    { campaign_id: "c3", brand_user_id: "b1", status: "live", categories: ["fashion"], budget_max: 4000, created_at: ago(6), title: "C3" },
    { campaign_id: "c4", brand_user_id: "b2", status: "draft", categories: [], budget_max: 0, created_at: ago(5), title: "Draft" },
    { campaign_id: "c5", brand_user_id: "b3", status: "live", categories: ["Food"], budget_max: 3000, created_at: ago(1), title: "C5" },
  ];
  const applications = [
    { application_id: "a1", campaign_id: "c1", creator_id: "d1", created_at: ago(9, 12) },
    { application_id: "a2", campaign_id: "c2", creator_id: "j1", created_at: ago(3) },
  ];
  const deals = [
    { id: "dl1", application_id: "a1", campaign_id: "c1", creator_id: "d1", brand_id: "b1", agreed_amount: 10000, status: "COMPLETED", created_at: ago(9), updated_at: ago(2) },
    { id: "dl2", application_id: "a2", campaign_id: "c2", creator_id: "j1", brand_id: "b1", agreed_amount: 5000, status: "NEGOTIATING", created_at: ago(2) },
    { id: "dl3", campaign_id: "c3", creator_id: "d2", brand_id: "b1", agreed_amount: 3000, status: "CANCELLED", created_at: ago(8) },
  ];
  const transactions = [
    { id: "t1", deal_id: "dl1", creator_id: "d1", gross_amount: 11800, platform_fee_amount: 1800, creator_net_amount: 10000, status: "SUCCESS", payout_status: "PAID", payout_reference: "UTR1", created_at: ago(8), payout_completed_at: ago(6) },
    { id: "t2", deal_id: "dl3", creator_id: "d2", gross_amount: 3000, platform_fee_amount: 300, status: "REFUNDED", created_at: ago(7) },
  ];
  const sessions = [
    { user_id: "d1", created_at: ago(5), last_active: ago(0, 2) },
    { user_id: "b1", created_at: ago(0, 1) },
    { user_id: "j1", created_at: ago(3) },
    { user_id: "j2", created_at: ago(90) },
  ];
  return { users, creators, brands, campaigns, applications, deals, transactions, ugcOrders: [], sessions, referrals: [{ referrer_id: "j1", referred_id: "j2", status: "pending" }], kyc: [{ creator_id: "j1", status: "APPROVED" }, { creator_id: "j2", status: "PENDING" }] };
}

describe("helpers", () => {
  it("cityKey cleans spacing, case, a trailing state, and blanks", () => {
    expect(cityKey("  jaipur ")).toBe("Jaipur");
    expect(cityKey("Delhi, India")).toBe("Delhi");
    expect(cityKey("navi   mumbai")).toBe("Navi Mumbai");
    expect(cityKey("")).toBe("Not set");
    expect(cityKey("India")).toBe("Not set");
    expect(cityKey(null)).toBe("Not set");
  });
  it("change is null without a base, else a one-decimal percent", () => {
    expect(change(5, 0)).toBeNull();
    expect(change(15, 10)).toBe(50);
    expect(change(5, 10)).toBe(-50);
  });
  it("median and dealRank", () => {
    expect(median([])).toBeNull();
    expect(median([1, 9, 3])).toBe(3);
    expect(median([1, 3])).toBe(2);
    expect(dealRank({ status: "NEGOTIATING" }, false)).toBe(3);
    expect(dealRank({ status: "NEGOTIATING" }, true)).toBe(4);
    expect(dealRank({ status: "CANCELLED" }, false)).toBe(3);
    expect(dealRank({ status: "COMPLETED" }, true)).toBe(6);
  });
});

describe("KYC rule", () => {
  it("the profile's own verified flag is not a KYC approval", () => {
    const m: any = market();
    m.kyc = [];
    const r = buildGrowthReport(m, NOW);
    expect(r.people.split.verifiedCreators).toBe(0);
    expect(r.people.incompleteCreators.needKyc).toBe(8);
  });
});

describe("geography", () => {
  const r = buildGrowthReport(market(), NOW);
  it("merges city spellings and ignores accounts with no city", () => {
    const jaipur = r.geography.cities.find((c) => c.city === "Jaipur")!;
    expect(jaipur.creators).toBe(6);
    expect(jaipur.brands).toBe(1);
    expect(r.geography.unsetCity.creators).toBe(1); // d2 has no city
    expect(r.geography.cities.some((c) => c.city === "Not set")).toBe(false);
  });
  it("flags a brand shortage where creators far outnumber brands", () => {
    const jaipur = r.geography.cities.find((c) => c.city === "Jaipur")!;
    expect(jaipur.zone).toBe("brand_shortage");
    expect(jaipur.priority).toBeGreaterThan(0);
    expect(jaipur.action).toContain("Meta / LinkedIn");
  });
  it("flags a creator shortage where campaigns get few applicants", () => {
    const delhi = r.geography.cities.find((c) => c.city === "Delhi")!;
    expect(delhi.campaigns).toBe(3);
    expect(delhi.applications).toBe(2);
    expect(delhi.zone).toBe("creator_shortage");
    expect(delhi.action).toContain("Get brand deals in Delhi");
  });
  it("counts brands and creators that really earned or paid, per city", () => {
    const delhi = r.geography.cities.find((c) => c.city === "Delhi")!;
    expect(delhi.brandsPaying).toBe(1);
    expect(delhi.creatorsEarning).toBe(1); // d1 only; d2's payment was refunded
    expect(r.geography.cities.find((c) => c.city === "Jaipur")!.creatorsEarning).toBe(0);
  });
});

describe("money", () => {
  const r = buildGrowthReport(market(), NOW);
  it("GMV and fees ignore refunded payments", () => {
    expect(r.money.gmv).toBe(11800);
    expect(r.money.netRevenue).toBe(1800);
    expect(r.money.takeRatePct).toBe(15.3);
    expect(r.money.payments).toBe(1);
  });
  it("paid-out money is not held and not a pending payout", () => {
    expect(r.money.held.count).toBe(0);
    expect(r.money.payouts.pendingCount).toBe(0);
    expect(r.money.payouts.paidOutCount).toBe(1);
  });
  it("shows money held and a payout request when a payment is waiting for the admin", () => {
    const m = market();
    m.transactions.push({ id: "t3", deal_id: "dl2", creator_id: "j1", gross_amount: 5900, platform_fee_amount: 900, creator_net_amount: 5000, status: "SUCCESS", payout_status: "PROCESSING", created_at: ago(1) } as any);
    const x = buildGrowthReport(m, NOW);
    expect(x.money.held.amount).toBe(5900);
    expect(x.money.payouts.pendingCount).toBe(1);
    expect(x.money.payouts.pendingAmount).toBe(5000);
    expect(x.money.payouts.oldestPaymentAgeDays).toBe(1);
  });
  it("week-on-week deal value compares real windows", () => {
    // The only payment is 8 days old: outside the last 7 days, inside the 7 days before.
    expect(r.money.week.gmv).toBe(0);
    expect(r.money.week.prevGmv).toBe(11800);
    expect(r.money.month.gmv).toBe(11800);
  });
});

describe("money by city and payout speed", () => {
  const r = buildGrowthReport(market(), NOW);
  it("credits deal value to the brand's city and gives its share", () => {
    expect(r.geography.topMoney[0]).toMatchObject({ city: "Delhi", gmv: 11800, gmvSharePct: 100 });
    expect(r.geography.cities.find((c) => c.city === "Jaipur")!.gmv).toBe(0);
  });
  it("measures days from payment to payout", () => {
    expect(r.money.payouts.velocity).toEqual({ sample: 1, avgDays: 2, medianDays: 2 });
  });
  it("payout speed is empty when no payout has a completion time", () => {
    const m = market();
    delete (m.transactions[0] as any).payout_completed_at;
    expect(buildGrowthReport(m, NOW).money.payouts.velocity.avgDays).toBeNull();
  });
});

describe("people", () => {
  const r = buildGrowthReport(market(), NOW);
  it("splits brands, agencies and verified creators", () => {
    expect(r.people.split.brands).toBe(2);
    expect(r.people.split.agencies).toBe(1);
    expect(r.people.split.creators).toBe(8);
    expect(r.people.split.verifiedCreators).toBe(1); // only j1 has an APPROVED KYC (j2 is pending)
  });
  it("active users come from login sessions", () => {
    const a: any = r.people.activity;
    expect(a.available).toBe(true);
    expect(a.dau.total).toBe(2); // d1 (last_active) and b1
    expect(a.dau.creators).toBe(1);
    expect(a.dau.brands).toBe(1);
    expect(a.wau.total).toBe(3);
    expect(a.mau.total).toBe(3); // j2's session is 90 days old
  });
  it("says activity is unavailable when sessions cannot be read", () => {
    const m: any = market();
    m.sessions = null;
    expect((buildGrowthReport(m, NOW).people.activity as any).available).toBe(false);
  });
  it("top spender and top earner are named from real payments", () => {
    expect(r.people.topBrands[0]).toMatchObject({ name: "Acme", total: 11800, deals: 1 });
    expect(r.people.topCreators[0]).toMatchObject({ name: "Dev", earned: 10000, paidOut: 10000 });
    expect(r.people.topBrands).toHaveLength(1);
  });
  it("lists brands whose deal waits for payment, and abandoned drafts", () => {
    expect(r.people.unpaidTotals.deals).toBe(1);
    expect(r.people.unpaidTotals.amount).toBe(5000);
    expect(r.people.unpaidTotals.drafts).toBe(1);
    expect(r.people.unpaidTotals.brands).toBe(2); // Acme (deal) + AdAgency (draft)
    expect(r.people.unpaidTotals.dealBrands).toBe(1); // only Acme gets the "pay" reminder
    expect(r.people.unpaidTotals.dealBrands).toBe(nudgeTargets(market(), "brand_payment", NOW).length);
    expect(r.people.unpaidBrands[0].name).toBe("Acme");
    expect(r.people.unpaidBrands[0].email).toBe("acme@x.in");
  });
  it("a deal younger than the limit is not 'stuck'", () => {
    const m = market();
    m.deals[1].created_at = ago(0, 3);
    expect(buildGrowthReport(m, NOW).people.unpaidTotals.deals).toBe(0);
  });
  it("finds creators with no KYC or no rate card", () => {
    const inc = r.people.incompleteCreators;
    expect(inc.total).toBe(7); // everyone except j1 (d1 has a rate card but no KYC)
    expect(inc.needRateCard).toBe(6); // j2..j6 and d2
    expect(inc.list[0].daysSinceSignup).toBeGreaterThanOrEqual(inc.list[inc.list.length - 1].daysSinceSignup as number);
  });
});

describe("funnel and velocity", () => {
  const r = buildGrowthReport(market(), NOW);
  it("counts each stage from real deals and payments", () => {
    const by = Object.fromEntries(r.funnel.steps.map((s) => [s.key, s.count]));
    expect(by).toEqual({ campaigns: 4, applications: 2, chat: 3, paid: 1, draft: 1, done: 1 });
  });
  it("drop-off is shown only between deal stages and the worst one is named", () => {
    const steps = r.funnel.steps;
    expect(steps[1].dropPct).toBeNull();
    expect(steps[2].dropPct).toBeNull();
    expect(steps[3].dropPct).toBe(66.7);
    expect(r.funnel.worst?.key).toBe("paid");
    expect(r.funnel.worst?.diagnosis.length).toBeGreaterThan(10);
  });
  it("measures days from campaign to completed deal, and time to accept / pay", () => {
    expect(r.funnel.velocity.avgDays).toBe(8);
    expect(r.funnel.velocity.completedSample).toBe(1);
    expect(r.funnel.velocity.avgHoursToAccept).toBe(18); // dl1 took 12h, dl2 took 24h
    expect(r.funnel.velocity.avgHoursToPay).toBe(24);
    expect(r.funnel.velocity.targetDays).toBe(GROWTH_RULES.targetDealDays);
  });
  it("returns null averages when there is nothing to average", () => {
    const e = buildGrowthReport({}, NOW);
    expect(e.funnel.velocity.avgDays).toBeNull();
    expect(e.funnel.worst).toBeNull();
    expect(e.money.gmv).toBe(0);
  });
  it("lists live campaigns older than the limit that nobody applied to", () => {
    const m = market();
    m.campaigns.push({ campaign_id: "c9", brand_user_id: "b3", status: "live", categories: ["Food"], budget_max: 2000, created_at: ago(5), title: "Lonely" } as any);
    const x = buildGrowthReport(m, NOW);
    expect(x.funnel.emptyCampaigns.map((c) => c.campaign_id)).toContain("c9");
    expect(x.funnel.emptyCampaigns.map((c) => c.campaign_id)).not.toContain("c5"); // only 1 day old
    expect(x.funnel.emptyCampaigns.map((c) => c.campaign_id)).not.toContain("c1"); // has an applicant
  });
});

describe("categories, acquisition, activation", () => {
  const r = buildGrowthReport(market(), NOW);
  it("matches campaign demand with creator supply per category", () => {
    const fashion = r.categories.rows.find((c) => c.category === "Fashion")!;
    expect(fashion.campaigns).toBe(3);
    expect(fashion.creators).toBe(2);
    expect(fashion.gap).toBe("creators_needed");
    expect(r.categories.creatorsWithoutNiche).toBe(6); // j2..j6 + d2 ("Go to Settings…" placeholder is ignored)
  });
  it("splits referral signups from the rest and admits the missing source tracking", () => {
    expect(r.acquisition.channels[0].count).toBe(1);
    expect(r.acquisition.channels[1].count).toBe(r.acquisition.total - 1);
    expect(r.acquisition.trackingGap).toBe(true);
  });
  it("activation steps count real people", () => {
    const cr = Object.fromEntries(r.activation.creators.map((s) => [s.key, s.count]));
    expect(cr.signup).toBe(8);
    expect(cr.profile).toBe(8);
    expect(cr.kyc).toBe(1);
    expect(cr.applied).toBe(2);
    expect(cr.earned).toBe(1);
    const br = Object.fromEntries(r.activation.brands.map((s) => [s.key, s.count]));
    expect(br).toEqual({ signup: 3, profile: 3, campaign: 2, deal: 1, paid: 1 });
  });
  it("finds brands that paid once and went quiet", () => {
    expect(r.activation.brandRetention.payingBrands).toBe(1);
    expect(r.activation.brandRetention.repeatBrands).toBe(0);
    expect(r.activation.brandRetention.winBack).toHaveLength(0); // paid 8 days ago
    const m = market();
    m.transactions[0].created_at = ago(45);
    expect(buildGrowthReport(m, NOW).activation.brandRetention.winBack[0]).toMatchObject({ name: "Acme", lifetime: 11800 });
  });
});

describe("smart alerts", () => {
  const r = buildGrowthReport(market(), NOW);
  const ids = r.insights.map((i) => i.id);
  it("raises alerts that match the numbers", () => {
    expect(ids).toContain("brand-shortage");
    expect(ids).toContain("creator-shortage");
    expect(ids).toContain("stuck-payment");
    expect(ids).toContain("creator-incomplete");
    expect(ids).toContain("tracking-gap");
    expect(ids).toContain("city-missing");
  });
  it("puts actions first and plain info last", () => {
    const levels = r.insights.map((i) => i.level);
    expect(levels.indexOf("action")).toBeLessThan(levels.indexOf("info"));
  });
  it("never uses the word escrow in text meant for users", () => {
    const m = market();
    const t = [...nudgeTargets(m, "creator_profile", NOW), ...nudgeTargets(m, "brand_payment", NOW)];
    for (const x of t) expect(x.message.toLowerCase()).not.toContain("escrow");
  });
  it("an empty marketplace gives no crash and no invented alerts", () => {
    const e = buildGrowthReport({}, NOW);
    expect(e.insights.map((i) => i.id)).toEqual(["tracking-gap"]);
  });
});

describe("reminder targets", () => {
  it("creator reminders name what is missing and skip ready creators", () => {
    const t = nudgeTargets(market(), "creator_profile", NOW);
    const ids = t.map((x) => x.user_id);
    expect(ids).not.toContain("j1");
    expect(ids).toContain("j2");
    expect(t.find((x) => x.user_id === "d1")!.message).toContain("KYC");
    expect(t.find((x) => x.user_id === "d1")!.message).not.toContain("rate card");
    expect(t.find((x) => x.user_id === "j2")!.message).toContain("KYC and rate card");
  });
  it("brand reminders go only to brands with an unpaid deal older than the limit", () => {
    const t = nudgeTargets(market(), "brand_payment", NOW);
    expect(t).toHaveLength(1);
    expect(t[0].user_id).toBe("b1");
    expect(t[0].message).toContain("1 creator waiting");
  });
});
