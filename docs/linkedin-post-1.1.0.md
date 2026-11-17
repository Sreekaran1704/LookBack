LookBack 1.1 is out 🐰✂️

A week ago I shipped LookBack, a little Android journal: one small thing a day, and on the same date next year it comes back as a letter from your past self.

Then I used it every day, and found what real use always finds:

🔁 Google Drive "kept asking to connect" every day or two. The real cause: the quiet daily backup checked the sign-in with a call that, on Android, opens Google's account picker. It looked like a lost connection, but it was one wrong API call. Now it reads the saved session silently.

🗑️ There was no way to delete a memory. Adding it was the easy part. The hard part was the two-way Drive sync: a memory deleted on the phone would simply come back from the backup. So deletions now travel as "tombstones", and a deletion beats any copy edited before it.

And because it's LookBack, deleting can't be a grey system dialog. The bunny opens its head, the memory floats out of its brain and drops into a paper shredder with a face. 🧠➡️🗃️

🎨 The bottom bar now matches whichever of the 7 paper colours you pick, in light and dark, with a test that checks the labels stay readable on every one.

Built with React Native, Expo and TypeScript, working with an AI coding agent (Claude Code): I set the direction, wrote the rules and checked every change on my own phone. The agent wrote most of the code.

Download the APK (Android): https://github.com/Sreekaran1704/LookBack/releases/tag/v1.1.0

#ReactNative #Expo #TypeScript #AndroidDev #MobileDevelopment #BuildInPublic #AIAssistedDevelopment
