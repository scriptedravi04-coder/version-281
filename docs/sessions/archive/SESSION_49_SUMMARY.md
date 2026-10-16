# Ybex — Session 49 Summary — clean-up (v298 → v299)

**Latest:** `ybex-v299.zip` (= v298 + the clean-up below). **No feature, text, design, route or server call changed.**
**State:** the sandbox again had **NO network**, so `npm install` / `npm run verify` / `vite build` could not run here.
What WAS checked, on every file:
- the whole app and the server bundle with every import / export resolving (esbuild, all 166 test files too);
- no missing names in any changed file (TypeScript scan) and no moved code reaching for a wrong global;
- no moved section writes to a value it only receives;
- every string / pattern the old tests pin in a file is still in that same file (that is why some parts stayed where they are);
- the protected Campaign / UGC / Invite check passes (no locked file touched).
**Run `npm install` → `npm run verify` → `npm run build` on your computer before going live.**
**Database rule (91):** nothing.

## What Ravi asked
Clean the codebase: separate files per feature, no giant files; very carefully; nothing may break. Locked files
(chat, UGC, campaign create, payments) → Ravi chose: **do the safe part now, locked files in a later session** (when
the tests can run).

## How the split was done (so nothing changes)
A tool cut each section out **word for word** into its own file. The page passes the section everything it used before
(as props). The section is a plain function at file level, so inputs keep focus and nothing re-mounts differently.
Sections inside animated tab switches were NOT moved (that could change the exit animation) — only what is inside them.

## 1. Big pages → section files
| Page | Before → after (lines) | New folder |
|---|---|---|
| Creator phone profile `CreatorMobileProfile.jsx` | 2,773 → 1,701 | `pages/creator/profileScreens/` (Platforms, Help, Rates, Portfolio, Sessions, Legal screens + `parts/`: Languages, Contact, Instagram stats, KYC identity, KYC payout) |
| Brand home `BrandHomeMobile.jsx` | 2,469 → 1,501 | `pages/brand/brandHome/` (actions, active briefs, templates, campaign-manager card, brands strip, schedule-call popup) |
| Creator home `CreatorHomeMobile.jsx` | 1,675 → 1,500 | `pages/creator/creatorHome/UgcLiveTimerCard` |
| Desktop creator settings `CreatorSettings.jsx` | 1,995 → 1,439 | `pages/creator/settingsDesktop/` (platforms, past brands, portfolio list, KYC panel) |
| Admin platform tools `PlatformTools.jsx` | 1,618 → 1,017 | `components/admin/platformTools/` (broadcast email, maintenance, fees, coupons list, referral settings) |
| Admin user panel `UserEnforcementPanel.jsx` | 2,060 → 1,140 | `components/admin/userEnforcement/` (8 cards) |

The only server calls that moved are the creator profile's two "save phone / email" calls (same `PATCH creators/me`),
now inside `parts/ContactVerificationSection.jsx`.

## 2. Removed (nothing used them)
`components/Onboarding/CreatorLivePreview.jsx`, `components/payments/PromoCodeSheet.jsx`, `components/payments/FeeConfigPanel.jsx`.
Kept on purpose: files that old tests read (MyProfile, AdminFAQManager, BrandGlobeSection, InfluencerMetricsChart,
usePullToRefresh) and the old "refer_legacy_unused" screen inside the creator profile (a test still reads a line in it).

## 3. Docs
- Session summaries 21 → 48 moved to `docs/sessions/`. The newest (this one) stays in the root.
- `SUPABASE_PROMPT.md` → `docs/` (`SUPABASE_PROMPT_SESSION43.md` stays in the root — a test reads it there).
- New `docs/CODE_MAP.md`: where every feature lives + the rule "a new screen / section gets its own file".
- New test `src/session49.test.js` keeps the split in place.

## Not done (and why)
- **Locked live files** — `backend/ugc_routes.ts` (3,668), `backend/server.ts` (3,381), `ChatBox.jsx` (3,080),
  `MobileCampaignCreate.jsx`, `BrandUGCMobile.jsx`, `CreatorUGCMobile.jsx`, `ManageUGCOrdersView.jsx`, `SystemMessage.jsx`,
  `payment_routes.ts`, `campaign_lifecycle.ts`, `creators_routes.ts`. Next clean-up session, in a sandbox where
  `npm run verify` runs, one file at a time, with `PROTECTED_CHANGES.md` + `protect:update` for each (your OK).
- Two `Onboarding` / `onboarding` folders and `lib` / `utils` overlap: merging changes paths that old tests read; left as is.
- Honest note on speed: splitting files makes the code easier to work on and safer to change; the phone downloads the
  same code as before. Real speed wins come from loading less at a time (each page already loads on its own).

## Still on Ravi
- `npm install` → `npm run verify` → `npm run build`. If any test fails, send me the output.
- Quick phone check of the moved parts: creator profile (platforms, help, rates, portfolio, devices, legal, edit profile
  languages + phone/email, Instagram numbers, KYC form), brand home (all cards + schedule-call popup), creator home UGC timer,
  desktop creator settings tabs, admin Platform tools tabs and the admin user panel.
- Everything open from Session 45–48 is still open.
