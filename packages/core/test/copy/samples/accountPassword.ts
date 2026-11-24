import * as copy from "../../../src/copy";

// Every function `src/copy/accountPassword.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeResetLinkSent: () => [
    copy.describeResetLinkSent("sam.taylor@example.com", "phone"),
    copy.describeResetLinkSent("sam.taylor@example.com", "browser"),
  ],
  describeSendAgainCountdown: () => [0, 1, 60].map(copy.describeSendAgainCountdown),
  describeResetLinkInvalid: () => [
    copy.describeResetLinkInvalid("phone"),
    copy.describeResetLinkInvalid("browser"),
  ],
  describePasswordFor: () => [copy.describePasswordFor("sam.taylor@example.com")],
};
