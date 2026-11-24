/** The hosted per-address window between two reset emails. */
export const RESEND_WAIT_SECONDS = 60;

/**
 * Whole seconds before Send again unlocks. It rounds up so the button never unlocks early, and it is held
 * between 0 and 60 so a clock moved back cannot make the person wait longer than the window.
 */
export function resendSecondsLeft(sentAt: number, now: number): number {
  const secondsLeft = Math.ceil((sentAt + RESEND_WAIT_SECONDS * 1000 - now) / 1000);

  return Math.min(RESEND_WAIT_SECONDS, Math.max(0, secondsLeft));
}
