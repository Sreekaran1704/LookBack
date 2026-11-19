import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/**
 * LookBack's small vocabulary of touches. On Android these are the system's own haptic effects (the crisp
 * ticks the keyboard and clock use, played by the haptics engine), not the old buzzy vibrator; on iOS the
 * matching taptic feedback. Each one means one thing, so the app feels the same everywhere:
 *
 * - press / release: a button going down under the finger and coming back up (a two-part click)
 * - tap: something happened from a tap (a spine pulled from the shelf, a letter shuffled)
 * - select: one of several choices picked (a page in the bar, a toggle half, a year stamp, a sticker)
 * - toggle on / off: something opens or closes (a sheet, an envelope, playing, recording)
 * - gestureStart / gestureEnd: a drag begins, or something comes to rest (a turned polaroid lands)
 * - arrive: a new page has slid into place
 * - thud: something heavy lands (the diary's cover falls open)
 * - confirm: saved; reject: something is let go for good
 *
 * Haptics are best-effort: a missing engine never breaks a tap.
 */
const android = Platform.OS === 'android';

function play(androidType: Haptics.AndroidHaptics, ios: () => Promise<void>): void {
  (android ? Haptics.performAndroidHapticsAsync(androidType) : ios()).catch(() => undefined);
}

const impact = (style: Haptics.ImpactFeedbackStyle) => () => Haptics.impactAsync(style);

export function pressHaptic(): void {
  play(Haptics.AndroidHaptics.Keyboard_Press, impact(Haptics.ImpactFeedbackStyle.Soft));
}

export function releaseHaptic(): void {
  // iOS has no "key up": the press alone reads as one clean click there.
  if (android) play(Haptics.AndroidHaptics.Keyboard_Release, () => Promise.resolve());
}

export function tapHaptic(): void {
  play(Haptics.AndroidHaptics.Virtual_Key, impact(Haptics.ImpactFeedbackStyle.Light));
}

export function selectHaptic(): void {
  play(Haptics.AndroidHaptics.Segment_Tick, () => Haptics.selectionAsync());
}

export function toggleHaptic(on: boolean): void {
  play(on ? Haptics.AndroidHaptics.Toggle_On : Haptics.AndroidHaptics.Toggle_Off, impact(on ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Soft));
}

export function gestureStartHaptic(): void {
  play(Haptics.AndroidHaptics.Gesture_Start, impact(Haptics.ImpactFeedbackStyle.Soft));
}

export function gestureEndHaptic(): void {
  play(Haptics.AndroidHaptics.Gesture_End, impact(Haptics.ImpactFeedbackStyle.Light));
}

export function arriveHaptic(): void {
  play(Haptics.AndroidHaptics.Segment_Frequent_Tick, impact(Haptics.ImpactFeedbackStyle.Soft));
}

export function thudHaptic(): void {
  play(Haptics.AndroidHaptics.Context_Click, impact(Haptics.ImpactFeedbackStyle.Medium));
}

export function successHaptic(): void {
  play(Haptics.AndroidHaptics.Confirm, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

export function rejectHaptic(): void {
  play(Haptics.AndroidHaptics.Reject, () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}
