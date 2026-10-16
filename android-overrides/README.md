# Android build — no logo box on opening (v334)

Problem: on Android 12 and newer, the phone itself shows a splash with the app icon in a rounded box for a moment,
then our purple opening animation starts.

Fix: make that system splash plain purple with no icon. This is inside the Android app (APK/AAB), not the website,
so it only works in a NEW Android build.

Build with Google's **Bubblewrap CLI** (PWABuilder's website does not let you edit these files):
1. `npm i -g @bubblewrap/cli`
2. In an empty folder: `bubblewrap init --manifest https://<your-app-domain>/manifest.webmanifest`
   (or copy `twa-manifest.json` from the repo there and run `bubblewrap update`).
3. Copy everything inside this `android-overrides/` folder over the generated project (same paths):
   - `app/src/main/res/drawable/splash_transparent.xml`
   - `app/src/main/res/values-v31/styles.xml`
   Check the theme name in `app/src/main/AndroidManifest.xml` (activity `LauncherActivity` → `android:theme`).
   If it is not `Theme.LauncherActivity`, rename the style in styles.xml to match.
4. `bubblewrap build` with the SAME signing keystore as before (see `docs/setup/APP_STORE_CHECKLIST.md` — keystore / assetlinks).
5. Install on an Android 12+ phone: opening shows plain purple → Ybex animation. The animation itself is untouched.

Note: `twa-manifest.json` `host` is `ybexapp.ai.studio`. If the live app is on `ybexmedia.in`, change `host` before
building and serve `/.well-known/assetlinks.json` on that domain (it's in `public/.well-known/`).
