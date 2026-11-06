import { describe, expect, it } from "vitest";

import { shouldSendToSetup } from "../../src/setup";

describe("shouldSendToSetup", () => {
  it.each([
    ["a finished read of an account that is not set up", false, false, false, true],
    ["a finished read of an account that is set up", false, false, true, false],
    ["no profile row, which reads as set up", false, false, true, false],
    ["a read that failed", true, false, false, false],
    ["a read under way, which may hold another account's answer", false, true, false, false],
    ["a read under way that failed before", true, true, false, false],
    ["nothing read yet, as when offline with nothing cached", false, false, undefined, false],
  ])("should decide %s", (_case, isError, isFetching, isSetUp, expected) => {
    expect(shouldSendToSetup({ isError, isFetching, isSetUp })).toBe(expected);
  });
});
