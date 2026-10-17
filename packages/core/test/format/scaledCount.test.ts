import { describe, expect, it } from "vitest";

import { formatScaledCount } from "../../src/format";

describe("formatScaledCount", () => {
  it.each([
    [0, "0"],
    [3, "3"],
    [1.5, "1.5"],
    [0.5, "0.5"],
    [0.25, "0.25"],
    [0.75, "0.75"],
    [1.333, "1.33"],
    [1.3333333, "1.33"],
    [2.5, "2.5"],
    [2.001, "2"],
    [999, "999"],
    [1000, "1,000"],
    [1234.5, "1,234.5"],
    [1234567, "1,234,567"],
  ])("should write %s as %s", (count, expected) => {
    expect(formatScaledCount(count)).toBe(expected);
  });
});
