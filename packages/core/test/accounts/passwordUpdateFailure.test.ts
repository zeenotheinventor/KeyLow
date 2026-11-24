import { describe, expect, it } from "vitest";

import { describePasswordUpdateFailure } from "../../src/accounts";
import { GENERIC_ERROR, PASSWORD_PROBLEMS, describeAuthError } from "../../src/copy";

const contexts = ["recovery", "change"] as const;

describe("describePasswordUpdateFailure", () => {
  it.each(contexts)("should say same_password is the current password in %s", (context) => {
    expect(describePasswordUpdateFailure("same_password", context)).toEqual({
      kind: "failed",
      reason: "samePassword",
      message: PASSWORD_PROBLEMS.samePassword,
    });
  });

  it.each(contexts)("should say weak_password is too easy to guess in %s", (context) => {
    expect(describePasswordUpdateFailure("weak_password", context)).toEqual({
      kind: "failed",
      reason: "weakPassword",
      message: PASSWORD_PROBLEMS.weakPassword,
    });
  });

  describe.each([
    "session_missing",
    "session_not_found",
    "session_expired",
    "refresh_token_not_found",
    "bad_jwt",
    "no_authorization",
    "reauthentication_needed",
  ])("%s", (code) => {
    it("should say the reset timed out in recovery", () => {
      expect(describePasswordUpdateFailure(code, "recovery")).toEqual({
        kind: "failed",
        reason: "sessionEnded",
        message: PASSWORD_PROBLEMS.resetTimedOut,
      });
    });

    it("should say the person was signed out in change", () => {
      expect(describePasswordUpdateFailure(code, "change")).toEqual({
        kind: "failed",
        reason: "sessionEnded",
        message: PASSWORD_PROBLEMS.changeSessionEnded,
      });
    });
  });

  it.each(["network", "over_request_rate_limit"])("should use the auth sentence for %s", (code) => {
    for (const context of contexts) {
      expect(describePasswordUpdateFailure(code, context)).toEqual({
        kind: "failed",
        reason: "other",
        message: describeAuthError(code),
      });
    }
  });

  it("should use the generic sentence for any other code and never the server's message", () => {
    for (const context of contexts) {
      expect(describePasswordUpdateFailure("some_new_code", context)).toEqual({
        kind: "failed",
        reason: "other",
        message: GENERIC_ERROR,
      });
    }
  });
});
