// Session 57 — Ravi's Money screens (Ybex_Money_Mobile_UI): creator Earnings, brand Payments, referral, checkout.
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { readyRows, isPaidToBank } from "./creatorPayoutRequests";
import { campaignPaymentStatus, briefPaymentStatus } from "./brandPayments";

const read = (p: string) => readFileSync(p, "utf8");

describe("v308 · creator: one Request payout for all approved money", () => {
  it("ready = approved (RELEASED / approved deal) and not yet in the bank, never refunded or a brief deposit", () => {
    const rows = [
      { id: "a", status: "SUCCESS", payout_status: "RELEASED", creator_net_amount: 100 },
      { id: "b", status: "SUCCESS", payout_status: "PAID", payout_reference: "UTR1" },
      { id: "c", status: "SUCCESS", payout_status: "PENDING", deal_id: "d1" },
      { id: "d", status: "SUCCESS", payout_status: "PENDING", deal_id: "d2" },
      { id: "e", status: "REFUND_PENDING", payout_status: "RELEASED" },
      { id: "f", status: "SUCCESS", payout_status: "RELEASED", brief_id: "br" },
      { id: "g", status: "INITIATED", payout_status: "RELEASED" },
    ];
    const ids = readyRows(rows, { approvedDealIds: new Set(["d1"]) }).map((r: any) => r.id);
    expect(ids).toEqual(["a", "c"]);
    expect(isPaidToBank({ payout_status: "RELEASED" })).toBe(false);
    expect(isPaidToBank({ utr_number: "X" })).toBe(true);
  });
  it("is wired, and the Earnings page treats RELEASED as Ready (not Paid)", () => {
    expect(read("backend/server.ts")).toContain("setupCreatorPayoutRequestRoutes(router, { supabase, privilegedSupabase, parseAuthUser, sendNotification });");
    const e = read("src/components/payments/CreatorEarningsMobile.jsx");
    expect(e).toContain('const isReady = !isPaid && ps === "RELEASED";');
    expect(e).toContain('api.post("creator/payout-request-ready", {})');
    expect(e).toContain('["disbursed", "Paid", countPaid]');
    expect(read("src/pages/dashboard/Earnings.jsx")).toContain("totalEarned={paidToBank || 0}");
  });
});

describe("v308 · brand Payments", () => {
  it("campaign and UGC brief status", () => {
    expect(campaignPaymentStatus({ status: "SUCCESS", payout_status: "PENDING" })).toBe("escrow");
    expect(campaignPaymentStatus({ status: "SUCCESS", payout_status: "RELEASED" })).toBe("released");
    expect(campaignPaymentStatus({ status: "REFUNDED" })).toBe("refunded");
    const b = { max_creators: 3 };
    expect(briefPaymentStatus(b, [{ status: "COMPLETED" }, { status: "SUBMITTED" }, { status: "IN_PROGRESS" }])).toEqual({ status: "escrow", delivered: 2, completed: 1, live: 3 });
    expect(briefPaymentStatus(b, [{ status: "COMPLETED" }, { status: "COMPLETED" }, { status: "COMPLETED" }, { status: "CANCELLED" }]).status).toBe("released");
  });
  it("screen: renamed to Payments, refunds tab, refund account, statement; escrow tab fixed", () => {
    const s = read("src/components/payments/BrandPaymentsMobile.jsx");
    expect(s).toContain(">Payments</h1>");
    expect(s).toContain('api.get("brand/payments-overview"');
    expect(s).toContain('["refunded", "Refunds", countRefunded]');
    expect(s).toContain("<RefundAccountForm");
    expect(s).not.toContain('setActiveTab("secure payment hold")');
    expect(s).not.toContain("2h ago · awaiting your review");
  });
});

describe("v308 · referral + checkout", () => {
  it("offers with a 0 amount are hidden; one shared page for brand and creator", () => {
    const h = read("src/components/referral/ReferralHub.jsx");
    expect(h).toContain("const bonusOn = Number(d.signups_per_reward || 0) > 0 && Number(d.free_deals_per_reward || 0) > 0;");
    expect(h).toContain('{[["creators", "Invite creators"], ["brands", "Invite brands"]]');
    expect(read("src/components/profile/mobile/brand/ReferScreen.jsx")).toContain('<ReferralHub compact mode="brand" />');
    expect(read("backend/referralProgram.ts")).toContain("type, complete: s.progress?.complete?.has(id) || false");
  });
  it("checkout sheet: review → Razorpay window → success / try again", () => {
    const e = read("src/components/chat/mobile/MobileEscrowSheet.jsx");
    expect(e).toContain('data-testid="escrow-paid"');
    expect(e).toContain('data-testid="escrow-failed"');
    expect(e).toContain("Card details never reach Ybex.");
    // Session 58 (Ravi): the brand picks UPI / card / netbanking on the sheet → passed on to Razorpay (requirement change).
    expect(read("src/components/chat/mobile/ChatBoxMobile.jsx")).toContain("onPay={(method) => payIntoEscrow(method)");
  });
});
