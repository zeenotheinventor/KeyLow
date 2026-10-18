import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { KILOGRAMS_PER_POUND, displayWeight, kgToLb, lbToKg } from "../../src/weight";

describe("pound conversion", () => {
  it("should use the international pound, 0.45359237 kg exactly", () => {
    expect(KILOGRAMS_PER_POUND).toBe(0.45359237);
  });

  it("should turn 80 kg into 176.37 lb to 2 decimals", () => {
    expect(kgToLb(80)).toBeCloseTo(176.37, 2);
  });

  it("should turn 1 lb into 0.45359237 kg", () => {
    expect(lbToKg(1)).toBe(0.45359237);
  });

  it("should turn 0 into 0 both ways", () => {
    expect(kgToLb(0)).toBe(0);
    expect(lbToKg(0)).toBe(0);
  });

  it("should round trip a weight within 1e-9", () => {
    fc.assert(
      fc.property(fc.double({ min: 20, max: 400, noNaN: true }), (kilograms) => {
        expect(Math.abs(lbToKg(kgToLb(kilograms)) - kilograms)).toBeLessThan(1e-9);
      }),
    );
  });
});

describe("displayWeight", () => {
  it.each([
    [80, "kg", 80],
    [81.44, "kg", 81.4],
    [81.46, "kg", 81.5],
    [81.449, "kg", 81.4],
    [80, "lb", 176.4],
    [100, "lb", 220.5],
    [45.359237, "lb", 100],
  ] as const)("should show %s kg in %s as %s", (kilograms, unit, shown) => {
    expect(displayWeight(kilograms, unit)).toBe(shown);
  });

  it("should never show a negative zero", () => {
    expect(Object.is(displayWeight(-0.04, "kg"), 0)).toBe(true);
    expect(Object.is(displayWeight(-0.02, "lb"), 0)).toBe(true);
  });

  it("should keep the sign of a change", () => {
    expect(displayWeight(-0.3, "kg")).toBe(-0.3);
  });
});
