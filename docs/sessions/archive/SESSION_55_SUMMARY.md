# Ybex — Session 55 Summary — Landing page fix (v304 → v305)

**Latest:** `ybex-v305.zip` (= v304 + the work below). Design canvas: board 4 (payment page) redone in the app UI,
board 7 = real screenshots of the new landing (phone + desktop).
**State:** no npm network here → run `npm install` → `npm run verify` → `npm run build` on your computer.
Checked here: app bundles; no missing names; old tests' pinned text unchanged; protected flows OK (no locked file
touched). New test `backend/session55Landing.test.ts` 31 ✓. Landing opened in headless Chrome at 390×844 and 1366×900:
no errors, no sideways scroll, "Install the app" opens the guide.
**Database:** no change.

## What Ravi asked
1. "Install the app" on the landing glitches / hangs the app → fix.
2. Landing mobile UI is bad → build a proper mobile landing, app's own theme, show best features (Cashfree-style
   idea, not a copy).
3. Payment page design used the Eva bot's green → must use the APP UI. Write the rule in the summary + ARCHITECTURE.
4. Installed app → login → small "Terms" link opens the website inside the app → must open in Chrome.

## RULE (also ARCHITECTURE.md → "UI consistency (rule 87)")
**Eva bot = green glass UI, only inside the Eva chat. Every app feature (landing, payment page, all screens) = the
app UI**: light #F4F4F8 background, white cards, violet #7C3AED, ink #0A0A0A, dark band #17122B, DM Sans.

## What changed
| Problem | Fix | Files |
|---|---|---|
| Install tap froze / did nothing | The install popup can be used once; the hero button and bottom bar each kept their own copy, so the 2nd tap used a dead copy and waited forever. Now one shared copy, dropped after use; never waits more than 8 s; if the popup can't show, the step-by-step guide opens. Optional `VITE_PLAY_STORE_URL` → Android "Install" opens the Play Store app page. | `src/hooks/usePWAInstall.js`, `src/components/install/InstallAppButton.jsx`, `src/components/common/PWAInstallPrompt.jsx` |
| Terms / Privacy link opened the website inside the installed app | In the installed app only, links to /info/*, /privacy-policy, /terms, /privacy, /refunds, /help, /blog that open in a new tab now go to Chrome on Android (falls back to the normal browser), new browser window on iPhone. Normal browser tabs untouched; app screens / files untouched. | `src/lib/externalLinks.js` (new), `src/index.jsx` |
| Landing: fake ticker, "140K+" numbers, fake ranked creators (Unsplash photos), "0% fee" calculator, heavy blur glows (phone jank) | New phone-first landing in the app UI: hero + drawn phone showing a deal (signed → paid & held → approved → released), Brand / Creator tabs with 4 feature cards each showing a small piece of the real screen, How it works (3 steps), real approved creators (hidden if < 3), Trust grid (KYC, Razorpay, release on approval, OTP agreement, chat, alerts), admin brand logos (hidden if none), reviews (hidden if none), honest FAQ, dark final CTA, clean footer with support@ybexmedia.in. No animation library, no blur layers. | `src/pages/dashboard/Landing.jsx` (rewritten) |
| Rule written down | UI consistency rule 87 | `ARCHITECTURE.md` |

Old landing parts (`ExclusiveBentoSection`, `BrandGridSection`, `TrustStrip`) are no longer used on the landing but the
files stay (other tests read them).

## For Ravi to do
- `npm install` → `npm run verify` → `npm run build`, deploy, then on the phone: open the site in Chrome → tap
  "Install the app" (popup or guide must open, no freeze); installed app → login → tap Terms → opens in Chrome.
- When the Play Store listing is live: add `VITE_PLAY_STORE_URL=https://play.google.com/store/apps/details?id=com.ybex.app`
  to the web env and rebuild (Android Install button then opens the Play Store).
- Still open from before: live Razorpay env, Play signing SHA-256 in `assetlinks.json`, APK rebuild, phone tests.
