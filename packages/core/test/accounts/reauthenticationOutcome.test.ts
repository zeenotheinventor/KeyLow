import { describe, expect, it } from "vitest";

import { reauthenticationOutcome } from "../../src/accounts";

describe("reauthenticationOutcome", () => {
  it.each([
    [undefined, "confirmed"],
    ["invalid_credentials", "wrongPassword"],
    ["over_request_rate_limit", "tooManyAttempts"],
    ["network", "network"],
    ["session_missing", "sessionEnded"],
    ["session_not_found", "sessionEnded"],
    ["session_expired", "sessionEnded"],
    ["refresh_token_not_found", "sessionEnded"],
    ["bad_jwt", "sessionEnded"],
    ["no_authorization", "sessionEnded"],
    ["unknown", "failed"],
    ["unexpected_failure", "failed"],
    ["some_future_code", "failed"],
  ])("should map %s to %s", (code, kind) => {
    expect(reauthenticationOutcome(code)).toEqual({ kind });
  });

  it("should carry a kind and nothing else, so no outcome holds a message", () => {
    for (const code of [undefined, "invalid_credentials", "network", "whatever"]) {
      expect(Object.keys(reauthenticationOutcome(code))).toEqual(["kind"]);
    }
  });
});
