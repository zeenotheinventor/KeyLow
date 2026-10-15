import { describe, expect, it } from "vitest";

import { isNumberBeingTyped } from "../../src/diary/isNumberBeingTyped";

describe("isNumberBeingTyped", () => {
  it.each(["", "7", "130", "1.", ".5", "1.5", "1,5", "0"])("should accept %j", (text) => {
    expect(isNumberBeingTyped(text)).toBe(true);
  });

  it.each(["a", "1a", "-1", "+1", "1.2.3", "1,2,3", "1.2,3", "1 2", "1e3", "١"])(
    "should refuse %j",
    (text) => {
      expect(isNumberBeingTyped(text)).toBe(false);
    },
  );
});
