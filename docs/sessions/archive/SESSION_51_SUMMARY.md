# Ybex — Session 51 Summary — Ybex Assist becomes the brand assistant (v300 → v301)

**Latest:** `ybex-v301.zip` (= v300 + the work below). Plan doc: "Ybex Assist AI — Brand Plan" (Claude doc, kept up to date).
**State:** again **no network** in the sandbox → `npm install` / `npm run verify` / `vite build` not run here.
Checked: whole app + server + all test files bundle with every import resolving; no missing names; old tests' pinned
text unchanged; protected Campaign / UGC / Invite check passes (no locked file touched); the new brain was run on
24 sample Hinglish / English messages, and the new test file (57 checks) passed with a small stand-in runner.
**Run `npm install` → `npm run verify` → `npm run build` on your computer.**
**Database rule (91):** nothing created. 3 follow-ups written in `PENDING_DB_CHANGES.md`.

## What Ravi asked
Turn the brand panel's green bot into an assistant that knows the app and the brand's data: find creators like
Explore's filters, select and act from the chat (UGC brief with Pay now, campaign, invite), know every brand
feature, keep secrets safe — plus the extra ideas he picked: applicants ranking, compare, product → creators, brief
check, hooks / script, alerts on open, pichla brief dobara, festival planner, monthly report, Campaign Manager
handoff, new-creator alerts. Decisions: free Gemini first, 20–30 messages a day (30), name stays "Ybex Assist",
it opens from the green bot on brand home.

## How it works
- **Brands only.** `FeedbackBot.jsx` loads `src/components/assist/brand/*` only for brands (creators and the home
  page don't download it). Anything the assistant doesn't take — hi, help, budget, bug, idea, screenshots — goes to
  the old bot exactly as before.
- **Rules first, AI second.** `brandLogic.js` reads Hinglish / English (city from the app's city list, niches as in
  Explore, followers ranges, ₹ budget, reach, "top 5", "sabse saste", gender, language). Only when the rules don't
  understand a real question does it ask the AI (`POST /assist/ai`). AI off / quota over → everything still works.
- **Real data only, from calls the app already makes** with the brand's own login: Explore list
  (`creators/explore` + Explore's own `applyFilters`), `campaigns?mine=true`, `/campaigns/:id/applications`,
  `ugc/orders/brand`, `ugc/briefs/my`, `escrow-transactions`. Missing numbers show "—", never invented.
- **Nothing paid / published / sent by the bot.** UGC brief → saved to the same `ugc_draft` slot the UGC screen
  restores, opened on step 5 (Review & pay). Campaign → the same `campaign_draft` the create screen restores. Invite
  → the app's own Explore Invite sheet. So the money / publish / invite code is the old tested code.
- **AI route** `backend/assist_routes.ts`: brands only, login required, 30 messages a brand a day
  (`ASSIST_DAILY_LIMIT`), Gemini (`GEMINI_API_KEY`, already in the app; model `ASSIST_MODEL`, default flash-lite),
  20 s timeout, JSON answers. The AI only gets the brand's text (+ their own draft for "check my brief"); its
  instructions forbid keys, admin / server details, other brands, creators' private fields; text inside messages
  is treated as data. Free Gemini may use what is sent to improve Google's products — that's why nothing private goes.
- **Daily limit on the phone too:** after 30 messages the bot says "kal phir baat karte hain"; bug reports still go.

## What the brand can do (all in chat)
| Ask | Result |
|---|---|
| "Jaipur ke fashion creators 10k–50k ₹15k tak", "Delhi food reach 30k+ top 5" | creator cards: tick, sort (best / reach / followers / lowest rate), Top 5, "aur dikhao", open profile, **Invite**, 🔔 Alert me |
| "Riya vs Aman vs Kunal" | compare table + reach per ₹1,000, best value highlighted |
| "kitne log apply kiye / best applicants" | top 8 applicants by niche match, reach, ask vs budget, follower fit + "Open all applicants" |
| opening the chat / "kya pending hai" | drafts to review, live links, counter offers, applications, campaigns closing soon (same rules as brand home) |
| "is mahine ka report" | spent, videos delivered, creators, avg delivery hours, live campaigns + Copy / WhatsApp share |
| "meri campaigns / orders / paisa hold" | live summary + pending list |
| "3 UGC videos serum ke liye ₹2000" | asks only what's missing (product, format, count, rate, what to say) → Brief card → **Review & Pay now** |
| "pichli baar wala serum UGC dobara" | last brief copied → change by typing ("budget 3000") → Pay |
| "campaign banani hai 10 micro creators Mumbai ₹20k" | draft card → **Review & Publish** on the create screen |
| "hook aur script likh do" | 3 hooks + 30s script + caption (AI; tested formats if AI is off) |
| "Diwali plan ₹1 lakh" | budget split, micro / nano count, UGC videos, timeline; buttons to post the brief / campaign |
| "mera brief check karo" | score + fixes (link, requirements, deliverable, budget, do's) on the current draft or pasted text |
| product link / 2 lines about the product | matching niches → creators |
| "campaign manager se baat karni hai" | WhatsApp button with a summary of the chat |
| "naye creators aaye to batana" / 🔔 | search saved on the phone; new matches shown when the chat opens |

## Files
- New: `src/components/assist/brand/{brandLogic.js, brain.js, tools.js, AssistCards.jsx, index.js, brandAssist.test.js}`,
  `backend/assist_routes.ts`.
- Changed: `FeedbackBot.jsx` (brand mode, cards, invite sheet; creator side and old brain untouched),
  `backend/server.ts` (one import + one line), `.env.example`, `PENDING_DB_CHANGES.md`, `docs/CODE_MAP.md`.
- Old summary 50 → `docs/sessions/`.

## Honest limits
- "Pay now" opens the UGC screen's Review & pay step already filled (one more tap), not a checkout inside the chat —
  that keeps the tested payment code untouched. Same for Publish.
- Chat history is only for this visit (Phase 4 needs the `assist_messages` table). The daily count resets if the
  server restarts (shared counter needs a table). Saved searches live on that phone.
- Gemini model names follow the blog writer's (`gemini-3.1-flash-lite`, then `gemini-3.8-flash`). If your key
  uses other names, set `ASSIST_MODEL` in the server env.
- Gender / language filters only work when creators filled them in.

## Still on Ravi
- `npm install` → `npm run verify` → `npm run build`; send me any failure.
- Server env: `GEMINI_API_KEY` (already there for the blog), optional `ASSIST_DAILY_LIMIT=30`, `ASSIST_MODEL`.
- Phone test as a brand: every row of the table above; then turn the AI key off and try again (should still work).
- Database session: the 3 items in `PENDING_DB_CHANGES.md` (Session 51). Creators' version of the assistant = Phase 5.
