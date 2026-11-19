# LookBack: project context for resume writing

> **For the AI reading this:** this is a full, factual brief of a personal project, written so you can turn it
> into resume bullets, a project section, or interview talking points for a specific role. Ask me for the job title
> and description first, then pick the angle (mobile, frontend, full-stack, product, design engineering, AI-assisted
> development) and the facts below that fit it. **Stay inside the facts here.** Don't invent users, downloads,
> revenue, team size or store ratings: the app isn't on the Play Store yet. Section 9 says how the work was split
> between me and AI tools. Describe that honestly.

---

## 1. One-line summary

**LookBack** is an offline-first mobile journaling app (Android, built with React Native + Expo + TypeScript). You
save one small thing a day: a note, a quote or a photo. On the same date a year later, it comes back as a "letter
from your past self". It has a handmade scrapbook look: every memory is a polaroid, torn note, ticket stub or taped
photo, and a small bunny mascot keeps you company.

- **Built:** November 2026 (first commit Nov 9, 2026; v1.0.0 released Nov 11, 2026; **v1.1.0 released Nov 17, 2026**
  after a week of daily use: two real-use bugs fixed, memory deletion added, paper-matched navigation bar)
- **Status:** working Android release build, installed and tested daily on a real phone (OnePlus Nord 5).
  Play Store release is a planned next step. iOS is configured but not tested on a device.
- **Releases:** public GitHub repo with signed APK releases (https://github.com/Sreekaran1704/LookBack/releases).
  v1.1.0 is signed with the same release key as v1.0.0, so it installs as an update and keeps people's data.
- **Size:** about 10,350 lines of TypeScript across 75 source files; 89 automated unit tests in 8 suites; strict typing,
  linting and tests run before every change.

## 2. The problem and the product idea

Most journaling apps ask for too much, so people stop. LookBack asks for **one tiny thing per day**. The payoff is
emotional and delayed: on the same calendar day next year, the app tells you something is waiting and shows you who
you were a year ago.

Product decisions I made:
- **One entry per day** (editable that day), so it's a habit and not a chore.
- **Notifications only on days that have a memory to show.** The app never nags with "write today" reminders.
- **Offline-first and private.** Everything lives on the phone. The only cloud copy is an optional backup to the
  person's own Google Drive, which the app can read only its own files from.
- **Delight as a feature:** the scrapbook look, the bunny, the envelope animation, and an app icon whose bunny gets
  sadder the longer you skip a day (in the style of Duolingo's icon).

## 3. Features

- **Daily entry:** a note, quote or photo, with a "Just words | With a photo" toggle and a **live preview** of the
  scrapbook object as you type. You pick its sticker, tape pattern and colors, or tap "Surprise me".
- **On this day:** each earlier year's memory arrives as a **sealed envelope** with a postage stamp, a sticker seal and
  "to: me, today / from: past me". Tap it and the flap opens and the memory slides out. Several years form a
  **swipeable deck**; a row of year stamps brings any letter to the top.
- **Years cupboard:** each year is a diary standing spine-out on a wooden shelf. The diaries look older with age
  (worn corners, yellowed pages, a coffee ring, a sleepy face). Tapping one plays a **shared-element "book flight"**
  animation: the book slides off the shelf, opens, and turns into that year's page.
- **Year page:** every memory of the year as a scattered pile. "Tidy up" animates each one into its month;
  "Scatter" throws them back.
- **Personalization:** 7 paper colors × light/dark tone ("the same paper by lamplight"), applied live, and your name.
- **Onboarding:** the bunny asks one question per page: name, paper, reminder time (with the permission request), and
  backup.
- **Smart local notifications:** a rolling 30-day schedule (iOS caps pending notifications at ~64), a custom
  music-box sound, a custom notification channel, colored with that year's color.
- **"Lively" app icon:** four icon states (waving, pleading, crying, wailing) chosen by a pure, tested function from
  how long today's page has been empty. It switches only while the app is in the background, to avoid crashes.
- **Home-screen widget (Android):** add today's entry in one tap, see today's entry, or see "💌 2 letters!".
- **Google Drive backup:** sign-in plus a two-way merge sync. Runs on demand and automatically about once a day.
- **Deleting a memory (v1.1):** asked on a paper card in the app's own style (not a system dialog), then a small
  animation: the bunny's head opens like a lid, the memory floats out of its pink brain and drops into a paper
  shredder with a face, which shakes out paper strips. One UI-thread clock drives every piece; tap skips it, and
  "reduce motion" turns it into a short fade.
- **Paper-matched navigation bar (v1.1):** the bottom bar is generated from the chosen paper (a brighter sheet in
  light, a lamp-lit shade in dark, tape in the paper's two accents) for all 7 papers × 2 tones, with a unit test
  that checks label contrast on every combination.
- **Animated intro and splash:** the native splash hands off seamlessly to an animated intro, where memories rain
  down and pile up around the bunny.
- **Accessibility:** respects the system's "reduce motion" setting everywhere (fades instead of springs, no idle
  motion). Proper accessibility roles and labels.

## 4. Tech stack

| Area | What I used |
|---|---|
| Framework | React Native 0.88, **Expo SDK 58**, React 19, **TypeScript 6 (strict)** |
| Navigation | **Expo Router** (file-based routes, tab group + stack, typed routes) |
| Storage | **SQLite** (`expo-sqlite`) with versioned migrations; file system for photos |
| Graphics | **Skia** (`@shopify/react-native-skia`) for paper textures, grain, offscreen image painting; **react-native-svg** for parametric shapes (torn edges, tape, stickers, doodles) |
| Animation | **Reanimated 4** (UI-thread worklets, springs), **Gesture Handler 3** (UI-thread pan gestures) |
| Native features | `expo-notifications`, `expo-image-picker`, `expo-image-manipulator`, `expo-haptics`, `expo-alternate-app-icons`, `react-native-android-widget` |
| Cloud | Google Sign-In (`react-native-nitro-google-signin`), **Google Drive REST API** (`drive.file` scope) |
| Asset pipeline | Node script using **CanvasKit** to generate every icon, splash, mascot pose and notification image from one drawing in code |
| Native config | Custom **Expo config plugins** (120 Hz display mode, release signing); Continuous Native Generation (no hand-edited native folders) |
| Quality | Jest (89 unit tests), ESLint (Expo config + React Compiler rules), `tsc --noEmit`; testing on a real phone over ADB |
| Builds | Local Gradle release builds over USB; EAS Build profiles (preview APK, production) |

## 5. Architecture and engineering decisions

- **Repository layer:** all data access goes through `entriesRepository`, `settingsRepository` and
  `backupRepository`. UI code never touches SQLite, the file system or Google APIs directly. Drive backup was added
  later behind the same interface without changing any screen.
- **Pure, tested core logic:** date rules, notification planning, backup merging, seeded looks, layout maths, icon
  state and paper themes are pure TypeScript modules with no React Native imports, each covered by Jest tests.
- **Calendar-correct date handling:**
  - Dates are stored as the *local* calendar date (`YYYY-MM-DD`), never derived from UTC, to avoid off-by-one-day
    bugs across time zones.
  - Leap day is handled: Feb 29 entries resurface on Feb 28 in non-leap years.
- **Schema migrations** via `PRAGMA user_version`, four so far: base schema, style fields, style colors, then a
  `deleted_entries` table for deletion tombstones (v1.1).
  Shipped migrations are never edited.
- **Photos** are copied into app storage, downscaled once to 1600 px JPEG, and stored as *relative* paths (the iOS
  container path changes between installs).
- **Deterministic procedural design:** each entry's look (object type, tilt, tape, sticker, torn-edge shape) comes
  from a seeded random generator (FNV-1a hash + mulberry32) keyed on the entry id. It's stable across renders and
  devices, and user-chosen style fields override it.
- **Backup sync design:**
  - Data model: a JSON manifest plus photo files in a visible Drive folder.
  - Merge rules: two-way merge where the latest `updatedAt` wins. Same day with different ids keeps the latest entry
    (preserving one-per-day). Only missing photos move, and photos upload before the manifest. Sample data never
    leaves the phone.
  - **Deletions sync as tombstones** (v1.1): a deleted memory is remembered (id + time) and written into the
    backup manifest, so a two-way merge removes it everywhere instead of restoring it from the other copy. A
    deletion beats any copy edited before it; an edit made after it (on another phone) wins. The deleted memory's
    photo is moved to the Drive trash. Older backups without tombstones still load.
  - Android Auto Backup is deliberately turned off because it restored stale data on reinstall.
- **In-memory entries store,** preloaded during the splash screen, so every screen has its data on the first frame.
- **Design tokens:** every color, spacing, radius, type style, shadow and motion value comes from one tokens file via
  a theme hook. Screens contain no inline colors. Theme is built by `makeTheme(paper, tone)`.

## 6. Performance work (measured on the device)

I profiled with `adb shell dumpsys gfxinfo` and fixed what the numbers showed:

- **Enabled 120 Hz** with a custom config plugin. The phone was running the app at 90 Hz by default.
- **Rasterized static, shadow-heavy views** into GPU textures. The animated mascot was forcing about 60 redraws a
  second of everything behind it.
  - **Home idle GPU time per frame: 12 ms → 5 ms.**
  - **Home scroll janky frames: 9% → 0–0.3%.**
  - **Settings GPU per frame: 16 ms → 5.5 ms.**
- **Virtualized the year pile:** only memories within one screen of the viewport are built, and the rest are built
  ahead in small batches. Crowds use a "lite shadows" mode, a flat offset shape in place of a blur.
  - **Diary scroll GPU: 11–12 ms → 6 ms; jank ~10% → 1.8%.**
  - **Opening a 72-memory year: 0% janky frames.**
- **Paused hidden tabs:** pages kept alive in the tab navigator stop all animation while hidden.
- **Swapped always-mounted text inputs** on tab pages for tap-to-edit text. They caused a 350 ms stall and a
  keyboard popping up whenever the tab appeared.
- **Pre-rendered mascot poses** to PNG. Drawing the bunny live cost too many frames.

## 7. Notable bugs I diagnosed and fixed

- **Android text clipping with a handwriting font:**
  - Android under-measures the Caveat font, so self-sizing labels lost their last letter or word. "Daily reminder"
    rendered as "Daily".
  - I found it from UI-hierarchy dumps (measured text bounds narrower than the drawn glyphs). The fix: give such
    labels their row's width.
  - Wrote the rule into the project docs so it doesn't come back.
- **Reanimated worklet crash:** an animated style called a plain JS helper on the UI thread. Fixed by inlining the
  value.
- **Expo Go crash** in Android notification-channel setup. Fixed by making setup non-fatal and using the channel only
  once it exists.
- **Wrong copy:** the detail screen said "2 years ago today" for a memory from a different day. Added a pure
  `memoryKicker()` function with tests ("today" only on a real on-this-day match).
- **Gesture conflicts:** horizontal swipes on the memory pile vs. vertical page scrolling. Swipes only take over when
  the drag is clearly sideways.
- **"Google Drive keeps asking to connect again" (found in daily use, fixed in v1.1):**
  - Symptom: every day or two the app showed Google's account picker, as if the Drive connection was lost.
  - Cause: the quiet daily auto-backup checked the sign-in with the library's `signIn()`. On Android that is the
    Credential Manager sheet, not a silent check. I traced it by reading the native Android source of the sign-in
    library.
  - Fix: read the saved session (`getCurrentUser()`), never show UI from a background path; only the "Back up now"
    button may ask, and only if the session is really gone. Verified on the phone after a cold restart.
- **Deleted data coming back through sync:** found while designing deletion; a plain delete would be undone by the
  two-way merge. Solved with tombstones (see section 5), covered by 5 new unit tests.
- **Safe upgrades:** before publishing v1.1, checked the v1.0.0 APK's signing certificate and built v1.1 with the same
  release key. A debug-key build would have forced users to uninstall and lose their memories.

## 8. Process and quality

- Planned before coding, then worked in small steps. After each step: typecheck + lint + tests (`npm run check`),
  then a **release build installed on a real phone** and screenshots in light and dark mode. Anything not
  verified was written down.
- Project rules live in `CLAUDE.md` / `AGENTS.md` (architecture, date rules, UI rules, performance budget), so humans
  and AI agents follow the same conventions.
- Used a design canvas (Claude Design) to lay out screen changes, then implemented and iterated on the device.

## 9. How it was built (be accurate about this)

LookBack was built by me **working with an AI coding agent (Claude Code)**:
- **My part:** product idea and requirements; UX and visual direction; feature priorities; every design and copy
  decision; testing on my phone; reviewing changes; deciding what ships; all version control.
- **The AI agent's part:** most of the code, under my direction. It worked from written specs and project rules I
  set, ran the checks, and installed builds on my phone over ADB so we could review screenshots together.

Honest framings that work on a resume:
- "Built and shipped a working Android app end-to-end using an AI coding agent, owning product, UX direction,
  specs, QA on device and release."
- "Directed an AI coding agent with written specs and project rules (architecture, testing, performance budgets);
  reviewed and verified every change on a real device."

Don't claim I hand-wrote all 9,700 lines. For roles that value AI-assisted development (most product, startup, and
many engineering roles now), present this as a strength: spec-writing, reviewing, debugging and measuring.

## 10. Skills this project demonstrates (pick per role)

- **Mobile / React Native:** Expo, Expo Router, Reanimated, Gesture Handler, Skia, SVG, native config plugins, Android
  widgets, notifications, alternate app icons, release builds, device profiling.
- **Frontend / design engineering:** design tokens and theming (7 papers × 2 tones), procedural graphics, motion
  design with springs, accessibility (reduce motion, roles/labels), handmade visual style.
- **Data / backend-ish:** SQLite schema and migrations, repository pattern, offline-first design, OAuth sign-in,
  Google Drive REST, a two-way sync with deterministic conflict rules.
- **Quality:** strict TypeScript, unit-testing pure logic (dates, leap years, time zones, sync merge, layout maths),
  lint rules, verification on a real device.
- **Performance:** profiling frame times, GPU rasterization, virtualization, UI-thread animation, 120 Hz.
- **Product:** habit design (one entry a day, no nagging), emotional design (letters from your past self, a mascot,
  a "lively" icon), onboarding, microcopy.
- **AI-assisted development:** writing specs and project rules for an AI agent, reviewing and verifying its work,
  keeping humans in charge of git and decisions.

## 11. Sample resume bullets (adapt to the role; numbers are real)

- Built **LookBack**, an offline-first Android journaling app (React Native, Expo SDK 58, TypeScript). One entry a
  day resurfaces on the same date a year later as an animated "letter from your past self".
- Designed a repository-based data layer on SQLite with versioned migrations, then added **Google Drive backup with
  two-way merge sync** behind the same interface without changing the UI.
- Cut home-screen GPU time per frame **from 12 ms to 5 ms** and scroll jank **from 9% to under 0.3%**. Methods:
  profiling on device, rasterizing static views to GPU textures, and enabling 120 Hz with a custom Expo config plugin.
- Wrote **89 unit tests** for calendar logic (time zones, leap days), notification scheduling within iOS's
  64-notification limit, sync conflict and deletion rules, theme contrast, and layout maths.
- Shipped **v1.1 a week after v1.0** from real daily use: fixed a Google sign-in bug that made Drive backup look
  disconnected, and added memory deletion that syncs correctly through a two-way merge using tombstones.
- Created a procedural scrapbook UI (polaroids, torn notes, washi tape) with Skia and SVG, seeded per entry for
  stable, unique looks, plus a home-screen widget and a mood-based "lively" app icon.
- Shipped the app end-to-end with an AI coding agent: I wrote the specs and project rules and verified every change
  on a real device.

## 12. Links / artifacts

- Code (public): https://github.com/Sreekaran1704/LookBack
- Releases with signed APKs: https://github.com/Sreekaran1704/LookBack/releases (v1.0.0, v1.1.0)
- Demo videos (screen recordings from the real phone, edited with handwritten captions in the app's style):
  - v1.0 launch: `docs/LookBack-demo-linkedin.mp4`
  - v1.1 "what's new" (61 s, vertical, made for LinkedIn): `~/Documents/LookBack-1.1-demo.mp4`. It covers the
    paper-matched bar across papers in light and dark, deleting with the bunny's brain-to-shredder animation, and
    "Back up" with no Google sign-in sheet.
- LinkedIn posts: one per release (v1.0 launch; v1.1 on the week of real use, the Drive bug and deletion with
  tombstones). Drafts: `docs/linkedin-post-*.md`.
- Play Store: not yet published
