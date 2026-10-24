import { motionDuration } from "@keylow/tokens";

import { useReducedMotion } from "../../../lib/motion";

/** How long the muscles take to ease to a new look: the standard 220 ms, and none with reduced motion, so it is instant. */
export function useLookFadeMilliseconds(): number {
  return useReducedMotion() ? 0 : motionDuration.standard;
}
