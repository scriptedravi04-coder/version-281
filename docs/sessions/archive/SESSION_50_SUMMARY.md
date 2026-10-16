# Ybex — Session 50 Summary — clean-up part 2: locked screens (v299 → v300)

**Latest:** `ybex-v300.zip` (= v299 + the split below). **No feature, text, design, route or server call changed.**
**State:** still **no network** in the sandbox, so `npm install` / `npm run verify` / `vite build` could not run here.
Checked on every file (same tools as Session 49):
- whole app, server and all 167 test files bundle with every import / export resolving;
- no missing names, no moved code reaching for a wrong global, no moved section writing to a value it only receives;
- every string / pattern / order-check the old tests hold against a file is still in that file;
- **protected Campaign / UGC / Invite check passes with the manifest untouched** — each locked screen makes exactly the
  same server calls as before (only sections with no server call or server path were moved).
**Run `npm install` → `npm run verify` → `npm run build` on your computer before going live.**
**Database rule (91):** nothing.

## What Ravi asked
"Split the locked files too, but safely" (after Session 49 left them out).

## 1. Locked flow screens → section files (word for word)
| Screen | Lines before → after | New sections |
|---|---|---|
| Desktop chat `chat/ChatBox.jsx` | 3,080 → 2,064 | 14 in `chat/chatBox/` (header, deal strip, stage label, composer, preset chips, feedback box, file upload, upload header, signature status, submission record, phone dock, payment sheet, upload sheet, modals) |
| Campaign create (phone) `MobileCampaignCreate.jsx` | 2,485 → 1,382 | 12 in `campaignCreate/` (brief form, advanced targeting, platforms, payout, niche / city / date / language sheets, review header + feed card, published screen, KYC notice) |
| Brand UGC (phone) `BrandUGCMobile.jsx` | 2,440 → 1,454 | 10 in `brand/brandUgc/` |
| Creator UGC (phone) `CreatorUGCMobile.jsx` | 2,404 → 1,736 | 8 in `creator/creatorUgc/` |
| Creator manage orders `ManageUGCOrdersView.jsx` | 2,048 → 1,543 | 8 in `creator/manageUgc/` |
| Chat system cards `SystemMessage.jsx` | 1,636 → 1,132 | 8 in `chat/systemMessage/` |
| Brand UGC orders (desktop) `BrandUGCOrders.jsx` | 1,781 → 1,507 | 5 in `brand/brandUgcOrders/` |

Rules the moving tool followed: a section moves only if it has no server call / server path, no React hook, no line an
old test reads, is not the direct child of an animation wrapper (so open / close animations stay the same), and never
writes to a value it receives. Logged in `PROTECTED_CHANGES.md` (no manifest update needed).

## 2. Backend NOT split (on purpose) — `ugc_routes.ts`, `server.ts`, `payment_routes.ts`, `campaign_lifecycle.ts`, `creators_routes.ts`
I tried every one of the 41 UGC routes. Almost every one carries text that a safety test reads from that exact file —
for example "every POST route in ugc_routes checks login", "recordAgreementSignature appears exactly twice",
"`status(401)` on each route". `server.ts` alone is read by 60 tests. Moving that code would either make those money /
security checks fail or let code slip outside them, and the project rule is: never change those tests to make a change
pass. So the backend stays as is. Safe way later: a session where the tests run, moving each file **together with** its
tests, one file at a time, with your OK.

## Files
- New: 65 section files in the 7 folders above; `docs/CODE_MAP.md` updated; `src/session49.test.js` now also checks the
  locked-screen splits and that no moved section calls the server.

## Still on Ravi
- `npm install` → `npm run verify` → `npm run build`. Send me any failing output.
- Phone / desktop check of the locked flows end to end once (they are live): desktop chat (send message, AI assist,
  offer chips, sign, pay, upload, live links, review), campaign create on phone (every sheet + review + publish),
  brand UGC (post brief steps, orders tab, approve / revision popups), creator UGC (brief detail, sign with OTP, submit),
  manage orders (each stage), brand UGC orders desktop.
- Everything open from Sessions 45–49 is still open.
