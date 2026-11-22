# Publishing LookBack on Google Play — checklist

Everything prepared for you:

| What | Where |
|---|---|
| Signed app bundle, your LookBack key | `release/LookBack-1.3.0.aab` (versionCode 4, built 23 Nov 2026, no developer tools) |
| Listing text, Data safety, content rating, target audience answers | `docs/play-store/listing.md` |
| App icon 512×512 | `docs/play-store/graphics/icon-512.png` |
| Feature graphic 1024×500 | `docs/play-store/graphics/feature-graphic-1024x500.png` |
| Phone screenshots (1272×2544) | `docs/play-store/graphics/1-…png` to `7-…png` |
| Privacy policy page | `docs/privacy/index.html` → https://sreekaran1704.github.io/LookBack/privacy/ |

Because your developer account is a **new personal account**, Google requires a **closed test with at least 12
testers who stay opted in for 14 days in a row** before you can apply for production. Plan for about 2–3 weeks.

---

## Status (23 Nov 2026)
- Developer account: **not created yet** (step 3).
- Privacy policy: updated for sharing (Supabase introductions, Firebase alerts, delete sharing account) but **not
  online yet** (step 1 gives a 404 until Pages is on).
- Google sign-in: still **Testing** (test users: sreekaran.2021@gmail.com, geetharan871@gmail.com). Do step 2 before
  the closed test, or every tester has to be added as a test user too.
- Data safety now includes email, name and the alert push address, and an account-deletion URL (see `listing.md`).
- Account deletion requests from the web (people who can't open the app): you promise to handle them within 7 days.
  Delete them in Supabase → Authentication → Users (that cascades to everything the sharing service keeps).

## 1. Put the privacy policy online (5 min)
1. Commit and push `docs/privacy/`, `docs/.nojekyll` and `docs/play-store/`.
2. GitHub → the LookBack repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch **main**, folder **/docs** → Save.
3. After a minute, open https://sreekaran1704.github.io/LookBack/privacy/ and check that it loads.

## 2. Let everyone use Google Drive backup (Google Cloud, 10 min)
Right now the Google sign-in consent screen is in **Testing**, so only listed test users can connect Drive.
1. https://console.cloud.google.com → project **Yearbook (yearbook-514320)** → **Google Auth Platform → Branding**:
   app name *LookBack*, support email, home page `https://github.com/Sreekaran1704/LookBack`,
   privacy policy `https://sreekaran1704.github.io/LookBack/privacy/`. Skip the logo: adding one triggers brand
   verification and can hold things up for days.
2. **Audience** → Publishing status → **Publish app** (to *In production*). The only scope is `drive.file`, which is
   non-sensitive, so no security review is needed.
3. **Clients**: make sure the Android client for `com.yearbook.app` has SHA-1
   `BC:31:F7:7D:61:9E:F6:BB:9B:5B:39:71:66:34:A6:79:1D:73:28:CD` (your LookBack key). Because Play will sign with this
   same key (step 5), Play installs will sign in to Drive just like your GitHub builds.

## 3. Create the developer account (if not done)
https://play.google.com/console/signup → **Personal** → pay the one-time **US$25** → verify your identity and your
Android phone (Play Console app). Approval can take a few days.

## 4. Create the app
Play Console → **Create app**: name `LookBack: One Year Ago Today`, default language **English (United States)**,
**App**, **Free** (free can never become paid later), accept the declarations.

## 5. App signing with your own LookBack key  ⚠️ do this before uploading anything
Setup → **App signing** → *Choose signing key* → **Use existing app signing key from Java keystore**.
1. Download the **PEPK tool** (`pepk.jar`) and the **encryption public key** (`encryption_public_key.pem`) it offers.
2. In Terminal, in the folder with those two files, run (it asks for your keystore and key passwords; they are in
   `~/.gradle/gradle.properties` as `LOOKBACK_UPLOAD_STORE_PASSWORD` / `LOOKBACK_UPLOAD_KEY_PASSWORD`):

   ```bash
   java -jar pepk.jar --keystore=$HOME/.lookback-keys/lookback-release.jks --alias=lookback --output=lookback-signing-key.zip --include-cert --rsa-aes-encryption --encryption-key-path=encryption_public_key.pem
   ```
3. Upload `lookback-signing-key.zip` back on that page and save. Then delete the zip.

Result: Play signs LookBack with the same key as your GitHub APKs, so people can move from GitHub to Play (or the
other way) without uninstalling, and their memories stay.

## 6. App content (Policy → App content)
Fill each section from `docs/play-store/listing.md` → "App content answers": privacy policy URL, ads (No), app access
(all available), content rating questionnaire, target audience (18+), news (No), Data safety (photos, voice
recordings and written memories: collected for the optional backup, not shared, encrypted in transit, deletable),
government/financial/health (No).

## 7. Store listing (Grow → Store presence → Main store listing)
- App name, short and full description: from `listing.md`.
- App icon: `icon-512.png`. Feature graphic: `feature-graphic-1024x500.png`.
- Phone screenshots: upload `1-home.png` … `7-dark-home.png` in that order.
- Category **Lifestyle**, contact email (shown publicly), website, privacy policy.

## 8. Closed test (the 14 days)
1. Testing → **Closed testing** → *Create track* (or use "Alpha") → **Testers**: add at least 12 Gmail addresses
   (or a Google Group). Friends and family are fine; they need an Android phone.
2. **Create release** → upload `release/LookBack-1.3.0.aab` → release name `1.3.0` → release notes from
   `listing.md` → *Review release* → **Start rollout to Closed testing**.
3. Countries: pick where testers live (or all).
4. Send testers the **opt-in link** (Testers tab). Each one taps *Become a tester*, then installs LookBack from Play
   and **keeps it installed for 14 days**. Ask them to open it now and then and send feedback; Google looks at
   engagement when you apply.
5. Updates during the test: bump `version` / `android.versionCode` in `app.json`, rebuild the bundle, upload a new
   release to the same track.

## 9. Apply for production (after 14 days with 12+ testers)
Dashboard → **Apply for production** → answer the questions about your test (who tested, what feedback you got,
what you changed). Review usually takes up to a week. Once approved: Production → **Create release** → upload the
latest bundle → roll out (start with a staged rollout, e.g. 20%, if you like).

## Rebuilding the bundle later
```bash
rm -rf $TMPDIR/metro-* && unset EXPO_PUBLIC_SHOW_DEV_TOOLS && cd android && ANDROID_HOME=~/Library/Android/sdk ./gradlew bundleRelease -PlookbackRelease=true --rerun-tasks
```
`--rerun-tasks` is required: otherwise Gradle reuses the JS bundle of the last dev test build (developer tools on).
Output: `android/app/build/outputs/bundle/release/app-release.aab`. Check the signer with
`keytool -printcert -jarfile app-release.aab` (SHA-256 starts `05:61:B5:5B`).
