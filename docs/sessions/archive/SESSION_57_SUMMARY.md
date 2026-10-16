# Ybex — Session 57 Summary — Money screens (v307 → v308)

**Latest:** `ybex-v308.zip` (= v307 + Ravi's "Ybex_Money_Mobile_UI" design built into the app, mobile).
**State:** no npm network here → `npm install` → `npm run verify` → `npm run build` → deploy (no new APK needed).
Checked here: app + server bundle; no missing names; old tests' pinned text unchanged; protected flows OK (no
locked logic file changed; the chat screen only changed how the pay sheet shows its result, same server calls).
New test `backend/session57Money.test.ts` 27 ✓; 124 test files compared with v307 → no new failures.
All screens opened in headless Chrome at 390×844 with sample data (preview image sent with this version).
**Database:** no change.

## What was built (design id → where)
| Design | In the app | File |
|---|---|---|
| ER-01 Earnings | "Ready to withdraw" hero + Request payout, In hold / Paid to bank tiles, KYC card, referral wallet line, Deal payments with All / In hold / Ready / **Paid** tabs, Statement (CSV), Get help | `src/components/payments/CreatorEarningsMobile.jsx` |
| ER-02 first time | Getting started card, Add payout account, how you get paid, Find deals | same |
| ER-03 deal breakdown | Deal amount − fee − GST = you get, timeline, Invoice, Request payout | same |
| ER-04 / 04b | One "Request payout" for all ready money → "Payout requested" | same + **new** `backend/creatorPayoutRequests.ts` (`POST /creator/payout-request-ready`) |
| ER-05 / 05b | Payout account sheet: name-match hint for UPI, "account numbers match" check | `src/components/payments/mobile/PayoutMethodSheet.jsx` |
| BP-01 / 01b / 02 | Brand **Payments** (was "Payouts"): in escrow, spent this year, active deals, refund-account warning, Post a brief / Create campaign, History with All / Escrow / Released / **Refunds**, Invoice on each row, Statement, first-time screen | `src/components/payments/BrandPaymentsMobile.jsx` + **new** `backend/brandPayments.ts` (`GET /brand/payments-overview`) |
| RF-01 brand refer | Ticket card, joined / qualified / earned, how it works, brands you invited, wallet, sticky code + Invite a brand | `src/components/profile/mobile/brand/ReferScreen.jsx` → `ReferralHub mode="brand"` |
| RF-02 / RF-03 creator | "Invite & earn" with Invite creators / Invite brands tabs, ticket cards, progress, your friends / brands you invited (with progress), wallet with withdraw rule, sticky code + share | `src/components/referral/ReferralHub.jsx`, `backend/referralProgram.ts` (people list now has type + done/not done) |
| PY-10 / 12 / 13 checkout | Review & pay sheet in app UI → Razorpay's own secure window (UPI / card / netbanking chosen there) → **Payment successful** or **Payment didn't go through · Try again** | `src/components/chat/mobile/MobileEscrowSheet.jsx`, `ChatBoxMobile.jsx` (shows the result) |

## Bugs fixed on the way
- Approved money (RELEASED) showed as "Paid / Disbursed" to creators and could never be requested → now **Ready** with Request payout; "Paid to bank" counts only money with a UTR / marked paid.
- "₹… in the last 28 days" counted money still in hold (`status SUCCESS` = brand paid, not creator earned).
- Brand "Locked in escrow" tab filtered nothing (wrong tab key); fake "2h ago · awaiting your review" line removed.
- Brand refer page used a `/signup?ref=` link the invite counter never matched → now the real `/b/<code>` link and real counts.
- "Invite 3 creators → your next **0** deals at 0% fee / up to ₹0" → offers with a 0 amount are hidden.
- Invite page header was see-through on scroll → solid white.

## Not built (and why)
- Card / UPI entry inside our own screen (PY-10b/10c/11): card details must stay in Razorpay's window (security rule).
- "Verify UPI name" / ₹1 bank check (ER-05): needs a paid bank-verification service — not connected.
- "Remind" for people who were invited but never signed up: the app only knows people after they sign up.
- "Use wallet balance at checkout" (RF-01): wallet money is withdrawn to UPI today; paying with it needs a change in the locked payment flow.

## For Ravi
- Deploy, then check on the phone: creator Earnings → Request payout; brand Payments → Refunds tab + Add refund account; Invite & earn tabs; a ₹1 deal payment → success screen.
