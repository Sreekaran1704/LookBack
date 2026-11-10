# LookBack

Save one tiny moment a day — a note, a quote, or a photo — and see it again on the same date next year.
Every day becomes a scrapbook object: a polaroid, a torn note, a ticket stub or a taped photo, held on with washi
tape, paper clips and pins, with stickers and date stamps. Dark mode is a "midnight desk" under a warm lamp.

Expo SDK 58 · React Native · TypeScript (strict) · expo-router · expo-sqlite · Skia · react-native-svg · local notifications.
Everything is stored on the device. No accounts, no backend (Milestone 1).

## Run it on your phone (Expo Go)

1. Install **Expo Go** from the App Store / Play Store (it must support SDK 58 — update it if prompted).
2. Install dependencies and start the dev server:

   ```bash
   npm install
   ```

   ```bash
   npx expo start
   ```

3. Scan the QR code: Camera app on iPhone, or the Expo Go app on Android. Phone and Mac must be on the same Wi‑Fi.
   If they can't see each other, use `npx expo start --tunnel`.

## Install on an Android phone over USB (no account needed)

With USB debugging on and the phone unlocked:

```bash
EXPO_PUBLIC_SHOW_DEV_TOOLS=1 npx expo run:android --variant release
```

This builds a release APK on your Mac and installs it. The first build takes ~10 min; later ones ~15 s.
Reinstalling keeps your entries.

> The scrapbook redesign has been verified with this release build, not in Expo Go.

## Install as a normal app on Android via EAS (cloud build)

Builds an `.apk` in Expo's cloud (EAS). Free Expo account required.

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest init
```

```bash
npm run build:android:preview
```

When the build finishes (10–20 min), open the link it prints on your phone, download the APK and install it
(allow "Install unknown apps" for your browser when Android asks). Installing a newer APK over it keeps your entries;
uninstalling the app deletes them.

The **preview** profile keeps the Developer tools in Settings. The **production** profile hides them.

## Try the "one year ago" flow today

Open **Settings** (gear icon) → the **Developer** sticky note (visible in dev and preview builds):

- **Seed sample memories** — adds ~60 fake entries over four years: today 1–4 years ago (fills the "On this day"
  pile), the next 10 days one year back (so reminders get scheduled), a mix of short notes, quotes (ticket stubs),
  long notes and photos (little sunset scenes painted with Skia), plus a **Feb 29, 2024** entry and a Feb 28, 2025
  entry for the leap-day case.
- **Clear sample memories** — removes only seeded entries (ids start with `seed-`).
- **Send test notification** — fires a "One year ago today: …" notification in 3 seconds using today's real matches.
  Background the app to see it as a banner.

Switch the look under **Settings → Look** (System / Light / Midnight). Turn on **Daily reminder** and pick a time; the screen shows how many reminders are scheduled in the next 30 days.

## Checks

```bash
npm run check
```

Runs `tsc --noEmit`, `expo lint` and `jest`. Individually: `npm run typecheck`, `npm run lint`, `npm test`.

## Project layout

```
src/app/            screens (expo-router): index, entry (modal), year/[year], memory/[id], settings
src/components/     buttons, titles, OnThisDayPile, StatusPill, ThemeProvider
src/components/scrapbook/  PaperBackground, Polaroid, TornNote, TicketStub, WashiTape, PaperClip, Pin,
                    DateStamp, Sticker, Doodle, AlbumStack, ScrapObject, DropIn, Confetti
src/data/           SQLite + photo storage behind entriesRepository / settingsRepository
src/lib/dates.ts    pure date logic (local dates, on-this-day, leap day, grouping)
src/lib/seeded.ts   seeded per-entry look (object type, tilt, tape, sticker)
src/notifications/  planner.ts (pure, tested) + scheduler.ts (expo-notifications)
src/theme/          design tokens + per-year colors (paper, ink, glow, type, motion)
src/dev/seed.ts     dev-only sample data
__tests__/          date, planner, seeded-look and year-color tests
```

Project rules for contributors and AI assistants live in [CLAUDE.md](CLAUDE.md).

## Known limits

- In Expo Go, Android shows a warning that *push* notifications need a dev build. **Local** notifications (what this
  app uses) still work.
- Reminders are only scheduled for days that have a memory, 30 days ahead; the window refreshes every time the app opens.
