# Session 58 — v309

## 1. Sign-in security hole (critical, fixed)
- `POST /auth/verify-email` used to hand a login session to an **already-verified** account without checking any code
  (anyone's email + any 6 digits = their account). Now it answers `409 ALREADY_VERIFIED` and gives no session.
- `PreStep_EmailVerify.tsx`: on `ALREADY_VERIFIED` → toast "already verified, please log in" → `/login?email=…`.

## 2. Launch: straight into our animation (Android + iPhone)
- Android (Play app / TWA): the native launch screen is now plain `#7E00DC` with **no logo**
  (`public/twa-splash-512.png` = solid purple; old wordmark kept as `public/notification-icon-512.png` → `monochromeIconUrl`).
  Bottom navigation bar is purple (`navigationColor*`). `appVersionCode` 3 / `appVersionName` 1.0.2.
- `index.html`: Android gets class `yb-android`; the splash starts on the same flat `#7E00DC` and the gradient fades in
  (480 ms), so there is no colour jump. theme-color follows (#7E00DC on Android).
- iPhone: `html.yb-splash-active body` is purple from the first frame (the strip behind the clock was grey for a frame).
- Shine now 340 ms (ends ~1.24 s) so it is never cut by the 1.25 s exit. `INTRO`/`HOLD` unchanged.
- **Needs one new APK** (bubblewrap build from `twa-manifest.json`, versionCode 3) — the launch image and nav colour live inside the APK.
- Not changeable: Chrome-installed (non-Play) Android PWA splash is drawn by Chrome (icon + name). Android 12+ may flash the launcher icon briefly (system rule).

## 3. Fewer emails (in-app bell + phone push unchanged)
- No user email for warning / suspend / ban (`notificationService.ts`, both paths). Super-admin alert stays.
- No email for `CAMPAIGN_UNDER_REVIEW` and the `verification` fraud-review note.
- UGC (`ugcDeadlineService.ts`, `UGC_IN_APP_ONLY`): the 3-hourly repeat reminder, brief relisted, refund queued, creator stepped away → in-app + push only.
  First + final reminders, order expired/cancelled, refund sent still email.
- Phone push: every row in `notifications` is pushed by `push_routes.ts` (if the user allowed notifications), so all of the above still reach the phone.

## 4. Admin delete / wipe was blocked for every admin (fixed)
- `adminTargetGuard.countFullAdmins` asked Supabase for a `users.is_admin` column that does not exist on the live DB,
  the query failed, the count fell back to the local copy (≤1) and every admin bin / wipe said "This is the last full admin".
  Now it retries with the columns that exist (`role`, `team_role`, `is_deleted`, `banned`). Rules unchanged:
  only a full admin can remove an admin, never yourself, never the last full admin.

## 5. Signup source tracking (DB change — Ravi OK "han kro")
- Migration `session58_signup_source` applied on the live DB (`scripts/sql/session58_signup_source.sql`):
  `users.signup_source`, `utm_source`, `utm_medium`, `utm_campaign` (nullable text).
- `src/lib/signupSource.js`: first link a visitor lands on (utm tags, gclid/fbclid, referrer, Play app) kept in localStorage;
  sent once after sign-in (`AuthContext`) → `POST /auth/signup-source` (`backend/signupSource.ts`), saved only on a new
  account (≤ 2 days old) with no source yet. Sign-up / login code untouched.
- Growth → "Where signups come from" now splits by Instagram / Google / Meta ads / Direct / Android app …; the
  "Signup source is not tracked yet" alert is gone. Older accounts show as "joined before tracking started".
- Tip for ads: add `?utm_source=instagram&utm_medium=paid&utm_campaign=<name>` to ad links.

## Open (sign-in audit, not changed yet)
- Google login on an unverified account keeps the old password (`oauth_routes.ts`).
- Web login shows "Use OTP instead" with no OTP option.
- Password reset does not mark the email verified.
- Google on `/login` defaults a brand to creator.
- Medium/low UX items listed in chat.

## Tests
- New `backend/session58Launch.test.ts` (37 pass). Full suite identical to v308 baseline otherwise. No locked files touched.

---
# v310 (same session, Ravi's phone test round)

## Payout counted twice (fixed in code; one data row waits for Ravi's OK)
- Cause: the live `transactions` table defaults `refund_status = 'NONE'`, `refund_amount = 0`. Code read "any refund_status"
  as a refund, so on approval the paid row was skipped and a SECOND payout row was inserted (Dell ₹13,000 → two ₹11,700 rows,
  admin mail "₹23,400 (2 approved deals)").
- New `backend/refundFlags.ts` `hasRefund()` used in `campaignGuards.isEscrowDepositRow` (LOCKED), `ugc_routes` isRefundRow (LOCKED),
  `ugcLifecycleService`, `brandPayments` (refunds tab showed every payment as a refund), `campaignRefunds`.
- `creatorPayoutRequests.readyRows`: one row per deal / UGC order.
- Data: duplicate row `f3d6d152…` (deal dbddaa41…) still in the DB — cleanup SQL was not run (needs Ravi's OK):
  merge into `e7d720e7…` (RELEASED) and delete `f3d6d152…`.

## Other fixes
- Admin payout-request email: own subject "💸 Payout request waiting" (was "direct message from Ybex Admin").
- Earnings rows: real campaign / brief title + brand name (`server.ts fetchUserScopedTransactions`), "Campaign deal" fallback.
- Inbox chip (creator): "₹X received" only when paid to bank; approved = "₹X approved · payout next" (`chatStageMap.js`, LOCKED; test updated — requirement change).
- Chat ☰ menu: popups were behind the phone chat (z-50) → z-[1100]; status popup follows the real deal step; footer wording.
- Live link "Ask to resubmit": opens the one sheet directly (the inline box's text was thrown away).
- Draft sent as an Instagram/YouTube/Drive LINK showed "file no longer available" → now an "Open on Instagram ↗" box.
- Draft video: "Full view" button while playing (phone's own full screen is blocked for watermarked drafts).
- Eva: solid green layer behind the chat while typing (page footer showed under the iPhone keyboard bar). The iPhone's
  ^ v ✓ bar itself is iOS and can't be removed from a web app.
- Rate cards: screen used other key names (story / YouTube / UGC never saved or shown); server kept the old `reels`
  value over the new `reel`. Now one set of keys, all variants + `reel_rate`/`story_rate`/`youtube_video_rate` sent
  (only after the rates were loaded, so other saves can't zero them). Save button shows "Saving…".
- Back from a profile screen: closing no longer pushes a page (Back re-opened the screen); opened from Eva "Fix"
  (`&from=eva`) → goes back and Eva opens again (`ybex:open-eva`).
- Meet the Creators: back to column-by-column (Ravi: "isko vesa hi kro"), up to 9; `session48.test` updated.
- Locked files changed with `protectedFlows --update` (logged in docs/code/PROTECTED_CHANGES.md): campaignGuards.ts, ugc_routes.ts, chatStageMap.js.

---
# v311 (same session)
- Footer: no divider line on top (`PremiumFooter.jsx`).
- Chat: "Review & sign agreement" card inside the chat when the price is fixed and I haven't signed (same sheet as the bar).
- Creator home "Best matches": new `components/campaigns/mobile/HomeCampaignCard.jsx` — brand face, posted time,
  closes-in, brief / requirement line, per-creator payout, deliverable, views and applied (same numbers as the
  Campaigns page). `session31.test` pin moved to the new card (Ravi redesigned it).
- Payout card: no ₹13,000 → ₹11,700 flicker (placeholder until the payout row is read); "Route" label on one line.
- Bottom sheets: timed slide (0.28 s) instead of a spring — smoother on busy phones (`lib/motion.js`).
- Waitlist CSV: rows already on Ybex are skipped by email, mobile (last 10 digits) or Instagram handle — checked
  against waitlist, users (phone) and creator_profiles (Explore creators); repeats inside the same file too.
- Still open: duplicate payout row `f3d6d152…` cleanup waits for Ravi's OK.

---
# v312 — Ybex Eva redesign, part 1 (Claude Design handoff "YBEX_Landing_Page_Design.zip" = Eva design)
Spec: design_handoff_ybex_eva/Eva Developer Notes.md. Plan: 1 chat look (this) · 2 brand flows · 3 creator flows · 4 history / settings / attach / desktop.
- New `src/components/feedback/evaUi.jsx`: 8 face moods (hello, wink, excited, proud, hmm, whoa, missed, cheeky; colour never changes),
  `moodFor(text)`, blur pop-in (`.eva-in`), word-by-word replies with ▍ and "Show more" (>170 chars), "Ybex Eva · just now" + 👍/👎,
  2×2 starter boxes, disclaimer, rotating peek lines.
- `FeedbackBot.jsx`: peek bubble rotates up to 8 lines a session (mood + squash, every 3rd line moves, max 4 moves); chat opens EMPTY
  (brand: "Hello {Brand} / Can I help you?" + boxes; creator: big orb + "Hi {Name}, how can I help?" + boxes); today's updates wait behind
  "N updates for you" (the ?assist=new notification still shows them at once); earlier chats via ☰; bubbles per design tokens (DM Sans);
  header orb + every avatar show a mood; disclaimer under the input; Hinglish UI copy → English.
- Brand: "What can you do?" → one line + 5 popular chips; "I need UGC videos" starts the UGC brief (English word order).
- `POST /assist/feedback` logs 👍/👎 (no table — PENDING_DB_CHANGES "eva_feedback").
- AI prompts: always "Ybex Eva", English by default (Hindi/Hinglish only if the user writes so), off-topic rules, rates/fees never shown.
- "Ybex Assist" renamed to "Ybex Eva" in all user-facing text (admin menu, bot replies, notification text); tests updated (requirement change).
- Not yet: brand/creator flow cards (photo cards, question box, apply/invite cards), creator brain copy still partly Hinglish, History/Settings screens, attach sheet, desktop panel.

---
# v313 — Ybex Eva part 2 (brand flows)
- Creator results: horizontal swipe row of photo cards (photo, name, AVG REACH, glow, float, blur slide-in), sort Best / Reach / Followers /
  Top 5 (no rate sort), tap = tick with a lime glow ring, Alert me + Invite n. "creators under ₹X" filters by the brand's budget per
  creator and says "Found n creators who fit your ₹X budget per creator" — rates are never shown.
- Invite sheet from Eva: no "rate card" line, offer prefilled with the brand's budget, hint "Everyone here fits up to ₹X per creator".
- Compare: Niche / City / Followers / Avg reach (no Rate or Reach-per-₹1k), only the "Best value" label. Applicants: "fits budget".
- Glass question box in chat (label, n of N, lime progress, big options, text box + Next + "OR PICK ONE"); answered boxes go away.
- UGC brief: 5 English questions ("What is it for?" product / app / event, format, videos, budget per video with format minimum, requirements / skip).
- Campaign builder: 9 steps in MobileCampaignCreate's order (title, brief ≥15 chars, niche ≤3, platforms, reach tier, payout, deliverables,
  applications close, advanced) → Campaign draft card (Publishing Free · ₹0, Payment hold Only on hiring) with Save as draft (left) /
  Review & Publish (right). Review & Publish opens Create campaign straight on Review & launch (`openView` in campaign_draft; the
  close date is kept). Eva never publishes.
- "What can you do?" (brand): 5 popular chips. Buttons show their label in the user's bubble but send their value.

---
# v314 — Ybex Eva part 3 (creator flows) + glow fix
- Glow fix (brand creators row): the scrolling row clipped the tile glow and lime ring — row now has room on every side
  (padding 26/22/34, negative margin keeps the layout the same).
- Campaigns for a creator: horizontal swipe row of cards (cover / brand initial, CAMPAIGN / UGC tag, match %, title,
  brand · deliverables, payout). Campaign → "Apply in 1 tap" opens the apply form under the row; UGC → "Claim on UGC"
  opens /creator/ugc (claiming needs the OTP agreement there — Eva never calls the claim API). "Show more" chip.
- Apply form: PITCH TO BRAND (20–500, counter "n/500 · min 20" amber below 20), YOUR QUOTE (₹100–₹50,00,000),
  ✅ / ⚠️ line (fair quote ≈ ₹0.30 per average view), full-width "Send application" → "✓ Application sent".
  Same `campaigns/apply` call as before, only on tap; tools.applyTo also checks the new limits.
- Brand invitations: new "invites" intent ("Do I have any brand invites?") + shown first when the chat opens. Card: brand,
  title, offered budget, timeline, deliverables, message; Decline (left) / Accept & open deal room (right) open the app's own
  CreatorReviewInvitationModal (same accept / decline-with-reason calls, file untouched). Card collapses to ACCEPTED / DECLINED;
  accepting closes Eva and opens the deal chat.
- "What should I charge?" now answers: "around ₹X per reel" + ✅ / ⚠️ check of the creator's own reel rate + Set / Edit my rates.
  Chat replies never show the formula.
- Creator opening messages and chip values in English (Hindi/Hinglish replies only when the creator writes so).
- Tests: session58Launch v314 block (rate rule, limits, intents, cards); full suite = baseline.
- Not yet (part 4): History screen, Settings, 📎 attach sheet, desktop docked panel. DB: eva_feedback table still waits for OK.

---
# v315 — Ybex Eva part 4 (history, settings, 📎 attach, desktop)
- ☰ Chats drawer: search box (title + last line — server list now carries `preview`), "No chats yet — tap New chat to start.",
  "Eva settings" button at the bottom. Reopening a chat that ended on a card shows "Show it again" (re-asks with fresh data —
  full cards are not stored, only their type). Back closes the top layer first (settings / sheet / drawer), then the chat.
- Eva settings (new `feedback/EvaPanels.jsx` + `feedback/evaSettings.js`):
  - What Eva can read: "Deals & offers" (creator: invites, due work, brief / checklist · brand: applicants, pending, status) and
    "Earnings & payouts" / brand "Payments & reports" (earnings, KYC/payout check, share card · brand monthly report). Off → Eva
    doesn't read it and says which switch to turn on, with an "Open Eva settings" button. Stored on this phone (per user).
  - Notify me from Eva: server-side — one "eva_mute" alert row; the 30-min alert job keeps lists fresh but sends no bell / push
    to that user. Works on every phone. (No new table or column.)
  - Reply language English / Hinglish / Hindi → sent to the AI (`lang`); if the user writes in another language Eva follows them.
  - Download my Eva chats → new `POST /assist/export` emails a .txt of all chats ("✓ Sent to your email").
  - Clear all chat history → two taps ("Tap again to clear everything"), wipes every chat.
- 📎 attach sheet: Photo / Screenshot / Document (PDF, Word, text). The file shows in the chat; Eva asks what to do: Report a problem
  (next line goes to the team with the file), Send to Ybex team, Explain it (documents — Eva asks to paste the text; she can't open
  files yet), Remove. Typing with a file still makes a report, as before.
- Desktop (new `feedback/DesktopEva.jsx`, mounted in Layout): from 768px Eva peeks bottom-right on brand / creator pages (not chat,
  inbox, onboarding, KYC, post wizards, admin). ≥1100px: docked glass panel 520px, 16px from the edges, radius 28, page stays usable;
  768–1099px: full-height drawer. Header: orb + Ybex Eva + BETA · ☰ · + New chat · Close. Below 768px nothing changes.
- AI gets the last 8 messages (was 6). Brand opening messages in English; compare reply no longer mentions "reach per ₹1,000".
- Tests: session58Launch v315 block; full suite = baseline.

---
# v316 — Eva settings saved on the server (Ravi approved "eva_settings")
- New table `eva_settings` (user_id, deals, money, lang, updated_at), RLS on, server-only — applied live as migration
  `session58_eva_settings` (scripts/sql/session58_eva_settings.sql). docs/database/PENDING_DB_CHANGES.md updated.
- `GET / PUT /assist/settings`. Eva loads the user's settings when the chat opens (before reading any data) and saves every
  change to the server; the phone keeps a copy, so Eva still works if the server is down. Settings now follow the user to
  every phone and computer. One row per login (brand team members keep their own).
- Tests: session58Launch v316; full suite = baseline.

---
# v317 — Eva 👍 / 👎 saved (Ravi approved "eva_feedback")
- New table `eva_feedback` (user_id, role, vote up/down, card, first 400 chars of Eva's reply, created_at), RLS on,
  server-only — applied live as migration `session58_eva_feedback` (scripts/sql/session58_eva_feedback.sql).
- `POST /assist/feedback` now saves each vote (the log line stays too). New admin-only `GET /admin/eva-feedback`.
- Admin → Help desk → Chatbot: "Eva reply ratings" box — 👍 / 👎 counts and % liked for the last 30 days, "See replies"
  with filters Disliked / Liked / All (Eva's reply text, role, card, time).
- docs/database/PENDING_DB_CHANGES.md: both Eva tables marked DONE. Tests: session58Launch v317; full suite = baseline.

---
# v318 — Review & pay (brand → creator deal) redesigned + payment bug hunt
Locked files opened (Ravi asked: "payment page ache se design karo, fully functional banao, bugs dhundo"), logged in
docs/code/PROTECTED_CHANGES.md: razorpay.js, useChatThreadMobile.js, deals_chat_routes.ts, payment_routes.ts (+ screen files
MobileEscrowSheet.jsx, DealDetail.jsx, BrandUGCMobile.jsx).
- Review & pay sheet: "Choose how to pay" — UPI (Fastest, default) / Debit-Credit card / Netbanking as real radio cards
  (icon, bank / app names, selected ring). The choice opens Razorpay straight on that method (`prefill.method`); button
  says "Pay ₹X with UPI". Razorpay window in Ybex purple. Payment-app logos: official files go in public/pay-logos/
  (gpay, phonepe, paytm, visa, mastercard, rupay .svg — README there); until then a name chip shows.
- Fewer popups: no "Verifying…" / "verified" / "secured" toasts on top of the sheet's own "Payment successful" page.
- Bug: every deal payment posted "💰 Payment Secured!" twice in the chat (the duplicate check asked for a column `id`
  that chat_messages doesn't have, so the check always failed). Fixed. (The old duplicate on the Dell mouse deal stays.)
- Bug: create-order turned a missing amount into a made-up ₹1,000 order → now refused ("amount isn't set yet").
- Bug: Razorpay was pre-filled with the name "Brand User" when the brand had no name → empty now.
- Bug: desktop Deal page "Pay" showed ₹0 (it read `proposed_amount`, which the deals table doesn't have) → agreed amount.
- Bug: UGC brief Review & Pay showed budget × creators but charged max(budget, format minimum) × creators → shows the
  charged total; all money in Indian format (₹1,30,000).
- Copy typos: "secure secure payment hold" ×4, "Secure payment Deposit", "(100% Secure Payment Hold Protected)".
- Checked: the Dell mouse deal really was agreed at ₹13,000 (creator asked ₹15,000, brand countered ₹13,000, creator
  accepted) — the ₹13,000 on Review & pay is correct.
- Tests: session58Launch v318; session57Money pin updated (method passed to payIntoEscrow — requirement change).

---
# v319 — Bug hunt round 2 (Ravi: "find more bugs and glitches now")
How: every database query in the code was checked against the LIVE table columns (a query that names a missing column
fails as a whole), plus two read-only audits of the creator and brand screens. Locked files opened are logged in
docs/code/PROTECTED_CHANGES.md (campaigns_routes, deals_chat_routes, content_submissions_routes, payment_routes, ugc_routes).
Database (wrong column → the whole query silently failed):
- Admin → Chatbot reports had no name / email / phone (users select asked for city / photo).
- UGC deal "/pay" follow-up never set the thread ACTIVE (wrote missing payment_funded) — same bug as the campaign one.
- Creator verification results were never saved (5 unknown columns); performance metrics lookup used entity_id.
- Collab deliverable upload looked up collabs by `id` (key is collab_id) → always "Collab not found".
Brand:
- Campaign languages were always saved as "Hindi" (screen sends `languages`) → saved as "Hindi, English"; edit reloads them.
- Payments: campaign refunds never showed (looked up by brand_id, rows have none) → found through the brand's deals.
- Payments: a cancelled UGC brief showed "Released" with its full amount → "Cancelled · refunded to you".
- Payments: step "Creator deliverable submitted" was always ticked → only when work came in; refund promise "30 hours to
  source account" → "refund account, usually 1–2 working days"; receipts named the payee "Content Creator" → real name.
- Home: "N unread messages" never appeared (wrong field) → uses unread_count; invented "50K" reach and "10k+ creators",
  desktop "140+ premium creators" removed; Explore niche chips matched "ai" inside "chai/hair" and "style" in every
  "lifestyle" → whole words; "Payout Payout Amount" typo; payout popup said every video was "Reel · 30s · Master v1".
- Rupee amounts in Indian format (₹1,00,000) in the deal chat pill, UGC orders, payout popup, UGC payments.
Creator:
- Completed UGC orders said "Payment cleared · Disbursed to bank" right after approval → "Approved · Payout next" until
  the UTR exists, then "Paid to bank".
- /creator/ugc/earnings on phones showed "KYC not submitted" for verified creators → phones open the full Earnings screen.
- UGC earnings rows were all "UGC Fast Turnaround Order · Brand Partner" with the claim date → real brief, brand, approval date.
- Home banner with an https link opened the 404 page → opens the link; Active deals showed "Campaign Sponsorship" for
  direct collabs → real deliverable; payout card "Download PDF" downloaded the video → "Download video"; the "alert admin"
  box still showed after the payout UTR → hidden; admin alert always said "Brand requested" → says who asked.
Needs Ravi's decision (NOT changed):
- Launching a saved campaign DRAFT makes it live straight away, skipping admin review (new campaigns go to review).
- UGC claim screens promise the full brief budget; the creator receives it minus Ybex fee + GST.
Tests: session58Launch v319; session43V287Feedback pin updated (its query asked for columns that don't exist); suite = baseline.

---
# v320 — Ravi's two decisions
- Launching a saved campaign draft now goes to admin review (status under_review + the same "under review, live in
  2–3 hours" notice as a new campaign). Toast: "Sent for review — the Ybex team checks it…". session28 test updated
  (requirement change). Logged in docs/code/PROTECTED_CHANGES.md.
- UGC claim screens: keep showing the brief budget only (no "you receive ≈ ₹X" line) — no change, as Ravi decided.

---
# v321 — Bug hunt round 3 (accounts, KYC, notifications, admin)
Accounts / KYC:
- Submitting (or an admin rejecting) KYC set users.verified=false — that flag means EMAIL verified, so the user could no
  longer log in with their password. KYC no longer touches it; admin screens no longer read it as "KYC approved".
- Change email said "updated" but changed nothing (wrote a missing column). Fixed; phone / password changes also report
  a failed save instead of a fake success.
- Desktop login: "verify your email" pointed at a missing "Use OTP" button → sends the code and opens the verify screen.
- Password reset now also marks the email verified and signs out old logins on other devices.
- Security: when a never-verified account is verified via login code or Google, a password set before verification is
  cleared (someone else could have signed up with that email).
- Desktop creator KYC lost the IFSC and UPI QR (field names) → saved; KYC save failures now say so; a missing PAN photo
  was replaced by a stock picture → left empty; team-member avatars were a stranger's stock photo → empty.
Notifications:
- Desktop bell ignored the link the server sends → uses it first, then the type rules, then the phone bell's fallback.
- UGC "deliverable submitted" notification lost its link; the never-saved "Welcome" notice brought the badge back every minute.
Admin:
- Escrow: failed / cancelled payments counted as held money and showed Release / Refund → "Payment not completed", no
  buttons; UGC brief deposits no longer show "Refunded"; refunded rows lose the money buttons.
- Mobile payouts: bank details always blank → shown; "Paid today" showed the all-time total → today only; the UGC refunds
  queue opens on phones.
- Payout breakdown now has the "GST on fee" line (rows add up); receipts no longer print a made-up GSTIN / invoice no.
- Help desk "Resolved today" counts resolved today; fake "~15m" removed. Dashboard "Pending UGC deliveries" was always 0.
- KYC review: no made-up "2+ Years", niche or Instagram handle. Resolve report saves who / when and reports failures.
- Referral withdrawals: only a REQUESTED one can be paid / rejected (no double payout); buttons lock while saving.
- Waitlist message: reaches the applicant's real account (or says "saved, no account").
Needs Ravi's decision (NOT changed):
- "Suspend user" only emails — nothing actually blocks the account (needs a `suspended_until` column + login check).
- Chat violation "Warn / Restrict" only changes a label.
- Login sessions never expire (7-day expiry exists in the table but isn't checked — turning it on logs everyone out weekly).
- Login rate limit can be bypassed with a fake X-Forwarded-For header (depends on the hosting proxy setup).
- Google sign-in without the popup lands logged out (rare fallback path).

---
# v322 — Bug hunt round 4 (security, deal chat, UGC money) + chat Warn / Restrict (Ravi: "hn")
Chat violations (Admin → System reports): Warn sends a real warning (recorded in user_violations + bell notice);
Restrict pauses the person's chat for 7 days (the send route refuses with "Your chat is paused until …"); new "Lift chat
pause" button ends it early. No new table (backend/chatRestriction.ts).
Security:
- Campaign payout / live-link routes accepted UGC order ids with NO ownership check → a creator could mark their own UGC
  payout released. UGC ids are now refused there (UGC has its own guarded routes).
- Draft approve / request-changes: only the deal's brand (a creator could approve their own draft). Collab accept /
  reject: only the person the proposal was sent to.
- Test-payment simulation now needs a signed-in brand. Quick-admin PIN: 5 wrong tries → locked 15 min, tries logged.
- Creator date of birth (stored inside rate_card) no longer in public profile lists; GET /creators strips emails/phones.
- Creator reviews only by a brand that completed a deal with them, once. Unpublished campaigns / briefs not readable by
  strangers. Sending a campaign for review via "update" needs brand KYC too.
Deal chat:
- Typing "payment released kab hoga?" closed the chat for both sides (text was matched) → only system cards count.
- Signed agreement showed ₹0 after an accepted counter → agreed amount. Desktop offer box pre-filled a made-up ₹15,000.
- Unread badge never cleared (messages without receiver) → marks read what the other side sent.
- Brand team members: inbox empty and counter / accept refused → they act for their brand.
- Payout card "Platform Fee (NaN%)" / wrong fee → saved fee; brand "Respond to offer" had no Accept for application /
  invite offers → amount read; offer card "1 revision included" → 5 (the real limit); deal panel stages, revisions left,
  date and ₹ format.
UGC money:
- Approving ONE order closed a multi-slot brief → paid slots could neither be claimed nor refunded. Now only when every slot
  is delivered.
- Signing again reset the draft deadline (endless extensions) → an order signed once keeps its timer.
- Brief cancel vs a claim at the same moment could refund AND pay one slot → cancel also checks the claim count.
- Refunds queued before the brand had a refund account could never be paid → get the account when it's added.
- A draft upload could revive an expired / cancelled order (stale local copy) → live row re-read first; the old submit route
  can't reset an approved draft; a failed slot close no longer reopens a refunded slot.
- Brand's change notes were never saved (missing columns) → saved; expiry/cancel notes went to a non-existent chat → real chat.
- Brand UGC orders: deadline showed "pending" and titles "UGC Deliverable" (wrong fields); Review / In progress filters hid
  live-link and revision orders → fixed.
Tests: session58Launch v322; session28 KYC-gate count pin 2 → 3 (requirement change: update also checks KYC). Suite = baseline.
Still open (decide / later): real Suspend (needs `suspended_until` column — asked Ravi); sub-admins can still use some
non-/admin money routes; inbox stage chips (counter shown to both sides, "In production" before payment); desktop chat
file attachments not shown; counter / accept don't push live to the other side (15 s poll); UGC reminders spacing for
48h/72h briefs; night-time expiry emails dropped.

# v323 — Bug hunt round 5 (data leak, public pages, Ybex Eva)
Security / data:
- Brand "applications" list (browser DB route) had its campaign filter inside a comment → every brand saw every brand's
  applications. Filter restored.
- Creator profile: a creator opening their own profile counted as a view; profile lookup by email removed; an empty
  profile is auto-created only for the creator themself (strangers created fake rows); deleted profile → 404.
- Rates on the public profile / GET creators / Explore now carry the platform markup per viewer, same as the rate card
  (they were raw on some fields). LOCKED file opened: backend/creators_routes.ts (protectedFlows --update, logged).
Public pages:
- Campaign card: no ₹10,000 fallback budget, no fake "Deals" column, no hard-coded "Jun 30, 2026"; Completed / Rejected badge.
- Campaign detail: no invented "10k+ followers / Pan India"; Share copies the link; closed campaigns hide "Actively
  reviewing" and Apply ("Applications are closed"). Campaigns list: no fake view counts.
- Creator public page: no invented category / bio / barter / payment defaults; languages shown properly; ₹ in en-IN.
- Info pages: careers → mailto support@ybexmedia.in; WhatsApp +91 87640 04299; unknown page → "Page not found".
- Explore "Budget: low to high" sort did nothing (read fields the API never sends) → uses the real rate.
Ybex Eva:
- Brand bug reports ("payments page not loading") were swallowed by a feature → go to the team (like creators).
- "report a bug" opened the monthly report → report needs month / summary words.
- "new chat" DELETED the current chat → now just opens a fresh one (old stays in ☰ Chats). "clear chat" still clears.
- English: "create a campaign", "who applied", "budget of 10k", "less than 5000", "creators for my campaign" (was status).
- Creator side: "pan india" opened KYC; "payment pending" went to deadlines; "my deadlines" not understood; "to do"
  matched any "want to do".
- Rates private from brands: no sorting results by rate, Compare shows "Highest reach" instead of "Best value" (₹-based).
- Settings respected: brand status hides the payment-hold line when "Payments & reports" is off; creator script help
  doesn't read orders when "Deals & offers" is off.
- Switching chats while Eva was thinking put the reply (and saved it) in the wrong chat → dropped. Opening an old chat
  resets the half-finished ticket follow-up.
- "N updates" for saved searches were marked seen just by opening Eva → seen only when shown.
- Creator to-do: approved UGC needing a live link (COMPLETED_APPROVAL) was missing. Fallback script (AI off) in English.
- Messages Eva didn't understand were filed as admin tickets → not filed (bugs / ideas / questions / screenshots still are).
- Backend: Eva export max 3 a day (sends email), feedback brands/creators only + daily cap, history writes capped;
  the "alerts off" switch / creator work alert no longer push out a brand's 5th saved search.
Tests: session58Launch v323. Requirement-change test updates (commented): assist_store ("nayi chat" no longer clears),
brandAssist (no rate sort for brands). Suite = baseline.
Still open: Suspend (needs `suspended_until` column — waiting for Ravi's "haan"); public profile/Explore show creator rates
to brands (Eva treats them as private — confirm which is intended); logged-out visitors still see sample campaign stats.

# v324 — Bug hunt round 6 (accounts, money, campaigns, uploads, dashboards)
Accounts:
- Brand "company details" save overwrote the LOGIN email + phone with the POC business email/mobile (no OTP) — an old
  POC email silently undid an Account → email change. Now only the brand profile keeps them. A creator could also post
  here and change role → brand accounts only, role never changed here.
- Delete account: the "money on hold" check used columns deals doesn't have → always skipped (accounts with escrow
  could be deleted). Fixed (read-only payment check). A failed delete no longer says "deleted" and logs out.
- Settings → change password now signs out every other device. Sessions list no longer sends every device's login token
  to the browser, and marks this device as current.
- "Offers and promotions" off now really stops promo emails. Creator settings save no longer reverts the login phone.
- Forgot / reset password use the same email lookup as login (spaces, capitals, old duplicate rows).
- Onboarding: brand social links saved; "onboarded" written only after the profile saved; creator "Profile Submitted!"
  only when it really went through. Profile update reports real failures. Forgot-password fills the email from the link.
- Delete-account screen no longer promises removals that don't happen.
Money:
- Admin "Freeze escrow" (dispute) didn't stop a payout → release refused while frozen.
- Payouts need approved creator KYC (server checks request + release); admin screens no longer show a fake "Verified KYC".
- A changed-while-saving payout answered "ALREADY_PAID" → phone moved an unpaid item to Transferred. Now TX_CHANGED.
  Creator "request payout" can't turn an already-paid row back to requested.
- Desktop Earnings: Request Payout now asks for ALL approved money (deals + UGC) like the phone; "earned" counts only
  money that reached the bank; the button shows the approved amount.
- Referral withdraw: two taps could create two payable requests; two admins could both mark paid + reject → guarded.
  Referral share counts only money actually paid (not RELEASED), once per deal. ₹21 friend / welcome rewards could
  never unlock (read KYC from columns users doesn't have) → KYC table. Referral stats showed 0 rewards → real numbers.
- Receipts / invoice PDF invented a 15% / 10% fee on zero-fee deals (and lowered "net payout") → stored fee only.
- UGC "alert admin" did nothing (id lookup errored) → flags the order's payment.
Campaigns:
- Back on the desktop Edit screen saved a LIVE campaign as a draft (took it offline) → Back only goes back.
- Deals page: brand Accept / Decline never showed (status case), Decline sent a word the server refuses, and the list
  was empty (bad join) → fixed; team members see their brand's applications.
- Applying worked on drafts / under review / rejected / past-deadline campaigns, by brands, even to their own campaign →
  only creators, only live, before deadline (+1 day). Desktop page hides Apply after the deadline.
- Editing a fixed-fee campaign was blocked ("min < max"); editing a closed campaign reopened it → fixed / refused.
- Rejection reason now saved; double-tap Accept can't open two deals + chats; local drafts no longer create duplicate
  campaigns; applicants CSV had 4 empty columns; "N creators match" counts word matches, skips deleted profiles.
Uploads / dashboards:
- /upload read the whole file into memory before checking sign-in → sign-in first, 100 MB cap.
- KYC / PAN / UPI QR files were sent "cache publicly for a year" → private, no-store. KYC images open with the media key.
- Files named without a dot / with spaces failed to upload → safe extension.
- Brand spent counted UGC refunds as spending; "Active collaborations" counted cancelled deals; brand phone "live links
  to approve" never cleared and "new applicants" was always 0; creator phone showed cancelled deals as IN PROGRESS;
  brand campaign cards showed ₹15K–25K / a fixed date / guessed platform → all real now (brands get the real view count).
- Creator auto-profile had score 75 / Lifestyle / fake view; tier now from each deal's own score; admin queue showed
  115,000 followers for 0.
Tests: session58Launch v324. Requirement-change test updates (commented): campaignManage (applicant must be a creator),
brandAssist (AWAITING_LIVE_LINK is the creator's turn). Suite = baseline.
LOCKED files opened (protectedFlows --update, logged): campaigns_routes, content_submissions_routes, payment_routes,
campaignManage, creators_routes.
Open (need Ravi): brand payment sheet shows creator payout + Ybex fee + GST, creator Ready sheet shows fee + GST — hide?;
campaign targeting fields (gender, followers, locations, max creators, dos/don'ts) have no columns → dropped on save
(DB change); YouTube avg views has no column; a partial refund blocks the rest of the payout; sessions never expire;
Suspend (`suspended_until`) still waiting.

# v325 — Bug hunt round 7 (admin, notifications, UGC, public pages)
Admin:
- Any sub-admin could skip the permission gate by writing the URL in capitals (/api/Admin/users…) → gate ignores case.
- The "don't warn / ban / delete admins or yourself" guard never worked (read a column users doesn't have) → fixed, and
  the same guard now also covers creator edit / bin, restore, unban, reinstate, unrestrict and templated warnings.
- KYC reject and admin creator edits wrote users.verified (= EMAIL verified) → people locked out of password login and
  their account open to re-sign-up takeover. KYC approve also marked unproven emails verified. All removed.
- Rejecting one verification overwrote all of the user's verifications → only that one / open ones.
- Push + email broadcasts read only the first 1000 users (and push reached banned users) → every page, active users.
- Activity log showed "System" for every action → admin email saved. Waitlist approve-by-user lookup errored → fixed.
- Admin "set password" said saved when it wasn't; used a 6-character rule → checked, normal password rule.
- Sub-admins got error toasts on Overview; growth report showed brand emails/phones to any staff; feedback readable by
  any sub-admin → fixed.
Notifications:
- Admin alerts (payout due, refund due, KYC submitted, new signup) were never saved: a fake 'admin' row broke the whole
  insert → one row per admin. "Send to all" and app-version notices had the same problem → one row per user (now each
  person can also mark it read).
- Logging out on a shared phone kept the account's pushes coming → phone goes back to guest on logout.
- "Offers and promotions" off now also stops promo pushes. Broadcast email queue can't send the same mail twice.
- User-typed text in admin alert emails is escaped (a sign-up name could put a fake link in a real Ybex email).
- Order-expired / brief-relisted emails were lost at night → sent (WhatsApp still waits). Push loop no longer drops
  notifications saved a little late or during a restart. UGC bell items open the order again. Notifications for a
  deleted account no longer create a fake "placeholder" user. "Contact support" on warning pop-ups now opens Help.
UGC:
- A creator could send a live link before the draft was reviewed → next Approve paid out with no review, order never
  expired, brand couldn't cancel. Now: live link only after draft approval (server + phone).
- Live-link corrections had no limit and reset the revision counter → counted against the limit.
- Brand UGC Payments page crashed (null creator) and "In Payment Hold" was always ₹0 → fixed.
- Briefs/campaigns from brands whose name contained "ravi"/"nexus" (e.g. "Gravity") were hidden from creators → exact
  demo names only. Public /ugc/showcase leaked full brief records → open briefs, safe fields.
- Approving an already-approved draft moved the order backwards → refused; phone shows the right buttons per state.
- Re-claiming after a brand cancel failed with a generic error → clear message. Old submit route could revive expired
  orders → live row. /ugc-orders showed every brief + other creators to anyone signed in → scoped.
- "Manager Override" (in-house team) only changed a local copy → switched off with an honest message.
- Brand desktop showed multi-slot briefs "Completed" too early; chat card showed a made-up "7 days" → fixed.
Public / reviews:
- Profile handle lookup let anyone test emails again ("zz,email.eq…") → only real handles.
- Deal-chat reviews were saved but never shown on creator profiles → shown. Reviews only after the deal is complete,
  one per side; team members can't post repeat profile reviews. No invented "Exceptional…" quote or 5 stars.
- POST /reports needed no login → signed-in only, sizes capped. Contact form threw messages away → opens email.
- Profile views counted every reload/bot → one per signed-in visitor per day. Leaderboard used missing name columns
  and showed hidden profiles → fixed.
Tests: session58Launch v325. Suite = baseline.
LOCKED files opened (protectedFlows --update, logged): campaigns_routes, chat_routes, ugc_routes, creators_routes.
URGENT open (needs Ravi's OK — DB change): brand_profiles / creator_profiles / creator_verifications are readable by
anyone with the public app key (emails, phones, DOB inside rate_card, KYC risk notes). Fix = drop those public-read
policies after moving the few browser reads to the server. Also open: admin "Fees & Risk" settings (payout freeze,
limits) aren't saved/enforced (need columns); robots.txt blocks public /creator/ and /brand/ share pages (intended?).

# v326 — Bug hunt round 8 + database fixes (Ravi: "ok" to the privacy fix; "database … sab bna dena")
Database (applied live): campaign targeting columns, youtube_avg_views, users.suspended_until, transactions.razorpay_payment_id,
payout_status default PENDING, drafts / proofs / UGC buckets private. See docs/database/PENDING_DB_CHANGES.md.
Privacy: every browser read of brand / creator profiles now goes through the server (+ new /creators/review-queue count).
The final step (drop the public-read policies) is scripts/sql/session58_close_public_reads.sql — the database tool refused
DROP statements, so Ravi runs it once in the Supabase SQL editor.
Suspend: really blocks the account (login says "Suspended until <date>"; open sessions end); unban / reinstate lift it.
Campaigns: gender / follower range / locations / creators needed / paid-barter are saved and shown; fake dos / don'ts /
hashtags not sent; no campaign goes for review with a past deadline; old drafts don't bring back a past deadline.
Payments: a second payment for an already-funded deal is not recorded as a second deposit (admins told to refund);
duplicate-insert races answer "already paid" (no extra "Payment Secured", no false error); webhook asks Razorpay to retry
on a temporary error; closing checkout after paying no longer shows "Invalid signature"; only captured money counts;
a part refund no longer blocks the rest of the payout (creator gets the rest); refund status only PENDING / PROCESSED;
a second Pay tap no longer drags a deal in production back to ACTIVE; status poll lookup fixed; paid UGC brief orders that
never became a brief alert admins after 10 minutes; payment id + brand saved on the deposit; UGC refund rows not counted
as payouts.
Contracts: no signing while a counter-offer waits or before a price; the contract shows the thread's agreed amount and the
server refuses a signature for a different amount; Accept on an older offer card is refused (newer offer); counters
limited (₹3,000–₹1 crore for campaigns, whole rupees); no agreement prepared during a counter; the old deal-page sign,
draft, live-link, approve and request-changes routes now follow the chat's stage rules (no reopening completed deals, no
live link before draft approval, deal's own revision limit); admin dispute resolution also closes the chat.
Coupons / team / blog: auto-apply launch offer was never saved → saved and shown; minimum deal value applies at payment;
per-user limit counted; coupon fee rate can only lower the fee; expiry lasts the whole last day (IST); 0 = unlimited uses;
FAQ create fixed (uuid); helpdesk replies need the helpdesk permission; brand promo box hidden (not applied yet).
Team members (local-only, any role could spend) and agency "create creator" (fake verified profiles) switched off until
built properly. Blog HTML cleaned on save and on display (a post could run script and steal logins); author saved.
App / routing: Back no longer bounces between dashboard and onboarding / login; after login you land on the page you
opened (email links); "Finish later" creators open the dashboard; links /brand/ugc, /creator/dashboard, /creator/refer,
/auth/register work; agency accounts get brand pages; brand settings / profile brand-only, Explore not for creators;
app updates wait for "Refresh" (no reload in the middle of an OTP or payment) and are checked when the app comes back;
applicant cards show no made-up ₹12,000 / "5 days" / pitch; dates in IST; ₹ amounts in Indian format; Back buttons on
shared links stay in the app; Eva's cache belongs to one account; admin phone nav highlights the open tab.
Tests: session58Launch v326. Suite = baseline.
LOCKED files opened (protectedFlows --update, logged): campaigns_routes, deals_routes, deals_chat_routes,
content_submissions_routes, payment_routes, src/utils/feeCalculator.ts, creators_routes.

### v327 — Ravi's answers to the permission questions
Q1 brand payment screens/APIs show only the total paid (no creator payout, Ybex fee or GST). Q2 creator sees fee; GST row
and "GST invoice" only when admin turns GST on (else "Download receipt"). Q3 "payment released" chat card + live event show
the deal total, not the after-fee amount. Q5/Q6 old duplicate ₹0 row and 15 old completed briefs left as they are.
Q7 logins last 30 days and renew while the app is used (old 1-year sessions cut to 30 days). Q8 rate limits use the real
IP (last X-Forwarded-For entry). Q9 CORS: ybexmedia.in (+ subdomains), ybexapp.ai.studio, the app's own host.
Q10 public profiles unchanged (little SEO value). Q11 Fees & Risk now real: admin "Freeze all payouts" blocks creator
requests and admin releases; minimum withdrawal checked on "Request payout" (live value ₹500); min / max campaign budget
checked when a campaign is sent for review (barter and drafts not limited; only after admin saves a value). Withdrawal fee
and dispute window are still not used anywhere (hidden from the form). Q12 team members stay off. Q13 brand coupons: not
built (waiting for Ravi). Q14 Do's / Don'ts / Hashtags boxes on desktop + mobile campaign forms, saved, shown on the
campaign page. Q16 desktop chat attachments saved + shown (private link); counter and accept show live on the other side;
the counter "Respond" prompt only for the side that received it; ACTIVE-before-payment no longer says "In production";
both-signed-not-paid says "Pay to start" / "Waiting for payment"; 48/72h UGC reminders spread across the window (24h same).
Q17 Google sign-in: popup blocked → continues in the same tab; popup that lost its link back finishes on /app/oauth and the
first tab follows — no more landing logged out.
Tests: session58Launch v327 (486). agreementRecord test header updated for Q8 (requirement change, commented).
LOCKED files opened (logged): payment_routes, campaigns_routes, deals_chat_routes, chat_routes, agreementRecord, chatStageMap.
Q4 (creator rates visible to brands on public profile / Explore): Ravi — later, Phase 2. Left as it is.
Q15 (sample views/stats on campaigns for logged-out visitors): Ravi — keep them showing. No change.
Q13 (brand coupon at payment): Ravi — not now. Brand promo box stays hidden.

# v328 — Ybex Eva bug hunt (Ravi: "find bugs and glitches in eva")
How: 4 read-only audits (chat shell, brand flows, creator flows, server) → fixes → an independent review re-ran ~400
source pins of 13 test files against the edited files (all hold). No locked files, no DB schema change.
Chat shell (FeedbackBot / EvaPanels / evaUi / evaSettings):
- Phone / browser Back now closes Eva's top layer (settings → 📎 sheet → ☰ drawer → chat) instead of leaving home.
- Scrolling up near the top no longer closes the chat (swipe-close only from the top bar, list at top, no panel open).
- No double send while Eva is thinking (double tap on a starter used 2 of the 30 daily messages and broke drafts);
  a question-box tap made while Eva is busy keeps the box open.
- Late replies no longer land in a new / other chat; the fallback no longer wipes text typed meanwhile.
- Closing resets settings / sheet / drawer; "new creators" notification opens Eva even if already mounted.
- Settings switch no longer snaps back when the server answer arrives late; "Notify me" switch usable if the check fails.
- Closed chat hidden from Tab / screen readers. 👍/👎 saved once per reply. Failed attach says so.
- Delete chat = two taps ("Tap again to delete"). Creators get their own "Ask me about…" line. Chips send English.
Brand:
- Application counts were always 0 (pending / status / "rank my applicants") → counted from `applicants`.
- "Fits budget" now uses the applicant's own bid (never shown). Budgets: "under 8000 male" was ₹800 crore (the "m" of
  male read as million) → units only as whole words; "2.5k" UGC budget was ₹25,000; payout "1.5 lakh" was ₹2;
  ranges "50000 to 1 lakh"; "cr" understood.
- "Create a campaign for my brand" didn't start the builder (and some went to the team as an idea).
- A half-done brief / campaign swallowed "new chat", bug reports and new searches → switching drops the draft with a note;
  old question boxes can't answer the current question.
- "Show more" skipped creators 13–20; "more creators in Delhi" paged the old search; "Lifestyle" also ticked Fashion;
  "2 weeks" / "1 month" / "30 Nov" close dates; date chips one day off after midnight IST; requirements text changed the
  video count; money questions respect "Payments & reports"; Hinglish bits in English replies; reply-language setting used;
  applicants not on Explore show their name / photo.
Creator:
- Cache refresh never worked (applied campaigns still showed "Apply in 1 tap" for 3 min).
- Approved-not-paid (RELEASED) money showed as paid → "Approved · payout next" until UTR; paid-jobs count only paid/approved.
- UGC "You get ₹X" → "Brief budget ₹X" (gross; no fee line, per Ravi's decision).
- Eva's own suggested quote got her ⚠️ → same fair quote + 10% band as Settings.
- Routing: "turn off alerts", "brand offers", feature ideas reach the team, "to do", "paise kab milenge", "get paid",
  platform-fee question, "rate my profile", "how does it work?" (opened campaigns).
- "apply … quote ₹5,000" read 5 as a count → amount pre-fills the quote, named brand picked; paused campaigns hidden;
  "4,500.50" quote → 4500; Earnings switch off hides KYC/payout items; finished deals off the to-do; UGC "Show more";
  invite cards stay in sync / "No longer open"; no "next payout" date (field never sent); IST month; 1.5L style counts.
Server (assist_routes / assist_store):
- Chat list loaded the OLDEST 2,000 messages (new chats missing from ☰ and export) → newest.
- Alert job read only 1,000 saved-search rows unordered (mute could be missed) → paged by id; creator scan ordered + paged.
- Max 1 mute + 1 work-alert row per brand. Export 3/day counted in the DB (was per server memory).
- "Messages left" correct with the DB counter; a failed AI call gives the message back. Feedback save errors logged.
- 64 KB cap on /assist bodies; seen-ids sliced first; mark-seen race fixed; AI intents include alertsOff / invites.
Tests: new brandAssistV328 (18), creatorAssistV328, backend/evaV328 (+assist_store 16 pass). creatorAssist "paid jobs"
pin 2 → 1 (requirement change, commented). npm registry was blocked in this session → full `npm run verify` not run;
tests run with bun (Eva tests 97 pass; 1 file can't load without web-push, same as before).
Open (Ravi to decide): Eva chats / export / "Notify me" are shared by a brand's whole team (keyed by parent brand) —
keep, or per member? Every question-box tap counts toward the 30/day limit — keep?

# v329 — Ybex Eva round 2 (Ravi: "more bugs in backend + UI/UX glitches in Eva")
Backend:
- AI prompt: user text fenced (can't break out of the prompt); answer size capped; creator rate fields stripped from any
  brand context; all model tries share one 21 s budget (phone waits 25 s).
- Eva settings PUT: junk values → 400; a partial save changes only what it names (used to reset other switches).
- Export: full chats; DB error reported (was "No chats yet" email); failed email doesn't use one of the 3/day; IST file name.
- Saved searches: creators only work alerts + mute, brands only creator searches + mute (a creator's search alert named
  other creators; a brand's work alert showed other brands' campaigns); bad id → 404 (was DB error).
- /assist/creator/insights creators only (brands could read other brands' budgets per niche).
- Bad chat id gave another chat / could delete every chat → empty chat.
- Alerts: "budget up to ₹X" compares the marked-up price brands see; paused / closed campaigns not announced; no bell / push
  to banned, deleted or suspended accounts, and those creators aren't named.
- Sub-admins (with helpdesk permission) can open Eva ratings + feedback inbox; feedback threads no longer cut at 1,000 msgs.
- LOCKED (protectedFlows --update, logged): campaigns_routes — brand names / logos read only for listed brands (in 150s;
  brands past 1,000 lost name + logo), "already applied" read with the server client; creators_routes — Explore paging
  in a fixed order (creators skipped / shown twice).
Chat UI:
- iPhone: typing bar no longer pushed under the keyboard in an empty chat; peek stays on screen on short phones / landscape.
- Peek now under drawers / menus / sheets (was on top), still above the page and clear of the bottom nav.
- List doesn't yank to the bottom while reading older messages; "Show more" doesn't jump; long links wrap.
- Greeting animation plays on every open; "reduce motion" switches all Eva animation off; "just now" updates.
- Send dimmed while Eva answers; Enter doesn't send a half-typed Hindi word; chat list load error + "Try again";
  Escape closes the top layer on desktop; focus in / out of the panel; desktop page makes room for the docked panel;
  bigger buttons, better contrast.
Cards:
- No "₹NaN", "undefined", "0 of undefined", "undefined% match", "Invalid Date"; dead photos / logos → initial.
- "Copied" only when it worked; "Alert me" / "Save as draft" / Invite / Apply can't double-send and say when they fail;
  ticks cleared after invite; "Top 5" from visible cards; paging text right on the last page.
- Swipe rows no longer drag the whole chat sideways or trigger the phone's back gesture.
- Brief box shows "n/15" (Next enabled at 15); question text 16px (iPhone no zoom); chips ignore double taps.
- Brand: "fashion in Jaipur" as an answer runs the search, Compare up to 3 + says names not found, 1.5L / 1.2Cr style,
  "10-50k", IST month for the report; product name no longer read as "ads".
- Creator: "Already applied" shared across cards (reset on a different login); "2026" not read as a ₹2,026 quote;
  emoji / Hindi letters count once in the pitch; empty earnings state ("No earnings yet"); paid jobs = reached bank;
  plain-English apply errors with a fix button (KYC, login, closed); story image fits long names.
Tests: new backend/evaV329.test.ts + creator/creatorAssistV329.test.js. Full suite with stub packages: same 136 failures
as v328 (all from missing packages), +19 new passes, 0 new failures. npm still blocked → real `npm run verify` not run.
Open (Ravi): payments `/transactions`, `/escrow-transactions`, payout eligible / payment-methods answer an EMPTY list when
the database fails, so Eva (and screens) say "no payments" / "add payout method" — change to an error? (locked
payment_routes; other screens would show an error instead of empty). Bug-report screenshots go to the public
cover-images bucket (permanent public link) — move to a private bucket? Team-shared Eva chats + question-box taps
counting toward 30/day still waiting.

# v330 — UI/UX glitch hunt, whole app (Ravi: "find more glitches in ui-ux in complete app")
6 areas checked in parallel (creator pages, brand pages, deal chat + inbox, campaigns / payments / deals / UGC,
app shell / auth / onboarding / profile, admin). ~230 fixes in 191 files, each marked "v330:". UI only — no API path,
route, money maths or locked logic file changed (protectedFlows test passes; screen call groups unchanged).
Seen everywhere (fixed per screen):
- "No X yet" shown when the load actually FAILED → "Couldn't load… / Try again" (UGC explore + manage, earnings, KYC
  status, brand campaigns, applicants, UGC orders, deals, campaigns list, notifications, help tickets, leaderboard,
  referral, admin users / payouts / escrow / KYC / waitlist / campaigns / UGC / refunds / helpdesk / logs).
- "NaN", "undefined", "Invalid Date", "₹0", "[object Object]", raw codes (IN_PROGRESS, ESCROW_HELD, under_review,
  MORE_INFO_NEEDED) → real words, "—", IST dates, ₹ en-IN.
- Broken photos / logos → initial; double taps on save / approve / release / reject / send blocked with "…ing" state;
  "Copied" / "Saved" / confetti only when it really worked; icon buttons labelled; bigger tap targets; long names / links wrap.
- Made-up data removed: fake "Global Brand Inc." profile, "Fashion & Retail / New Delhi" defaults that got saved back,
  "Ravi Sharma" name, stranger's stock face for creators without photo, "New Delhi / GOLD Tier", fake Instagram numbers
  "Synced from Instagram", ₹10,000 / ₹3,000 fallback budgets, "#INV-2026-904", "IMPS HDFC", "2 do's / 2 don'ts".
Notable:
- Phone side menu: "Log Out" was hidden under the bottom nav. Notification tap now closes the drawer.
- Brand UGC: bottom nav covered the Approve / Pay bar; "24h SLA" on 48h / 72h briefs; UGC brief tap opened Campaigns.
- Creator home: UGC "Upload in" timer ignored the real deadline ("NaNh NaNm"). OTP boxes overflowed 320px phones (3 places).
- Creator earnings hold sheet ticked "Content submitted" before delivery; "Open Full Asset" opened nothing.
- Brand payments: cancelled brief receipt said "Settled & Transferred"; desktop chat pay sheet "Platform Security Fee FREE
  (₹0)" row removed (totals only) and its made-up ₹3,000.
- Deal chat: task label ran off small screens; Enter sent half-typed Hindi words; sheets stuck on "Sending…" after an error;
  Hinglish "Aapka review baaki"; times in IST; inbox search with no match said "No conversations yet".
- Accept / Decline order fixed (Accept right) in Collabs; Update / Remove in Platforms; colours of Shortlisted / Rejected.
- Copy profile link copied a 404 URL (/creators/:id) → /creator/:id.
- Login / signup / OTP: 16px inputs, autofill codes, email carried to Forgot password; onboarding Continue no longer under
  the browser bar (new --yb-vh in index.css).
- Admin: confirm before suspend / Super Admin / remove admin / reject / recall campaign / freeze escrow / enforce dispute /
  force status / broadcast email / batch approve; mobile "Refund brand" said "initiated" but did nothing → honest message;
  waitlist "Reject Selected" never reached the server → honest message; tables scroll inside their box on phones.
Tests: full suite with stub packages — same failures as v329 (missing packages only), 0 new. One pin restored
(BrandUGCPayments creator id text). npm still blocked → real `npm run verify` not run.
Needs Ravi:
- iPhone safe areas: index.html has no `viewport-fit=cover`, so all safe-area padding is 0 today — add it (test on a phone)?
- Payout timing text: 1–2 working days (receipt, Eva) vs 2–3 (Earnings) — which is right?
- Desktop chat header always shows a green verified tick — show only for verified?
- Waitlist batch reject: make it real (one email per person)? Dead "Schedule call" modal: remove or wire up?
- Receipt label "Convenience fee & TDS" really shows platform fee + GST — rename?
- Brand mobile profile / Explore still show creator rate amounts (Q4 = Phase 2, left as is).

# v331 — Ravi's answers ("hn kr do")
- iPhone safe areas ON: index.html viewport now has `viewport-fit=cover`, so every `env(safe-area-inset-*)` padding
  already in the bars / sheets works (bottom nav, sheets, Eva, pay bars clear the home bar). Top unchanged (the "default"
  status bar keeps the page below the clock). Phone deal-chat footer now clears the home bar too.
  → Please test once on an iPhone (home screen app + Safari) and the Android app.
- Waitlist "Reject Selected" is real: confirm → one reason for all → rejects one by one through the same single-reject
  call (each person gets the email), "Rejecting 3 of 10…", rows update, failed ones stay selected, "Rejected 8 · 2 failed".
- "Schedule a call" (brand home → Campaign Manager card) now opens the call sheet; the request goes to the help desk as
  a ticket ("Call request"); error shown (and WhatsApp opens) if it fails — before it always said "Call scheduled!".
  Date from tomorrow (IST), readable date in the ticket, sheet scrolls + clears the home bar.
- Fee name: everything the creator sees says "Convenience fee & TDS" (payout card, earnings sheet, deal chat breakdown,
  negotiation table, receipts PDF, CSV, agreements text, help / legal text, Eva, chat messages from the server).
  Coupon labels say "Convenience fee waiver / rate" (TDS is never waived). "0% / zero platform fee" promises unchanged.
  LOCKED (text only, protectedFlows --update, logged): campaign_lifecycle.ts, deals_chat_routes.ts, agreementTerms.js.
  Terms version NOT bumped (would make everyone accept again) — say if you want that.
- Desktop chat header: green tick only when the partner is verified (same check as the phone chat).
Tests: full suite with stub packages — same 109 failures as v330 (missing packages only), 0 new; protectedFlows 9/9.

# v332 — Ravi's answers + UI/UX glitch hunt round 2 (Ravi: "hn krvana h", "hn ek ui bna do khali mt dikhao errors ya oops", "find more glitches in ui-ux in complete app")
Supabase public reads: checked live — already closed (migration session58_close_public_profile_reads_v2: brand_profiles /
creator_profiles / creator_verifications policies are service_role + false). Nothing for Ravi to run.
Terms 1.4: LEGAL.termsVersion + backend TERMS_VERSION = 1.4, lastUpdated 16 Oct 2026, new first "what changed" line (fee now
called "Convenience fee & TDS", amount unchanged). Everyone re-accepts once. Version pins in termsVersion / session43V283 /
session43V290Invite tests updated (requirement change, commented).
Payments never look empty on a database failure:
- LOCKED payment_routes (protectedFlows --update, logged): /transactions, /escrow-transactions, /creator/payout-eligible-deals,
  /creator/payment-methods → 503 { code: PAYMENTS_UNAVAILABLE } (was [] / 500). server.ts fetchUserScopedTransactions throws
  TX_READ_FAILED (creator dashboard + admin user panel still catch → empty). brandPayments overview → 503 on a failed read.
- New src/components/common/PaymentsRetryCard.jsx (+ isPaymentsUnavailable): purple shield card "Your payments are safe —
  nothing has changed with your money" + Try again (auto-retries once, max one auto retry a minute). Used on creator Earnings
  (phone + desktop), creator UGC earnings, brand Payments (phone + desktop). Brand profile escrow shows "—" (was "…" for ever).
- Brand desktop home: no "Failed to load transactions." toast; "SLA Amount Spent" → "Amount Spent". Brand phone home: refund
  rows no longer counted as spent.
- Eva: creator "earnings" / "payout check" say "couldn't check just now, your money is safe" + Try again chip (not "No paid
  work yet" / "No bank added"); profile score doesn't nag "add bank" when unknown; brand status "Payment hold: couldn't check
  right now", monthly report Spent "—". Failed reads aren't cached.
UI/UX glitch hunt (6 areas in parallel + 2 independent reviews; ~800 fixes in ~340 files, each marked "v332:"; UI only — no
API path / method change, no locked logic file, protectedFlows 9/9):
- Creator: made-up brief text / categories / do's-don'ts / "14h 22m" timers / "BRONZE rank" / bio removed; overdue = "Deadline
  passed"; failed loads → "Couldn't load / Try again" (home, dashboard, deals, KYC, profile, leaderboard); settings forms stay
  open when a save fails; KYC "Under review" shown right; 16px inputs; sticky bars clear the home bar; referral popup no "Invite 0".
- Brand: stock "Campaign Manager" face removed; "SLA Exceeded" only while the draft is due; cancelled briefs "Cancelled"; dead
  approved-video download fixed (media link); made-up usage rights / job titles / sessions removed; double "Save as draft" blocked;
  Under-review KYC on desktop; public page hides drafts; failed loads → Try again.
- Deal chat / inbox: calm error toasts (new chat/calmError.js), IST times (chat/chatTime.js), made-up ₹3,000 / ₹5,000 / ₹15,000
  removed, failed chat load no longer shows the welcome card, declined/countered offers not "Accepted ✓", failed message readable
  "Not sent", typed reasons kept on failure, bell dot clears after Mark all read, desktop notifications open their link,
  collabs "Refresh metrics" no longer invents numbers, "Verified reach" no fake 25,000.
- Campaigns / deals / UGC / money: raw status codes → words; rejected campaigns "Not approved" (not Draft + Launch); made-up niche
  counts, deliverables, "Marketing Manager", OTP modal fake email / user id removed; real 24/48/72h; "in-house agency after 15h"
  promise removed; desktop Earnings "DONE ✓" only when paid; no made-up receipt dates; drawer Close left / action right.
- App shell / auth / onboarding: CRASH fixed — creator phone onboarding crashed when the email got verified (hook order); brand
  "profile live" screen showed raw ·; failed photo / logo upload no longer saves a dead blob preview; 404 "Go to home" →
  dashboard when signed in; agency accounts get brand settings / pages; help / blog / tickets failed loads → Try again; fake blog
  dates, Mumbai address, stock photos removed; 99+ badges.
- Admin: hard-coded "AI Smart Review / Low risk 8%", fake dispute claims and evidence files, "STAMPED & VERIFIED" contract seal,
  waitlist "8/10" defaults removed; UGC Orders status filter / counts (UPPERCASE) fixed; team-intervention upload now also sends
  videoUrl (server needed it — every upload failed before; same path); rates "₹3,500" no longer saved as 0; confirm before
  destructive actions; Helpdesk conversation no longer blanks on status change; failed loads → Try again; tables scroll on phones.
Tests: new backend/v332Payments.test.ts (6). Full suite (bun, stub packages) = v331 baseline + 6 new passes, 0 new failures.
npm still blocked → real `npm run verify` not run.
Needs Ravi (not changed):
- Payout timing text still differs (48h / 1–2 working days / 48–72h / 2–3 days) — pick one.
- Account recovery window: 180 days (Account status) vs 30 days (Delete account).
- Unproven claims still on screen: login "786+ Creators / 87+ Brands / ₹27 Lac+", apply page "643+ creators", "Contracts managed by
  Leegality", "Zero Platform Fee / Guaranteed SLA" banners, brand refer "Commissions Saved: 100%", blog "Join 10,000+" (subscribe
  saves nothing), campaign guide (Cashfree, TDS above ₹30,000, UPI in 1–2 hours).
- OTP agreement modal always says "1x UGC video (30–60s)" + 24h penalty even for campaigns; "Verified (Locked)" phone with none
  saved — contract wording.
- Desktop "My Deals" "SECURED IN PAYMENT HOLD" badge on signed-not-paid deals (needs a paid flag); desktop Campaigns "Closed" tab
  can never fill (page loads live only).
- Decline applicant uses the browser prompt box (needs a proper sheet); BrandUGCPayments still uses the global loader.
- Dead files with fake data (safe to delete?): pages/profile/MyProfile.jsx, landing ExclusiveBento / BrandGlobe / BrandGrid
  sections, Campaigns.jsx "My Activity" modal, Earnings bank-details modal, market/* widgets, AdminFAQManager.jsx.
- Desktop chat issue form now sends the creator's own reason values (same as phone) — check the admin ticket queue.

---
# v333 — Ravi's phone test (15 screenshots), his answers, landing page, offline, skeletons
Money (cause: the old duplicate payout row f3d6d152… — every screen took the FIRST row of a deal):
- New `src/lib/dealTxn.js` (pickDealTxn / oneRowPerDeal) + `src/hooks/useDealPayoutRow.js`: the row with the money wins
  (paid > released > held, then amount). Receipt no longer ₹0.00, Earnings shows the Dell deal once, desktop receipt too.
- Creator sees only what reaches the bank in chat: payout card "You receive in your bank ₹11,700" (never "Deal amount"),
  header pill ₹11,700 after the deal is done. Brand still sees ₹13,000. Receipt / PDF: a stored 0 can't hide the amount.
- Earnings "Paid to bank": filled green verified tick with a soft glow.
- `scripts/sql/v333_remove_duplicate_payout_row.sql` — NOT run, waits for Ravi's OK.
- Brand email with ₹11,700: no such email found in the code (only the creator's own payout email) — Ravi to send the subject.
Ravi's answers: "1–2 working days" everywhere (Earnings, help, legal, agreement text — agreementTerms.js LOCKED, logged);
account recovery 30 days; My Deals "SECURED IN PAYMENT HOLD" only after payment (else "WAITING FOR BRAND PAYMENT");
desktop Campaigns Live / Closed tabs removed; applicant Decline = own sheet (RejectApplicantSheet, reasons + note, same
API call, creator still sees the reason); OTP agreement popup shows the deal's real deliverable, UGC-only penalty with the
brief's hours, "Verified (Locked)" only with a saved phone; claims softened (Guaranteed SLA → Tracked delivery time,
Commissions Saved 100% → Keep more of every deal, 10,000+ / 643+ → plain lines, blog no fake "Subscribed!", Cashfree / TDS
₹30,000 / "UPI in 1–2 hours" corrected; login numbers kept); dead files deleted (MyProfile, ExclusiveBento, BrandGlobe,
BrandGrid, AdminFAQManager, market/*, Campaigns "My Activity" and Earnings bank-details popups).
Notifications: a phone push to /notifications now opens the role's own screen (All / Briefs / Payouts) — the old page had
no Back.
Ybex Eva: settings, ☰ chats drawer and 📎 sheet are solid green (nothing shows through); keyboard: chat moves above it on
the iPhone app (tallest-height check while typing + re-reads after focus); "What can you do?" = one line + 5 chips +
"Show more ▾"; "create a good profile for me" → profile score (was campaigns); scripts: new AI task `creator_write`
(never refuses), shown as HOOKS / SCRIPT / CAPTION with Copy per part; campaign cards = the home campaign card in green.
Loading: My campaigns full-width list skeleton (was a small box in the middle), Brand UGC Payments skeleton (no global
loader), brand profile screens and leaderboard skeletons. (Invite & earn already had one in v332 — Ravi's phone runs an
older build.)
Offline (App Store 4.2 / Play): with no internet a GET answers with the last saved answer of that screen (same login,
wiped on logout) — Earnings, payouts, refer, notifications, inbox, campaigns, UGC; `OfflineBanner` pill "You're offline ·
showing your last saved screens" / "Back online". Dashboard banners are not frozen (festive themes).
Landing page (Claude Design handoff): new `/` = LandingMobileView (<768px) / LandingDesktopView (≥768px), generated by
`scripts/landing/` from the design (text, layout, motion as designed; design-tool preview bar and browser frame removed;
Safari fallback for scroll reveal; reduced motion). Own nav + footer (no Layout). Photos / fonts in public/landing
(3 MB, cached on first visit, not in the app's offline download). Links open inside the app.
Tests: full suite = v332 baseline (same 7 old failures) + new v333 tests, 0 new failures; pins updated for requirement
changes (commented); protectedFlows passes. Real `vite build` passes (precache 250 entries, 8.2 MB).
v333 follow-up (Ravi's answers):
- Brand email with ₹11,700: not a bug — that inbox (ankittomarr123@gmail.com) is the CREATOR account; the creator's
  payout email correctly shows what reached their bank.
- Landing brand wall + reviews read Admin → Landing content (`/landing-brands`, `/landing-reviews`, new
  `src/components/landing/v2/landingContent.js`), same as the old landing. No admin reviews → the reviews section is
  hidden (the design's sample quotes are never shown). Fixed while testing: desktop landing crashed with
  "REVIEWS is not defined" after this change — caught in the browser check before shipping.
- Payment strip logos are in the app (`public/landing/pay/`: Razorpay, Visa, Mastercard, UPI wordmark) — no outside
  links. "Contracts managed by Leegality" → "Agreements signed with Email OTP" (softened).
DEFERRED (Ravi: "baad mai krege"): delete the duplicate payout row f3d6d152… —
`scripts/sql/v333_remove_duplicate_payout_row.sql` is ready, NOT run. The app already hides the row (v333 code),
but the database still has it.
Needs Ravi:
- UPI logo is a plain wordmark — send the official NPCI file if you want the real mark.
- Test on iPhone: Eva keyboard, offline (airplane mode after opening a few screens), landing page.

# v334 — env keys, store readiness, offline app, code cleaning, Android splash
Database: duplicate payout row f3d6d152… DELETED (Ravi ran it in the SQL editor; checked — Dell deal now has only the
PAID row e7d720e7…, ₹13,000 / ₹11,700, UTR 3245465787908). scripts/sql/v333_remove_duplicate_payout_row.sql fixed
(live column is payout_reference, not utr_number). The DEFERRED line above is done.
Env keys: why the deploy asked so few — there was NO .env.example (README pointed to one). New `.env.example` lists every
key the code reads (Supabase, secrets, Gemini, Resend, Razorpay + webhook /api/payments/razorpay/webhook, Google, Apple
Services ID, VAPID push, WhatsApp, admin, and the ones that must stay empty in production). Step-by-step: docs/setup/ENV_KEYS.md.
Sign in with Apple needs only APPLE_CLIENT_ID (backend already existed).
Store readiness (docs/setup/APP_STORE_CHECKLIST.md): Delete account on desktop Settings too (creator + brand), delete screen
says what goes after 30 days, public /delete-account page with 3 ways; new Help & support card (email, WhatsApp, legal,
delete) on Help screens + /help; footer / app first screen / login links to Privacy · Terms · Help · Delete; "Continue
with Apple" next to Google on iPhone/iPad (calm message if APPLE_CLIENT_ID is missing); "Report this profile" on public
creator / brand pages (existing reports API); 18+ line for Google/Apple sign-up; blog newsletter box hidden; "coming
soon" text removed. Block user = needs a DB table → docs/database/PENDING_DB_CHANGES.md.
Offline app: whole app (all screen files, fonts, icons) saved on the phone on first open; links open the saved app
offline; signed-in phone paints a placeholder page from the first frame (splash + opening animation untouched); saved
screens open with data; never-opened screens show one OfflineState card; Terms/Privacy/Refunds/help open offline; Eva says
she needs internet; login shows "Connect to the internet"; send/apply/pay/upload/save blocked centrally in api.js with one
calm toast (Razorpay never opens offline); "Back online" refresh. docs/setup/OFFLINE_AND_APP_STORE.md.
Android opening (Ravi: logo box for a moment): that's Android 12+'s own system splash (launcher icon). New
android-overrides/ (styles.xml values-v31 + transparent icon + README): plain #7E00DC system splash with no icon →
straight into our animation. Needs a new Android build with Bubblewrap CLI (PWABuilder site can't edit these files).
Code cleaning: 40 dead files deleted (one-off backend scripts incl. two with the live Supabase URL, duplicate modal
copies, 25 unused ui/* parts, old helpers), 881 unused imports removed in 163 files, debug console.logs removed, stale
references cleared, docs/archive/BRAND_MOBILE_AUDIT.md → docs/, empty dev-dist/ removed (+ .gitignore), docs/code/CODE_MAP.md quick map.
Locked files untouched (razorpay.js keeps its 2 logs).
Tests: full suite = v333 (1441 pass, same old failures, 0 new); protectedFlows 9/9; every changed file builds; no undefined
names. npm blocked here → run `npm run verify` + `npm run build` once on the deploy machine.
Needs Ravi:
- Fill keys from .env.example in the hosting secrets (live Razorpay + webhook, Google redirect URI, APPLE_CLIENT_ID, VAPID).
- Android: keep the SAME keystore (assetlinks.json has fingerprint 14:6D:E9:…:18:A9). If the app is already on Play, the
  key is needed to update it. twa-manifest host is ybexapp.ai.studio — change to the live domain if different.
- iPhone: needs a native wrapper build (Capacitor / WKWebView) — TWA is Android-only. Demo reviewer accounts (creator + brand).
- Decide: Block user (DB), remove BETA badges for store builds, Apple button only on iPhone or everywhere.
- bun.lock is an empty file — check the deploy uses package-lock.json.

# v335 — iPhone App Store app (Capacitor, files inside the app) (Ravi: "shuru kro")
New folder ios-app/ (own package.json — the main package.json / lock are untouched): capacitor.config.json (appId
com.ybex.app, webDir ../dist/client, plain #9B00FF launch, no logo), assets/ (1024 icon, purple splash),
ios-overrides/Info.plist.additions.xml (com.ybex.app return link, photo/camera/mic reasons, UPI apps, encryption NO),
README.md (Mac + Xcode steps: npm ci → cd ios-app → npm install → npx cap add ios → npm run assets → npm run sync →
Xcode signing + Sign in with Apple → Archive).
App code (no change on the website — everything checks isNative()):
- src/lib/native.js: server address (VITE_API_ORIGIN, default https://ybexmedia.in); axios (api.js), media links
  (mediaUrl.js), socket (sharedSocket.js), plain fetch("/api…") and server-given "/api/files…" / "/uploads…" images all
  go to the live server with the login token; Android back button; sign-in return link.
- Google / Apple sign-in open in the phone's browser sheet; server state carries app=native and sends the person back
  through com.ybex.app://oauth#token=… (backend/oauth_routes.ts — not a locked file).
- App starts on /app (isStandalone true in the app), opening animation plays (index.html), no service worker inside
  the app, Terms/Privacy/Help open in the app, outside sites in the browser sheet, web-push help hidden in the app.
- Server CORS already allows capacitor://localhost.
Not yet: iPhone phone push (needs Apple APNs + @capacitor/push-notifications + server change).
Tests: new backend/v335Native.test.ts (4); full suite 1448 pass, 0 new failures vs v333; protectedFlows passes.
Needs Ravi: a Mac with Xcode + Apple Developer account (or a Mac build service); APPLE_CLIENT_ID + Google keys on the
server; register com.ybex.app in Apple Developer with Sign in with Apple.

# v336 — iPhone App Store app: Apple push notifications + live update (Ravi: "hn tum is pr kaam strt kro")
Why: the App Store app (Capacitor) can't use web push (the Home Screen app still can), and it carries its own copy of
the web build, so UI changes needed an App Store release.
Apple push (APNs):
- backend/apns.ts — sends to iPhones through Apple (Node http2 + ES256 token from the .p8 key; no new package).
  Settings: APNS_KEY, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID (com.ybex.app), APNS_PRODUCTION.
- backend/push_routes.ts — POST /push/native-register saves the phone's Apple token in push_subscriptions (endpoint
  "apns:<token>", no DB change); every push (deal notifications + admin campaigns) goes to web-push phones AND iPhone
  app phones; dead tokens removed; web push and Apple push switch on independently.
- src/lib/nativePush.js — same "Never miss a brand deal" screen then Apple's popup; token saved under whoever is signed
  in; tap opens the notification's screen; logout hands the phone back to guest (like web push).
Live update (self-hosted @capgo/capacitor-updater, no paid service):
- scripts/ota-bundle.mjs runs after every `npm run build` → dist/client/ota/bundle-<version>.zip + latest.json
  (version = hash of the files; never fails the deploy).
- backend/appUpdate.ts — POST /api/app/ios-update answers the app with the newer zip; IOS_OTA_OFF pauses,
  IOS_OTA_MIN_BUILD keeps old App Store versions on their build.
- App downloads in the background, shows it on next open; notifyAppReady → a broken update rolls back by itself.
- ios-app: plugins added (@capacitor/push-notifications, @capgo/capacitor-updater), config, set-builtin-version.mjs,
  ios-overrides/AppDelegate.push-snippet.swift, README steps (Push + Background Modes capabilities, APNs key).
Still needs an App Store build: new plugin / permission / icon / anything in ios-app/.
Tests: new backend/v336NativePushUpdate.test.ts (5); full suite 1453 pass, 0 new failures; protectedFlows passes.
Needs Ravi: Apple Developer → Keys → APNs .p8 key + Key ID + Team ID on the server; if the site isn't on ybexmedia.in yet,
change updateUrl in ios-app/capacitor.config.json and VITE_API_ORIGIN when building on the Mac.
