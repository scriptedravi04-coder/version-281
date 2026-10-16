# Session 59 — v337
(Before this: docs/sessions/SESSION_58_SUMMARY.md = v309 → v336.)

## 1. App server address = ybexapp.ai.studio (Ravi: "ye kr do")
Why: v335/v336 sent the iPhone app and its live update to https://ybexmedia.in, which doesn't serve the app yet
(AI Studio free hosting can only take a custom domain through Cloud Run + billing) → login / data / updates would fail.
- `src/lib/native.js`: DEFAULT_ORIGIN `https://ybexapp.ai.studio`; only `VITE_API_ORIGIN` changes it (the old
  fallback to VITE_PUBLIC_SITE_URL is gone — that's the share-link address and could name a dead domain).
- At start the app calls `CapacitorUpdater.setUpdateUrl(<API_ORIGIN>/api/app/ios-update)`; config has
  `allowModifyUrl` + `persistModifyUrl`. So later moving to ybexmedia.in = set VITE_API_ORIGIN (or one line) and
  deploy → iPhones move by live update, update check follows. **No App Store release needed.** Keep ai.studio alive a
  few weeks for phones that haven't opened the app.
- `ios-app/capacitor.config.json`: updateUrl ai.studio; allowNavigation ai.studio + ybexmedia.in (+ razorpay).
  `ios-app/package.json` web build default ai.studio. README updated.
- Android (Play/TWA): host stays ybexapp.ai.studio (no change). Moving Android to the new domain later = one Play
  update (new APK with new host + assetlinks) — any time, not urgent.
- `.env.example` / docs/setup/ENV_KEYS.md: APP_URL / SITE_URL / VITE_PUBLIC_SITE_URL = ai.studio until the domain
  opens the app (emails, Google sign-in return, share links would otherwise point at a dead address). New keys:
  VITE_API_ORIGIN (optional), PROXY_SHARED_SECRET.
- CORS already allowed ybexapp.ai.studio + capacitor://localhost — no change.

## 2. ybexmedia.in via Cloudflare (free jugad) — Ravi does the clicks
- Guide (Hinglish, step-by-step): `docs/setup/DOMAIN_CLOUDFLARE.md` — Cloudflare free account → check / copy email
  (Resend MX/TXT) records → GoDaddy nameservers → secret → Worker → custom domains → test → switch APP_URL etc. + Google
  redirect URI.
- Worker code: `cloudflare/ybex-proxy-worker.js` — forwards everything to ybexapp.ai.studio (websocket too),
  www → apex, rewrites ai.studio redirects, sends visitor IP + PROXY_SHARED_SECRET.
- Server: new `backend/domainProxy.ts` (first middleware in backend/server.ts). Only with the right secret (20+ chars)
  the visitor's real IP is appended to X-Forwarded-For, so the existing login / OTP rate limits see each person
  (otherwise everyone behind the Worker shares one IP and one lock). Wrong / missing secret → headers dropped.
- Cost: ₹0 up to 1,00,000 requests/day; then Workers Paid $5/mo or own hosting (Hostinger VPS KVM 1 ≈ ₹599–999/mo).

## 3. Block a user (Apple 1.2) — DB change OK'd ("hn kr do")
- Live migration `session59_blocked_users` (scripts/sql/session59_blocked_users.sql): `blocked_users`
  (blocker_id, blocked_id, created_at; pk both; blocker ≠ blocked; index on blocked_id), RLS on, no policies (server only).
  docs/database/PENDING_DB_CHANGES.md marked DONE.
- `backend/blockUsers.ts` (not locked), registered before chat / creators / campaign routes:
  `GET /blocks`, `GET|POST|DELETE /users/:id/block`. Brand team members block for the parent brand. Admins can't be
  blocked. Each block also writes a `reports` row (`target_type user_block`, optional reason) → Admin → System reports.
- Both directions: chat send → 403 BLOCKED ("You blocked X. Unblock them from their profile…" / blocked side just
  "You can't send messages in this chat."); brand invite → refused; creator apply → refused.
- Lists filtered on the way out (locked handlers untouched): inbox hides blocked chats — a chat with payment already
  held stays (marked `blocked`) so the deal can finish, messages stay off; creator invitations; campaign applicants.
- UI: new `src/components/safety/BlockUserButton.jsx` — "Block" next to "Report this profile" on public creator and
  brand pages, "Block <name>" in the chat ☰ menu (BurgerMenuSupport.jsx, not locked; all API calls in the new
  component, so screen call groups unchanged), confirm sheet with what happens + optional reason, Unblock toggle.
  `BlockedPeopleList` under every Help & support card (phone Help screens, desktop settings, /help when logged in).
  Report sheet now points to Block. docs/setup/APP_STORE_CHECKLIST.md Part D updated (reviewer note).
- Not filtered (small, later if wanted): /chat/v2/threads/count badge, Explore lists, notifications already sent.

## 4. Files organised + clean-up (Ravi: "kachre ko saaf kro")
- Root now: README.md (folder map), AGENTS.md + GEMINI.md (AI agent rules — must stay in root), config files.
- `docs/` (index `docs/README.md`): `setup/` (ENV_KEYS, DOMAIN_CLOUDFLARE, APP_STORE_CHECKLIST, OFFLINE_AND_APP_STORE),
  `code/` (CODE_MAP, ARCHITECTURE, PROTECTED_CHANGES, CONTRIBUTING, UNIQUE_FEATURES), `database/` (PENDING_DB_CHANGES +
  all Supabase prompts), `sessions/` (58, 59) + `sessions/archive/` (21–57; merged into one file in v338), `archive/` (old brand mobile audit).
- All references updated (code comments, tests, scripts/protectedFlows.mjs now logs to docs/code/PROTECTED_CHANGES.md).
  Test path pins moved (requirement change): loadingStates, session49, session43V290Invite. Locked files untouched
  (one comment rewrite in directInvites.ts was put back).
- Deleted: 7 unused code files (nothing imported them: backend/services/deliveredMetrics.ts, TrustBadge, ActivityFeed,
  PaymentMethodCard, shared/GeminiIcon, lib/typography.ts, platformTools/ReferralSettingsCard), empty bun.lock,
  docs/eva_part1_preview.jpg, empty docs/prompts/.
- Kept on purpose: db_mock.json (server's local fallback DB), metadata.json + firebase-applet-config.json + .aistudio/
  (AI Studio platform files), scripts/sql history.
- Zip folder is now `ybex-v337` (was still named ybex-v296).

## Tests
New `backend/v337BlocksDomain.test.ts` (10 pass). Full suite (bun, no npm here): 795 pass; the failures are the same
106 as the v336 baseline in this environment (missing packages), 0 new. protectedFlows 9/9. Every changed file compiles;
whole web app bundles (only the usual /landing/fonts URL notes). npm still blocked → run `npm run verify` + `npm run build`
once on the deploy machine.

## Needs Ravi
- Deploy v337, then follow docs/setup/DOMAIN_CLOUDFLARE.md (secret in BOTH AI Studio + Worker).
- Hosting secrets: keep APP_URL / SITE_URL / VITE_PUBLIC_SITE_URL = https://ybexapp.ai.studio until ybexmedia.in opens the app.
- APNs .p8 key + Key ID + Team ID on the server; Mac iPhone build (ios-app/README.md).
- Test Block: block from a profile and from the chat menu, try messaging / inviting / applying from both accounts,
  check Help → Blocked people → Unblock, check Admin → System reports shows the block.

---
# v338 (same session) — AI Studio GitHub import: "1000 files imported, 130 skipped"
AI Studio imports at most 1,000 files from GitHub; v337 had 1,133, so 130+ files were silently missing (broken deploy).
- All 187 test files packed into ONE file `dev/tests.tgz` (same paths inside). `npm run tests:unpack` puts them back,
  `npm run tests:pack` packs them again and removes the loose copies; `npm run verify` / `protect:check` unpack first.
  Loose `*.test.*` / `*.spec.*` are in .gitignore. New `scripts/tests-archive.mjs`. AGENTS.md + GEMINI.md explain it.
- Old summaries 21–57 merged into `docs/sessions/SESSIONS_21_to_57.md` (text unchanged); session49 test pin moved
  (requirement change, commented).
- Repo now **913 files** (87 under the limit). No app code changed.
- Tests: unpacked → bun suite 796 pass / same 106 environment failures as before, 0 new; packed again.
- Ravi: the GitHub repo must be REPLACED (old files deleted), not uploaded on top — otherwise the old test files stay
  and the count is still over 1,000. Keep new files under ~950 in future (big file sets → one archive).
