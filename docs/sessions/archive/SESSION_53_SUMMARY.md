# Ybex — Session 53 Summary — Launch audit + "Ybex Eva" chat (v302 → v303)

**Latest:** `ybex-v303.zip` (= v302 + the work below). Design canvas: "Ybex Assist — Chat & Pay UI" (board 5 = real
screenshots of Eva as built).
**State:** no npm network in the sandbox → `npm install` / `npm run verify` / `vite build` not run here.
Checked here: app + server + every test file bundle with all imports resolving; no missing names; old tests' pinned
text unchanged (except two of my own tests, below); protected Campaign / UGC / Invite check passes (manifest updated with
Ravi's OK, logged in PROTECTED_CHANGES.md); new / related tests ran with a stand-in runner (session53Launch 31 ✓,
assist_store 31 ✓, persistedLists 14 ✓, brandAssist 57 ✓, campaignIntegrity 88 ✓, session21Review 19 ✓,
session22Audit 38 ✓, session33Auth 14 ✓, session42LoginOtp 56 ✓). Eva was opened in a real headless Chrome (390×844)
and screenshotted: home, chat, creator results, menu, creator side.
**Database:** live Supabase changes, additive only (see PENDING_DB_CHANGES.md, scripts/sql/session53.sql).
**Not possible here:** tapping through the real app on an Android / iPhone. Do the phone checklist at the end.

## What Ravi asked
1. Check the whole app (admin, brand, creator — web, mobile, iOS, Android), database, security, dummy things, splash —
   Play Store launch tomorrow.
2. Domain: keep `ybexapp.ai.studio` for the app until ~200 users; emails stay as they are.
3. Remove made-up reviews / rating on creator profiles and made-up Instagram post stats (campaign views stay).
4. Open the locked files for the security fixes "but tell me what and why".
5. Chat UI: "How can I help?" + small chips; header fades away as the chat grows; then "Ybex Eva · BETA" on top with a ☰
   menu for earlier chats; creators shown like "Meet our creators" (glow); premium blurry glass; full green; status bar
   and keyboard area the same green on iOS and Android.

## Security holes closed (all real, found in the code)
| Hole | Fix | File |
|---|---|---|
| Anyone could **sign up as admin** (`role:"admin"`) and log in | sign-up makes only creator / brand; staff emails can't be re-registered | auth_routes.ts |
| Sign up with someone else's email → log straight in with a password | password login needs a verified email ("Use OTP instead" verifies it) | auth_routes.ts |
| Any logged-in user (even the creator) could **approve a UGC video and release the payout** | only that order's brand or an admin 🔒 | campaign_lifecycle.ts |
| Anyone could **post into any chat**, and fake "system" cards (e.g. "Payment secured") | only the two parties / staff; users can't send "system"; sender side from the thread 🔒 | chat_routes.ts |
| Anyone could submit a draft on any deal | only the deal's creator 🔒 | deals_routes.ts |
| On UGC chats any creator / brand could sign the other person's agreement | you sign only your own side 🔒 | deals_chat_routes.ts |
| A ₹1 Razorpay order could be recorded as a full payment hold (UGC / non-campaign) | paid amount must cover the recorded amount for every payment 🔒 | payment_routes.ts |
| Google login popup sent the login token to any website | only our own page receives it; login page ignores other sites | auth_routes.ts, Login.jsx, Signup.jsx |
| A banned / deleted user's phone stayed logged in | old logins stop working at once | server.ts |
| AI brief generator open to the whole internet (Gemini bill) | brands only 🔒 | ugc_routes.ts |
| Upload: any bucket name (new public buckets), HTML / SVG files, 500 MB bodies | app buckets only, no page-type files, 25 MB JSON | misc_routes.ts, server.ts |
| Mobile "Business email" box **silently changed the login email** → creator locked out | profile form never changes the login email 🔒 | creators_routes.ts |
| Creators could write computed / admin profile fields; upsert could hit another user's row | more fields blocked; upsert key must include the owner | browserDbRoutes.ts |
| 3 database views readable with the public browser key (user activity, deals, UGC checks) | server-only now | Supabase |
🔒 = locked file, opened with Ravi's OK ("locked files kholna but mujhe bata bhi dena"). Only "who may do this" checks were
added — the flows, screens and routes are the same.

## Bugs fixed
- **No phone push had ever been sent**: notification rows never had `id`, and the push loop skips rows without it.
  Database now fills it (and back-filled old rows). Every bell notification now also goes to the phone.
- **User reports never reached admin**: the report id wasn't a valid uuid, so every save failed; and there was no screen.
  Fixed + new tab Admin → System Reports → **User Reports** (Mark resolved).
- Admin **Unban** didn't really unban (account stayed hidden, couldn't log in) — fixed.
- Admin "Custom message" offered WhatsApp / SMS that never sent — now "App + phone push" and **Email** (really sends).
  A failed save now says so.
- Admin "Campaign marked Live" even when the save failed — now shows the error.
- Sub-admins could warn / suspend / ban the Super Admin (or themselves) through the API — blocked.
- Admin Fees tab: "Global payout freeze", refund window, min / max campaign budget did nothing — removed (payouts are
  released by hand in the Payouts tab). Old referral settings card removed (it reset the live programme's settings).
- Permanent fake "AT RISK" tag on UGC Orders menu removed.
- Brand: dashboard banner "/campaigns/create" opened a broken page; Eva's "closes soon" alert opened a 404 — fixed.
- Campaign create fallback deadlines were in the past (Aug / Sep 2026) — now +14 days.
- Creator: deleted / bad campaign link showed a skeleton forever — now "This campaign isn't available · Go back".
- Creator settings showed "updated!" after a failed save — fixed (phone, business email, platforms, rate card).
- KYC notification opened Settings home on mobile instead of KYC — fixed.
- Maintenance screen "Call Team" used a fake US number — now WhatsApp to the Ybex team number.
- UGC briefs with no budget showed an invented ₹15,000 — now the real budget.

## Made-up numbers removed (Ravi's list)
- Creator public profile: no more invented 10–25 reviews, 4.5–5.0 rating, sub-scores and profile views. No reviews →
  "New on Ybex". Real reviews (now saved in `creator_reviews`, Session 52) show as before.
- "Add collab proof": no more random 15k–47k views / likes / reach + stock photo "fetched". The creator pastes the link
  and types the numbers from Instagram insights (`fetch_status: "MANUAL"`).
- Kept as Ravi chose: campaign "views / applied" activity for creators.

## Ybex Eva (the green bot) — new look
- Opens with **"Hi {name}, How can I help?"** and chips — brands: Find creators · Create campaign · Create UGC · Monthly
  report · What needs me? · Write a script; creators: Report a bug · Suggest a feature · Something's confusing · What can
  you do? · Plan my budget.
- As the chat grows the header blurs and folds away (same animation as before, a bit sooner) and **"Ybex Eva · BETA"**
  fades in on the top bar. **☰ menu**: New chat + earlier chats (open / delete) for brands — each chat saved separately
  on the server (`assist_messages.chat_id`, `GET /assist/chats`). "chat clear karo" clears only the open chat.
- Creator results now use the **"Meet our creators" photo cards** — 3 columns, colour glow behind, slow float. Tap = pick
  (lime tick), ↗ = open profile; Invite / Alert me below.
- **One green everywhere**: status bar, top, middle and the strip by the keyboard are the same `#1F7A35` on iPhone and
  Android (the lime strip on iPhone is gone); frosted glass bubbles, chips and menu with strong blur.
- Small bubble on the bot now says "How can I help?". Placeholder: "Ask Eva anything…".
- The AI is told its name is Eva and that it's in beta.

## Android / store
- `twa-manifest.json`: status bar colour during the Android splash = the splash purple `#7E00DC` (was lavender);
  **location permission removed** (the app never uses location — avoids an extra Play declaration). Same colour in
  `manifest.json`. Push links can't open other sites.
- Kept: host `ybexapp.ai.studio` (Ravi's decision).

## Still on Ravi (before / at upload)
- `npm install` → `npm run verify` → `npm run build` (send me any failure).
- Server env: live Razorpay keys + `PAYMENTS_TEST_MODE=false`; `NODE_ENV=production`; `DEMO_LOGIN` unset;
  **`ADMIN_QUICK_PIN` unset** (or 32+ random characters); `CRON_SECRET` set.
- Play: add the **Play App Signing SHA-256** (Play Console → App integrity) to `public/.well-known/assetlinks.json`
  next to the upload key, else the app shows a browser bar. Bump `appVersionCode` in `twa-manifest.json` if 2 was
  already uploaded. Rebuild the APK / AAB with bubblewrap (colours + location changed).
- Phone checklist (Android + iPhone): open Eva (top bar and keyboard strip same green? iPhone clock readable?), find
  creators, ☰ → New chat / earlier chat; brand pays a UGC brief (live mode); creator submits draft; brand approves;
  ban a test user while logged in on a phone (should log out); send a test push from admin.

## Known, not done tonight (written in PENDING_DB_CHANGES.md)
- Profile emails (and brand representative mobile) are readable with the public browser key (needs ~10 screens moved
  to server reads first). `content-submissions` bucket is public. CORS accepts any site. Campaign targeting fields
  (languages, gender, follower range…) aren't saved — needs columns + a locked-file change.
- Admin: sidebar shows some sections to sub-admins that the server then refuses; FAQ manager page has no menu entry.

## Files
New: `backend/session53Launch.test.ts`, `scripts/sql/session53.sql`, `SESSION_53_SUMMARY.md`.
Changed (main): `backend/{auth_routes, server, campaign_lifecycle🔒, chat_routes🔒, deals_routes🔒, deals_chat_routes🔒,
payment_routes🔒, ugc_routes🔒, creators_routes🔒, misc_routes, browserDbRoutes, admin_campaigns_settings_routes,
admin_users_enforcement_routes, tags_notifications_routes, assist_store, assist_routes}.ts`,
`src/components/feedback/FeedbackBot.jsx`, `src/components/assist/brand/{AssistCards.jsx, memory.js, brain.js,
brandLogic.js, index.js}`, `src/components/admin/{SystemReports, PlatformTools, UserEnforcementPanel}.jsx`,
`platformTools/FeesSettingsCard.jsx`, `layout/Layout.jsx`, `src/pages/creator/{CreatorPublicView, CreatorSettings,
CreatorMobileProfile, CreatorUGCBrowse}.jsx`, `profileScreens/{RatesScreen, parts/ContactVerificationSection}.jsx`,
`src/pages/collabs/AddCollab.jsx`, `src/pages/campaigns/{CampaignDetail, Campaigns}.jsx`, `BrandCampaignCreate.jsx`,
`MobileCampaignCreate.jsx`, `BrandDashboard.jsx`, `NotificationItem.jsx`, `Earnings.jsx`, `src/App.jsx`,
`src/lib/razorpay.js🔒` (Session 52), `twa-manifest.json`, `public/manifest.json`, `public/push-sw.js`.
Tests changed on purpose: `src/session49.test.js` (ReferralSettingsCard no longer rendered — it broke the live
referral settings); `brandAssist.test.js` (Session 52, ₹1 minimum).
