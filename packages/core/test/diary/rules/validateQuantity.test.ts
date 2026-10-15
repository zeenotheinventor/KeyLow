import { describe, expect, it } from "vitest";

import { validateQuantity } from "../../../src/diary/rules/validateQuantity";

describe("validateQuantity", () => {
  it("should accept an amount above 0", () => {
    expect(validateQuantity(150)).toEqual({ ok: true, value: 150 });
  });

  it("should accept a fraction above 0", () => {
    expect(validateQuantity(0.25)).toEqual({ ok: true, value: 0.25 });
  });

  it("should refuse 0", () => {
    expect(validateQuantity(0)).toEqual({ ok: false, problems: { quantity: "not_above_zero" } });
  });

  it("should refuse a negative amount", () => {
    expect(validateQuantity(-2)).toEqual({ ok: false, problems: { quantity: "not_above_zero" } });
  });

  it("should refuse an amount left blank", () => {
    expect(validateQuantity(null)).toEqual({ ok: false, problems: { quantity: "not_above_zero" } });
  });

  it("should refuse an amount that is not a number", () => {
    expect(validateQuantity(Number.NaN).ok).toBe(false);
  });

  it("should refuse an amount that is not finite", () => {
    expect(validateQuantity(Number.POSITIVE_INFINITY).ok).toBe(false);
  });
});
