# Ybex — Session 46 Summary — continues Session 45 (v295 → v296)

**Latest:** `ybex-v296.zip` (= v295 + the work below).
**State:** the sandbox had NO network, so `npm install`, `npm run verify` and `npm run build` were NOT run. What was checked: the new backend module compiled with `tsc --strict` (clean); its 37 + 5 tests were run with a small stand-in test runner (all 42 pass); the new React files were parsed and checked for undeclared names with the TypeScript compiler (none). **On your computer run `npm install`, `npm run verify`, `npm run build` first.**
**Database rule (91):** no new table / column / SQL. One wish that needs it is written in `PENDING_DB_CHANGES.md` (signup source).

## What Ravi asked
Turn Admin → Overview into an "Executive Growth Command Center" from the AI's blueprint (city ad hotspots, demographics, funnel, finance, smart alerts) and add anything else that helps growth. Every number must be real.

## What is built (Admin → Overview, `AdminAnalytics.jsx`)
Top of the page, always: **3 answers** (where money comes from · where to spend on ads · where people get stuck) and **"What the numbers say"** (smart alerts, each from real data, with a button to the right tab). Then 6 tabs:
1. **Overview** — the old page, unchanged (stat cards, treasury, Attention Required Hub, charts) + a "This week vs last week" strip (signups, campaigns, applications, deal value).
2. **Where to advertise** — brand-shortage cities (run Meta/LinkedIn ads for brands) and creator-shortage cities (Reels ads for creators) with a 0–100 ad priority; money by city; all-cities table (creators, brands, campaigns, applicants/campaign, deal value, % creators earning, % brands paying); states.
3. **People** — brands / agencies / creators (KYC-approved); active today / week / month (from login sessions); top 10 spender brands; top 10 earning creators; brands that stopped before paying (with phone/email) and creators who are not bookable (no KYC / no rate card). Two buttons send **real reminders** (bell + email).
4. **Deal funnel** — campaigns → applications → chat → payment held → draft → paid out, biggest drop highlighted with a plain reason; deal speed (campaign→completed vs the 7-day target, application→accepted, accepted→paid, payment→payout); live campaigns nobody applied to.
5. **Money** — deal value, net revenue + fee %, money held, payouts waiting, week/month vs before, payout speed.
6. **Growth ideas** (my additions) — category supply vs demand with 14-day trend; creator and brand activation journeys (where new accounts stop); repeat-brand rate + win-back list; signup channels (referral vs not recorded).

Extra things I added beyond the blueprint: activation journeys, win-back list, "live campaigns with no applicants", week-on-week strip, bookable-creator count, one-click reminders with a 3-day cooldown, category gap with growth %.

## How it works (so nothing is invented)
- `backend/adminGrowth.ts` (new, pure) builds every number from rows. `backend/admin_growth_routes.ts` (new) reads the existing tables with the service-role client, falls back to fewer columns on an older database, caches 60 s, and serves `GET /api/admin/growth`.
- `POST /api/admin/growth/nudge {kind}`: needs `manage_users`; the server rebuilds the list itself (never trusts ids from the browser); max 100 per click; nobody gets the same reminder twice in 3 days (`ybex_ephemeral`); logged as `GROWTH_REMINDER`. Texts never say "escrow".
- KYC "approved" follows `creatorKyc.ts` (creator_kyc, else the newest real verifications row); the profile's own `verified` flag is not counted.
- Cities come from the profile (`city`); a brand's deal value counts for the brand's city. Accounts with no city are listed as "Not set" and counted in a note, not hidden.
- Honest gaps shown on screen: signup source (Instagram/Google/Meta) is not stored → only Referral vs not-recorded; "request payout" time is not stored → payout speed is measured from the brand's payment day; activity is counted from login sessions (a floor).
- Changed: `server.ts` (1 import + 1 register line), `adminPermissions.ts` (`growth` area, read open to staff). No locked / protected file touched.

## Tests added
- `backend/adminGrowth.test.ts` (37): city cleaning, shortage zones, money by city, GMV ignoring refunds, held / payout, DAU/WAU/MAU, top lists, stuck deals, KYC rule, funnel + drop-off, deal speed, categories, referral split, activation, win-back, alerts, reminder targets, empty marketplace.
- `backend/session46GrowthWiring.test.ts` (5): route registered, nudge needs manage_users and rebuilds its list, report route never writes, no "escrow" in shown text, every panel mounted.
- Not changed: any existing test. (`session27.test.ts` still finds none of its banned strings in `AdminAnalytics.jsx`.)

## Still on Ravi
- Run `npm install` → `npm run verify` → `npm run build`; fix anything the sandbox could not see (I could not open the page in a browser — check the 6 tabs on desktop and a phone).
- Open Admin → Overview with real data and look at: city names (people type "jaipur", "Jaipur " — merged by spelling only), thresholds in `GROWTH_RULES` (top of `adminGrowth.ts`: 5 creators per brand, 3 applicants per campaign, 24 h stuck payment, 7-day deal target) — change them if they do not match your market.
- Decide: signup-source tracking (see PENDING_DB_CHANGES.md); an India map picture was NOT built (states are ranked bars instead).
- Everything open from Session 45 is still open (phone checks, SITE_URL, TWA rebuild, VAPID, domain).
