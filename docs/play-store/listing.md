# LookBack — Google Play listing

Copy each block into Play Console → Grow → Store presence → Main store listing. Character limits are Play's.

## App name (max 30)

```
LookBack: One Year Ago Today
```
(28 characters)

## Short description (max 80)

```
One small thing a day, in words, a photo or your voice. Meet it again next year.
```
(80 characters)

## Full description (max 4000)

```
LookBack is a leather-bound diary for one small thing a day.

Write a few words, tuck in a photo, or record your voice. On the very same day next year, LookBack brings it back to you as a letter from your past self, so you can see how it feels now.

ONE SMALL THING A DAY
No blank pages, no streak pressure. A sentence, a quote, a photo or a few seconds of your voice is plenty. Whatever weighed on you, or made you smile, goes on today's page.

LETTERS FROM YOUR PAST SELF
On the same date a year later, the page comes back as a sealed letter. Several years on the same day? They wait for you together.

WRITE BACK
Read what you wrote a year ago, then write back to your past self. Your reply is kept in sepia ink under the original.

VOICE ON TAPE
Record up to a minute. Your voice goes on a little cassette, and a leather tape recorder plays it back, reels turning, needle following your voice.

A DIARY FOR EVERY YEAR
Each year is its own volume on a bookshelf. Open one and every page of that year is there.

MAKE IT YOURS
Pick the colour of your paper, by day or by lamplight at night.

GIVE A PAGE TO SOMEONE YOU LOVE
Add the people you trust (beside you, or by sharing your code), and give them a page: it goes straight from your phone to theirs, encrypted. Pages from your people arrive by themselves, even when LookBack is closed.

GENTLE REMINDERS
A quiet note on the days when a letter from an earlier year is waiting, at the time you choose.

PRIVATE BY DESIGN
Your diary stays on your phone. No ads, no tracking. If you like, back it up to a "LookBack" folder in your own Google Drive; the app can only see the files it made there. Pages you give go phone to phone and are never stored on a server.

LookBack is made by one person, with care. Start today, and next year, today will be waiting for you.
```

## Release notes for this version ("What's new", max 500)

```
Hello, Play Store!
• A new look: a leather-bound diary with cream pages.
• Voice memories play on a little tape recorder.
• Write back to your past self when a letter comes back.
• Give a page to someone: phone to phone, encrypted.
• Pages from your people arrive by themselves, with an alert if LookBack is closed.
```

## Category and contact

- App or game: **App**
- Category: **Lifestyle**
- Tags (pick up to 5 that Play offers): Journal, Diary, Memories, Photo, Personal
- Contact email: **your developer email** (required, shown publicly)
- Website: https://github.com/Sreekaran1704/LookBack
- Privacy policy: https://sreekaran1704.github.io/LookBack/privacy/

---

# App content answers (Policy → App content)

## Privacy policy
https://sreekaran1704.github.io/LookBack/privacy/

## Ads
**No**, the app does not contain ads.

## App access
**All functionality is available without special access** (no login is needed; Google sign-in is only for the optional Drive backup).

## Content rating (IARC questionnaire)
- Category: **Reference, News, or Educational**? No — choose **"All Other App Types"**.
- Violence, sexuality, language, controlled substances, gambling: **No** to all.
- Does the app let users interact or exchange content with other users? **Yes** (giving a page to someone).
  Follow-ups: shared content isn't the main content, no public nudity/violence, no block/report/chat moderation,
  interactions **can be limited to invited friends: Yes**.
- Does the app share the user's current physical location? **No.**
- Does the app allow users to purchase digital goods? **No.**
- Result (submitted 23 Nov): **Everyone / PEGI 3 / USK all ages / 3+**, interactive element **Users Interact**.

## Target audience
- Age groups: **18 and over** (simplest; you may add 13–17). Do **not** pick under-13 groups: that brings the Families policy.
- Appeal to children: **No**.

## News app
**No.**

## Health apps / Financial features / Government app
**None / No.**

## Data safety

Answer "Does your app collect or share any of the required user data types?" → **Yes**.

- Is all of the user data collected by your app encrypted in transit? **Yes** (HTTPS / TLS everywhere).
- Do you provide a way for users to request that their data is deleted? **Yes**.
- **Account creation**: users can create an account (the sharing account, via Google sign-in). **Delete account URL**:
  `https://sreekaran1704.github.io/LookBack/privacy/#delete` (in-app: You → Delete sharing account).

Data types — mark only these as **Collected** (none as **Shared**):

| Data type | Collected | Shared | Processed ephemerally | Required or optional | Purpose |
|---|---|---|---|---|---|
| Personal info → **Email address** | Yes | No | No | **Optional** (only when you connect Google) | App functionality, Account management |
| Personal info → **User IDs** (the sharing account id) | Yes | No | No | **Optional** | App functionality, Account management |
| Personal info → **Name** | Yes | No | No | **Optional** (only while visible to people beside you) | App functionality |
| Device or other IDs (the push address for alerts) | Yes | No | No | **Optional** | App functionality |
| Photos and videos → **Photos** | Yes | No | No | **Optional** (only with Drive backup) | App functionality (backup) |
| Audio → **Voice or sound recordings** | Yes | No | No | **Optional** (only with Drive backup) | App functionality (backup) |
| App activity → **Other user-generated content** (the written memories) | Yes | No | No | **Optional** (only with Drive backup) | App functionality (backup) |

Why these answers:
- Pages given to someone go **phone to phone, end-to-end encrypted**; the developer can't read them, so they are not
  "collected" (Play's exemption for end-to-end encrypted data), and a transfer the user starts to another user is not
  "sharing".
- The short connection notes (name, a page's date, network addresses) pass through the sharing service and are
  deleted within minutes: that's covered by Name above.
- Supabase (sharing service) and Firebase Cloud Messaging (alerts) are service providers acting for the app, so their
  use isn't "sharing" either. Drive backup goes to the user's own Drive at their request.

Not collected: location (the Bluetooth permission on Android ≤ 11 is for finding people nearby only), contacts,
financial info, health, messages, files and docs, calendar, analytics, web browsing, crash logs.

## Permissions declarations
- **Microphone (RECORD_AUDIO)**: used only while the user records a voice note. No special declaration form is needed
  for it, but the Data safety answers above cover the recordings.
- **Nearby devices (BLUETOOTH_SCAN / ADVERTISE)**: to find people beside you on the Shared page; on Android 11 and
  older Android also needs ACCESS_FINE_LOCATION for Bluetooth scanning (declared with maxSdkVersion 30). No location
  is read, so no location declaration or background location.
- No exact-alarm, background-location, SMS/call log, all-files or accessibility permissions are used.
