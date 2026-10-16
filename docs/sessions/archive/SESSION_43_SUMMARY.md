# Ybex — Session 43 Summary (in progress)

**Latest:** `ybex-v292.zip` (= v291 + the v292 fixes below; line started from the original v262, not the AI Studio copy).
**State:** v290 was 1264 tests pass, tsc / crash guard / build clean. **v291 and v292 were NOT run** (no node_modules; npm registry blocked in those chats): on your computer run `npm install` (zip has no package-lock.json — commit the one it makes), then `npm run verify` and `npm run build`; fix anything they flag. Done instead: all 739 source files syntax-parsed (0 errors); the new splash run in headless Chromium.
**Database rule (91):** no new table / column / SQL.

## This chat at a glance (v279 → v284)
- v280: v279's new login was on the website "/" only; the installed app (start_url /app) kept the old
  screen → app welcome rebuilt. Demo buttons follow the server's DEMO_LOGIN (GET /api/auth/demo-enabled).
- v281: live address https://version80.ai.studio everywhere (TWA host, share links, og tags); TWA v1.0.1 / code 2.
- v282: website "/" keeps its own landing on phones; app login = Claude Design "Ybex Login" (4-slide
  carousel, photo role cards); splash = Claude Design "Ybex App Flow" (camera → flash → "Ybex."); email
  screen in the main bundle (no blank flash on tapping Creator).
- v283: Ravi's 14-point phone review (below).
- v284: Supabase free-plan quota ran out (egress 5.05/5 GB, log ingestion 6.21/1 GB) with no real users → fewer, lighter Supabase reads (below).
- Still on Ravi: deploy + reinstall on iPhone; Play signing SHA-256 + new AAB (code 2) + internal
  testing; VAPID keys and ADMIN_QUICK_PIN in server env; DB queue (30-day delete purge, brand coupons).

## What came from the AI Studio copy
Kept: Push screen — spinner on Send / Schedule, title / message / date checks with toasts, trimmed text,
in-app "Cancel Push" popup (Keep left, Cancel Push right), form clears + list refreshes. `.env.example` VAPID placeholders.

Not kept (on purpose):
- `push_routes.ts` isAdmin accepting `team_role` admin / owner / sub_admin — brand team members can hold
  team_role "admin", so they could have sent app-wide pushes. Back to `role === "admin" || is_admin`.
- VAPID keys written in code as a fallback (and in `.env`). Keys are env only. The AI Studio keypair is
  public now — never use it; generate a new one.
- Local `db_mock.json` fallbacks in `/admin/chart-data` and `fetchUserScopedTransactions` — production would
  show empty / wrong numbers instead of an error (same reason as Session 33).
- `package-lock.json` was missing from that zip — v263 has it.

## New in Session 43
- Push "Send now" asks first in an in-app popup ("Send now?" → Back / Send now), shows who gets it.
- `backend/session43PushGuard.test.ts` (3): push admin check has no team_role, no key in code, no browser confirm.

## App icon + splash (Claude Design "Ybex App Icon & Splash", turn 4)
- Icon 4a: purple tile (#9B00FF → #7E00DC → #6200B4 → #2E0066) with the white "Ybex." wordmark.
  `public/pwa-192x192.png`, `pwa-512x512.png` (rounded), `pwa-maskable-512x512.png` (full bleed, mark in the
  safe circle), `apple-touch-icon.png` (180, square — iPhone rounds it), `favicon.ico`, `icon.svg`.
  Made by `scripts/brand/generate_brand_assets.py` (cairosvg + Pillow) from the design's own vector wordmark.
- iPhone / iPad launch images: `public/splash/launch-WxH.png` (20 sizes, portrait), linked in `index.html`.
  They are the plain purple screen = first frame of the animation, so nothing jumps.
- Launch animation (installed app only, phones, once per app session): plain HTML/CSS in `index.html`
  (#yb-splash) so it plays while the app downloads — dot pops, rolls like a tyre with smoke, "Ybex" appears in
  its trail, shine, tagline "Where brands meet creators" (~2.1 s). Then `AppLaunchSplash.jsx` (after the login
  check) shrinks the purple into the home hero banner (`data-splash-target="hero"` on creator + brand mobile
  home) and fades to the real banner. No banner (welcome page / push deep link) → simple fade.
  Reduced motion → no movement. Safety: always gone by 10.5 s. Browser tabs + desktop: never shown
  (the old light ColdStartSplash stays for them).
- `StatusBarSync` re-reads the top colour when the splash leaves. Android launch colour `#7E00DC`
  (manifest + twa-manifest).
- Tests: `src/components/layout/launchSplash.test.js` (5).

## v265 — Ravi's phone test, part 1
- **OTP already filled in (app + website) — security hole, fixed.** The code was sent back to the browser
  whenever PAYMENT test mode was on, and payment test mode is on for every run.app deploy. So the live
  server gave out every signup / login / contract-signing code: anyone could log into any account with
  "Continue with OTP". New `backend/otpEcho.ts`: the code goes to the browser (or logs) only when
  `NODE_ENV` is not production (`npm start` sets production). Rule 9 updated. Payment test mode unchanged.
- **"One sec…" for 1–1.5 min after Allow:** saving the device waited for the service worker, which first
  downloads the whole app for offline use. Now the screen closes as soon as the phone's popup is answered;
  the save runs in the background and is retried on the next open. iPhone launch images are no longer in
  the offline download. Android phones that already gave permission (Play app asks at install) never
  see this screen — that is expected.
- "Missed Notifications" waits while the Allow screen is open.
- Creator home: heading "Best matches for your profile"; the list is now swipeable boxes (like brand
  templates), no auto-slide.
- Status bar: follows the top of the screen while scrolling (pinned header colour, else the page
  background — not the cards passing under it). Swiggy screenshot not received yet.
- Tests: `backend/session43Otp.test.ts` (3), `src/session43Fixes.test.js` (5); updated session20 / session33 /
  campaignRoutesAndOtp tests for the new OTP rule.

## v266 — batch 1 + 2 of Ravi's big list
- Security: brand team "admin"/"owner" never counts as Ybex staff (auth, server, notifications, support,
  market intelligence, speed report, home picks, push, App.jsx, AdminLogin). Brand team can't be given "admin".
- App login: unverified accounts are accounts (OTP login verifies the email). Admin email on the
  Creator / Brand card → "This is a Ybex admin account"; server refuses app logins into admin accounts.
- "You're signing in / up as a Creator" line instead of the sparkle chip; sparkle icons removed for users.
- Desktop-experience popup deleted. Onboarding: a progress-save hiccup no longer blocks the next screen.
- Admin: Search Intelligence removed. App Version Updates removed; What's new is in Platform Settings.
- Pages open at the top also when ?section= / subscreen / tab / view changes.
- Status bar (option a): always #6200B4, white clock (iPhone black-translucent + #yb-statusbar strip,
  #root below it); Android theme-color + manifests. Users must re-add the iPhone app.
- Quick actions: creator Refer & Earn · Share profile · My orders · Earnings; brand "New campaign".
- Best matches: % only when 2+ parts compared.

## v267 — batch 3
- Explore: creators created from 10 Oct 2026 show only after waitlist approval (`backend/exploreGate.ts`,
  applied in server.ts on GET /api/creators/explore because creators_routes.ts is locked). Older ones stay.
- OTP code first in every code email subject (login, signup verify, resend, password reset, contract sign).
- Creator payout card: "You receive in your bank ₹net" + "Deal ₹X − Ybex fee ₹Y" from the recorded
  transaction; brand side unchanged.
- Admin on phone: 5th tab "More" (all sections + Log out). Desktop Explore uses the full width.
- Android WebView wrappers treated as in-app browsers (install guide says open in Chrome).
- iOS adds "from Ybex" under web-push titles itself — not in our payload, can't be removed.

## v268 — batch 4
- Mobile Explore: place search ("Jaipur creators", "Faridabad") — that city first, else creators within
  50 km (then 100 km), "18 km from Faridabad" on each card, a note on top (`src/lib/indiaCities.js`, fixed
  list, no DB). Cards = desktop details: name, followers, primary niche only, city, avg reach; no Verified, no rate.
- Rating sheet: partner's real logo, gold rounded stars with bigger tap area.
- Live links: real Instagram / YouTube / Facebook / LinkedIn / X mark from the link; fake sample link removed.
- Draft videos: the phone's own full-screen player is blocked so the Ybex watermark always shows.
- Creator info: profile photo / cover saved right after upload (Save not needed); cover field name fixed;
  design notes that leaked onto the screen removed.

## v269 — status bar, Ravi's correction (replaces v266 option a)
- Not one fixed purple strip. iPhone back to `default` (dark clock); the bar takes each page's top colour
  (StatusBarSync: route change + scroll). A header can name its colour with `data-statusbar`.
- Creator + brand dashboard header: darker lavender at the top (#D6C3FF) fading to light, and the same
  colour continues up behind the clock (Zepto / Hopr style). Other pages: their own colour (white etc.).
- Purple strip, #root padding and full-height overrides removed. Manifest theme colour #DCCBFF.
  iPhone: remove + re-add the app (the bar style is read only when it's added).

## v270 — batch 5
- Chat: my offer is the latest → footer "Waiting for response" (like desktop); theirs → "Respond to offer"
  opens a bottom sheet (Accept ₹X / Negotiate → counter price) — `MobileRespondOfferSheet.jsx`. No full page.
- Android keyboard shake: keyboardAware.js scrolled the field into view on every viewport scroll (a loop).
  Now once per focus, updates batched per frame, CSS vars written only on change.
- Push to Android: phones subscribed under an old server key re-subscribe automatically; pushes sent with
  urgency "high"; 403 (old key) subscriptions removed.
- Desktop Explore: same place search as mobile, "18 km from Faridabad" on the card.

## v271 — Ravi's phone list (33 points)
- Security: home-banner routes (`admin_content_routes.ts`) and `/admin/notifications/send` no longer accept a
  brand-team `team_role "admin"` — staff only (`isAdminStaff` / role admin). Debug log removed.
- Payout receipt (creator, mobile): until the UTR is posted everything is yellow "Transfer pending" + "reaches your
  bank in 1–2 working days"; UTR box says it will show once the money arrives; Copy disabled; Destination / IFSC /
  Channel / date only after the UTR. Hardcoded HDFC0001234 and the fake date are gone (real `bank_ifsc`, UPI → no
  IFSC). "Convenience fee & TDS" (also on the transfer receipt, which now says "Net payout to creator").
- Quick action sheet: green gradient dark → light; big amount; details list (campaign, deliverables, timeline,
  invited on), description and message; brand side shows quote / followers / niche.
- Explore UGC: real brand logos (`components/common/BrandLogo.jsx`, falls back to the letter); black NEW removed;
  small shining NEW on the delivery chip. Same logos on every Manage-orders card and brief details.
- UGC deadline: the green dot is now a small clock with turning hands (card + order page).
- Status bar: toasts never colour it (the green bar in chat); see-through popup backdrops are blended, not
  read as near-black; re-checked every 0.7 s so pages that load late (Manage orders) get their real colour.
- Chat (UGC + campaign): "Draft approved" box has its own Submit live link button (creator). "Agreement executed"
  is a centred line ("Both parties have now signed the ₹X agreement…"), no box. Creator declining live-link
  changes is a card: brand gets Contact support / Re-request changes / Approve last live link, creator a turning
  "Waiting for the brand to respond…".
- UGC order page ↔ chat: reads the server's own resolved stage (COMPLETED_APPROVAL, LIVE_LINK_SUBMITTED, …). After
  the draft is approved it shows "Submit live link" (opens the chat sheet) instead of the video upload; quiet
  refresh every 30 s / on deal events with the same GET calls. No new server call (locked flow).
- Support tickets: real top bar (back, title, New); empty page shows help topics and one-tap ticket reasons.
- Android keyboard shake (contract OTP sheet): `interactive-widget=resizes-content` in index.html so Android shrinks
  the page itself; keyboardAware sets --kb 0 then and ignores < 24 px changes (the lift ↔ scroll loop is gone).
- Push: promo daily limit removed (Ravi approved in writing; `push.test.ts` updated to the new rule). Send now tells
  the admin audience / devices / why 0 phones; the list marks 0-phone pushes.
- Permission screen: new copy both roles + three "what you get" rows, button "Turn on notifications". Shown to every
  signed-in creator / brand outside onboarding (brands who chose "finish later" were never asked → 0 brand phones).
- Notifications page (mobile): "Allow notifications" button only when not allowed → opens the same screen; if the
  phone blocked it, the screen explains Settings; iPhone Safari tab → "Add to Home Screen" help.
- Tests: `src/session43V271.test.js` (9).

## v272 — Ravi's list 34–58
- iPhone "from Ybex" under push titles: added by iOS to every web-app push; only a native App Store app removes it.
- Creator code: removed from the agreement (mobile sheet + desktop). New `components/referral/CreatorCodeDealCard.jsx`
  in the chat, creator only, after both signed and before the brand pays (fee is fixed at payment). Look from Ravi's
  Refer & Earn reference. Applied code → "you save ₹X". The "0 deals / ₹0" referral block is gone from this flow.
- Phone number in pieces ("Reach me at 931" / "509" / "9117"): `contactSecurityFilter.ts` buffers the number at the
  END of a sentence too, more contact words; new `splitNumberAcrossMessages` (whole pieces, prices excluded) used by
  mobile + desktop chat against the chat's own history (works across server instances). Server keeps its check.
- Admin payout (mobile): same "paid" rule as the server (`isPaidOut`), so paid payouts leave "Ready to release";
  an ALREADY_PAID answer moves the row out. Real UPI QR (`qrcode.react`) only from the registered UPI ID + exact net
  amount; no valid UPI ID → no QR. UPI app buttons use the same link.
- "Waiting signature" after signing: mobile shows "You've signed this agreement" (no sign + OTP sheet); desktop a toast.
- Earnings deal sheet: brand logo + name (it showed the creator), real dates only, "Add a payout account" when none.
- Share previews: `public/og-image.jpg` (1200×630, `scripts/brand/generate_share_image.py`) + og/twitter tags.
  JPG on purpose: not in the offline download list.
- Shared links (invite, referral, profile, campaign, install) use `src/lib/publicUrl.js` → VITE_PUBLIC_SITE_URL,
  default https://ybex.in — never the test address.
- Brand Explore (mobile): profile circle removed; only the first niche; long city truncates, no clash with reach.
- Notifications: every row opens a page (`resolveNotificationTarget`); "Notification" titles get real ones.
- Chat reopening by itself (Ravi's two videos): back from a chat opened at /chat/<id> now goes to the plain inbox
  address; refresh / 30 s poll no longer reopen it.
- Long unbroken text wraps inside chat cards (creator's note).
- Handshake cards: the picture from Ravi's "Handshake Cards" file (`public/img/handshake.webp`), design's layout.
- Chat ☰ menu: the tap-outside layer could stay after closing and eat every tap ("freeze"). Menu now in <body>,
  layer exists only while open, closes on back. "**Section 10A**" shows bold. "Contact Details" → "Partner details",
  no Instagram handle.
- Tests: `src/session43V272.test.js` (9).

## v274 — Ravi's list 59–79
- Policies (Terms / Refund / Privacy) on phones: plain reading page with back + title; no landing layout, no bar.
- Bottom bar: brands now also only on main pages (`isBrandNavPage`): Dashboard, Explore list, Manage lists, Inbox,
  Brand. Not on creator profiles (Invite bar clash), wizards, order details, policies. Brand "Good morning" strip gone.
- Brand Campaigns page redesigned: header + summary + "New" (floating + removed — it covered "Review"), padding,
  clearer cards (Edit / Launch on drafts, "Under review · usually 2–3 hours").
- Chat: "payment funded" card shown once (mobile + desktop); creator photo field in the header.
- Brand pay sheet is a "Review & pay" step (campaign, creator, total, protections) before Razorpay.
  Brand coupon codes need a DB change → PENDING_DB_CHANGES.md.
- Draft video: phone fullscreen blocked for drafts (watermark always on); creator notes only when typed (no file
  name / system text); "Request changes" opens "What should change?" directly; live-link tips for link changes.
- Invoice fits Android screens and scrolls.
- Campaign create: real brand logo; `CreatorMatchStrip` = real matching creators (count + photos from Explore list,
  no made-up 142); published screen shows "In review (2–3 h)" or "Live", no fake "creators reached".
- UGC brief preview: the creator's Explore card + "You pay now" summary (no black mock).
- Brand UGC order: the uploaded draft plays inline with the watermark (was "Open Cloud Link").
- index.html: quiet stand-in for the dev-only "vite-hmr" socket (AI Studio fix); other sockets untouched.
- Not done: applicant faces on creator campaign cards — needs `campaigns_routes.ts` (locked) to send photos, and
  showing other applicants to a creator is a privacy question. Ravi to decide.
- Tests: `src/session43V274.test.js` (9).

## v284 — Supabase quota (egress / log ingestion) — Ravi
Another chat looked at Supabase from the outside and blamed the server's notifications poll. From the code,
that poll is small; the heavy readers were:
- **Inbox** (`/chat/v2/threads`, polled by several screens): 2 Supabase requests per thread (last 60
  messages, every column + a separate count) and full `select('*')` user / profile rows just for a name
  and a photo. 20 threads ≈ 40 requests + log lines per load, every 20–45 s on every open screen.
- **Hidden tabs / apps** kept every timer running all day.
- **Videos**: every view got a new signed link, so the phone re-downloaded the whole file each time.
- **Server start**: one `ugc_orders` count per brief on every start (the 872 HEAD requests).

Fixes (no locked file touched, no DB change, same answers to the screens):
- `src/lib/api.js`: a GET asked while the page is hidden waits until it is visible; repeats of the same
  URL become one request. POST/PUT/DELETE never held. `{ allowWhileHidden: true }` opts out.
- New `backend/inboxLean.ts` (used by `populateThreadData` in server.ts): profiles read only
  name / picture columns; message window = one request per thread (rows + exact count together) with light
  columns, and ONE batched read for each thread's full last message. A missing column is dropped once and
  remembered; any other error → the old full read.
- `/api/media`: a signed link is reused for 5 min (of its 15) so the phone's cache can serve repeat plays.
  Access is still checked on every request; a player retry (`_r`) always gets a fresh link.
- Push loop: wakes every 60 s (was 20 s); every notification insert kicks it, so pushes still go out in ~2 s.
- Startup brief check: order counts read once in pages of 1000 (was one request per brief).
- Not done: upload size limit / compression for videos (upload screens + content_submissions_routes are
  locked — needs Ravi's OK). Uploads cost storage, not egress.
- **Pre-existing bug, NOT changed (Ravi to decide):** the startup check sets `ugc_briefs.claimed_count` to
  ALL orders of the brief, cancelled ones included. A creator cancel relists the slot by lowering the count
  (`ugcSlots.ts`), so after any server restart that slot is taken again.
- Tests: `backend/session43Egress.test.ts` (7), `src/lib/apiHiddenGate.test.js` (3).
- After deploy: watch Supabase → Usage per day for 2–3 days. Egress quota resets with the billing cycle.

## v283 — Ravi's phone review (14 points)
- **Offers & promotions ON by default** (no saved choice = on; switching off is saved). Terms text
  updated, Terms **v1.2** (front + backend) → everyone re-accepts once. DPDP: default-on marketing
  consent is weak — CA/lawyer to confirm before launch.
- **Campaign detail brand logo**: real logo (`BrandLogo`). `BrandLogo` now fills the tile
  (object-cover) and accepts `logo` as well as `src`.
- **Status bar**: every screenshot showed the strip = body grey (#F2F2F7) → iOS 26 paints it from
  <body>. `applyStatusBarColor` now paints body too; page base colour read from --bg-base (no loop).
  Needs a real-iPhone check after deploy.
- **Social platforms**: "+ Add" bounced to the hub because `platform_<id>` was not in the screen list
  (`isMobileScreen` in CreatorSettings). The screen also read/saved a `socialLinks` object nobody stores
  → now real fields (socials[], Instagram numbers, YouTube subscribers + avg views → youtube_subscribers /
  youtube_avg_views).
- **Creator info location**: `LocationAutocomplete` (same as desktop).
- **Finish (complete profile)**: sheet with Photo / Niche & bio / Instagram-YouTube / Rate card / Past
  work / KYC, each Done or Add → exact screen; ring % from the same list.
- **Quick actions**: My orders · Refer & Earn · Earnings · Media kit ("Share profile" renamed).
- **NEW badge** on every 24h-delivery chip (creator UGC, browse, brand preview).
- **Logo crop**: `LogoCropper` (drag + zoom → 512×512 PNG, "Use as is", Cancel) in brand onboarding
  mobile + desktop and mobile brand profile. Not yet in desktop BrandSettings' generic image modal.
- **KYC Resubmit** top-right on creator "Creator verification" and brand "Verification" (approved or
  submitted). Resubmitting sends KYC back to review.
- **Earnings**: "Payouts go to" card removed; small "→ UPI/bank" line beside "Total paid to your bank";
  dashed "Add a payout account" card stays when none is set.
- **Chat "You're in 🎉" flash**: skeleton until messages arrive; fallback card only for new / empty
  threads (2.5 s window, no last_message) or a load error. Done in ChatBoxMobile — useChatThreadMobile
  is a locked file and was left untouched.
- **Android opening screen**: `public/twa-splash-512.png` (white "Ybex." on transparent, on purple
  #7E00DC); twa-manifest iconUrl → it. Shows only after a new AAB. Pre-Android-8 launchers would also use it.
- Tests: `src/session43V283.test.jsx` (13); earningsRedesign + termsVersion updated. 23 notification/push
  test files pass (real pushes need VAPID keys). Headless phone smoke of 8 pages: no errors.

## v282 — Ravi's screen recordings: website lost its landing, wrong login + splash, "crash" on Creator
- **Website "/" on phones** showed the app login hero on top (v279). Removed: `Landing.jsx` is back to
  `<Hero />` for every width. The app-style login exists only inside the installed app (/app).
- **App login = Claude Design "Ybex Login"** (`src/components/app/AppLoginScreen.jsx`): 4-slide auto
  carousel (3.5 s, loop, dots, swipe) — creator card / Diwali campaign / contract signed / wefrnd case
  study — and photo role cards. Images in `public/app-login/*.webp` (from the design bundle). No header
  "Log in" button (the email screen handles existing accounts). Wording kept "Secure payment hold".
  `LandingMobileHero` deleted.
- **Splash = Claude Design "Ybex App Flow"** (index.html #yb-splash): camera pops in (inline webp),
  swings, flashes, the flash becomes the dot of "Ybex.", shine; ready at 1300 ms. Logged out → purple
  slides up (`exit(null,"up")`, event `ybex:splash-up`) and the login screen drops in (yb-drop) with
  cards rising. Logged in → shrinks into the home banner as before (word scales .5 and fades).
- **"Crash" on tapping Creator** in the recording was a blank frame while the email screen's file
  loaded. `AppContinue` now ships in the main bundle (Login already did) → opens instantly.
- Headless phone run (390x844, installed-app mode, production build): splash → login → Creator → email,
  no page errors. Tests: `appWelcomeHero.test.jsx` rewritten (6), `launchSplash.test.js` updated.

## v281 — live address is now https://version80.ai.studio (Ravi)
- `twa-manifest.json` host → version80.ai.studio, appVersionCode 2 / 1.0.1 (Play needs a higher code).
- `src/lib/publicUrl.js` default + og / twitter URLs in index.html → version80.ai.studio.
- Still to do for the Play app: rebuild the AAB with Bubblewrap, check
  https://version80.ai.studio/.well-known/assetlinks.json opens, and make sure its SHA-256 includes the
  Play App Signing key (Play Console → App integrity). Wrong / missing key = the app shows a browser bar.

## v280 — Ravi: "same old login, same old splash, no demo"
- **Real bug in v279:** the new hero was put on the website's "/" only. The installed app starts at `/app`
  (manifest start_url) and "/" itself redirects the app to `/app` → `AppWelcome` (old "Brand deals, done
  properly" + "Escrow-protected payments"). So the phone could never show it. Now `AppWelcome` renders
  `LandingMobileHero inApp` (all widths; Creator / Brand / Log in → `/app/continue/:role`, the app's own
  email screen, which already sorts out "this email is the other role"). Loading state is purple (#7E00DC).
- **Demo access:** v277 tied the buttons to `import.meta.env.DEV`, so they were gone from every deployed
  build, even a test server. Now `GET /api/auth/demo-enabled` → `{enabled}` from the server's DEMO_LOGIN, and
  `useDemoLogin()` shows the buttons (Login page + a small "Demo access (test server)" link on the app
  welcome → /login?demo=1) only when it is on. Public server stays DEMO_LOGIN=false → nothing shows.
- **Android Play app looked old because of the TWA, not the code:** `twa-manifest.json` host is still the
  old run.app preview, and reinstalling from Play gives the same old APK. Needs host change + new AAB.
- Tests: `src/pages/app/appWelcomeHero.test.jsx` (4); `session43Batch2` demo test updated.

## v279 — mobile landing redesign + splash fixes (Batch 2, Ravi)
- **New mobile entry screen** (`src/components/landing/LandingMobileHero.jsx`) from Ravi's design: purple
  hero with "Ybex." + Log in, headline "Hire creators. Pay only on delivery.", a live "Diwali Glow
  Campaign" card (creator rows + statuses), a ₹45,000 "Held safely till approval" chip, and two role
  cards (I'm a Creator / I'm a Brand) + a "Secure payment hold · Legal contracts" trust line. One
  orchestrated load animation (reduced-motion safe). Shown on mobile only; the desktop Landing hero is
  unchanged (`hidden md:block`). Fixes from review: wording is "Secure payment hold" (never "escrow"),
  both role cards are lavender (no blue), the chip is brighter, and the hero sets the status bar purple.
- **Splash:** installed-app first paint is now purple (`@media (display-mode: standalone)` in index.html)
  so there is no blank flash before the launch animation on iPhone and no colour jump on Android. TWA
  `splashScreenFadeOutDuration` lowered to 200; native splash background stays purple (#7E00DC) so it
  blends into the web animation.
  - **Still needs a real phone + a TWA rebuild (can't verify here):** the Android 12+ system splash
    shows the app icon briefly — it can't be removed, only matched (purple bg + the Ybex icon). The
    purple bottom-nav-bar some phones show during the splash is TWA/nav-bar behaviour; verify after the
    rebuild. Also `twa-manifest.json` `host` is still the old preview URL — it must be changed to the
    final domain before building the AAB (then re-add the Play signing SHA-256 to assetlinks.json).
- Tests: `src/components/landing/landingMobileHero.test.jsx` (7).

### Database — one change queued (see SUPABASE_PROMPT.md)
`users.deletion_requested_at` + `users.deletion_reason` (nullable) to enable the 30-day purge +
countdown + self-serve recovery for Delete account. A ready, safe, idempotent prompt is in
`SUPABASE_PROMPT.md` (outputs). Deletion already works today via `is_deleted`.

## v278 — Account section + Delete account (Batch 1, Ravi)
- **New `backend/account_routes.ts`** (registered in server.ts): `GET /account/overview` (email + phone),
  `POST /account/phone` (instant, no OTP, 10-digit check), `POST /account/email/send-otp` +
  `/account/email/verify` (change email, OTP to the NEW address), `GET /account/delete/preflight`
  (blocks when a deal is live or money is on hold, via the existing `activeMoney` helper),
  `POST /account/delete/send-otp` + `/account/delete/confirm` (OTP → soft-delete `is_deleted`, end
  sessions). Payment / invoice records (`transactions`) are never touched. Confirm best-effort stamps
  `deletion_requested_at` for the future purge job.
- **`AccountPanel`** (`src/components/account/AccountPanel.jsx`): Settings → Account — Login details
  (email change via OTP, phone change instant), Devices & sessions + Privacy & terms rows, and the
  Delete account flow (what's removed / kept, 30-day recovery note, active-money block, OTP, red
  confirm). Creator and brand mobile profiles now show a single **Account** row (replacing the separate
  Device sessions / Privacy & terms rows) that opens it.
- **Public `/delete-account` page** (`src/pages/legal/DeleteAccount.jsx`) for the Play Console
  "Data deletion" link: explains how to delete, what's removed / kept; logged-in users can delete there.
- **Privacy policy** now describes self-serve deletion (Settings → Account → Delete account /
  ybexmedia.in/delete-account), the 30-day recovery window, and retention of payment records.
- **PENDING_DB_CHANGES.md:** to enable 30-day auto-purge + precise countdown + self-serve recovery, add
  `users.deletion_requested_at timestamptz` + `users.deletion_reason text` and a daily purge job. The
  flow works today via `is_deleted` (hidden + login blocked, like the admin bin; recovery via support).
- Tests: `src/session43Batch3.test.js` (10), `src/components/account/accountPanel.test.jsx` (5).

### Still queued — Batch 2 (login + splash)
Login screen redesign (from the screenshot; wording "Escrow-protected payments" → "secure payment hold",
Brand card lavender not blue, brighter ₹45,000 chip) and the splash fix (Android app-icon splash +
purple bottom bar; iOS ~0.12s blank) with twa-manifest + matching launch images — needs a real phone to
verify. Plus more in-app page transitions, VAPID keys, Play steps, domain + Play account decisions.

## v277 — profile clean-up, onboarding slide, demo off, hidden admin entry (Ravi)
- **Profile page (mobile, creator + brand) made clean & simple, Switch-style.** Removed the Profile
  strength card, every grey sub-line under a row title, and every trailing value / badge
  (Add details, 0 connected, ₹1,680, 0 items, N joined, N active, KYC badge). Rows are now just a big
  title + icon + chevron. Titles bumped to 15px. Creator's unused profile-strength calc removed.
- **Onboarding steps slide + fade in** instead of jumping (creator + brand mobile). New `.yb-step-in`
  keyframe in index.css (opacity + transform only, reduced-motion safe); the step wrapper is keyed by
  `screen` so it replays each step.
- **Demo / bypass logins OFF for the public app.** Root `server.ts` default is now `DEMO_LOGIN=false`
  (was true) — set `DEMO_LOGIN=true` only on a test server. The "Direct Demo Access" buttons on the
  login screen now render only in local dev (`import.meta.env.DEV`), never in the built app.
- **Hidden quick-admin entry at `/admin/ybx`** (not linked anywhere): tap the Ybex mark 6 times → a PIN
  box. The PIN rides inside the admin token (`dev_bypass_admin|<pin>`) and is checked on the server in
  constant time against env `ADMIN_QUICK_PIN` (unset or <6 chars = door stays shut). This is independent
  of DEMO_LOGIN, so it works in production with demo off. Normal admin login is unchanged.
  → To use: set `ADMIN_QUICK_PIN=<a strong 6+ char pin>` in the live server env.
- Tests: `src/session43Batch2.test.js` (10), `src/pages/admin/adminQuickEntry.test.jsx` (4).

### Still queued for Play launch (discussed, not yet built)
- **Splash fix (needs device testing):** Android TWA shows the app-icon splash (Ravi's "bekar logo",
  screenshot) + a purple bottom nav bar on some phones; iOS shows a ~0.12s blank purple before the
  animation. Plan: match the native TWA splash to the web animation's first frame (purple bg + Ybex
  mark), set `navigationBarColor` so the bottom bar isn't purple, drop `splashScreenFadeOutDuration`,
  and show the web splash's frame-0 via `@media (display-mode: standalone)` so there's no gap. Twa-manifest
  edits + matching launch-image assets; must be tested on a real phone.
- **Login screen redesign** from Ravi's design (build from the screenshot; the uploaded HTML is a 1MB
  AI-Studio bundle, not reusable). Also fix "Escrow-protected payments" → "secure payment hold" wording,
  make the Brand card lavender (not blue), brighten the ₹45,000 chip.
- **More in-app page/tab transitions** (carefully, so smoothness holds).
- **Account section + Delete account** (launch blocker): Settings → Account with login details
  (phone change instant, email change via OTP), devices & sessions, privacy & terms, and Delete account
  (OTP confirm, 30-day grace, blocked while a deal is live or money is on hold; keep payment/invoice
  records). Plus a `/delete-account` web page for the Play Console link. Privacy policy has NO deletion /
  retention wording yet and there is no `/delete-account` route — both to be added here. May need a DB
  column for the delete-request date → will go in PENDING_DB_CHANGES.md first.
- **VAPID keys** (push), Play Console steps, domain + Play account decisions.

## v276 — scroll lag / stuck / reversed (Ravi)
Ravi: scrolling down suddenly lags, then sticks; the whole page moves instead of the content; sometimes
down scrolls up and up scrolls down. Three causes, all fixed:
- **Two scrollers.** The app shell was 100vh, taller than the visible phone screen, so the document scrolled
  too (header + bottom bar moved, the browser bar hid / showed and resized the page mid-swipe). Shell is now
  `.app-shell` = 100dvh; while it is on screen html/body don't scroll; `#app-scroll-container` has
  `overscroll-behavior-y: contain`. Phones without dvh keep the old h-screen (fallback in `@supports`).
- **Pull-to-refresh (Home pages, campaigns list) fought the page scroll.** React's touchmove is passive, so its
  preventDefault never worked; touch-action became "none" for the whole refresh (page frozen); touch +
  pointer handlers both ran. Now native non-passive touch listeners, touch-action always pan-y, starts only
  at scrollTop 0 after 8 px clearly downward, pointer = mouse only. Same look and refresh calls.
- **StatusBarSync** read the colour under the clock on every scroll frame (forces a re-measure) → at most
  every 150 ms + once when the scroll stops.
- Tests: `src/session43Scroll.test.jsx` (6).

## v275 — Earnings page, Ravi's design (Earnings_dc.html)
- Mobile Earnings (`CreatorEarningsMobile.jsx`) in the new look: white header "Earnings" + KYC line + settings
  button (opens the payout account sheet); purple card "Total paid to your bank" + "₹X in the last 28 days" and two
  tiles "In secure hold" / "Ready to disburse"; "Payouts go to" card with Change (or "Add a payout account");
  "Have a creator code?" card; "Deal payments" with All · In hold · Ready and one list (brand logo, deal · date,
  amount, In hold / Ready / Requested / Paid). Empty list → 3 steps + "Find deals" (/campaigns).
- Same numbers and calls as before. Design sample text left out: "Next payout in 2 days" (no such data — tile says
  "Tap a Ready deal to get paid" / "After the brand approves"), "HDFC Bank" (we only have the last 4 digits / UPI ID),
  "Released automatically" (finance sends it → "Ybex sends it to your bank / UPI"), the code "Remove" button (the
  server has no remove call).
- Taps: In hold → deal steps sheet, Ready → the per-deal payout request sheet, Paid → receipt (all unchanged).
- Fixes: a deal already in the payout queue was listed twice (in hold + ready) — now once, as Ready; hold tile =
  unpaid − ready. The old "In secure payment hold" filter never worked (left over from the escrow rename).
  A queued deal with no server net amount shows no amount (was ₹0).
- New `components/payments/CreatorCodeCard.jsx` (same GET/POST `creator/coupon` as before). Desktop Earnings and
  the desktop promo box are unchanged.
- Tests: `src/components/payments/earningsRedesign.test.jsx` (5).

## v273 — live address
- Ravi: the live app is **https://version270.ai.studio** (not ybex.in). Shared links use the address the app is
  open on (VITE_PUBLIC_SITE_URL overrides it for an own domain later); og/twitter preview URLs point to
  version270.ai.studio. When the domain changes: set VITE_PUBLIC_SITE_URL + change the URLs in index.html.

## Ravi — check after deploy (v276)
1. iPhone app + Android Chrome: scroll long pages (Home, Explore, Earnings) fast up and down — no lag, no
   sticking, header and bottom bar stay put, direction never flips.
2. Home: pull down at the very top → refresh still works; a normal scroll never starts it.
3. Typing in a search field / chat still works (keyboard).

## Ravi — check after deploy (v272/v273)
1. Share an invite on WhatsApp → preview shows the purple Ybex picture.
2. Chat: "Reach me at 931" → "509" → "9117" — the third is blocked.
3. Admin payout on phone: paid ones under Transferred; QR scans to the creator's UPI ID with the right amount.
4. Chat ☰ opens on the first tap, every time.

## Ravi — test on the phone (v271)
1. iPhone: delete the Ybex app from the home screen and add it again (old installs keep the white-clock bar).
2. Android: open the contract OTP sheet and type — no shaking. Also check other sheets with typing.
3. Brands: log in on a phone → permission screen should now appear.
4. Admin → Push → Send now: the toast says how many phones and why 0.

## Still open
E11 inbox tap, E12 invite quick-action popup, D (waitlist gate, location search, mobile cards), R (Explore
grid), H (Earnings — mobile redesign done in v275; desktop not changed), Q (admin mobile), B5, F (keyboard jitter), I (Samsung hint), L (no footer in chat).

## Ravi — to do
0. (v292) Run `npm install` → `npm run verify` → `npm run build`; commit package-lock.json. Rebuild the Play AAB for host vibexapp.ai.studio (new icon / splash show only then), put its assetlinks.json + Play signing SHA-256 live. Check on a real iPhone: launch image → intro has no flash and both logos match.
1. New VAPID keys on your own computer: `npx web-push generate-vapid-keys`. Put VAPID_PUBLIC_KEY,
   VAPID_PRIVATE_KEY, VAPID_SUBJECT=mailto:support@ybex.in in the server env (not in chat, not in code).
2. Deploy v263 (`npm ci`). Admin → Push: banner gone, Send now → popup → Send now.
3. Phone test (v292) — new icon, launch image, intro: **delete the old Ybex app from the home screen and add it again**
   (iPhone saves the icon and launch image only when you add it). Open → purple → dot rolls → "Ybex." →
   shine → shrinks into the home banner. Android Play app (TWA): icon changes only with a new APK build.
4. Still pending from Session 42: phone tests (section 1), Claude Design icons / splash.

## Security note (Session 41 → closed in v266 / v271)
Brand team members can no longer be given team_role "admin" (v266), and every admin check that accepted it has been
changed (v266 + the banner / admin-notification routes in v271).

## v285 — notifications on first open, before login (Ravi)
Ravi: "app install karke login nahi kiya, phir bhi notifications aane chahiye; onboarding ke baad
allow karwana bahut lamba hai".
- `PushPermissionScreen`: in the installed app (Play Store / Home Screen, `isStandalone()`), a person who
  is not signed in now gets the "Turn on notifications" screen on the first open (/app, /, /login, /signup),
  ~2.8 s after launch so the splash finishes. Guest copy: "Don't miss paid collabs". Never on the website.
  Signed-in behaviour unchanged. "Not now" → asked again after 3 days (same as before).
- `push_routes.ts`: `/push/subscribe` works without login → phone saved with `user_id = "guest"` (column is
  text — no DB change). Only real push services accepted, 20 guest saves / IP / hour. A guest save never
  takes a phone away from an account; on sign-in the normal save moves the phone to the real account.
- Admin → Push: "Everyone" now includes not-signed-up phones; new audience "Installed the app, not signed up yet".
- Tests: `backend/session43V285Push.test.ts` (5). Full suite 1219 pass, tsc clean, build OK.
- Domain: `publicOrigin()` already follows the address the app is open on. When the ai.studio name changes,
  update `PUBLIC_SITE_URL` in `src/lib/publicUrl.js`, the og tags in `index.html` and `twa-manifest.json` host.

## v286 — Ravi's phone list (launch speed, status bar, login, crop, small fixes)
- Launch: Google Fonts no longer block the first paint (preload + media="print" swap). In-app splash starts
  with "Ybex." already on screen (class `st`), one shine, ready at 650 ms (was a 1.3 s camera intro; its
  11 KB inline picture removed). All 20 iPhone launch images now show the white wordmark in the exact
  splash position (iOS caches them — re-add the app to the Home Screen to see the new one).
- Status bar: html/body are splash purple in the installed app; StatusBarSync keeps the strip #9B00FF while
  #yb-splash is up (iOS 26 paints the strip from <body>). Dashboard headers (brand + creator): top 28px
  are exactly #D6C3FF and the glow starts lower → no seam under the clock.
- Android icons (pwa-512, pwa-192, maskable): flat #7E00DC + white "Ybex." — same colour as the manifest
  background, so the Android splash shows only the logo (no gradient box).
- KYC PENDING badge red (brand); creator "KYC pending" line red.
- Meet the Creators: shared rule `src/lib/visibleCreators.js` (Explore + dashboard). The direct
  creator_profiles fallback (showed unapproved / Developer Bypass) is removed.
- Trust line (both panels): only the green line, centred.
- Complete profile: brand card names only empty fields (logo / brand name / category / website);
  creatorProfileStrength reads primary_niche, story_rate, youtube_video_rate, ig_followers, youtube_channel_url.
- Creator profile (brand view): footer portalled to <body> (transform parent made "fixed" float mid-page).
- Brand signup (AppContinue) asks "Your full name" → representative name; brand name stays in onboarding.
- What's New: only updates published after the account was created (`onlyAfterJoin`).
- LogoCropper: pinch zoom, purple zoom track with −/+ buttons, wheel zoom; circle mode for creator photos
  (CreatorOnboardingMobile photo step, CreatorMobileProfile avatar).
- Google / Apple sign-in: `backend/oauth_routes.ts` (same-window redirect, signed state, Apple id_token
  checked with Apple's keys, users + user_sessions in Supabase like e-mail login) → `/app/oauth`
  (`AppOAuthDone.jsx`). AppContinue: Google for everyone, Apple only on iPhone/iPad.
  Needs: Google redirect URI `/api/auth/oauth/google/callback`, Apple Services ID with return URL
  `/api/auth/oauth/apple/callback`, env APPLE_CLIENT_ID. The old pop-up /auth/google flow saved new users
  only in the local JSON db — left untouched for the website, not used by the app.
- Tests: backend/session43V286.test.ts (9), src/session43V286.test.js (3). Two older UI tests updated to
  Ravi's v286 requests (header gradient string, splash timing). Full suite 1231 pass, tsc clean, build OK.
- No database changes.

## v287 — "Ybex Assist" feedback bot (Claude Design Turn 27, Purple theme, Lime ball)
- `src/components/feedback/FeedbackBot.jsx` on BrandHomeMobile + CreatorHomeMobile (portal on <body>).
  Exact design values: peek translateX(30px) rotate(-14deg) .75s cubic-bezier(.34,1.56,.64,1); bubble at
  +650 ms, scale .4→1 .42s, typing dots only, fades after 9 s; tap → 170 ms squash (1.14×0.9) → circle
  reveal .62s cubic-bezier(.65,0,.35,1) from the bot's centre; greeting fade-up .3s delay; chips; glass
  input; grain overlay; Quicksand 300/600/700 (added to the font link). Spots 118/300/480 px, a hop every
  25 s while idle (not while scrolling/touching, bubble/chat open), max 4 per session. Intro once per
  session; swipe right = hidden for the session; swipe down on the chat top = close (draft kept).
  Waits while any full-screen popup / splash is up. Paperclip attaches a screenshot (POST /upload).
  Real status bar instead of the design's fake 9:41 row.
- Haptics `src/lib/haptics.js` — the "Ybex heartbeat": native app (Capacitor Haptics) Light → Medium 70 ms
  later; Android web vibrate [7, 55, 16]; send = one tick. iPhone web: none (Apple allows none).
- Server `backend/feedback_routes.ts`: POST /feedback → support_tickets (page_context "/feedback-bot",
  category "Feedback · Bug|Suggestion|Confusing|General", bug = HIGH) + ticket_messages with a device
  line. Follow-ups only into the sender's own feedback ticket. 30 msgs/hour/user. GET /admin/feedback
  (admin only) with sender name, email, phone, role, city, joined. No database changes.
- Admin → Feedback (Ybex Assist): `AdminFeedbackInbox.jsx` — filter by kind and role, counts, messages,
  screenshots. Menu link next to Help desks (same permission) + admin "More" on mobile.
- Tests: backend/session43V287Feedback.test.ts (4), src/session43V287.test.jsx (5). Suite 1240 pass,
  tsc clean, build OK.

## v288 — Ravi's Gemini changes, redone on this code
1. Admin / sub-admin accounts can be deleted (bin) or completely wiped (rule 56 updated, logged in
   PROTECTED_CHANGES.md with Ravi's request). `backend/adminTargetGuard.ts`: only a full admin may touch
   an admin account; never yourself; never the last full admin (LAST_ADMIN, 409). Used by
   POST /admin/users/:id/wipe and POST /admin/users/:user_id/delete (before, any sub-admin could bin a
   full admin). Wipe plan also deletes `admin_permissions`.
   UI: Admins list → red trash button per admin / sub-admin (full admins, not on yourself) → the same
   DeleteAccountPanel (Normal delete / Complete wipe with password). Admin detail screen → red
   "Delete / Wipe Account" button in the header + tab.
2. UserEnforcementPanel crash on accounts with no profile row (`profile: null` → instagram_handle):
   `const profile = fullData?.profile || {}`.
- Test: backend/adminAccountWipe.test.ts (6). Suite 151 files / 1246 pass (run in 4 chunks), tsc
  clean, crash guard clean, build OK. No database changes.

## Session 43 — where things stand (v284 → v288)
- v285 guest push (ask on first open of the installed app, before login).
- v286 launch speed, status bar, Android icons, KYC red, Meet the Creators rule, trust line, profile
  checklist, profile footer, brand signup name, What's New for old users, cropper, Google + Apple login.
- v287 Ybex Assist feedback bot + Admin → Feedback + Ybex heartbeat haptic.
- v288 admin delete / wipe + admin detail crash fix.
- v289 promo popups (see below) + bot bubble text + screenshot fix.
- v290 invite rewards + wallet + profile banner + Terms 1.3 (see below).
- v291 Ravi's list: bot UI, wrong approval mails, website Google = app Google, password in signup + Settings, top creators (see below).
- v292 splash intro back + same logo on launch image and page, clean "e", bigger Android icon, new address vibexapp.ai.studio (see below).
- Next (agreed with Ravi, not started): app tour, Best Match cards (real views /
  applies, "Be among the first to apply" under 5) → native iOS app (Capacitor) for the App Store
  (also fixes the iPhone Google account list for good). Creator "Meet our top creators" is done in v291.
- Ravi's to-dos: Google redirect URI /api/auth/oauth/google/callback; Apple Services ID + return URL
  /api/auth/oauth/apple/callback + APPLE_CLIENT_ID; VAPID keys present; re-add the iPhone home-screen
  app to see the new launch image; build the Play Store file in PWABuilder (package com.ybex.app, host =
  final ai.studio name), then send the assetlinks.json + Play signing SHA-256.

## v289 — promo popups, bot bubble text, screenshot fix
- Promo popups: `backend/promo_routes.ts` (GET /promos/active, POST /promos/:id/event, admin CRUD),
  `src/components/promo/PromoPopup.jsx` (mounted in App.jsx next to What's New),
  `src/components/admin/AdminPromoPopups.jsx` (Admin → Platform tools → Promo popups).
  Layouts: fullscreen (1080×2340, text inside middle 1080×1920), card (960×1400), sheet (1080×1200).
  Whole poster = the button (app page "/…" or https link; empty = close), ✕ on all three, no other button.
  Audience all / creator / brand / guest; frequency once / daily / every open; start / end; priority;
  live switch; views + clicks. Phones only (< 768 px), not on admin / auth / onboarding pages. Poster is
  loaded before showing. One popup per app open: promo and What's New never both (What's New waits for
  the next open, not marked seen); the feedback bot waits while it is up.
  **Needs the SQL: `scripts/sql/session43_promos.sql`** (PENDING_DB_CHANGES.md). Until then nothing shows
  and the admin screen says the table is missing.
- Ybex Assist bubble: typing dots at +650 ms, then at +1650 ms it types "Any issue..?" (38 ms per letter,
  blinking caret — the design's own "showText" timing), hides 7 s after.
- Screenshot fix: /upload answers { public_url, url: "/api/files/<id>" }; the bot read `url` and the server
  dropped "/api/files/…" links, so screenshots were silently lost. Now the bot sends public_url and the
  server also accepts /api/files/<id>.
- Tests: backend/session43V289Promos.test.ts (5), src/session43V289.test.jsx (3). Suite 153 files / 1254
  pass (4 chunks), tsc clean, crash guard clean, build OK.

## v290 — invite rewards, wallet, profile banner, Terms 1.3
- `backend/inviteRewards.ts` (derived, no payment-code hooks), wired into `referralSummary`
  (`backend/referralProgram.ts`):
  - ₹21 friend reward both sides when the invited friend's profile is 100% (details + KYC; creators also
    photo, bio/niche, social, rate, ≥ 1 portfolio item); referrer cap ₹1,000; never locked.
  - ₹500 brand invite when the invited brand's first funded deal / UGC order is ≥ ₹5,000; max 10 brands;
    locked until the referrer completed 2 own deals; + 7 days Featured.
  - All numbers in referral_config (admin → Referrals). Code defaults work before the SQL; admin save
    falls back to the old columns with a warning until the SQL is run. min_withdraw default ₹11.
- Withdrawals: need a UPI id (creator_payment_methods / creator_kyc / brand_refund_accounts), snapshot
  stored in referral_withdrawals.upi_id (saved without it if the column is missing). Admin list shows
  name, role, email, UPI (tap to copy) → pay by hand → "Mark paid" with UTR.
- UI: `ReferralHub.jsx` (₹21 card, "Invite a brand" section id=brand, wallet incl. locked amount),
  `WalletChip.jsx` on both mobile dashboards, routes /b/:code (brand sign-up with the same code),
  /invite → /refer, /invite/brand → /refer#brand.
- Profile banner: promo layout "banner" (1080×200) via GET /promos/banner, `ProfileBanner.jsx` under the
  header on CreatorMobileProfile + BrandProfileMobile; hidden when none is live.
- Terms 1.3 (frontend + backend in step): section 10 "Referral and invite rewards" ("up to" = per-person
  total, amounts as shown in the app, offers can change, misuse rules, prizes, UPI payout). Users
  re-accept once (TermsUpdateGate).
- Not done on purpose: 0% fee on the invited brand's first deal (locked payment code — needs Ravi's
  separate OK).
- DB: ONE file `scripts/sql/session43_all.sql` + ready prompt `SUPABASE_PROMPT_SESSION43.md` (promo_popups
  incl. banner, referral_config new columns, referral_withdrawals.upi_id).
- Tests: backend/session43V290Invite.test.ts (10). Updated to Ravi's new numbers: referralProgram.test
  (₹11), termsVersion.test + session43V283.test (Terms 1.3). Suite 154 files / 1264 pass (5 chunks),
  tsc clean, crash guard clean, build OK.

## v291 — bot UI, approval mails, website Google login, passwords, top creators (Ravi)
Not run: no node_modules / network. Only `node --experimental-strip-types --check` on the changed backend
`.ts` files (syntax OK). Run tests + tsc + crash guard + build before deploying.

- **Ybex Assist bot** (`src/components/feedback/FeedbackBot.jsx`, version const v291):
  - Chat uses the design's gradient + grain again (the opaque #2E1065 backing that hid it is gone).
    No wavy lines (the design file has them behind the typing bar — Ravi asked to leave them out) and
    the ambient glow under the typing bar is gone too (it showed as a hard rectangle).
  - Status bar: iPhone keeps the light lavender strip (dark clock) with a wash that fades into the chat,
    now inside the chat so there is no hard edge; Android gets the design's dark purple.
    `STATUS_TOP`, `IS_IOS` consts. Chat is `position: fixed; top: 0` (no `--vvtop`/`--vvh`).
  - Keyboard: `useVisibleBox()` reads `visualViewport` (top + height) only while the keyboard is open, so
    the typing bar sits on the keyboard (screenshot: big empty gap under it).
  - "Stops halfway": backdrop blur only after the opening circle finishes (blur under an animated
    clip-path is the likely freeze on iPhone); 900 ms watchdog forces it fully open; `openTok` ref so a
    late timer from an old open/close does nothing; `open()` ignores a second tap. The clip-path transition
    string stays (session43V287 test checks it). This is a best guess from the screenshots — check on the phone.
- **Wrong mails** (`backend/notificationService.ts`): every type containing APPROVED got "Content Approved
  by Brand!". KYC_* (approved / rejected / update) and PROFILE_* (profile_approved from the waitlist) are
  now checked first with their own subject, heading and button.
- **Website Google sign-in** (`backend/oauth_routes.ts`, `backend/auth_routes.ts`): the old pop-up
  callback only looked in the local JSON store, so an account made on the phone looked new on the website
  (→ "create account" + onboarding). New exported `oauthSignInCore()` (Supabase lookup by e-mail, create if
  missing, session) is used by BOTH the app redirect flow and the website pop-up. Refuses admin / deleted /
  banned accounts (the website pop-up used to let admins in). Pop-up sends `OAUTH_FAILURE` with a message;
  Login.jsx / Signup.jsx show it, and say "signed you in" / "this email is a creator account" when the
  e-mail already exists or the role differs. Signup now routes with `postLoginPath`. Google profile with
  `email_verified === false` is refused.
- **Onboarding**: removed the bottom-left second "Log Out" (`src/pages/auth/Onboarding.jsx`); header one stays.
  Onboarding already redirects onboarded users to /dashboard. A full cross-platform onboarding audit was NOT done.
- **iPhone Google, no account list**: `GET /auth/oauth/url?hint=<email>` → Google `login_hint` (no
  `prompt=select_account` when a hint exists). App sends the e-mail typed on the email screen, else
  `ybex_last_email` (saved after login). A tip line shows on the e-mail screen when nothing is typed.
  Real fix = native Google Sign-In in the Capacitor iOS app.
- **Passwords**: app signup always asks for a password (8+), `ownPassword = true`, toggle removed; the
  e-mail code still verifies the address. Desktop signup already asked. Settings → Account → "Password"
  row (`ChangePassword` in `AccountPanel.jsx`): e-mail code first, so it works for Google / code-only
  users. Backend `POST /account/password/send-otp` and `/account/password/set` (bcrypt → `users.password_hash`).
- **Creator "Meet our top creators"** (`backend/creatorHomePicks.ts`, `CreatorHomeMobile.jsx`): the section
  only showed when the admin ticked "Show on creator home" — nobody ticked, so it never appeared. Now,
  when nobody is ticked, `GET /creators/home-picks` returns up to 4 best approved creators
  (`autoHomePicks`: visibleCreators rule, photo first, then followers; viewer excluded). Admin ticks still
  win. Heading is now "Meet our top creators". Mobile creator home only (desktop dashboard not touched).
- **Waitlist → Upload CSV takes every field** (`backend/waitlistCsvImport.ts`, `admin_waitlist_routes.ts`,
  `WaitlistCsvImportModal.jsx`). Ravi's website export (70 rows, 20 columns) only brought name, email, mobile,
  handle, city, gender, notes: the importer only knew `followers`, `avg_reach`, `price`, `niche`, so
  `followers_count`, `avg_reach_per_reel`, `charges_ugc`, `content_niches` were ignored.
  - Now mapped: full_name, instagram_handle / instagram_link (handle taken from either; tracking params cut),
    followers_count, avg_reach_per_reel, charges_ugc, content_niches, collab_types (list), ugc_experience_rating
    (1–10), sample_links (list of URLs), notes, submitted_at → `created_at` (day/month/year, am/pm, India
    time, so the real apply date is kept). Old template names still work; the sample CSV has the new columns.
  - Reach: a count ("70,000", "1.8M", "30000+") becomes a number; a range ("100k-200k", "100k to 500k") is kept
    exactly as written — no midpoint invented.
  - No waitlist column for `brands_applied` / `is_exclusive` (DB rule 91) → added at the end of notes
    ("Applied to: …", "Marked exclusive on the old form"). `id` and `source` of the old site are dropped.
  - E-mail typed as "@name@gmail.com" is fixed. Rows with a bad e-mail / repeated e-mail are still refused.
  - **Re-upload completes earlier partial imports**: a row whose e-mail is already a `csv_import` waitlist row
    gets status "update" — only its EMPTY cells are filled (`fillMissing`), nothing filled is overwritten,
    status / source / created_at untouched; notes get the "Applied to" lines appended. Modal shows
    "N to complete", Reach and Price columns, and the toast says how many were added / completed.
  - Checked against the real file: 70 rows → 66 ready, 1 refused (bad e-mail, now auto-fixed → 67), 3 repeats:
    four different creators (Kamya, Beautiful jaipur, Anju choudhary, Anisha Jain) all typed
    "xyz@gmail.com" — only the first can import; they need their real e-mails in the sheet. Gender is empty
    for 43 of 70 rows in the export itself.
- DB: nothing new. Tests added: `backend/session44V291.test.ts` (4), `backend/session44CsvImport.test.ts` (6;
  these 6 were run with a small node shim, not vitest), `src/session44V291.test.jsx` (3, not run).
- Open / Ravi: confirm the arrow in IMG_3839 meant "opening animation stops halfway"; confirm admin Google
  login on the website should stay blocked; `package-lock.json` is still missing in the zip (needed for
  `npm ci`); check the bot, keyboard and iPhone status bar on a real phone.

## v292 — splash intro back, one logo, clean "e", Android icon, new address (Ravi)
Not run: no node_modules / network (npm registry blocked). Syntax-parsed all 739 source files (0 errors); splash frames
checked in headless Chromium (390x844, installed-app mode, no page errors).

Ravi's report: v286 removed the "Ybex App Flow" opening animation while fixing the ugly first logo; the launch-image logo and the
page's logo differed (second one bigger + glossy, a screen flash between them); Android icon looked small; address is now
vibexapp.ai.studio; the "e" of the logo looks cut / bitten.

- **Splash** (`index.html` #yb-splash): the page now starts on the SAME picture as the phone's launch image (class `st`: word + dot),
  holds it HOLD = 160 ms so nothing jumps, then plays the Claude Design "Ybex App Flow" intro again — camera pops in (`go p1`) → swings
  (p2) → flash (p3) → flash becomes the dot of "Ybex." (p4) → shine (p5); ready at 160 + 1210 = ~1.37 s (reduced motion: 200 ms, word only).
  Camera + burst markup back in index.html (camera.webp inlined, ~11 KB). Exit logic (shrink into home banner / slide up for login),
  `window.__ybSplash`, 9 s / 10.5 s safety timers unchanged.
- **Same logo twice, no flash**: the iPhone launch images are no longer drawn separately. `scripts/brand/generate_brand_assets.py`
  (`_splash_html()` / `launch()`) takes the splash's own CSS + markup from index.html and screenshots it at each device size, so size, 170deg
  gradient, corner glow and the dot's glow are identical. Check: live `.st` frame vs `launch-1170x2532.png` = 0 pixels different.
  The flash itself came from two things: launch image used a plain vertical gradient while the page used 170deg, and the page showed #F2F2F7
  before the script ran. New early `<head>` script adds `yb-splash-active` (installed phone, first open of the session) and
  `html.yb-splash-active` is the splash gradient from the first paint.
- **"e" of the wordmark**: the tilted "e" (arc + bar rotated -45deg) is the logo's signature and STAYS. Only the cut at its upper-right corner
  is fixed: the crossbar used to stop at x=155 while the bowl's outer edge is at 201, leaving a step. Now the bar runs flush into the bowl:
  `<g transform="translate(1419 504) rotate(-45) scale(.67)"><path d="M-155 0H196M155 0A155 155 0 1 0 127 89" stroke-width="92"/></g>`
  (196 = sqrt(201^2 - 46^2), so the bar's corners stay inside the ring — no nub). (A flat, un-tilted "e" was tried first and rejected by Ravi.)
  Changed in index.html (2 places), `public/icon.svg`, `LETTERS` in the generator; regenerated `pwa-192/512`, `pwa-maskable-512`,
  `apple-touch-icon`, `favicon.ico`, 20 launch images, `og-image.jpg`, `twa-splash-512.png`. No other file draws the wordmark as vector.
- **Android icon**: maskable wordmark scale 0.52 → 0.58 of the tile (still inside the 40 % safe circle, corner check 0.385 < 0.40).
  `twa-splash-512.png` regenerated (white wordmark, 78 % of width, transparent). Shows on phones only after a new AAB.
- **Address**: https://vibexapp.ai.studio — `src/lib/publicUrl.js`, og / twitter tags in index.html, `twa-manifest.json` host.
  assetlinks.json + Play App Signing SHA-256 must be for this host or the app shows a browser bar.
- Generators (`generate_brand_assets.py`, `generate_share_image.py`) fall back to Playwright's Chromium when cairosvg is missing.
- Tests: `launchSplash.test.js` (intro, the tilted "e" with the corner fix everywhere, launch images from the splash, new address) and `session43V286.test.ts`
  (`el.className = "st"`) updated — not run.
- No database changes.
