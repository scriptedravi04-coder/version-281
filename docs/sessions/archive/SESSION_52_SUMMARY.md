# Ybex — Session 52 Summary — Database connected: Assist memory, real tables, live-payment prep (v301 → v302)

**Latest:** `ybex-v302.zip` (= v301 + the work below).
**State:** no npm network in the sandbox again → `npm install` / `npm run verify` / `vite build` not run here.
Checked: app + server + every test file bundle with all imports resolving; no missing names; old tests' pinned
text unchanged; protected Campaign / UGC / Invite check passes (manifest updated twice with Ravi's OK, see
PROTECTED_CHANGES.md); new tests ran with a stand-in runner (assist_store 31 ✓, persistedLists 14 ✓, brandAssist 57 ✓).
**Database:** Supabase is now connected (project `ybex-app`). Changes were made on the LIVE database — additive only.
**Run `npm install` → `npm run verify` → `npm run build` on your computer.**

## What Ravi asked
1. "supabase connect kr diya hu tum khud dekhlo or kaam krlo" — the 3 Assist items that needed the database.
2. Check the whole app: is everything going into proper tables, not one blob (`ybex_sync`)?
3. Razorpay: testing mode → real mode. Keep minimum amounts at ₹1 for now (UGC minimum → ₹3,000 later).
4. Question: should Pay now open our own payment page first? (Answer + design coming, see below.)
5. Show the chatbot UI (current + new) as a design inside this chat.

## 1. Ybex Assist now remembers (database)
Tables (server-only — RLS on, no policies; `scripts/sql/session52_assist.sql`):
| Table | What it does |
|---|---|
| `assist_messages` | Chat history. The brand's chat comes back on any phone (last 40 messages, kept 90 days). Only text + the card's type are saved — never creator lists, numbers or secrets. "chat clear karo" / "nayi chat" deletes it. |
| `assist_usage` + function `assist_usage_take` | The 30-a-day AI count, shared by every server copy and kept through restarts (atomic, tested on the live DB). Memory is the fallback if the DB is down. |
| `assist_saved_searches` | "Naye creators aaye to batana". A server job every 30 min checks each saved search against approved creators; new matches → a normal bell notification + **phone push** ("2 new creators for your search"). Tapping it opens brand home with the chat open. The chat also shows them when opened. Max 5 searches a brand; searches saved on a phone before this move to the server automatically. |
Code: `backend/assist_store.ts` (new), `setupAssistDataRoutes` in `backend/assist_routes.ts`, one line in `server.ts`,
`src/components/assist/brand/memory.js` (new), small changes in `tools.js`, `brain.js`, `index.js`, `FeedbackBot.jsx`.
Routes: `GET/POST/DELETE /assist/history`, `GET/POST /assist/saved-searches`, `DELETE /assist/saved-searches/:id`,
`POST /assist/saved-searches/:id/seen` — brands only, each brand sees only its own rows (team members share the brand's).

## 2. Database audit — is everything in proper tables?
- **The blob is not being used.** The live `ybex_sync` row holds only app_version / maintenance_mode. Users, profiles,
  campaigns, applications, deals, chat, notifications, payments, UGC, KYC, referrals, reviews, tickets — all in their own
  tables. The server was still trying to upload the WHOLE app into `ybex_sync` on every save; that upload was failing
  every time (no `updated_at` column) and only wasted bandwidth → **switched off** (`YBEX_SYNC_BLOB=true` brings it back).
- **Real bug found and fixed:** some things lived only in the server's memory and vanished on every restart:
  - Brand team activity log → now also saved in `team_activity_logs` and read from it (`server.ts`, `brands_routes.ts`).
  - **Saved creators** → `saved_creators` table (save / unsave / "saved" heart on the profile).
  - **Brand's review of a creator** → `creator_reviews` table (the table's trigger keeps overall rating = stars and the
    creator's tier up to date). Profile shows table reviews + any older memory ones, no duplicates.
  These two are in the LOCKED `creators_routes.ts` — opened with Ravi's OK ("Haan, kholo aur theek karo"); routes and
  answers unchanged, memory stays as the fallback. Helpers in `backend/persistedLists.ts` (new).
- Left as is (no screen uses them): collab cost requests, admin message flags, deleted-id lists, UGC admin notes —
  written down in `PENDING_DB_CHANGES.md`.
- Indexes added: saved_creators (brand, creator) unique; creator_reviews (creator); team_activity_logs (brand).
- Supabase security check: new tables show only the usual "RLS on, no policy" info (same as every server-only table).
  Older warnings already there (3 security-definer views, 19 functions without a fixed search_path, 2 extensions in
  public) were NOT touched — worth a separate clean-up before scale.

## 3. Payments — live mode
- **Ravi sets on the server (Cloud Run env), not in code:** `RAZORPAY_KEY_ID=rzp_live_…`, `RAZORPAY_KEY_SECRET=<live>`,
  `PAYMENTS_TEST_MODE=false`. That last one also turns the demo-login buttons off (right for launch).
- Code fix (LOCKED `src/lib/razorpay.js`, Ravi's request): the browser no longer treats a `*.run.app` address as test
  mode — only the server decides. Before, a live deploy on a run.app address showed "Test Mode / Auto-Complete" to real
  brands.
- Minimums stay ₹1: the phone UGC screen used to jump to ₹1,500–2,500 on any real domain (e.g. ybexmedia.in) — now ₹1
  everywhere (`UGC_MIN_BUDGET` in BrandUGCMobile.jsx; desktop was already ₹1). The bot follows the same ₹1 and only
  *suggests* the usual rate. To raise it later (₹3,000): BrandUGCMobile `UGC_MIN_BUDGET`, BrandUGCPost `getMinBudget`,
  brandLogic `UGC_MIN_BUDGET`. Server already accepts ₹1.
- Test changed on purpose: `brandAssist.test.js` expected the bot to raise ₹100 to ₹2,500 — the rule changed (Ravi: ₹1),
  so it now expects ₹100 to stay.

## 4. Pay now → our own payment page?
Recommended yes: order summary, promo code, fee + GST breakup, "secure payment hold" trust line, then one **Pay ₹X**
button that opens Razorpay. Promo code / fee breakup parts already exist (PromoCodeInput, FeeBreakup). Chat's Pay now
is a locked flow → design first, code after Ravi approves the design.

## Still on Ravi
- `npm install` → `npm run verify` → `npm run build`; send any failure.
- Server env: live Razorpay keys + `PAYMENTS_TEST_MODE=false` (+ Razorpay dashboard webhook if you use one).
- Phone test as a brand: chat → close app → reopen (history back); "chat clear karo"; save a search ("Jaipur fashion
  creators… naye aaye to batana") → approve a matching creator from admin → push within ~30 min.
- Save / unsave a creator and write a review, restart the server, check both are still there.
