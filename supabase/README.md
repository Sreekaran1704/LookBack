# Introductions server

LookBack gives pages phone to phone, the way AirDrop and Blip do. The page itself (words, photo, recording) goes over a
direct WebRTC connection, encrypted end to end, and is saved only on the receiving phone. **No memory is ever sent to,
stored on, or readable by this server.**

The Supabase project (`ljaucnbljsgdpbenlxwz`, "LookBack") only introduces two phones:

- **Who you are:** Google sign-in (the same Google account that backs the diary up to Drive, connected once on the You
  page). Sessions stay in the phone's secure storage.
- **Nearby:** while Shared is open, a phone announces a random 8-byte token over Bluetooth and registers it
  here with its name for 10 minutes. A phone that hears the token asks who is behind it (`nearby_people`).
- **Inboxes:** each person has a private Realtime broadcast channel `inbox:<account id>`. Only they can listen to it.
  Nobody writes to it directly: notes go through `send_note`, which stamps the sender's real account id on the note
  (so "from" can't be faked), checks its kind and size, and allows 120 a minute per person (`note_rate`, a count
  only). Notes are "I have a page for you", yes / no, and the WebRTC connection setup (SDP and ICE); Realtime keeps
  broadcast rows briefly and `send_note` tidies ours away after about two minutes.
- **Alerts (like Blip's):** when a page is given and the other phone doesn't answer within 4 s (its LookBack is
  closed), the giver's app calls the `alert` Edge Function (`functions/alert/index.ts`). It looks up that person's push
  address (`push_tokens`, saved by each phone through `save_push_token`) and sends one Firebase Cloud Messaging
  notification, "💌 Sree has a page for you", on the `pages` channel. It carries no memory, date or words. Tapping it
  opens Shared; the page then comes across phone to phone. Alerts are claimed atomically by `claim_alert` before anything
  is sent: at most 6 a minute and 30 an hour per sender, 10 an hour per pair, 20 an hour per recipient (`alert_log`,
  kept a day). The name in the title is stripped of control and direction-flipping characters. Firebase project: `lookback-c3896` (free Spark plan, no billing), only used for these alerts;
  `google-services.json` is in the app; its service-account key lives only in the `FCM_SERVICE_ACCOUNT` secret.

Phone keys: each phone signs its half of a page's connection with its own Ed25519 key, so this server can't step in
between even if it were taken over. `202611230001_keys.sql` lets a nearby phone learn that key with the name.

The schema is `migrations/202611220001_introductions.sql` plus `202611220002_alerts.sql`,
`202611220003_alert_grants.sql` (applied on the live project) and `202611220004_hardening.sql` (signed notes,
anonymous sessions refused, atomic alert limits, `delete_my_account`) and `202611230001_keys.sql` (phone keys for
nearby; applied November 23, 2026) and `202611230002_alert_pair_limit.sql` (10 alerts an hour per pair) and `202611230003_note_recipient.sql` (a note to a deleted account is refused: "No such person."; applied November 23, 2026). The first replaces the earlier
letters, handoffs and shared-pages migrations: those tables, functions and both storage buckets were deleted on
November 22, 2026.

## Set up a project

1. Run `migrations/202611220001_introductions.sql` in the SQL editor.
2. Enable Google under Authentication → Sign-in providers, with the Google Cloud Web OAuth client id as an allowed
   audience.
3. Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env` and the build environment. Use
   the publishable key, **never a service-role key**.

## Dashboard settings (not in the migrations)

- Authentication: only Google enabled; anonymous sign-ins **off**; email/phone sign-up off.
- Realtime settings: "Allow public access" **off** (private channels only).
- Run Advisors → Security Advisor after each migration and keep it clean.

## Limits

- A note's sender is real, but the name in it is whatever they typed; someone you already have shows under the name
  you saved. Nothing arrives unless you accept it.
- `202611270001_more_notes.sql` (for 1.3.3, applied November 27, 2026): `send_note` also allows `seen` (the receiver's phone
  heard a knock and is asking, so the giver waits up to a minute instead of sealing it after 4 s) and `added` ("I
  added you", so the other phone offers Add back). Only the allowed list changes.
- `202611270002_chat_notes.sql` (for 1.3.3, applied November 27, 2026): `send_note` also allows `msg` (a chat message
  or reaction, sealed end to end for the other phone) and `got` (its delivery tick). Only the allowed list changes.
- Deleting your account (You → Delete sharing account) makes a new account id next time you connect.
- Phones on different mobile networks may not reach each other directly. Then the page goes through the **sealed
  mailbox** (`202611260001_mailbox.sql`, applied November 26, 2026; Security Advisor: 0 errors, its only new warning is the usual
  "signed-in users can execute SECURITY DEFINER" for `mailbox_can_leave`, like every RPC here): a private `mailbox` bucket (50 MB per envelope) where the giver leaves the page
  sealed for the receiver's phone key at `<receiver>/<giver>/<gift>.lbm`. Policies: only you as the giver can leave one
  (the path's giver must be your id), at most 60 of yours waiting per person, only the receiver (or the giver, to take
  it back) can see or delete it. The server holds only sealed bytes; the receiver deletes it once kept. `send_note`
  also allows a `mail` note ("there's an envelope for you"). Free on the existing project; no Cloudflare needed
  (`functions/turn` is optional and unused without its secrets).

## Checks

```sh
npm install --prefix /tmp/lookback-sql-check @electric-sql/pglite
NODE_PATH=/tmp/lookback-sql-check/node_modules node supabase/tests/nearby.mjs
```

Covers: nothing but `nearby_presence` exists, names behind tokens (never your own), the table is unreadable directly,
inbox listen/write rules, and leaving.
