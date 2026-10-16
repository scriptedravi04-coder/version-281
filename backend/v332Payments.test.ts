import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";

// Session 58 v332 (Ravi: "khali mt dikhao, errors ya oops esa kuch nahi"): a database read failure on the money
// routes is answered with 503 PAYMENTS_UNAVAILABLE (never an empty list), and the app shows PaymentsRetryCard.
const read = (p: string) => readFileSync(p, "utf8");

describe("v332 — payments never look empty when the database can't be read", () => {
  it("payment routes answer 503 PAYMENTS_UNAVAILABLE instead of []", () => {
    const s = read("backend/payment_routes.ts");
    expect(s).toContain('code: "PAYMENTS_UNAVAILABLE"');
    expect(s).not.toMatch(/\[\/transactions\][^\n]*\n\s*return res\.json\(\[\]\)/);
    expect(s).not.toMatch(/\[\/escrow-transactions\][^\n]*\n\s*res\.json\(\[\]\)/);
    expect(s).not.toMatch(/\[\/creator\/payout-eligible-deals\][^\n]*\n\s*return res\.json\(\[\]\)/);
  });
  it("fetchUserScopedTransactions throws TX_READ_FAILED (other callers still catch it)", () => {
    expect(read("backend/server.ts")).toContain('code: "TX_READ_FAILED"');
    expect(read("backend/creatorDashboard.ts")).toContain("fetchUserScopedTransactions(me, user.role).catch(");
    expect(read("backend/admin_logs_creators_routes.ts")).toMatch(/fetchUserScopedTransactions\(targetId\)[^\n]*\.catch\(/);
  });
  it("brand payments overview answers 503 on a failed read", () => {
    const s = read("backend/brandPayments.ts");
    expect(s).toContain('status(503)');
    expect(s).toContain("dealsR?.error || briefsR?.error");
  });
  it("money screens use the calm retry card, not an empty state", () => {
    expect(read("src/components/common/PaymentsRetryCard.jsx")).toContain("Your payments are safe");
    for (const f of ["src/pages/dashboard/Earnings.jsx", "src/pages/brand/BrandPayments.jsx", "src/components/payments/BrandPaymentsMobile.jsx"]) {
      expect(read(f), f).toContain("PaymentsRetryCard");
    }
    expect(read("src/components/dashboard/BrandDashboard.jsx")).not.toContain('toast.error("Failed to load transactions.")');
  });
  it("Eva says she couldn't check instead of 'no earnings' / '₹0 held'", () => {
    expect(read("src/components/assist/creator/tools.js")).toContain("payoutUnknown");
    expect(read("src/components/assist/creator/brain.js")).toContain("I couldn't check your earnings just now");
    expect(read("src/components/assist/brand/tools.js")).toContain("paymentsFailed");
  });
  it("Terms bumped to 1.4 on both sides", () => {
    expect(read("backend/consents.ts")).toContain('TERMS_VERSION = "1.4"');
    expect(read("src/lib/legal/legalContent.js")).toContain('termsVersion: "1.4"');
  });
});
