import { describe, expect, it } from "vitest";

import { validateEmailAddress } from "../../src/accounts";
import { AUTH_FIELD_PROBLEMS } from "../../src/copy";

describe("validateEmailAddress", () => {
  it.each(["", "   ", "\t\n"])("should ask for an address when %j is empty", (email) => {
    expect(validateEmailAddress(email)).toBe(AUTH_FIELD_PROBLEMS.emailRequired);
  });

  it.each(["plain", "no@dot", "@keylow.test", "a@.test", "two words@keylow.test", "a@b@c.test"])(
    "should refuse %j",
    (email) => {
      expect(validateEmailAddress(email)).toBe(AUTH_FIELD_PROBLEMS.emailInvalid);
    },
  );

  it("should accept an address", () => {
    expect(validateEmailAddress(`${crypto.randomUUID()}@keylow.test`)).toBeUndefined();
  });

  it("should trim before checking", () => {
    expect(validateEmailAddress(`  ${crypto.randomUUID()}@keylow.test \n`)).toBeUndefined();
  });
});
