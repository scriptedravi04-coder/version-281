// Session 56 (Ravi: "payments mai kuch bhi chota mota error thodi hai — loop hole check karo").
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import crypto from "crypto";
import { resolveTestMode, isLiveKey } from "./paymentTestMode";
import { isPaidOut, isEscrowHeld, payoutReleaseBlock, refundBlock, isRefundInProgress } from "./adminMoney";
import { payoutRequestBlock } from "./payoutMethods";
import { verifyWebhookSignature, webhookOrderInfo } from "./razorpayWebhook";

const read = (p: string) => readFileSync(p, "utf8");
const DEAL = "0b6c2f3e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";

describe("v306 · test mode can never run with a live Razorpay key", () => {
  it("live key → never test mode, whatever else is set", () => {
    expect(isLiveKey("rzp_live_ABC")).toBe(true);
    expect(isLiveKey("rzp_test_ABC")).toBe(false);
    expect(resolveTestMode({ RAZORPAY_KEY_ID: "rzp_live_ABC", NODE_ENV: "production", APP_URL: "https://x.run.app" })).toBe(false);
    expect(resolveTestMode({ RAZORPAY_KEY_ID: "rzp_live_ABC", PAYMENTS_TEST_MODE: "true" })).toBe(false);
    expect(resolveTestMode({ RAZORPAY_KEY_ID: "rzp_test_ABC", PAYMENTS_TEST_MODE: "true" })).toBe(true);
  });
});

describe("v306 · admin payout desk", () => {
  it("brand approval (RELEASED, no UTR) is NOT paid out — the admin can record the transfer", () => {
    const approved = { status: "SUCCESS", payout_status: "RELEASED", creator_net_amount: 8500 };
    expect(isPaidOut(approved)).toBe(false);
    expect(isEscrowHeld(approved)).toBe(true);
    expect(payoutReleaseBlock(approved)).toBeNull();
    expect(isPaidOut({ payout_status: "RELEASED", payout_reference: "UTR9" })).toBe(true);
  });
  it("no payout while a refund is on its way, or for a payment that never came in", () => {
    expect(isRefundInProgress({ status: "REFUND_PENDING" })).toBe(true);
    expect(payoutReleaseBlock({ status: "REFUND_PENDING" })?.code).toBe("REFUND_IN_PROGRESS");
    expect(payoutReleaseBlock({ status: "SUCCESS", refund_status: "PENDING" })?.code).toBe("REFUND_IN_PROGRESS");
    expect(payoutReleaseBlock({ status: "INITIATED" })?.code).toBe("NOT_FUNDED");
  });
  it("no refund of money that never arrived or of an unknown amount", () => {
    expect(refundBlock({ status: "FAILED", gross_amount: 1000 }, 100, "PROCESSED")?.code).toBe("NOT_FUNDED");
    expect(refundBlock({ status: "SUCCESS", gross_amount: 0 }, 100, "PROCESSED")?.code).toBe("NO_AMOUNT");
    expect(refundBlock({ status: "SUCCESS", gross_amount: 1000 }, 500, "PROCESSED")).toBeNull();
  });
  it("release and refund save with compare-and-set and fail loudly", () => {
    const s = read("backend/payment_routes.ts");
    expect(s).toContain("return res.status(404).json({ error: \"No payment was found for this deal, so the payout can't be recorded.\", code: \"NO_PAYMENT\" });");
    expect(s).toContain("updateTxnQuery = updateTxnQuery.eq('id', matchedTx.id);");
    expect(s).toContain("return res.status(502).json({ error: \"Couldn't save the payout. Nothing was marked paid — try again.\" });");
    expect(s).toContain("code: \"TX_CHANGED\"");
    expect(s).toContain("payment_status: 'RELEASED',");
    expect(read("backend/ugc_routes.ts")).toContain("if (!failedRows || failedRows.length === 0)");
  });
  it("creator can't ask for refunded money", () => {
    const deal = { creator_id: "c1", status: "COMPLETED" };
    expect(payoutRequestBlock("c1", deal, { status: "REFUNDED" })?.code).toBe("REFUNDED");
    expect(payoutRequestBlock("c1", deal, { status: "SUCCESS", refund_status: "PENDING" })?.code).toBe("REFUNDED");
    expect(payoutRequestBlock("c1", deal, { status: "SUCCESS" })).toBeNull();
  });
});

describe("v306 · one payment per deal", () => {
  it("create-order refuses a paid deal and re-uses / recovers the last order", () => {
    const s = read("backend/payment_routes.ts");
    expect(s).toContain('code: "ALREADY_PAID", paid: true, detail: "This deal is already paid — the money is held safely."');
    expect(s).toContain("const pending = await ephemeralGet(pendingOrderKey(campaignOrderDealId))");
    expect(s).toContain("reused_order: true,");
    expect(s).toContain("await ephemeralSet(pendingOrderKey(campaignOrderDealId), { order_id: order.id }, PENDING_ORDER_TTL_MS)");
  });
  it("check-status only takes plain ids", () => {
    expect(read("backend/payment_routes.ts")).toContain('return res.status(400).json({ paid: false, error: "Invalid id." });');
  });
  it("browser: Pay stays busy until the payment window is done; no fake contact details; ALREADY_PAID is success", () => {
    const r = read("src/lib/razorpay.js");
    expect(r).toContain("return await finished;");
    expect(r).not.toContain("brand@example.com");
    expect(r).not.toContain("9876543210");
    expect(r).toContain('body?.code === "ALREADY_PAID"');
    const b = read("src/lib/briefPaymentRetry.js");
    expect(b).toContain("export async function recoverPendingBriefOrder(");
    expect(b).toContain("if (v.user_id && v.user_id !== currentUserId()) return null;");
    expect(read("src/pages/brand/BrandUGCMobile.jsx")).toContain("if (payBusyRef.current) return;");
    expect(read("src/pages/brand/BrandUGCPost.jsx")).toContain("const recovered = await recoverPendingBriefOrder();");
  });
});

describe("v306 · Razorpay webhook", () => {
  const secret = "whsec_test";
  const body = JSON.stringify({ event: "order.paid", payload: { order: { entity: { id: "order_ABC123", notes: { deal_id: DEAL, kind: "campaign_escrow" } } }, payment: { entity: { id: "pay_XYZ", order_id: "order_ABC123" } } } });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  it("only Razorpay's signature on the raw body is accepted", () => {
    expect(verifyWebhookSignature(Buffer.from(body), sig, secret)).toBe(true);
    expect(verifyWebhookSignature(Buffer.from(body + " "), sig, secret)).toBe(false);
    expect(verifyWebhookSignature(Buffer.from(body), sig, "")).toBe(false);
    expect(verifyWebhookSignature(Buffer.from(body), "", secret)).toBe(false);
  });
  it("reads the deal from the order notes; ignores other events", () => {
    expect(webhookOrderInfo(JSON.parse(body))).toEqual({ orderId: "order_ABC123", paymentId: "pay_XYZ", dealId: DEAL, kind: "campaign_escrow" });
    expect(webhookOrderInfo({ event: "payment.failed" })).toBeNull();
    expect(webhookOrderInfo({ event: "order.paid", payload: { order: { entity: { id: "x,status.eq.1" } } } })).toBeNull();
  });
  it("is wired with the raw body and off without a secret", () => {
    expect(read("backend/server.ts")).toContain('app.use("/api/payments/razorpay/webhook", express.raw({ type: "*/*", limit: "1mb" })');
    expect(read("backend/payment_routes.ts")).toContain('if (!secret) return res.status(503).json({ ok: false, error: "Webhook not configured." });');
  });
});

describe("v306 · UGC money", () => {
  it("approve touches only the one order; admin cancel can't auto-refund; slots close safely", () => {
    const l = read("backend/services/ugcLifecycleService.ts");
    expect(l).not.toContain(".or(`id.eq.${targetOrderId},brief_id.eq.${rawId}`)");
    expect(read("backend/ugc_routes.ts")).toContain("'ADMIN_USE_REFUND_QUEUE'");
    const d = read("backend/services/ugcDeadlineService.ts");
    expect(d).toContain('.eq("max_creators", cur).select("id")');
    expect(d.indexOf('closeOneBriefSlot(client, brief.id, "brandOrderCancel:slotMax")')).toBeLessThan(d.lastIndexOf("await deps.releaseBriefSlot(brief.id, order.creator_id);"));
    expect(read("backend/server.ts")).toContain(".not('status', 'in', '(CANCELLED,EXPIRED)');");
  });
});

describe("v307 · UGC brief deposit saved + one payout row per order", () => {
  it("deposit row: brief id, admin fee stamped, never paid out / refunded / held by itself", async () => {
    const { isBriefDeposit, isEscrowHeld: held, payoutReleaseBlock: rel, refundBlock: ref } = await import("./adminMoney");
    const dep = { brief_id: "brief_1", status: "SUCCESS", payout_status: "PENDING", gross_amount: 3000, platform_fee_amount: 450 };
    expect(isBriefDeposit(dep)).toBe(true);
    expect(isBriefDeposit({ brief_id: "b", ugc_order_id: "ugcord_1" })).toBe(false);
    expect(held(dep)).toBe(false);
    expect(rel(dep)?.code).toBe("BRIEF_DEPOSIT");
    expect(ref(dep, 100, "PROCESSED")?.code).toBe("BRIEF_DEPOSIT");
    const u = read("backend/ugc_routes.ts");
    expect(u).toContain("brief_id: briefId,");
    expect(u).toContain("platform_fee_amount: depositFee.platformFee,");
    expect(u).toContain("code: 'BRIEF_SAVE_FAILED'");
    expect(read("scripts/sql/session56.sql")).toContain("uq_transactions_ugc_payout");
    expect(read("backend/services/ugcLifecycleService.ts")).toContain('String((insErr as any)?.code || "") === "23505"');
    expect(read("src/components/admin/AdminPayoutMobile.jsx")).toContain("if (t?.is_brief_deposit) return;");
  });
});
