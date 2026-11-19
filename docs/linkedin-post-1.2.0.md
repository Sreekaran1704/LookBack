LookBack 1.2 is out: now you can say it out loud 🎙️🐰

LookBack is my little Android journal: one small thing a day, and on the same date next year it comes back as a letter from your past self.

This update was about feel:

🎙️ Voice memories. Record a few seconds and it becomes a polaroid with its own waveform. Tap it and the bars fill in while a tiny heart rides along. With a photo, the photo sits on top and the waveform runs along the strip.

📷 Photos now look like old instant film: a bit of sepia, faded colour, a soft vignette.

🐰 The bunny got fur, blinks, breathes, tilts its head, and squishes when you poke it.

👍 Every button moved to the bottom where your thumb is, with labels, and the haptics now use Android's own crisp effects instead of the old buzzy vibration.

The part I learned most from: opening a memory sometimes stuttered for a whole second. Instead of guessing, I captured a Perfetto system trace on the phone. The culprit was the page-slide animation redrawing the previous page in software, on the CPU. After fixing that and a few smaller things the trace showed, the worst frame went from 1.1 s to about 20 ms, and opening a diary from the shelf went from 150 ms to 44 ms.

Built with React Native, Expo and TypeScript, working with an AI coding agent (Claude Code): I set the direction and checked every change on my own phone. The agent wrote most of the code.

Download the APK (Android): https://github.com/Sreekaran1704/LookBack/releases/tag/v1.2.0

#ReactNative #Expo #TypeScript #AndroidDev #MobileDevelopment #Performance #BuildInPublic #AIAssistedDevelopment
