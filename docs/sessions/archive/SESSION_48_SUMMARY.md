# Ybex — Session 48 Summary — continues Session 47 (v297 → v298)

**Latest:** `ybex-v298.zip` (= v297 + the work below).
**State:** this time the sandbox had **NO network** (npm registry blocked), so `npm install`, `npm run verify` and `vite build` could **not** run. What WAS checked: every changed file compiles (esbuild), no undeclared names (TypeScript scan), the protected Campaign / UGC / Invite check passes (run with plain Node), and every pinned test string in the old tests still holds. A new test file `src/session48.test.jsx` was added. **Run `npm install` → `npm run verify` → `npm run build` on your computer first.** Nothing was opened on a real phone.
**Database rule (91):** no new table / column / SQL.

## What Ravi asked (+ testing team's WhatsApp list)
1. Login with email: show **password first**, "Log in with OTP instead" as the small link.
2. Profile: the invite banner appears a moment late → must be there from the start.
3. Profile → **Account** doesn't open; tapping it many times can hang the app.
4. Any page opened from Profile / Account opens already scrolled → must open fresh from the top.
5. Admin promo popups go live very late; explain the promo screen (what is "priority").
6. Creator panel "Meet our top creators" → same UI as the brand's "Meet the Creators", with "you could be the next top creator" instead of Explore.
7. KYC page shows "Not provided" everywhere → show the details that were filled.
8. Testing team: Refer & earn shown twice (one under Log out); bot bubble purple while the bot is green; Vasudha card text running out of the card; Deliverables pre-filled with "1 Reel (30s+)"; "10k+ verified creators / Explore more" sitting on top of the creator cards.
9. Friend: the bot is green, so the message bubble and its **text** should be green too.

## 1. Login — password first (`AppContinue.jsx`)
- Email → account **has a password** → "Welcome back" + password box + big **"Log in with password"**; under it small **"Log in with OTP instead"** and "Forgot password?".
- Account **without** a password → the old OTP screen (Continue with OTP).
- Back from the password screen → email box. Back from the code screen → password screen (if the account has one). Role switch ("Continue as Brand") also opens on the password screen.
- `appLogin.test.jsx`: the old test pinned "OTP first"; it now checks the new order you asked for (password first, OTP link still logs in) + a new password-login test.

## 2. Profile banner on the first frame (`ProfileBanner.jsx`, `PromoPopup.jsx`)
- The banner + its picture are fetched in the background as soon as a creator / brand is logged in (`prefetchProfileBanner`, started from the always-mounted promo component) and the last answer is remembered on the phone.
- My Profile draws it straight away and only refreshes it quietly. No banner live → nothing (same as before).

## 3. Account opens again (`BrandProfileMobile.jsx`, `CreatorSettings.jsx`)
- Root cause: `"account"` was missing from the list of allowed profile screens on BOTH panels. Tap → URL got `?section=account` → the list threw it away → the hub redrew. Many taps = many redraws (the "hang"). Added `"account"` to both lists.

## 4. Pages open at the top (`Layout.jsx`, `lib/scrollTop.js`, `BottomNav.jsx`, `AccountPanel.jsx`)
- The "go to top" now runs **before the first paint** (no flash of the old position) and checks again at 80 / 220 / 450 ms while a late page settles — it stops the moment you touch the screen.
- The Profile / Brand tab no longer restores an old scroll position (it goes to the hub anyway). Other tabs still remember their own position.
- Account's inner screens (change email / phone / password, delete) open at the top.

## 5. Promo popups go live fast + explained (`PromoPopup.jsx`, `promo_routes.ts`, `AdminPromoPopups.jsx`, `WhatsNewPopup.jsx`)
Why it was late: the app asked the server **once per app open** and then locked. The installed app stays open in the background for days, so a new popup waited until the app was fully closed. Also every new promo started with **Live unticked**.
- Now the app asks again whenever it comes back to the screen, and at most once a minute while moving between pages. Still only one popup per open — but a NEW or EDITED popup counts as new.
- Server cache 30 s → 10 s.
- New promo form starts with **Live ticked**.
- A "How this works" box on the admin screen + a line under Priority.

**The promo screen in short:**
- **Layout** — Full screen / Centre card / Bottom sheet (popup when the app opens) or **Profile banner** (strip on My Profile). Use the designer size shown.
- **Poster** — the image; the whole image is the button.
- **Tap opens** — an app page like `/creator/refer` or a full `https://` link. Empty = tap just closes.
- **Who sees it** — everyone / creators / brands / installed-but-not-signed-up.
- **How often** — once per person / once a day / every app open.
- **Starts / Ends** — optional. Empty start = live right after save.
- **Priority** — a phone shows only ONE popup (and one banner) at a time. Two live for the same people → the higher number shows; same number → newest wins. Only one live? Leave 0.
- **Live** — tick = visible, untick = saved but hidden.

## 6. "Meet our top creators" = brand's grid (`components/dashboard/MeetCreatorsGrid.jsx` new, `BrandHomeMobile.jsx`, `CreatorHomeMobile.jsx`)
- One shared grid for both homes: photo cards with glow, name, avg reach.
- Cards fill **row by row** (1-2-3 / 4-5-6). Before, column 1 took cards 1-3 and the other columns stayed empty when only 3 creators were live → one thin column + "10k+ verified creators" on top of the 3rd card (the red-circle screenshot).
- Max 2 rows (6 creators); the box is only as tall as its rows, so the call-to-action sits **under** the cards.
- Brand: "10k+ verified creators · Explore more" (same as before). Creator: **"You could be our next top creator ✨ · Finish your profile and land your first campaigns · Find campaigns"**.
- The old horizontal creator card with "5.0M followers · Fashion, Beauty, Lifestyle" (the Vasudha overflow) is gone.

## 7. KYC page shows the filled details (`misc_routes.ts` GET /verifications/me, `KycScreen.jsx`)
- A `brand_kyc` row can exist with empty fields (approved by admin, or an older save). The server now fills every EMPTY field from the brand's own KYC form copy in `verifications` and from the brand profile (read-only, nothing saved).
- The phone screen also falls back to the brand profile for company name, contact person, phone, email and website. GSTIN / PAN only come from KYC (if they were never sent they still say "Not provided").

## 8. Testing-team fixes
- **Refer & earn twice:** the purple Refer card under Log out is removed; "Refer & earn" stays once in the list.
- **Bot bubble:** see 9.
- **Vasudha text overflow:** fixed by 6.
- **Deliverables:** starts **empty**, grey hint "e.g. 1 Reel + 2 Stories with link" (`MobileCampaignCreate.jsx`, text/default only — no server call changed; protected check passes). A template or a saved draft still fills it. ⚠️ If "like before" meant something else (chips?), tell me.
- **"10k+ verified creators" overlap:** fixed by 6.

## 9. Bot bubble green (`FeedbackBot.jsx`)
- "Any issue..?" bubble = light lime (the ball's own colours) with **dark-green text**, green typing dots and caret. Rest of the bot unchanged.

## Still on Ravi
- Run `npm install` → `npm run verify` → `npm run build` (not run this session — no network).
- Phone checks: login (password first / OTP link), Account on brand + creator, open sub-pages after scrolling the profile, profile banner, a new promo (upload → leave app → come back), both home grids with 3 and 6 creators, brand KYC page, bot bubble, new campaign Deliverables.
- Everything open from Session 45 / 46 / 47 is still open (SITE_URL, TWA rebuild + Android splash, VAPID, domain, signup-source tracking, Growth tabs, bot mascot position).
