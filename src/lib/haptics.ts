import * as Haptics from 'expo-haptics';

/** Haptics are best-effort: never let a missing engine break a tap. */
export function tapHaptic(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function successHaptic(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
