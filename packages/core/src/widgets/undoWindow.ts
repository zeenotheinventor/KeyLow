import { MILLISECONDS_PER_MINUTE, UNDO_WINDOW_MINUTES } from "./constants";

/**
 * Whether a pending-undo record written `at` (an ISO instant) can still be undone at `now`. A record from
 * the future (a clock moved back) is not trusted, so it counts as expired.
 */
export const isUndoWindowOpen = (at: string, now: Date): boolean => {
  const elapsed = now.getTime() - new Date(at).getTime();

  return elapsed >= 0 && elapsed < UNDO_WINDOW_MINUTES * MILLISECONDS_PER_MINUTE;
};
