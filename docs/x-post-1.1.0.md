# LookBack 1.1 on X

## Thread (5 posts, each under 280 characters; attach the demo video to post 1)

1/
LookBack 1.1 is out 🐰✂️

A tiny Android journal: one small thing a day, back on the same day next year.

A week of daily use turned up 2 real problems, so I fixed them 👇

2/
🔁 Bug: Google Drive "kept asking to connect".

Cause: the quiet daily backup checked the sign-in with signIn(), which on Android opens the account picker.

Fix: read the saved session instead. Background code never shows UI.

3/
🗑️ New: delete a memory.

The hard part was the two-way Drive sync: a deleted memory just came back from the backup.

Now deletions sync as tombstones. A delete beats any copy edited before it, and an edit made after it wins.

4/
And it couldn't be a grey system dialog.

Bun opens its head, the memory floats out of its brain and drops into a paper shredder with a face 🧠➡️🗑️

Plus: the bottom bar now matches whichever of the 7 paper colours you pick, in light or dark 🎨

5/
Built with React Native + Expo + TypeScript, with Claude Code as my coding agent. I set the direction and checked every change on my own phone.

Android APK 👇
https://github.com/Sreekaran1704/LookBack/releases/tag/v1.1.0

#BuildInPublic #ReactNative

## Single post (if you'd rather not thread)

LookBack 1.1 is out 🐰✂️

• Fixed: Google Drive no longer asks you to reconnect
• New: delete a memory. Bun opens its head and shreds it, and the deletion syncs through Drive with tombstones
• The bottom bar now matches your paper colour

Android APK: https://github.com/Sreekaran1704/LookBack/releases/tag/v1.1.0

#BuildInPublic
