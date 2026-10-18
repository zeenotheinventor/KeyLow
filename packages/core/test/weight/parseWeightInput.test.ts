import { describe, expect, it } from "vitest";

import { parseWeightInput } from "../../src/weight";

describe("parseWeightInput", () => {
  it.each([
    ["81.4", 81.4],
    ["81,4", 81.4],
    ["  81.4  ", 81.4],
    ["81", 81],
    ["81.", 81],
    ["20", 20],
    ["400", 400],
    ["81.40", 81.4],
    ["81,40", 81.4],
    ["81.400", 81.4],
    ["81.00", 81],
    ["20.0", 20],
    ["400.0", 400],
    ["020", 20],
  ])("should accept %j as %s kg", (text, weightKg) => {
    expect(parseWeightInput(text)).toEqual({ ok: true, weightKg });
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["abc", "not-a-number"],
    ["81 4", "not-a-number"],
    ["8.1.4", "not-a-number"],
    ["81,4,5", "not-a-number"],
    ["81.4 kg", "not-a-number"],
    ["1e3", "not-a-number"],
    ["Infinity", "not-a-number"],
    ["-", "not-a-number"],
    [".", "not-a-number"],
    ["٨١", "not-a-number"],
    ["81.45", "too-many-decimals"],
    ["81,45", "too-many-decimals"],
    ["81.401", "too-many-decimals"],
    ["814.55", "too-many-decimals"],
    ["1,001", "too-many-decimals"],
    ["1,000", "too-low"],
    ["19.9", "too-low"],
    ["-5", "too-low"],
    ["0", "too-low"],
    [".5", "too-low"],
    ["814", "too-high"],
    ["400.1", "too-high"],
    ["99999999999999999999999", "too-high"],
  ])("should refuse %j with the reason %s", (text, reason) => {
    expect(parseWeightInput(text)).toEqual({ ok: false, reason });
  });
});
