import { describe, expect, it } from "vitest";

import { RECOVERY_LINK_LIFETIME_MS, authLinkDestination } from "../../src/accounts";

const now = 1_795_000_000_000;
const justNow = now - 1000;
const longAgo = now - RECOVERY_LINK_LIFETIME_MS;

describe("authLinkDestination", () => {
  it.each([null, justNow, longAgo])("should go home for a sign in with the marker %s", (marker) => {
    expect(
      authLinkDestination({ result: { kind: "signedIn" }, recoveryRequestedAt: marker, now }),
    ).toBe("home");
  });

  it.each([null, justNow, longAgo])(
    "should set a new password for a recovery with the marker %s",
    (marker) => {
      expect(
        authLinkDestination({ result: { kind: "recovery" }, recoveryRequestedAt: marker, now }),
      ).toBe("setNewPassword");
    },
  );

  it("should call a failed link a reset link after a recent request", () => {
    expect(
      authLinkDestination({ result: { kind: "failed" }, recoveryRequestedAt: justNow, now }),
    ).toBe("resetLinkInvalid");
  });

  it.each([null, longAgo])(
    "should call a failed link a sign in link with the marker %s",
    (marker) => {
      expect(
        authLinkDestination({ result: { kind: "failed" }, recoveryRequestedAt: marker, now }),
      ).toBe("signInLinkInvalid");
    },
  );
});
