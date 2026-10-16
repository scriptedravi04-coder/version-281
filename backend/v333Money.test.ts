import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
// @ts-ignore — plain JS helper
import { pickDealTxn, oneRowPerDeal } from "../src/lib/dealTxn.js";

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

// v333: the Dell mouse deal had a paid row (₹11,700, UTR) and an empty duplicate (f3d6d152…, ₹0).
const paid = { id: "e7d720e7", deal_id: "dbddaa41", gross_amount: 13000, creator_net_amount: 11700, payout_status: "PAID", utr_number: "3245465787908" };
const dupe = { id: "f3d6d152", deal_id: "dbddaa41", gross_amount: 0, amount: 0, creator_net_amount: 0, payout_status: "HELD" };

describe("v333 one payout row per deal", () => {
  it("picks the paid row, whatever the order", () => {
    expect(pickDealTxn([dupe, paid], ["dbddaa41"])?.id).toBe("e7d720e7");
    expect(pickDealTxn([paid, dupe], ["thread-x", "dbddaa41"])?.id).toBe("e7d720e7");
    expect(pickDealTxn([dupe], ["other"])).toBeNull();
  });
  it("creator lists show the deal once", () => {
    const out = oneRowPerDeal([dupe, { id: "loose" }, paid]);
    expect(out.map((t: any) => t.id)).toEqual(["e7d720e7", "loose"]);
  });
  it("receipt and chat use it; creator card shows only the bank amount", () => {
    expect(read("src/components/chat/ChatBox.jsx")).toContain("pickDealTxn(rows, ids)");
    expect(read("src/pages/dashboard/Earnings.jsx")).toContain("oneRowPerDeal(");
    const card = read("src/components/chat/mobile/MobilePayoutCard.jsx");
    expect(card).toContain("useDealPayoutRow(thread");
    expect(card).not.toContain('"Deal amount"');
    expect(read("src/components/payments/InvoiceModal.jsx")).toContain("firstPositive(transaction.gross_amount");
  });
  it("My Deals: payment hold badge only when paid", () => {
    const s = read("src/pages/collabs/Collabs.jsx");
    expect(s).toContain("WAITING FOR BRAND PAYMENT");
    expect(s).toContain("r.escrow_hold || r.escrow_hold_at");
  });
  it("Ravi's answers: 1–2 working days, 30-day recovery", () => {
    expect(read("src/components/payments/CreatorEarningsMobile.jsx")).not.toContain("2–3 working days");
    expect(read("src/pages/auth/AccountStatus.jsx")).not.toContain("180 days");
  });
});

describe("v333 notifications, Eva", () => {
  it("phone push opens the role's own Notifications screen", () => {
    const s = read("src/App.jsx");
    expect(s).toContain("function NotificationsEntry()");
    expect(s).toContain('<Route path="/notifications" element={<ProtectedRoute><NotificationsEntry /></ProtectedRoute>} />');
  });
  it("Eva settings / drawer are solid; keyboard check while typing", () => {
    expect(read("src/components/feedback/EvaPanels.jsx")).not.toContain('background: "rgba(16,74,34,.72)"');
    const bot = read("src/components/feedback/FeedbackBot.jsx");
    expect(bot).not.toContain('background: "rgba(18,84,40,.62)"');
    expect(bot).toContain("fullH - vv.height > 120");
  });
  it("What can you do = popular chips + Show more; scripts use the creator task", () => {
    const brain = read("src/components/assist/creator/brain.js");
    expect(brain).toContain("chips: CREATOR_POPULAR, more: CREATOR_MORE");
    expect(brain).toContain('T.askAi("creator_write"');
    expect(read("backend/assist_routes.ts")).toContain("creator_write:");
    expect(read("src/components/assist/creator/CreatorCards.jsx")).toContain('data-testid="eva-chips-more"');
  });
});
