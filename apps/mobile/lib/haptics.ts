import * as Haptics from "expo-haptics";
import { AccessibilityInfo } from "react-native";

// Haptic feedback is motion the user can switch off, so it follows the reduce-motion setting. The
// setting is read on every call, because the user can change it while the app runs. A device with
// no haptics makes expo-haptics reject, and a missing buzz is not worth surfacing, so that is
// swallowed here and callers can fire and forget.
async function play(feedback: () => Promise<void>): Promise<void> {
  try {
    if (await AccessibilityInfo.isReduceMotionEnabled()) {
      return;
    }
    await feedback();
  } catch {
    // Nothing to do: the feedback is a nicety.
  }
}

// The design's `--haptic-complete` is "heavy-double": two firm impacts, one straight after the other.
async function playHeavyDouble(): Promise<void> {
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
}

/** The design's haptic tokens (`--haptic-*`). */
export const haptic = {
  /** A selection, step, tab or segment change. */
  select: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** An entry added or saved. */
  confirm: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** A day marked complete. */
  complete: () => play(playHeavyDouble),
  warning: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

/** The name of a haptic token, for a component that lets its caller choose the feedback. */
export type HapticFeedbackName = keyof typeof haptic;
// ci test, safe to delete
