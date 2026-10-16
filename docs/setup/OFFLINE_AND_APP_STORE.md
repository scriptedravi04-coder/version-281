# Offline app (v333 + v334)

Why: Apple (App Store guideline 4.2, "minimum functionality") and Play reviewers open the app in airplane mode.
A web page that shows a browser error or spins forever reads as "just a website". Ybex opens like an installed
app with no internet: the screens you opened before show their last saved data, and the rest says calmly that
you're offline.

## What works offline

| Area | Offline behaviour | Where |
|---|---|---|
| App start | The whole app (every screen's files, fonts, icons, login pictures) is saved on the phone by the service worker. Any page link opens the saved app page. A signed-in phone paints the grey app page with placeholder cards from the first frame; the purple launch splash (Android `#7E00DC`) is unchanged. | `vite.config.js` (VitePWA `navigateFallback`, `globPatterns`, `maximumFileSizeToCacheInBytes` 6 MB, `cleanupOutdatedCaches`), `index.html` (`#yb-shell`) |
| Login session | Offline, the app opens at once with the saved login (no waiting for `/auth/me` to fail). Back online it is checked again. | `AuthContext.jsx` |
| Screens opened before | Show their last saved answer (same login only, wiped at logout): home, campaigns, UGC, inbox, notifications, earnings / payouts, refer, profile. Pill at the top: "You're offline · showing your last saved screens". | `lib/api.js`, `lib/apiSnapshot.js`, `OfflineBanner.jsx` |
| Screens never opened | One designed card, `OfflineState` — "You're offline", what still works, Try again. It loads by itself when the internet is back. Payment screens keep their card ("Your payments are safe") with offline wording. | `components/common/OfflineState.jsx`, `PaymentsRetryCard.jsx` |
| Static pages | Terms, Privacy, Refunds and the other `/info/*` pages are built into the app. In the installed app these links open inside the app while offline (the phone's browser can't load them offline). Help articles: the last list of each category is kept on the phone. | `lib/legal/legalContent.js`, `lib/externalLinks.js`, `pages/help/*` |
| Profile / Settings menus | Render from the saved user and saved profile (`/creators/:id`, `/brands/me`). | `lib/apiSnapshot.js` |
| Eva | Opens with her chats; a note says "Eva needs internet to reply". | `feedback/FeedbackBot.jsx` |
| Login screen | "Connect to the internet to sign in" card while offline. | `Login.jsx`, `AppContinue.jsx` (`OfflineSignInNotice`) |
| Actions (send, apply, pay, upload, save) | Never sent. `api.js` refuses every POST / PUT / PATCH / DELETE while offline with code `OFFLINE` and one calm grey toast: "You're offline — try again when you're back online". Payment: the Razorpay order is never created, so the Razorpay window never opens offline. | `lib/api.js`, `lib/offline.js` |
| Back online | Pill says "Back online"; screens on `useLiveRefresh` (and home, inbox, earnings) reload once quietly; offline cards reload by themselves. | `lib/liveRefresh.js`, `useBackOnline` in `lib/offline.js` |

Not frozen on purpose: dashboard banners / festive themes are always read fresh online.

Updates: a new version still waits for the "Refresh" toast (session 58, `registerType: 'prompt'`); old saved
files are removed only when the new version takes over.

## How to test (iPhone and Android)

1. Install the app (Android: Play Store / Chrome "Install app"; iPhone: Safari → Share → Add to Home Screen) and sign in.
2. With internet on, open a few screens: Home, Campaigns, UGC, Inbox, Notifications, Earnings, Profile, Help, Terms. Wait ~30 seconds the first time so the app finishes saving its files.
3. Close the app fully, turn on **airplane mode** (Wi-Fi off too).
4. Open the app: it should open straight to Home with your data and the "You're offline" pill.
5. Visit the screens from step 2 — they show their saved data. Open a screen you never visited — you see the "You're offline" card, not a spinner.
6. Tap an action (send a message, apply, Pay) — a grey "You're offline — try again when you're back online" toast; nothing is sent; Razorpay does not open.
7. Open Eva — the "Eva needs internet to reply" note. Log out and look at the login screen — "Connect to the internet to sign in".
8. Turn airplane mode off — the pill says "Back online" and the screen refreshes by itself.

Desktop check: Chrome DevTools → Application → Service Workers → "Offline" (or Network → Offline), then reload.
