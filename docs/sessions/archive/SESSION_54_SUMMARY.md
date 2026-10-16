# Ybex — Session 54 Summary — Ybex Eva for creators (v303 → v304)

**Latest:** `ybex-v304.zip` (= v303 + the work below). Design canvas board 6 = real screenshots of creator Eva.
**State:** no npm network here → run `npm install` → `npm run verify` → `npm run build` on your computer.
Checked here: app + server + all tests bundle; no missing names; old tests' pinned text unchanged; protected flows OK
(no locked file touched). Tests with the stand-in runner: creatorAssist 68 ✓, brandAssist 57 ✓, assist_store 31 ✓,
session53Launch 31 ✓. Creator Eva was opened in headless Chrome (390×844) and 16 flows were tried with sample data.
**Database:** no change needed (re-uses the Session 52/53 tables).

## What Ravi asked
"Brand panel jaisa hi creator panel ke liye bhi pura system banao" — all the ideas from the list (find work, one-tap
apply, alerts, what brands want, script, brief help, deadlines, draft check, profile score, bio / portfolio, fair rate,
growth ideas, earnings, KYC / payout help, refer, share card).

## What creators can now do in Eva (green bot on creator home)
| Ask (Hinglish / English) | Eva does |
|---|---|
| opening the chat | shows what's due (with hours left), new matching work, profile % if under 70 |
| "mere liye campaigns dikhao", "ugc kaam hai kya" | live campaigns + UGC briefs that fit the niche, % match, budget, closing soon; View / **Apply** |
| "top 3 pe apply kar do" | pitch + rate filled from the profile (rate kept inside the campaign budget) → creator taps **Send** |
| "naye campaign aaye to batana" | alert on: a matching campaign / UGC brief goes live → phone push ("New work for you") |
| "brands kya maang rahe hain" | most-wanted niches, typical pay in their niche, UGC rate, formats asked most (from live campaigns, no brand names) |
| "mera rate kitna hona chahiye" | fair reel / story / YouTube range (same benchmark as onboarding) + whether their rate is high / low |
| "meri profile check karo" | profile score with ✓ / Fix buttons that open the right settings screen |
| "bio likh do", "portfolio kaise likhu" | bio / portfolio text (AI, or a template) → Copy & open profile |
| "hook aur script likh do" | 3 hooks + 30 s script + caption (uses their active UGC brief if any) |
| "brief samjhao", "submit se pehle checklist" | the active brief in simple words + a tick-list before submitting |
| "kya baaki hai" | drafts due, changes asked, live links pending, accepted campaigns to reply to |
| "meri kamai" | this month / total paid / coming, next payout date |
| "payout kab aayega" | KYC state, payout account, money waiting and why |
| "content ideas do" | 3–5 ideas for their niche this week + 3 growth tips |
| "dost ko refer karna hai" | their code + WhatsApp invite |
| "share card banao" | a 1080×1920 story image ("I'm a creator on Ybex", name, deals done) → Share / save |
| "team se baat" | WhatsApp the Ybex team with a chat summary |
| a bug ("upload nahi ho raha") | still goes to the Ybex team as before |
Opening chips: Find campaigns · Write a script · Improve my profile · My earnings · What brands want · Growth ideas ·
Report a bug. ☰ menu: new chat + earlier chats (saved like the brand side). 30 messages a day.

## Safety
- The only thing Eva sends for a creator is a campaign application — the same `campaigns/apply` call and the same checks
  as the campaign page (setup done, KYC verified, niche matches, rate ≥ ₹100, pitch 20+ characters), and only after the
  creator taps Send. UGC briefs open the UGC screen (claiming needs the OTP agreement there). A test checks this.
- The AI only gets the creator's own text and a small summary of their own profile; its instructions forbid keys,
  admin details and anyone else's data. Market insight is counts and typical pay only — no brand names.

## Files
New: `src/components/assist/creator/{creatorLogic.js, brain.js, tools.js, CreatorCards.jsx, index.js, creatorAssist.test.js}`.
Changed: `src/components/feedback/FeedbackBot.jsx` (creators load the creator module, creator chips),
`src/components/assist/brand/index.js` (shared names), `backend/assist_routes.ts` (creator AI tasks + knowledge, routes
open to creators, `GET /assist/creator/insights`), `backend/assist_store.ts` (`matchWork`, `buildInsights`, new-work
alerts in the 30-min job), `backend/assist_store.test.ts` (one pinned line: routes now allow creators too),
`docs/CODE_MAP.md`.

## Still on Ravi
- Everything from Session 53 (live Razorpay keys, `PAYMENTS_TEST_MODE=false`, Play signing SHA-256, rebuild APK).
- Phone test as a creator: open Eva, try the chips, apply to one campaign, turn alerts on, then post a matching test
  campaign as a brand (admin approves) → the creator should get a push within ~30 minutes.
