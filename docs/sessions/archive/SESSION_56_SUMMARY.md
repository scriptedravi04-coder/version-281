# Ybex — Session 56 Summary — Payment audit (v305 → v306 → v307)

**Latest:** `ybex-v307.zip` (= v306 + part 2 below: the two "still open" items fixed).
**State:** no npm network here → run `npm install` → `npm run verify` → `npm run build` on your computer.
Checked here: app + server bundle; no missing names; old tests' pinned text unchanged; protected flows OK
(locked files changed with the reason logged in `PROTECTED_CHANGES.md`). Payment tests run here: new
`session56Payments` 52 ✓, session38Admin 115 ✓, payoutMethods 27 ✓, paymentTestMode 18 ✓, briefPayment 14 ✓,
creatorSelfCancel 81 ✓, briefPaymentRetry 11 ✓; ~110 test files compared with v305 → no new failures.
(The full end-to-end test needs real `express` — it runs in `npm run verify` on your computer.)
**Database:** `scripts/sql/session56.sql` APPLIED on the live DB (Ravi OK) — see part 2.
Live DB has 0 payments so far (fresh), so nothing old needs fixing.

## APK question
The Play Store app is a TWA: it only opens `ybexapp.ai.studio`. **Every fix here (and the new landing) goes
live by deploying the website — no new APK upload.** A new APK is needed only to change the app's name,
icon, splash colour, package or version. So build/upload the APK now, once.
Only APK-side check: `public/.well-known/assetlinks.json` must have the **Play App Signing SHA-256** from
Play Console (App integrity) — otherwise the app shows a browser address bar. (That file is on the website,
so it can be fixed later without a new APK.)

## What was wrong → what changed
| # | Problem (how it could hurt) | Fix | Files |
|---|---|---|---|
| 1 | **Approved payouts could never be paid.** Brand approval marks the payment `RELEASED` ("released to payout"), but the admin desk treated `RELEASED` as "already paid" → "Mark paid" always said *already marked paid*; mobile admin hid them as Transferred. | `RELEASED` without a UTR = still to be paid. Paid = PAID/COMPLETED or a UTR. | `backend/adminMoney.ts` |
| 2 | **Test mode in production** (any `*.run.app` URL with `PAYMENTS_TEST_MODE` unset) → deals marked paid with no money, free UGC briefs, demo "Super Admin" login. | With a live key (`rzp_live_…`) test mode is **always off**. | `backend/paymentTestMode.ts` |
| 3 | **Brand could pay twice for one deal** (second tap after UPI switch, app closed before verify). | Server refuses a paid deal; remembers the last order 30 min — if it got paid it's recorded ("you were not charged again"), if still open the same order is reused. Pay button stays busy until the Razorpay window is done. | `payment_routes.ts`, `src/lib/razorpay.js` |
| 4 | Payment taken but app killed before verify → deal stuck "payment pending". | **Razorpay webhook** `/api/payments/razorpay/webhook` (`order.paid`) records it. Off until `RAZORPAY_WEBHOOK_SECRET` is set. | `backend/razorpayWebhook.ts` (new), `payment_routes.ts`, `server.ts` |
| 5 | UGC brief: double tap / app killed → second payment. | Mobile busy guard; order saved when created; next tap asks Razorpay if it was paid and uses it. Saved orders tied to the logged-in brand. | `src/lib/briefPaymentRetry.js`, `BrandUGCMobile.jsx`, `BrandUGCPost.jsx` |
| 6 | Admin "Mark payout paid" / "Refund" could be saved twice (two admins / double tap), payout allowed while a refund was pending, success shown even when the save failed. | Compare-and-set saves (second one gets "already paid / changed"), blocks on pending refund / unpaid row, 502 on failed save, creator + amount from the DB row, not the page. | `payment_routes.ts`, `adminMoney.ts` |
| 7 | UGC payout update always failed (`payment_status: 'PAID'` not allowed by DB). | `RELEASED`. | `payment_routes.ts` |
| 8 | Admin cancelling a UGC order refunded through Razorpay **and** reopened the slot (money to brand and to a new creator). | Admins can't cancel from that button; use the UGC Refunds queue. | `ugc_routes.ts` |
| 9 | Approve sent with a brief id completed every order of that brief. | Approve updates only that one order. | `services/ugcLifecycleService.ts` |
| 10 | Two brand cancels at once refunded 2 slots but closed 1 (reopened slot paid again). | Slot closed safely (compare-and-set) **before** the claim is freed. | `services/ugcDeadlineService.ts` |
| 11 | Every server restart counted cancelled/expired orders as taken → paid slots closed. | Count only live orders. | `server.ts` |
| 12 | Crafted ids in check-status / payout filters. | Plain ids only. | `payment_routes.ts` |
| 13 | Razorpay window pre-filled `brand@example.com` / `9876543210` (receipts/OTP to a fake number). | Real details or empty. | `razorpay.js` |
| 14 | "Mark refund failed" could tell the brand it failed after another admin sent it; creator could request payout on refunded money. | Row-changed checks. | `ugc_routes.ts`, `payoutMethods.ts` |

Checked and fine: Razorpay signature check; paid amount must cover the deal; an order can't fund another deal;
one transaction per order (DB unique); both signatures needed before paying; admin-only money routes;
users can't see others' payout details; refunds computed on the server.

## For Ravi to do (server env + Razorpay dashboard)
1. Env: `RAZORPAY_KEY_ID=rzp_live_…`, `RAZORPAY_KEY_SECRET=…`, `PAYMENTS_TEST_MODE=false`.
2. Razorpay Dashboard → Settings → **Payment capture = Automatic** (else payments stay "authorized" and get auto-refunded).
3. Razorpay Dashboard → Webhooks → add `https://ybexapp.ai.studio/api/payments/razorpay/webhook`, event **order.paid**,
   set a secret → put the same in env `RAZORPAY_WEBHOOK_SECRET`.
4. `npm install` → `npm run verify` → `npm run build` → deploy.
5. Real ₹1 test: campaign deal pay → check deal shows paid → approve → Admin desk "Mark paid" with UTR works.
   UGC brief ₹1 pay → brief posts. Close the app during UPI once → reopen → it must not ask to pay again.

## Part 2 (v307) — Ravi: "UGC fee admin se control hoti hai… dusre vale ko bhi fix kro"
| Problem | Fix | Where |
|---|---|---|
| UGC brief deposit never saved in Supabase `transactions` (DB rule refused a row with no deal / order). | DB rule now allows a brief-only row. The deposit is saved with `brief_id`, `brand_id`, and the **platform fee from Admin at the moment the brand paid** (same rule as campaigns). Each creator's payout on that brief uses it. | `scripts/sql/session56.sql`, `ugc_routes.ts` |
| One paid order could make two briefs (two taps at once). | DB: one order → one brief. The second tap gets the same brief back. | `session56.sql`, `ugc_routes.ts` |
| Brief not saved in the DB but brand told "posted". | Now an error: "payment safe, press Post again — not charged again" (the saved order is reused). | `ugc_routes.ts` |
| Two approve taps at the same instant → two payout rows for one UGC order. | DB: one payout row per UGC order; the second approve answers "already approved". | `session56.sql`, `services/ugcLifecycleService.ts` |
| Admin desk | Brief deposits are labelled "UGC brief deposit" and kept out of the payout / held lists (creators are paid per order, refunds via UGC Refunds queue) — no double counting. | `adminMoney.ts`, `payment_routes.ts`, `EscrowDashboard.jsx`, `AdminPayoutMobile.jsx` |

Note: a change to the UGC fee in Admin applies to briefs paid AFTER the change (a brief already paid keeps its fee).

## Still open
- Creator side still shows "Released" right after brand approval (means: released for transfer) — wording only.
