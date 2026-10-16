# Ybex — App Store (iPhone) and Google Play checklist

Written for Ravi (v334). Part A = what the app already has (with where to find it). Part B = what **you** fill in
on App Store Connect / Play Console. Part C = demo accounts for reviewers. Part D = risks and open decisions.

Links you will paste again and again:

| What | Link |
|---|---|
| Privacy Policy | `https://ybexmedia.in/privacy-policy` |
| Terms of Service | `https://ybexmedia.in/info/terms` |
| Refund Policy | `https://ybexmedia.in/info/refunds` |
| Support / contact | `https://ybexmedia.in/help` (shows email + WhatsApp without login) |
| Delete account (works without the app) | `https://ybexmedia.in/delete-account` |
| Support email | `support@ybexmedia.in` · WhatsApp +91 87640 04299 |

All five pages open **without logging in** (checked in `src/App.jsx`).

---

## Part A — what is done inside the app

| Store rule | Status | Where |
|---|---|---|
| **Delete account inside the app** (Apple 5.1.1(v), Play "account deletion") | ✅ | Phone, creator: **Profile tab → Account → Delete account**. Phone, brand: **Brand tab → Account → Delete account**. Computer: **Settings → Account & delete → Delete account** (new in v334). 3 taps. Email code confirms. Screen says what is deleted, what is kept, and the 30-day recovery. Code: `src/components/account/AccountPanel.jsx`. |
| **Delete account without the app** (Play needs a web link) | ✅ | `/delete-account` — step-by-step for app, website and "can't log in → email privacy@ybexmedia.in". Logged-in visitors can delete right there. Linked in the website footer, the landing page footer, the app's first screen and every Help screen. Code: `src/pages/legal/DeleteAccount.jsx`. |
| **Privacy / Terms / Refund links** | ✅ | Login screen (new line under the buttons), signup (18+ checkbox with links), app first screen (new links row), app email screen, Settings → Privacy & Terms (both roles, phone + computer), website + landing footers. |
| **Help & support contact in the app** | ✅ new | Phone: Profile/Brand → Help centre → "Help & support" card (email + WhatsApp + legal + Delete account). Computer: Settings → Help & Support, and `/help`. Code: `src/components/help/SupportContactCard.jsx`. Ticket form ("Chat with support") already existed. |
| **Sign in with Apple** (Apple 4.8, because Google sign-in is offered) | ✅ (needs `APPLE_CLIENT_ID`) | Black "Continue with Apple" button, same size as Google, on iPhone/iPad: app email screen (already), website login, website signup, phone signup welcome (new). If the key is missing it shows a calm "not set up yet" line. Code: `src/components/auth/AppleSignInButton.jsx`, server `backend/oauth_routes.ts` (unchanged). Privacy Policy now mentions Apple sign-in. |
| **Permission prompts with a reason** (Apple 5.1.1) | ✅ | Only notifications are asked. Our own explainer screen first ("Never miss a brand deal" + what you'll get); the phone's real popup opens only after tapping the button. Camera / photos are never asked by the app — the phone's own file picker is used when you upload. No location, contacts, microphone. Code: `src/components/push/PushPermissionScreen.jsx`. |
| **No placeholder / "coming soon"** (Apple 2.1) | ✅ fixed | Blog newsletter box hidden (it saved nothing — `SHOW_NEWSLETTER` in `src/pages/blog/BlogIndex.jsx`); public UGC page "More videos coming soon…" → "No videos here yet." Demo logins only appear when the server has `DEMO_LOGIN=true` (keep it off). |
| **No in-app purchase needed** (Apple 3.1) | ✅ | Ybex sells **real-world services** (creators making and posting brand content, UGC made to order) and advertising campaigns. No digital subscriptions, coins, boosts or paid badges anywhere in the app. Razorpay is correct — see Part B "Payments note". |
| **Report a user / content** (Apple 1.2) | ✅ new (partly) | Public creator and brand profiles: **"Report this profile"** (reasons + details) → Admin → System reports. In a deal chat: menu → "Raise an issue on this order" → admin ticket. Help → "Trust & Safety" ticket. Admin can suspend / ban users. Code: `src/components/safety/ReportUserLink.jsx`. |
| **Block a user** (Apple 1.2) | ⚠️ not built | Needs a database table → waiting for the database session. Until then the report form says support can close the chat and suspend the account. See Part D. |
| **18+ only** | ✅ | Terms: 18+. Email signup: required checkbox "I am 18 or older and agree to the Terms and Privacy Policy" (website + app). Google / Apple: "By continuing you confirm you are 18 or older…" line (app line updated in v334). |
| **Works offline / not just a website** (Apple 4.2) | ✅ (v333) | Last-seen screens open without internet, offline banner. Another v334 task is improving this. |

---

## Part B — Apple App Store Connect (iPhone)

1. **App Information**
   - Category: **Business** (secondary: Social Networking or Productivity).
   - Content rights: you own or have rights to all content (creator photos are uploaded by users).
   - Age rating questionnaire: answer honestly — no violence/sexual content made by Ybex; **"User-generated
     content: Yes"**, **"Messaging / chat: Yes"**, **"Unrestricted web access: No"**, gambling/contests: No.
     Because the Terms say 18+, pick the **18+** age rating (use "Age Rating Override" if the answers give a lower one).
2. **App Privacy → Privacy Policy URL**: `https://ybexmedia.in/privacy-policy`.
   **User Privacy Choices URL** (optional): `https://ybexmedia.in/delete-account`.
3. **App Privacy → Data collection ("nutrition label")** — all of these: *Linked to the user: Yes*, *Used for
   tracking: No* (Ybex doesn't share data with ad networks or data brokers).

   | Apple data type | Collected? | Why (purpose to tick) |
   |---|---|---|
   | Contact Info → Name, Email Address, Phone Number | Yes | App Functionality; Developer's Advertising or Marketing (campaign / offer emails) |
   | Contact Info → Physical Address | No (only city) | — |
   | Financial Info → Other Financial Info (bank account, IFSC, UPI for payouts) | Yes | App Functionality |
   | Financial Info → Payment Info | No — cards / UPI payments are handled by Razorpay, not stored by Ybex | — |
   | User Content → Photos or Videos (profile photo, portfolio, deliverables) | Yes | App Functionality |
   | User Content → Emails or Text Messages (in-app chat) — or "Other User Content" | Yes | App Functionality |
   | User Content → Customer Support (tickets, reports) | Yes | App Functionality |
   | User Content → Other User Content (bio, rate card, reviews, campaign briefs, agreements) | Yes | App Functionality |
   | Identifiers → User ID | Yes | App Functionality; Analytics |
   | Identifiers → Device ID | Yes (push subscription, analytics cookie) | App Functionality; Analytics |
   | Usage Data → Product Interaction | Yes (Google Analytics page views) | Analytics |
   | Diagnostics → Crash Data / Other Diagnostic Data | Yes (Eva "report a problem" files, error logs) | App Functionality |
   | Other Data → PAN, GSTIN / business document, date of birth, gender | Yes | App Functionality (verification, tax) |
   | Location, Health, Contacts, Browsing History, Search History, Sensitive Info | No | — |

4. **Sign in with Apple**: create the Services ID and set `APPLE_CLIENT_ID` (steps in `docs/setup/ENV_KEYS.md` §6), and
   register the email domain for "Hide My Email" users. Test it on a real iPhone before you submit.
5. **App Review Information**
   - Sign-in required: **Yes** → give the **creator** demo account (Part C) in the user/password fields and the
     **brand** account in the Notes.
   - Contact: your name, phone, `support@ybexmedia.in`.
   - **Notes for the reviewer** (copy and edit):
     > Ybex is a marketplace in India where brands hire content creators. Payments are for real-world services
     > (creators making and posting promotional content on Instagram/YouTube, and made-to-order UGC videos for the
     > brand's own ads), paid by the brand to the creator through Razorpay. No digital content, subscriptions or
     > features are sold inside the app (Guidelines 3.1.3(e) goods and services consumed outside the app, and
     > 3.1.3(g) advertising management). Please don't complete a payment — the demo brand account already has a paid
     > deal you can open.
     > Log in: tap "I'm a Creator" (or "I'm a Brand"), type the email, then "Use password instead".
     > Delete account: Profile → Account → Delete account. Report a profile: open any creator/brand profile →
     > "Report this profile" at the bottom. Sign in with Apple is on the email screen.
     > Notifications are optional; nothing else is asked.
6. **Support URL**: `https://ybexmedia.in/help`. **Marketing URL**: `https://ybexmedia.in`.
7. **Screenshots**: iPhone 6.9" (1320 × 2868) — at least 3, up to 10. iPad only if you ship for iPad (13" 2064 ×
   2752). Use the demo accounts with the sample data — real-looking, no "test", no personal phone numbers.
   Suggested: Home, Live campaigns, Creator profile, Deal chat with the payment-hold card, Earnings, Eva.
8. **Export compliance**: uses only standard HTTPS encryption → "No" to custom encryption (set
   `ITSAppUsesNonExemptEncryption = NO` in the app's Info.plist so you're not asked every build).
9. **iPhone app build (Capacitor / developer side)**
   - Info.plist text for the phone's file picker (it can offer the camera):
     `NSCameraUsageDescription` = "Ybex uses the camera only when you choose to take a photo or video to upload,
     like your profile photo or a deal deliverable." · `NSPhotoLibraryUsageDescription` = "Ybex opens your photos
     only when you choose a photo or video to upload." · `NSPhotoLibraryAddUsageDescription` = "Ybex saves a file to
     your photos only when you tap Download."
   - Capability: **Sign in with Apple**. If native push is added later, also Push Notifications (see Part D).
   - Google sign-in **inside an app web view is blocked by Google** ("disallowed_useragent"). The app must open
     Google sign-in in the system browser (ASWebAuthenticationSession / Capacitor Browser) or use native Google
     Sign-In. Otherwise reviewers see a Google error → rejection.
   - Turn **maintenance mode OFF** (Admin → Platform settings) while the app is in review.

## Part B — Google Play Console (Android)

1. **App content → Privacy policy**: `https://ybexmedia.in/privacy-policy`.
2. **App content → App access**: "All or some functionality is restricted" → add the creator and brand demo
   accounts (Part C) with the same login steps as for Apple.
3. **App content → Ads**: "No, my app does not contain ads".
4. **App content → Content rating (IARC)**: category "Social / communication or Business"; users can interact /
   exchange messages: **Yes**; user-generated content: **Yes**; shares location: **No**; digital purchases: **No**;
   no violence / sexual / drugs / gambling content.
5. **App content → Target audience**: **18 and over only**. "Appeals to children": No.
6. **App content → Data safety** (answer "Yes, we collect data"; "Data is encrypted in transit": **Yes**;
   "Users can request deletion": **Yes** → `https://ybexmedia.in/delete-account`). Collected and **shared**?
   Ybex shares with service providers only (hosting, Razorpay, email) — Google counts that as *not* sharing.

   | Play data type | Collected | Optional? | Purpose |
   |---|---|---|---|
   | Personal info → Name, Email address, Phone number, User IDs | Yes | Required | Account management, App functionality, Fraud prevention |
   | Personal info → Other info (date of birth, gender, city, PAN, GSTIN) | Yes | Required for payouts / verification | App functionality, Fraud prevention |
   | Financial info → User payment info (bank account / UPI for payouts) | Yes | Required to get paid | App functionality |
   | Financial info → Purchase history (deal payments, receipts) | Yes | Required | App functionality |
   | Messages → Other in-app messages (deal chat) | Yes | Required | App functionality |
   | Photos and videos → Photos, Videos | Yes | Optional (profile) / required for deliverables | App functionality |
   | Files and docs (KYC / GST certificate, agreements) | Yes | Required for verification | App functionality, Fraud prevention |
   | App activity → App interactions, Other user-generated content (bio, reviews, briefs) | Yes | Required | App functionality, Analytics |
   | App info and performance → Crash logs, Diagnostics | Yes | Optional | App functionality, Analytics |
   | Device or other IDs (push token, analytics id) | Yes | Optional | App functionality, Analytics |
   | Location, Contacts, Calendar, Health, Audio, Web browsing | No | — | — |

7. **App content → Account deletion**: "Yes, users can create an account" → delete URL
   `https://ybexmedia.in/delete-account`; in-app path Profile → Account → Delete account.
8. **App content → Financial features**: Ybex holds deal money in a payment hold and sends payouts through
   Razorpay. Answer the declaration honestly (it is *not* a loan, bank, crypto or wallet-top-up app). Ask your CA
   which option fits if unsure.
9. **App content → Government ID / sensitive info**: Ybex asks creators for PAN and brands for GSTIN/PAN for tax
   and payouts — this is already explained in the Privacy Policy.
10. **Store listing**: short description (≤ 80 chars), full description, app icon 512 × 512, feature graphic
    1024 × 500, phone screenshots (2–8, 16:9 or 9:16, min 320 px), contact email `support@ybexmedia.in`, website
    `https://ybexmedia.in`, privacy policy link.
11. **Android app build (TWA / Bubblewrap — developer side)**
    - `twa-manifest.json` says `"host": "ybexapp.ai.studio"` — keep it until ybexmedia.in serves the app (v337). Moving the
      Android app to the new domain later = one Play update (new APK with the new host).
    - `https://ybexmedia.in/.well-known/assetlinks.json` must list **both** SHA-256 fingerprints: your upload key
      (already there) **and** Play Console → Setup → App signing → "App signing key certificate". Without the Play
      one the app shows a browser address bar after Play installs it → reviewers call it a "webview wrapper".
    - New apps must target a recent Android version (Android 15 / API 35 in 2025–26). Update Bubblewrap and rebuild.
    - If the Play developer account is a **personal** account made after Nov 2023: you must run a closed test with
      at least 12 testers for 14 days before production is unlocked. An **organisation** account (Ybex Media, needs a
      D-U-N-S number) skips this.

### Payments note (both stores)

Ybex takes payment from brands for work that real people do outside the app (posting on Instagram/YouTube, making
ad videos for the brand). Apple allows non-Apple payment for this (3.1.3(e) goods/services consumed outside the app;
3.1.3(g) apps for buying/managing advertising campaigns). Google Play Billing is likewise only required for digital
goods; physical/real-world services may use Razorpay. Keep it that way: **never** sell anything digital in the app
(no "Ybex Pro", boosts, paid badges, coins, or paid Eva). The referral rewards are cash paid to UPI, not bought.

---

## Part C — demo accounts for reviewers (make these before submitting)

Make two **real** accounts on the live app (not `DEMO_LOGIN`), each **with a password** (reviewers can't receive
the email code). Use emails you control, e.g. `review.creator@ybexmedia.in` and `review.brand@ybexmedia.in`.

| Account | What it should show |
|---|---|
| **Creator** — "Ybex Review Creator" | Complete profile with photo, 2–3 portfolio items, rate card, social handle; KYC approved (admin approves); at least one deal in chat at "work in progress" (paid, money in hold), one completed deal with a payout and receipt, one open invite; a few notifications. |
| **Brand** — "Ybex Review Brand" | Company profile + logo, verification approved, one live campaign with applicants (include the review creator), one UGC brief, the paid deal with the review creator, payment history with a receipt. |

- Write both in App Review Information (Apple) and App access (Play), with the steps: tap "I'm a Creator" / "I'm a
  Brand" → type email → **Use password instead** → password.
- Don't use real people's data. Keep these accounts out of public lists if possible (or make them look normal).
- After review, keep them — every update is reviewed again.

---

## Part D — known risks and open decisions

1. **Block user — done (v337).** "Block" next to "Report this profile" on every public creator / brand page and in the
   chat ☰ menu; Help → Blocked people to unblock. A block stops messages, invites and applications both ways, hides
   the chats, and files a report for the team (Admin → System reports, type `user_block`). Tell the reviewer in the
   notes: "Users can report and block from any profile or chat menu; we act on reports within 24 hours."
2. **30-day final deletion runs by hand for now.** The app and Privacy Policy say data is removed after 30 days.
   The automatic purge job is waiting for the DB session (`docs/database/PENDING_DB_CHANGES.md` → `deletion_requested_at`).
   Until then, once a week check Admin → deleted users older than 30 days and delete them permanently.
3. **Sign in with Apple token revoke.** Apple asks apps using Sign in with Apple to revoke Apple tokens when an
   account is deleted. Ybex never stores Apple tokens (only checks the sign-in once), so there is nothing to revoke —
   if a reviewer asks, reply with exactly that.
4. **"BETA" badges** on Explore UGC, Instant UGC and Ybex Eva (menus and landing page). Apple 2.2 says betas belong
   in TestFlight; a label alone is usually fine, but some reviewers flag it. **Decision for Ravi:** remove the BETA
   badges for the store builds? (UGC is a finished, locked flow.)
5. **Notification explainer has a "Not now" button.** Fine on Android. For a future native iPhone push screen,
   Apple prefers one button ("Continue") before its own popup. The current web screen doesn't appear in an iPhone
   App Store app (iPhone web views have no web push), so no change now.
6. **Apple 4.2 (minimum functionality).** An iPhone app that is "just the website" can be rejected. Ybex has
   offline screens, push (Android), Sign in with Apple and a full account system — mention these in Review Notes. A
   native push + share sheet in the iPhone app would make it safer.
7. **Google sign-in inside the iPhone app web view** must open in the system browser (see Part B, item 9),
   otherwise Google blocks it.
8. **TWA host + Play signing fingerprint** (Part B, Android item 11) — without them the Android app shows a URL bar.
9. **Illustrations with numbers** on the app's first screen (e.g. "84k followers", "₹46k earned") are design art.
   Fine for review; if a reviewer asks, they're sample illustrations.
10. **Payments during review.** With live Razorpay keys a reviewer who pays spends real money. The Review Notes ask
    them not to pay and point to the already-paid demo deal.

## Before you press "Submit" (both stores)

- [ ] All REQUIRED keys filled (`docs/setup/ENV_KEYS.md`), `DEMO_LOGIN` / `DEMO_SEED` / `RESEND_ALLOW_FALLBACK` empty,
      `NODE_ENV=production`, `PAYMENTS_TEST_MODE=false`, live Razorpay keys + webhook.
- [ ] `APPLE_CLIENT_ID` set and "Continue with Apple" tested on a real iPhone.
- [ ] Google sign-in tested on the website and inside both apps.
- [ ] Demo creator + brand accounts ready with passwords and sample data (Part C).
- [ ] Delete account tested end to end on a spare account (code email arrives; account can't log in after).
- [ ] `/privacy-policy`, `/info/terms`, `/info/refunds`, `/help`, `/delete-account` open in a private browser window.
- [ ] Maintenance mode OFF.
- [ ] Screenshots made from the demo accounts.
