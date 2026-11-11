<p align="center">
  <img src="assets/icon.png" width="128" alt="LookBack's bunny" />
</p>

<h1 align="center">LookBack</h1>

<p align="center">
  <b>One small thing a day. It comes back to you on the same day next year.</b><br/>
  A cosy, handmade journal for Android: a note, a quote or a photo each day, and a letter from your past self when the date comes round again.
</p>

---

## What it is

Every day you stick one small thing into your notebook: a line about your day, a quote, or a photo with a note taped to it. A year later, on the same date, it comes back as a sealed envelope from your past self, and a little bunny lets you know it's arrived.

- **On this day.** Memories from earlier years arrive as envelopes. Tap one and the flap opens and the memory slides out. Several years make a deck you can swipe through.
- **A real scrapbook.** Each memory becomes a polaroid, a torn note, a ticket stub or a taped photo, held on with washi tape, a paper clip or a pin, with a sticker. You choose the sticker, the tape and their colours, and see it live as you write.
- **Your years on a shelf.** Every year is a diary standing in a little wooden cupboard, showing its age. Tap one and it flies off the shelf and opens onto that year's pile of memories; "Tidy up" sorts them by month.
- **Pick your paper.** Cream, peach, rose, lemon, mint, sky or lavender, in light or dark (the same paper by lamplight).
- **Gentle reminders.** One notification on days that have a memory from an earlier year, at the time you choose. Never on other days.
- **A bunny that misses you.** The app icon is the bunny, and it gets more dramatic the longer today's page stays empty: hopeful by the evening, teary after a missed day, wailing after a few.
- **Home-screen widget.** Add today's memory in one tap, or see the one you've saved.
- **Smooth.** Runs at 120 Hz on phones that support it.

## Install (Android)

1. On your phone, open the [latest release](https://github.com/Sreekaran1704/LookBack/releases/latest) and download `LookBack-<version>.apk`.
2. Open it. If Android asks, allow your browser to install unknown apps.
3. Open LookBack. The bunny asks a few things (your name, your paper, reminders, backup) and you're set.

Needs Android 7 or newer on a 64-bit (arm64) phone, which is almost every phone from the last several years. New versions install over the old one and keep your memories.

To check the download, compare its SHA-256 with the one in the release notes:

```bash
shasum -a 256 LookBack-1.0.0.apk
```

## Your memories are yours

- Everything is stored **on your phone**. There are no accounts, no servers and no analytics.
- **Backup is optional** and goes to **your own Google Drive**, into a visible "LookBack" folder. The app can only see files it created itself (the `drive.file` permission), nothing else in your Drive. Connect the same account on a new phone to bring everything back.
- If you never connect Drive, there is no copy anywhere else, so uninstalling the app deletes your memories.

> Google Drive backup is still in Google's testing mode, so for now it only works for accounts that have been added as testers. Everything else works for everyone.

## Build it yourself

Expo SDK 58 · React Native 0.88 · TypeScript · expo-router · expo-sqlite · Reanimated · Skia · react-native-svg

```bash
npm install
```

```bash
npm run check
```

That runs the type check and lint. To run it on an Android phone connected over USB (with USB debugging on):

```bash
npx expo run:android --variant release
```

The first build takes about ten minutes; later ones are quick.

To switch on Drive backup in your own build, copy `.env.example` to `.env` and add a Google OAuth *Web application* client id. You also need an *Android* OAuth client in the same Google Cloud project for the package `com.yearbook.app` and your signing key's SHA-1. Without them the app works, and Settings says backup isn't switched on in this build.

### Signed release

Release builds are signed with a private key that never goes in the repo. Its path and passwords live in `~/.gradle/gradle.properties` (`LOOKBACK_UPLOAD_STORE_FILE`, `LOOKBACK_UPLOAD_KEY_ALIAS`, `LOOKBACK_UPLOAD_STORE_PASSWORD`, `LOOKBACK_UPLOAD_KEY_PASSWORD`). Raise `version` and `android.versionCode` in `app.json`, then:

```bash
npx expo prebuild --platform android
```

```bash
cd android && ./gradlew assembleRelease -PlookbackRelease=true -PreactNativeArchitectures=arm64-v8a
```

Without those properties the build is signed with the debug key instead.

### Where things are

```
src/app/(tabs)/       Home, Years and Settings (the pages the bar switches between)
src/app/              writing page, a memory, a year's diary, first-run questions
src/components/       the bar, pickers, page chrome, the shelf
src/components/scrapbook/   paper, polaroids, notes, tape, stickers, envelopes, diaries, the bunny
src/data/             SQLite, photos and Google Drive backup, behind small repositories
src/lib/              pure logic: dates, the on-this-day rules, the icon's mood, backup merging
src/notifications/    which days get a reminder, and scheduling them
src/widget/           the home-screen widget
plugins/              config plugins: 120 Hz, release signing
scripts/make-icons.mjs  draws the icon, the bunny's poses, the splash and the widget preview
```

The bunny, the icons and the paper textures are all drawn in code; there are no image assets to license.

## License

MIT
