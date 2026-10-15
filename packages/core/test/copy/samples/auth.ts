import * as copy from "../../../src/copy";

// Every function `src/copy/auth.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAuthError: () =>
    [
      undefined,
      "invalid_credentials",
      "user_already_exists",
      "email_exists",
      "over_request_rate_limit",
      "over_email_send_rate_limit",
      "email_not_confirmed",
      "network",
      "unknown_code",
    ].map(copy.describeAuthError),
  describeCheckEmail: () => [copy.describeCheckEmail("sam.taylor@example.com")],
};
