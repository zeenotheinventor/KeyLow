import { captureMessage } from "@sentry/nextjs";

/**
 * Reports a reset request that ended with a code core does not know, so it can be added. The message is
 * fixed and the code is the only data. The address is never sent, as the person's account must not be
 * guessable from a report.
 */
export function reportPasswordResetCode(code: string): void {
  captureMessage("Password reset request ended with an unexpected code", {
    level: "warning",
    tags: { passwordResetCode: code },
  });
}
