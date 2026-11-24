import { describe, expect, it } from "vitest";

import { PASSWORD_MIN_LENGTH, validateNewPassword } from "../../src/accounts";
import { AUTH_FIELD_PROBLEMS, PASSWORD_PROBLEMS } from "../../src/copy";

const makePassword = (length: number, character = "a"): string => character.repeat(length);

describe("validateNewPassword", () => {
  it("should set the minimum at 8", () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it("should refuse 7 characters", () => {
    const password = makePassword(7);

    expect(validateNewPassword({ password, confirmation: password })).toEqual({
      password: AUTH_FIELD_PROBLEMS.passwordTooShort,
    });
  });

  it("should accept 8 characters", () => {
    const password = makePassword(8);

    expect(validateNewPassword({ password, confirmation: password })).toEqual({});
  });

  it("should count an emoji as one character", () => {
    const sevenEmoji = makePassword(7, "😀");
    const eightEmoji = makePassword(8, "😀");

    expect(validateNewPassword({ password: sevenEmoji, confirmation: sevenEmoji })).toEqual({
      password: AUTH_FIELD_PROBLEMS.passwordTooShort,
    });
    expect(validateNewPassword({ password: eightEmoji, confirmation: eightEmoji })).toEqual({});
  });

  it("should not trim, so spaces count and are allowed", () => {
    const password = makePassword(8, " ");

    expect(validateNewPassword({ password, confirmation: password })).toEqual({});
  });

  it("should flag a confirmation that differs", () => {
    const password = crypto.randomUUID();

    expect(validateNewPassword({ password, confirmation: `${password}x` })).toEqual({
      confirmation: PASSWORD_PROBLEMS.mismatch,
    });
  });

  it("should show both problems at once", () => {
    expect(
      validateNewPassword({ password: makePassword(3), confirmation: makePassword(4) }),
    ).toEqual({
      password: AUTH_FIELD_PROBLEMS.passwordTooShort,
      confirmation: PASSWORD_PROBLEMS.mismatch,
    });
  });

  it("should give the length problem only for two empty fields", () => {
    expect(validateNewPassword({ password: "", confirmation: "" })).toEqual({
      password: AUTH_FIELD_PROBLEMS.passwordTooShort,
    });
  });
});
