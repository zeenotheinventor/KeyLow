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

/** The design's haptic tokens (`--haptic-*`). `complete` is deferred with the motion moments. */
export const haptic = {
  /** A selection, step, tab or segment change. */
  select: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** An entry added or saved. */
  confirm: () => play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  warning: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};
