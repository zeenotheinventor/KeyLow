import { describe, expect, it } from "vitest";

import { roundToGram } from "../../src/weight/roundToGram";

describe("roundToGram", () => {
  it.each([
    [80, 80],
    [80.1234, 80.123],
    [80.1236, 80.124],
    [19.9996, 20],
    [19.9994, 19.999],
    [400.0004, 400],
    [400.0006, 400.001],
  ])("should round %s to %s", (kilograms, expected) => {
    expect(roundToGram(kilograms)).toBe(expected);
  });

  // 32.0025 is stored a hair under 32.0025, so multiplying by 1000 and rounding gives 32.002.
  // The database reads the decimal text and rounds half up, so core must give 32.003.
  it.each([
    [32.0025, 32.003],
    [32.0055, 32.006],
    [19.9995, 20],
    [400.0005, 400.001],
    [0.0005, 0.001],
  ])("should round the half %s the way the column does, to %s", (kilograms, expected) => {
    expect(roundToGram(kilograms)).toBe(expected);
  });

  // The double 215.29749999999999 prints with a 17 digit tail. Postgres stores that text as 215.297,
  // so core must round the digits as they print, and not the nearest double of the shifted text.
  it.each([
    [215.29749999999999, 215.297],
    [215.29750000000001, 215.298],
  ])("should round the 17 digit text of %s to %s", (kilograms, expected) => {
    expect(roundToGram(kilograms)).toBe(expected);
  });

  it("should round a half away from zero for a negative value", () => {
    expect(roundToGram(-32.0025)).toBe(-32.003);
  });

  it("should leave a value that is already whole grams alone", () => {
    expect(roundToGram(81.4)).toBe(81.4);
  });

  it("should pass a value that is not finite through", () => {
    expect(roundToGram(Number.NaN)).toBeNaN();
    expect(roundToGram(Number.POSITIVE_INFINITY)).toBe(Number.POSITIVE_INFINITY);
  });

  it("should round a value written with an exponent", () => {
    expect(roundToGram(1e-7)).toBe(0);
    expect(roundToGram(1.2e21)).toBe(1.2e21);
  });
});
