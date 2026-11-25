import { captureMessage } from "@sentry/react-native";

import { PASSWORD_RESET_CODE_MESSAGE } from "./passwordResetCodeMessage";

/**
 * Reports that a password reset request came back with a code core does not know. The code is the only data
 * in the report, as a tag (the SDK's scrubbing keeps the tags and drops anything else a message could
 * carry). It never holds the email address that was asked for.
 */
export function reportPasswordResetCode(code: string): void {
  captureMessage(PASSWORD_RESET_CODE_MESSAGE, {
    level: "warning",
    fingerprint: [PASSWORD_RESET_CODE_MESSAGE],
    tags: { code },
  });
}
