import { motionDuration } from "@keylow/tokens";

import { useReducedMotion } from "../../../lib/motion";

import type { BottomTabNavigationOptions } from "expo-router/js-tabs";

type TabTransitionOptions = Pick<BottomTabNavigationOptions, "animation" | "transitionSpec">;

const quickFade: TabTransitionOptions = {
  animation: "fade",
  transitionSpec: { animation: "timing", config: { duration: motionDuration.quick } },
};

const noAnimation: TabTransitionOptions = { animation: "none" };

/**
 * How the content of a tab changes when another is chosen: the plain quick fade, in place of the
 * design's angled wipe, which waits for a motion review on a device. With reduced motion the content just
 * changes. Spread it into the `Tabs` navigator's `screenOptions`.
 */
export function useTabTransitionOptions(): TabTransitionOptions {
  return useReducedMotion() ? noAnimation : quickFade;
}
