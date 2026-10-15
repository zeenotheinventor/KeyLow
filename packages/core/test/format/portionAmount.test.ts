import { describe, expect, it } from "vitest";

import { formatPortionAmount } from "../../src/format";

describe("formatPortionAmount", () => {
  it("should give a weight portion in grams", () => {
    expect(formatPortionAmount({ grams: 30, ml: null })).toEqual({ amount: "30", unit: "g" });
  });

  it("should give a volume portion in millilitres", () => {
    expect(formatPortionAmount({ grams: null, ml: 250 })).toEqual({ amount: "250", unit: "ml" });
  });

  it("should keep one decimal under 10, as grams are written", () => {
    expect(formatPortionAmount({ grams: 7.5, ml: null })).toEqual({ amount: "7.5", unit: "g" });
    expect(formatPortionAmount({ grams: null, ml: 5.25 })).toEqual({ amount: "5.3", unit: "ml" });
  });

  it("should be null when neither a weight nor a volume is set", () => {
    expect(formatPortionAmount({ grams: null, ml: null })).toBeNull();
  });
});
