# Ybex — where the code lives (Session 49)

## Quick map (v334 clean-up — read this first)

**Front end (the app people use)** — React + Vite, starts at `src/index.jsx` → `src/App.jsx` (all page links).
- Pages: `src/pages/<area>/` (`brand`, `creator`, `admin`, `campaigns`, `collabs`, `ugc`, `onboarding`, `auth`, `help`, `legal`, `blog`, `dashboard`, `kyc`, `profile`, `app`).
- Pieces of pages: `src/components/<feature>/` (chat, campaigns, ugc, payments, profile, admin, assist = Eva, feedback, layout, common, …). `src/components/ui/` keeps only the library parts the app really uses (button, calendar, popover, autocomplete, date picker, number input).
- Helpers: `src/lib/` (API client `api.js`, Razorpay, offline, links), `src/utils/` (money maths, formatting, deal / UGC rules), `src/hooks/`, `src/contexts/`, `src/store/`.

**Back end (the server)** — Express + Supabase. `server.ts` (root) only starts `backend/server.ts`, which sets up every route file.
- Login / account: `auth_routes.ts`, `oauth_routes.ts`, `session_routes.ts`, `account_routes.ts`
- Campaigns: `campaigns_routes.ts`, `campaign_lifecycle.ts`, `campaignManage.ts`, `campaignGuards.ts`, `campaignRefunds.ts`
- Deals + chat + contract: `deals_routes.ts`, `deals_chat_routes.ts`, `chat_routes.ts`, `content_submissions_routes.ts`, `dealFlow.ts`, `agreementRecord.ts`, `signTokens.ts`
- UGC orders: `ugc_routes.ts`, `ugcSlots.ts`, `ugcOrderStage.ts`, `ugcGuards.ts`, `services/ugcLifecycleService.ts`, `services/ugcDeadlineService.ts`
- Money: `payment_routes.ts`, `razorpayWebhook.ts`, `services/escrowService.ts`, `briefPayment.ts`, `refunds.ts`, `creatorPayoutRequests.ts`, `brandPayments.ts`, `adminMoney.ts`, `feeOffer.ts`, `stampedFee.ts`
- Creators / brands / invites: `creators_routes.ts`, `brands_routes.ts`, `public_creator_routes.ts`, `directInvites.ts`, `creatorKyc.ts`
- Admin: `admin_*_routes.ts` (one per admin area)
- Eva (assistant): `assist_routes.ts`, `assist_store.ts`; other: `blog_routes.ts`, `promo_routes.ts`, `push_routes.ts`, `support_routes.ts`, `feedback_routes.ts`, `media_routes.ts`, `misc_routes.ts`, `whats_new_routes.ts`

**How the money / deal / UGC flows are organised**
- Campaign, UGC and Invite-to-campaign are LOCKED (AGENTS.md). Their logic files are listed in
  `scripts/protectedFlows.mjs` → `LOGIC_FILES` and must not change by one character; their screens are in `SCREEN_GROUPS`
  (design may change, server calls may not). `backend/protectedFlows.test.ts` checks both.
- A deal goes: offer → negotiation → contract (OTP signing) → payment held (Razorpay) → content submitted → brand approves →
  payout. Server side in `dealFlow.ts` + the deals / chat / payment route files; browser side in
  `src/components/chat/` (`dealState.js`, `chatFlowState.js`, `mobile/useChatThreadMobile.js`) and `src/utils/dealFlow.js`.
- UGC: brand posts a brief and pays → creators take slots → submit video → brand approves → payout. Cancels never refund
  through Razorpay (docs/code/ARCHITECTURE.md rules 51–52).

**Tests** — next to the code they check: `backend/*.test.ts` (server + "this text must stay" safety checks) and
`src/**/*.test.js(x)` (screens and helpers). Many tests read source files word for word: never edit a test to make it pass.

**Commands**
- `npm run dev` — start locally · `npm run build` — build app + server into `dist/` · `npm start` — run the build
- `npm run verify` — type check + crash check + all tests (run before every deploy)
- `npm run protect:check` — only the locked-flow check. `npm run protect:update` is for Ravi only.

**Settings / keys** — copy `.env.example` to `.env`; every key is explained in `docs/setup/ENV_KEYS.md`. `db_mock.json` is the
local fallback data file the server reads when Supabase is not connected — keep it.

**Docs** — `docs/code/ARCHITECTURE.md` (rules, protected changes), `AGENTS.md` (rules for AI tools), `docs/database/PENDING_DB_CHANGES.md`
(database work waiting for the DB session), newest session summary in the root (`docs/sessions/SESSION_58_SUMMARY.md`), older ones in
`docs/sessions/`, SQL files in `scripts/sql/`.


A short map so anyone (person or AI tool) can find a feature without opening 2,000-line files.

## Top level
| Path | What |
|---|---|
| `server.ts` | 4-line starter → `backend/server.ts` |
| `backend/` | the API. One file per area: `auth_routes.ts`, `ugc_routes.ts`, `payment_routes.ts`, `promo_routes.ts`, `admin_*_routes.ts`, … Shared helpers sit next to them (`dealFlow.ts`, `ugcSlots.ts`, …); long jobs in `backend/services/`. |
| `src/pages/` | one folder per role / area: `app` (login), `brand`, `creator`, `admin`, `campaigns`, `collabs`, `ugc`, `onboarding`, `auth`, `help`, `legal`, `blog` |
| `src/components/` | pieces used by pages, grouped by feature: `admin`, `chat`, `payments`, `profile`, `campaigns`, `ugc`, `referral`, `promo`, `feedback`, `account`, `kyc`, `layout`, `common`, `ui` (library parts) … |
| `src/lib/`, `src/utils/` | small helpers (API client, formatting, rules) |
| `docs/` | all notes — index in `docs/README.md` (`setup/`, `code/`, `database/`, `sessions/` (21–57 merged in SESSIONS_21_to_57.md)) |
| `cloudflare/` | Worker that serves ybexmedia.in from ybexapp.ai.studio (v337) |
| `ios-app/`, `android-overrides/` | iPhone (Capacitor) and Android (Play) store builds |
| `scripts/` | build / brand / safety scripts (`protectedFlows.mjs`, `check-crashes.mjs`) |

## Big pages are split into section files (Session 49)
Each section file gets everything it needs as props from its page — no logic, text or server call moved.

| Page | Section folder |
|---|---|
| `src/pages/creator/CreatorMobileProfile.jsx` (phone profile + its screens) | `src/pages/creator/profileScreens/` — `PlatformsScreen`, `HelpScreen`, `RatesScreen`, `PortfolioScreen`, `SessionsScreen`, `LegalScreen`, `portfolioLinkInfo.js`; `parts/` — `LanguagesField`, `ContactVerificationSection`, `InstagramStatsForm`, `KycIdentitySection`, `KycPayoutSection` |
| `src/pages/brand/BrandHomeMobile.jsx` | `src/pages/brand/brandHome/` — `BrandHomeActions`, `ActiveBriefsCarousel`, `CampaignTemplatesRow`, `CampaignManagerCard`, `BrandsGrowingStrip`, `ScheduleCallModal` |
| `src/pages/creator/CreatorHomeMobile.jsx` | `src/pages/creator/creatorHome/UgcLiveTimerCard` (+ shared `components/dashboard/MeetCreatorsGrid`) |
| `src/pages/creator/CreatorSettings.jsx` (desktop settings) | `src/pages/creator/settingsDesktop/` — `PlatformsPanel`, `PastBrandsCard`, `PortfolioList`, `KycPanel` |
| `src/components/admin/PlatformTools.jsx` | `src/components/admin/platformTools/` — `BroadcastEmailCard`, `MaintenanceCard`, `FeesSettingsCard`, `CouponList` |
| `src/components/admin/UserEnforcementPanel.jsx` | `src/components/admin/userEnforcement/` — `BasicDetailsCard`, `KycHighlightsCard`, `PayoutHighlightsCard`, `ActivityTimelineCard`, `LegalKycGrid`, `UploadedDocumentsCard`, `PayoutMethodsCard`, `EscrowLedgerCard` |
| brand phone profile | already split: `src/components/profile/mobile/brand/*Screen.jsx` |

Parts that old tests read word-for-word (for example the creator profile's edit screen, the KYC header, the Instagram
YouTube rows, the home headers and quick bars) stay in their page file on purpose.

## Locked flow screens — split too (v300, Ravi OK)
Only sections with **no server call** were moved, so each screen still makes exactly the same calls (protected check unchanged).

| Screen | Section folder |
|---|---|
| `src/components/chat/ChatBox.jsx` (desktop chat) | `src/components/chat/chatBox/` |
| `src/components/chat/SystemMessage.jsx` | `src/components/chat/systemMessage/` |
| `src/components/campaigns/mobile/MobileCampaignCreate.jsx` | `src/components/campaigns/mobile/campaignCreate/` |
| `src/pages/brand/BrandUGCMobile.jsx` | `src/pages/brand/brandUgc/` |
| `src/pages/creator/CreatorUGCMobile.jsx` | `src/pages/creator/creatorUgc/` |
| `src/pages/creator/ManageUGCOrdersView.jsx` | `src/pages/creator/manageUgc/` |
| `src/pages/brand/BrandUGCOrders.jsx` | `src/pages/brand/brandUgcOrders/` |

## Not split on purpose (backend money / UGC / server logic)
`backend/ugc_routes.ts`, `backend/server.ts`, `backend/payment_routes.ts`, `backend/campaign_lifecycle.ts`,
`backend/creators_routes.ts`. Dozens of safety tests read the exact text of these files (for example "every POST route
here checks the login", "recordAgreementSignature appears exactly twice"). Moving code out would hide it from those
checks or make them fail, and the project rule is never to edit those tests to make a change pass. Splitting them is a
job for a session where the tests run, with the tests moved together with the code and Ravi approving each file.

## Ybex Assist for brands (v301)
| What | Where |
|---|---|
| The bot (chat UI, all roles) | `src/components/feedback/FeedbackBot.jsx` — brands get the assistant, everyone keeps bug / idea reports |
| Brand brain (rules, maths, Hinglish) | `src/components/assist/brand/brandLogic.js` (pure, tested in `brandAssist.test.js`) |
| What to do with a message | `src/components/assist/brand/brain.js` |
| Data + drafts (existing calls only) | `src/components/assist/brand/tools.js` |
| Cards in the chat | `src/components/assist/brand/AssistCards.jsx` |
| AI route (Gemini, 30/day, brands only) | `backend/assist_routes.ts` → `POST /assist/ai` |
| Chat history + saved searches (phone side) | `src/components/assist/brand/memory.js` |
| Chat history, shared daily count, saved searches, 30-min new-creator push job | `backend/assist_store.ts` + `setupAssistDataRoutes` in `backend/assist_routes.ts`; tables in `scripts/sql/session52_assist.sql` |
| Saved creators + brand reviews (tables) | `backend/persistedLists.ts` (used by `creators_routes.ts` and `server.ts`) |

## Rule for new work
A new screen or a new section of a page goes in its own file in the page's section folder above. Keep page files as
the "wiring": state, data loading and which section shows.

## Session 53 (v303)
| What | Where |
|---|---|
| Eva (the green bot) — "How can I help?", top bar "Ybex Eva · BETA", ☰ menu (new / earlier chats) | `src/components/feedback/FeedbackBot.jsx` |
| Eva's chats on the server | `backend/assist_store.ts` (`listChats`, `history(brand, chat)`), `GET /assist/chats`, `src/components/assist/brand/memory.js` |
| Creator results in Eva ("Meet our creators" style) | `CreatorTile` / `Creators` in `src/components/assist/brand/AssistCards.jsx` |
| Admin → System Reports → User Reports tab | `src/components/admin/SystemReports.jsx` |
| Launch security guards (test) | `backend/session53Launch.test.ts` |

## Session 54 (v304) — Eva for creators
| What | Where |
|---|---|
| Creator brain (pure: intents, matching, rate, profile score, earnings, due, writing helpers) | `src/components/assist/creator/creatorLogic.js` (tested in `creatorAssist.test.js`) |
| What to do with a creator's message | `src/components/assist/creator/brain.js` |
| Data + the one send (campaign apply) | `src/components/assist/creator/tools.js` |
| Creator cards (opportunities + apply, profile, rate, earnings, brief, ideas, refer, share card…) | `src/components/assist/creator/CreatorCards.jsx` |
| Chat (both roles; loads brand or creator module) | `src/components/feedback/FeedbackBot.jsx` (`usesEva`, `CREATOR_CHIPS`) |
| Server: creator AI tasks, `GET /assist/creator/insights`, new-work alerts job | `backend/assist_routes.ts`, `backend/assist_store.ts` (`matchWork`, `buildInsights`) |

## Session 55 (v305) — landing page
- `src/pages/dashboard/Landing.jsx` — the website landing (phone first, app UI, only true content).
- `src/hooks/usePWAInstall.js` — one shared install popup, 8 s limit, returns accepted / dismissed / failed.
- `src/components/install/InstallAppButton.jsx` — Install button / bar; guide when the popup fails; `VITE_PLAY_STORE_URL`.
- `src/lib/externalLinks.js` — installed app: policy/help links open in Chrome (set up in `src/index.jsx`).
- UI rule: docs/code/ARCHITECTURE.md → "UI consistency (rule 87)".

## Session 56 (v306) — payment audit
- `backend/razorpayWebhook.ts` — webhook signature check + "which deal was paid" (route in `payment_routes.ts`).
- `backend/adminMoney.ts` — RELEASED (brand approved) is not "paid out"; refund-in-progress / not-funded blocks.
- `backend/paymentTestMode.ts` — live key = never test mode.
- `src/lib/razorpay.js` — resolves only when the payment window is done; ALREADY_PAID = success.
- `src/lib/briefPaymentRetry.js` — pending brief order recovery, tied to the user.

## Session 57 (v308) — Money screens (Ravi's design)
- `backend/creatorPayoutRequests.ts` — `POST /creator/payout-request-ready` (request all approved money).
- `backend/brandPayments.ts` — `GET /brand/payments-overview` (brand Payments list, refunds, summary).
- Screens: `CreatorEarningsMobile.jsx`, `BrandPaymentsMobile.jsx`, `ReferralHub.jsx` (creator + brand), `brand/ReferScreen.jsx`, `chat/mobile/MobileEscrowSheet.jsx`.

## Safety: report + block (v334 / v337)
- `src/components/safety/ReportUserLink.jsx` — "Report this profile" → POST /reports.
- `src/components/safety/BlockUserButton.jsx` — Block / Unblock (profiles + chat ☰ menu) and `BlockedPeopleList`
  (shown under Help & support). Server: `backend/blockUsers.ts` (table `blocked_users`; guards in front of the locked
  chat-send / invite / apply routes and filters on inbox / invitations / applicants — locked files untouched).
