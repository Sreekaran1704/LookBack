# LookBack — project rules

Expo tooling rules (SDK-versioned docs, `npx expo install`, no hand-edited native folders): @AGENTS.md

## Concept
One tiny entry per day (note, quote, or photo). On the same calendar date a year later, the app
reminds the user and shows it. Later milestones: private Google Drive backup (M2), Play Store release.

## How to work
- Plan first for anything non-trivial; work in small steps.
- After each step run `npm run check` (typecheck + lint + tests) and report what was actually verified,
  including what could not be verified (e.g. on-device behavior).
- Expo SDK 58, React Native 0.88, Reanimated 4.7, Skia 2.14 (paths are built with `Skia.PathBuilder`), react-native-svg.
- **Verify on the real phone** (OnePlus Nord 5 over ADB): local release build with
  `EXPO_PUBLIC_SHOW_DEV_TOOLS=1 npx expo run:android --variant release`, then screenshots via `adb exec-out screencap`.
  Check both light and dark (Settings → Look → Dark), not just tests.
- **Never run git write commands** (commit, branch, reset…). The user does all git.

## Architecture rules
- Routes live in `src/app/` (expo-router). Non-route code lives elsewhere in `src/`. The bar's pages (Home, Years,
  Settings) are a tab group `src/app/(tabs)/` (URLs stay `/`, `/years`, `/settings`): built once and kept, kept attached
  (`detachInactiveScreens={false}`), switched with a 160 ms cross-fade. Everything else is pushed on the root stack.
- **All data access goes through `src/data/`** (`entriesRepository`, `settingsRepository`). UI never imports
  `expo-sqlite` or `expo-file-system`. Drive backup (M2) must plug in behind these interfaces.
- SQLite table `entries`: `id` (UUID), `local_date` (`YYYY-MM-DD`), `text`, `photo_uri`, `created_at`, `updated_at`,
  plus optional style `object_type`, `tape_pattern`, `sticker` (v2; NULL = derive from the id seed, `sticker='none'` = no sticker)
  and `sticker_color`, `tape_color` (v3; a style palette name from `STYLE_PALETTES`, NULL = the entry's year color).
  Schema changes = append a migration in `src/data/db.ts` (`PRAGMA user_version`); never edit a shipped one.
- **Store the local calendar date, never a UTC-derived date.** Use `toLocalDate()`; never `toISOString().slice(0,10)`.
- `photo_uri` holds a path **relative to the document directory** (`photos/<uuid>.jpg`). Picked photos are copied
  there by `photoStore.importPhoto`. Resolve with `resolvePhotoUri()` at render time (the iOS container path changes).
- One entry per day by default, enforced in the repository (no UNIQUE constraint, to keep restore/merge simple).
  Editing today's entry is allowed.
- Date logic is pure and lives in `src/lib/dates.ts`; notification planning is pure in `src/notifications/planner.ts`.
  Both must stay free of React Native imports and be covered by tests in `__tests__/`.

## Date rules
- "On this day" = same month and day, earlier year.
- Feb 29 entries surface on Feb 28 in non-leap years (and only on Feb 29 in leap years).
- Timeline groups by year, newest first; entries newest first within a year.

## Notifications
- `expo-notifications`, local scheduling only. iOS allows ~64 pending, so schedule a **rolling 30-day window**:
  one notification per upcoming day that has a past-year match, at the user's chosen time.
- Rebuild the window on app open (foreground) and after every save/settings change (root layout subscribes to the repositories).
- Only cancel notifications with `data.kind === 'memory'`; leave others alone.
- Copy is a letter from your past self: title "💌 A little letter from 2025" (or "💌 3 little letters from your past self"),
  body "One year ago today: <first line>" / "2 years ago today: …", plus " · and 2 more 🐰" for several; a photo-only
  memory reads "a photo you saved 📷".
- Look: bunny status-bar icon (`assets/notification-icon.png`), waving bunny on a peach page as the large icon
  (`notification-large.png`), both from `scripts/make-icons.mjs`; accent color = the memory's year color; music-box chime
  (`assets/sounds/chime.wav`) and a gentle vibration; on iOS a photo memory attaches its photo. Tapping opens home.
- Android channel `memories-chime` ("Letters from your past self"). Channels can't change sound once created, so a new
  sound needs a new channel id (delete the old one, as `memories` is).

## UI rules — cutesy paper journal
- The whole app is a warm, handmade journal: cream paper desk, taped paper cards, washi tape, stickers, doodles,
  handwriting, and a little clay buddy for company. Lean cute; when in doubt add a sticker, not a gray box.
- Every color, spacing, radius, type style, shadow and motion value comes from `src/theme/tokens.ts` via `useTheme()`.
  Drawing constants inside `src/components/scrapbook/*` may be named module constants. **No inline hex in screens.**
- A photo with words gets them on a small torn note taped to its lower right (polaroid caption becomes the date).
- Each entry is a physical object (`ScrapObject`): polaroid, taped photo, torn note, or ticket stub, with tape / clip / pin
  and an optional sticker. The type, tilt (±4°), offsets, tape pattern and sticker come from `lookForEntry()` in
  `src/lib/seeded.ts` (seeded by entry id, stable across renders; stored style fields override when valid).
- Parametric SVG/Skia pieces live in `src/components/scrapbook/`: PaperBackground, Polaroid (+TapedPhoto), TornNote,
  TicketStub, WashiTape, PaperClip, Pin, DateStamp, Sticker, Doodle, AlbumStack, Buddy, plus ScrapObject, DropIn,
  Confetti. No image assets: textures (grain, grid, cork) and the buddy are drawn in code.
- Screen chrome (`src/components/Screen.tsx`): `ScreenTitle` (highlighter swipe + count circled in pen),
  `SectionHeader` (wavy underline), `Panel` (a slightly crooked paper card held by washi tape, sticker in a corner).
  Panels and buttons are paper: text on them uses `colors.ink`, never `colors.onDesk` (paper stays light in dark mode).
- Pills (`PillButton`): `paper` = quiet, `dark` = the main action, amber = reminder status, green = saved.
- **One notebook throughout**: every screen is the same dotted page (`<PaperBackground variant="dots" desk />`) on the
  person's chosen paper, with a red margin line down the left edge (inside a year diary the page is tinted with the
  year's color), and ends with a handwritten page footer (`PageFooter`: "page 1 · the cover", "2025 · 72 pages",
  "the last page · settings").
- **Paper and tone** (`src/theme/papers.ts`, pure + tested): the person picks a paper color (cream, peach, rose, lemon,
  mint, sky, lavender) and a tone. Light = the pale paper; **dark = the same paper by lamplight** (a deep shade of that
  color, not black), light text on it. `makeTheme(look)` builds the theme; `useLook()` reads/sets it; it is stored as
  JSON under the old `themeMode` key (`parseLook` still reads the old 'light'/'dark'/'system'). No "follow the system".
  Loaded during the splash (`preloadLook`) so the first frame is on the right paper.
- **Bottom bar** (`NavBar`, global in the root layout): a stitched paper strip taped at both ends with a round notch
  (an even gap all round) cradling the + sticker, which has bunny ears; Home, Years (its own page, `/years`) and
  Settings; the page you're on sits on a fixed-width pill of the year color. The + writes today / edits it (green). A screen can add its own button while focused
  with `useNavAction` (the year page's Tidy up / Scatter). Hidden on `/entry`, `/welcome` and while the keyboard is up.
  Scroll views leave `useNavBarSpace()` at their foot. Screens have no add/settings buttons of their own.
- **Home title** is the app name "LookBack" (no count, no buttons), with "hi, <name> ✿" under it and a peeking bunny.
- **On this day** (home, `MemoryLetters`): each earlier year's memory arrives as a sealed envelope from your past self
  (year tint, sticker seal, "to: me, today / from: past me", postage stamp with the year, the buddy perched on top
  saying "psst… a letter from 2025"). Tap: the flap opens and the memory slides out; tap the memory to read it in full;
  tap the envelope to tuck it back. **Several years make a deck** (`LetterDeck`): letters stacked and fanned, swipe the
  top one away (gesture-handler v3 `usePanGesture`, all on the UI thread) and it tucks in at the back; a row of year
  stamps underneath brings any letter to the top. This is the heart of the app: keep it the hero.
- **Year screen**: opens as a scattered pile of every entry (overlapping, tilted up to ±16°, stable shuffled order).
  The floating "Tidy up" pill slides each one under its month (January first, oldest first within a month) with a
  highlighted month name, count and sticker; "Scatter" throws them back. Layout maths is pure in
  `src/lib/yearSpread.ts` (tested in `__tests__/yearSpread.test.ts`).
- **Buddy** (`Buddy`, `BuddySays`): a soft cream **bunny** (gradient-lit forms, blurred ambient shading, tummy patch,
  round glossy brown eyes with a big highlight and a sparkle, airbrushed cheeks, ground shadow) cut out as a puffy die-cut sticker with a warm outline. Its poses are
  **pre-rendered images** (`assets/buddy/*.png`) plus a white bow tinted with the year color: drawing it live cost too
  many frames. Change its look in `scripts/make-icons.mjs` and run `node scripts/make-icons.mjs`. Moods: wave, happy, sleepy (ears flop), cheer, peek;
  the icon also uses plead (huge eyes, clasped paws), cry (tear streams) and wail (squeezed eyes, tear fountains, puddle). Keep it clearly
  not an orange blob: earlier versions read like another company's mascot. Use it where the app would otherwise feel
  empty or cold: empty states (with a paper speech note), nudges ("What's one small thing from today?"), peeking over
  a title, cheering on save. One buddy per screen area; it bobs gently and holds still under reduce motion.
- **Years cupboard** (home, `Cupboard` + `BookSpine`): a wooden cupboard (planked back panel with grain, crown, lit
  shelf edges, feet) where each year stands upright **spine out**, oldest left to newest right, a shelf filling before
  the next. A spine: rounded cloth in the year color, head/tail bands, the year written down a paper label (reads
  bottom to top), memory count at the foot, a tiny age face; this year's has its ribbon out of the top. The bunny sits
  at the end of the bottom shelf as a bookend.
- **Opening a book** (`BookFlight`, wraps the navigator): the spine slides up out of its row, floats to the middle
  growing, turns to its cover (`AlbumStack` with `open`), the cover swings open onto a first page ("2025 · 72
  memories") with a glow and a burst of stars and hearts; meanwhile the year page is pushed **hidden under the opaque
  paper** and reports `ready` once drawn; then the open book swells and dissolves into it. The year page starts its
  pile empty and stacks every memory on after the reveal (one per 55 ms). Everything moving is `LiteShadows`, the glow
  and sparkles are textures. Measured: flight ~5% janky frames, stack-up ~11%.
- **Year diaries** (`AlbumStack`, `age` = this year − diary year): little hardback characters — linen cover lit from
  the top left, embossed border, elastic band, a paper name label with the year, and a face (wide-eyed when new, content
  for a year or two, dozing with a "z" from 3 years). They show their age. This year's is crisp with a
  ribbon bookmark ("brand new"); older ones fade, wear through at the corners, pick up a crease and scuffs (2+ years),
  yellowed pages and a coffee ring (3+), with "3 years old" handwritten underneath.
- **Buddy motion**: pops in when it appears, rocks when waving, bounces when cheering, breathes when asleep, and hops
  whenever its `bump` prop changes (each keystroke on the entry screen, Tidy up / Scatter on the year screen).
- **Keep it smooth** (measure with `adb shell dumpsys gfxinfo com.yearbook.app`; aim for ~0% janky frames):
  blurred `boxShadow`s and sticker `filter`s are re-drawn every frame while scrolling. Wrap still, shadow-heavy
  objects in `Raster` (GPU texture; `ScrapObject` and `AlbumStack` already do) — never around something that animates
  inside. For crowds (the year pile) wrap in `LiteShadows` instead and pass `raster={false}`: no blur, a flat offset
  shape stands in for the shadow.
- **Writing screen**: "Just words | With a photo" sliding toggle at the top (switching to words puts the photo aside;
  switching back restores it), then today's object **live** (updates on every letter and pick; an empty polaroid to tap
  in photo mode), then the ruled note (a 2-line caption under a photo). Tapping the preview's tape or sticker (or the
  dashed "+" spot where a sticker could go; `ScrapObject` `onPressTape`/`onPressSticker`) opens every option for that
  part with its colors, in a wrapping grid under a "Sticker | Tape" toggle. New entries get their id up front (`newEntryId()`, passed as
  `SaveEntryInput.id`) so "Surprise me" previews exactly what is saved. A picked tape (pattern or color) always holds the
  object (`lookForEntry`), and a sticker is never hidden by a clip or pin (it moves to the top right).
- **Standing out from the page**: the buddy has a warm outline around its white sticker edge (`buddyOutline`); diaries
  have an outline, shadows in their own deep shade (`palette.ink`) and a contact shadow, so a lime diary still reads on
  a lime-washed page.
- Year colors (`src/theme/yearColors.ts`): 2025 coral, 2024 teal, 2023 amber, 2022 violet, 2021 lime, repeating
  (2026 = lime). Use them for tape, stamps, stickers, tints, album covers, shadows.
- Shadows are paper-on-desk: `theme.shadow(tint, lift)` (layered, tinted; omit the tint for warm brown). Never flat gray.
- Type: **handwriting everywhere** — Caveat 700 for titles/labels, 600/500 for notes, captions and body. No sans.
  Android under-measures Caveat: a shrink-wrapped Caveat label (`alignSelf` start/end, content-sized parent) loses its
  last letter or word. Give it the row's width (`flex: 1` or full width + `textAlign`) instead. Android also clips
  text just inside its padding, so big headings end with `HAND_TAIL` (a trailing space, `Screen.tsx`), or the last
  letter's tip is sliced off ("da|y").
- Motion: Reanimated springs. Drop-in entrance with 75 ms stagger (first 12 only), envelope flap opens and the letter slides out, press lifts 1.03 and tugs tape, save = pop + tape flicker + confetti + cheering buddy + green pill. Use
  `sharedValue.get()/.set()` (React Compiler lint). **Respect `useReducedMotion()`**: fall back to fades, no sway.
- The background is paper too (`<PaperBackground desk />`): cream paper with a faint grid/dots, cloudy mottling and
  fine grain in light mode; **black paper** in dark mode (charcoal sheet, pale grain, faint pale lines, darker edges).
  No wood desk, lamp or dust motes. **Paper objects stay light** (dimmed cream) on the black page. Theme follows the
  system with an override in Settings (System/Light/Midnight); switching cross-fades the page.
- Microcopy: warm and short ("One year ago today", "Nothing here yet. Add today's moment.").

## First run, Settings
- `/welcome` (shown after the intro until `settingsRepository.getOnboarded()`; also "Meet the bunny again" in
  Settings): the bunny asks one thing per page — name (`profile.name`), paper + tone (applied live), reminder time
  (asks for notification permission), Google Drive backup — then "Write today's page". Answers save as they're given.
- Settings is one paper card per topic, each with a colored icon badge and its help text inside the card:
  You, Look, Reminders, Backup, About, (Developer).

## Name, icon, splash, intro
- The app is **LookBack** (`app.json` name). The package id stays `com.yearbook.app` and the slug/scheme `yearbook`:
  changing them would make a new app (losing data) and break the Google OAuth client and EAS project.
- `scripts/make-icons.mjs` (CanvasKit, already installed with react-native-skia) paints the icon (the whole bunny on
  the peach dotted page, no name), Android adaptive layers, themed-icon silhouette, splash, buddy poses, notification
  icons and the widget preview from one bunny drawing. `PREVIEW=/path.png node scripts/make-icons.mjs` draws a sheet of
  moods instead. Re-run it after changing the bunny, then prebuild.
- **Lively icon** (Duolingo-style): `iconStateFor()` in `src/lib/appIcon.ts` (pure, tested) picks Default (waving),
  Waiting (pleading, from 18:00 with today empty), Missed (crying, a whole day missed) or Gone (wailing, 4+ days).
  `expo-alternate-app-icons` switches activity aliases; `syncAppIcon()` only runs while the app is in the background
  (on leaving the app, and from the widget's half-hourly refresh), because swapping an alias in the foreground can close it.
- **Widget** (`react-native-android-widget`, Android): `src/widget/` — `TodayWidget` (taped paper card on the chosen
  paper, Caveat, the bunny; empty day: "+ add today" opens `yearbook:///entry`; written: today's first lines + "edit";
  "💌 2 letters!" when past years match, or the streak). The headless handler is registered in `index.ts` (the app
  entry, which also loads expo-router); the app calls `refreshWidget()` after entry or settings changes.
- Startup: the native splash (`expo-splash-screen`, bunny on the desk color) hands off to `Intro`
  (`src/components/Intro.tsx`) with the same bunny in the same spot. The bunny hops to the bottom, ~20 recent memories
  (placeholders if few) rain down and pile up from the floor to the top of the screen, two land on its head, it cheers,
  "LookBack" appears on a taped label, and the sheet lifts away to home, which rendered underneath. Tap to skip; reduce
  motion = short fade. The pieces are built in one go while the bunny sits still, then fall purely on the UI thread.

## Speed (measure with `adb shell dumpsys gfxinfo com.yearbook.app`)
- **120 Hz**: `plugins/withHighRefreshRate.js` asks Android for the fastest display mode up to 120 Hz (the phone drew
  LookBack at 90 Hz otherwise). At 120 Hz a frame has 8.3 ms, so watch the GPU percentiles, not just "janky".
- The bunnies bob forever, which re-renders the screen ~60×/s: anything with a blurred shadow that sits still must be a
  texture (`Raster`; it now keeps the same view when toggled, only the flag changes). Sealed envelopes are rastered
  (not while their flap moves). This took home idle GPU from 12 ms to 5 ms a frame and home scroll jank from 9% to 0%.
- Photos are shrunk to 1600 px JPEG once on import (`photoStore.importPhoto`, expo-image-manipulator).
- Hidden bar pages must not animate: `usePageActive()` (`PageActive.tsx`, provided per tab via `screenLayout`) is
  false while a page is hidden, and the bunny stops bobbing. Otherwise hidden pages keep the phone repainting.
- Settings cards (`Panel`) are textures (`Raster`): Settings cost 16 ms of GPU a frame before, 5.5 ms after.
- No text box that is always on screen in a bar page: Android focuses it whenever the page appears (a 350 ms stall
  and a keyboard popping up). Show text and swap in a `TextInput` on tap (Settings → Your name).
- Diary memories within a screen of the view are textures taken outside the 1.7× miniature scale (on-screen size,
  ~1 MB each, ~14 MB in all); far ones stay plain drawings. Diary scroll GPU 11–12 ms → 6 ms, jank ~10% → 1.8%.
- A diary keeps building ahead after the stack-up (one more screen every 140 ms) until the whole pile exists, so
  scrolling doesn't build mid-scroll: diary scroll jank 19% → ~10% (still some slow UI-thread frames).
- Entries live in one in-memory store (`src/hooks/useData.ts`): loaded during the splash (`preloadEntries`), refreshed on
  every repository change; `useYearEntries`/`useEntry` read from it, so screens have their data in the first frame.
- Building many scrapbook objects is what costs frames (each is several SVG views), not moving them. Year screen: the
  bottom of the pile is drawn during the slide-in, the rest stacks on after it, and **only memories within a screen of
  the visible area are built** (more as you scroll), like a chat list. In crowds (`LiteShadows` → `theme.lite`) tape is
  a plain strip, notes skip ruled lines and stickers skip filters. Reminders and backup wait 3 s after startup.
- Last measured (OnePlus Nord 5): home scroll 0–0.3% janky frames, opening a 72-memory year 0%, scrolling it ~2%,
  cold start + intro ~5%.

## Backup (M2) — private Google Drive
- UI talks only to `backupRepository` (`src/data/backupRepository.ts`): `getStatus`, `connect`, `disconnect`, `syncNow`,
  `syncIfDue`. Google sign-in (`src/data/backup/googleAuth.ts`, `react-native-nitro-google-signin`) and Drive REST
  (`src/data/backup/driveStore.ts`, `expo/fetch`) stay behind it.
- Format and merge rules are pure in `src/lib/backup.ts` (tested in `__tests__/backup.test.ts`): one `yearbook.json`
  manifest plus the photo files, in a visible **"LookBack" folder** in the person's Drive (a folder from before the
  rename, "Yearbook", is found and renamed in place). Scope is `drive.file` only
  (the app sees just the files it created). Sync is a two-way merge: same id → latest `updatedAt` wins; same day with
  different ids → the latest one is kept (one entry per day); only missing photos move; photos go up before the
  manifest. Sample entries (`seed-` ids) never leave the phone.
- Runs when the person taps "Back up now" in Settings, and quietly on app open / foreground when connected and the last
  backup is older than ~20 hours. The chosen account and last backup time live in the settings table.
- Needs `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` at build time (OAuth *Web application* client id; not a secret). Without it
  Settings shows "isn't switched on in this build yet". Google Cloud must also have an *Android* OAuth client for
  `com.yearbook.app` with the signing key's SHA-1 (local release builds use `android/app/debug.keystore`; EAS and Play
  builds have their own). iOS needs its own client and the real `iosUrlScheme` in `app.json` (currently a placeholder).
- Google Cloud project: "Yearbook" (`yearbook-514320`), consent screen in Testing (only listed test users can connect).
  The web client id is in `.env` and `eas.json`. After changing an `EXPO_PUBLIC_*` value, clear Metro's cache
  (`rm -rf $TMPDIR/metro-*`) or the old value stays in the bundle.
- Verified on the phone: sign-in, first upload (manifest + photo appear in Drive), and restore of a missing text entry
  after a reinstall. Not yet verified: downloading a missing *photo* from Drive, and the daily automatic run.
- Android's own Auto Backup is **off** (`android.allowBackup: false` in `app.json`): it used to restore a stale copy
  of the data on reinstall. Drive is the only backup, so someone who never connects it has no copy off the phone.

## Dev-only tools
Settings → Developer panel (only when `SHOW_DEV_TOOLS` in `src/lib/flags.ts`: `__DEV__`, or EAS `preview` builds via
`EXPO_PUBLIC_SHOW_DEV_TOOLS=1`; never in `production`): seed sample memories (ids prefixed `seed-`, 4+ years, text/quote/
long text/photos — photos are painted with Skia offscreen; includes Feb 29 2024), clear them, and fire a test notification in 3 s.
