import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { amountInPickerUnits } from "../../src/diary";
import { roundToTenth } from "../../src/diary/amountInPickerUnits";
import { GRAMS_PER_OUNCE, ML_PER_FLUID_OUNCE } from "../../src/nutrition";

describe("roundToTenth", () => {
  it("should round to one decimal place", () => {
    expect(roundToTenth(141.7475)).toBe(141.7);
    expect(roundToTenth(236.588)).toBe(236.6);
  });

  it("should change nothing when applied again", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 100_000, noNaN: true }), (value) => {
        expect(roundToTenth(roundToTenth(value))).toBe(roundToTenth(value));
      }),
    );
  });
});

describe("amountInPickerUnits", () => {
  it("should hand grams and millilitres over as they are", () => {
    expect(amountInPickerUnits({ quantity: 50, unit: "g" })).toEqual({ quantity: 50, unit: "g" });
    expect(amountInPickerUnits({ quantity: 250, unit: "ml" })).toEqual({
      quantity: 250,
      unit: "ml",
    });
  });

  it("should turn ounces into grams, to a tenth", () => {
    expect(amountInPickerUnits({ quantity: 2, unit: "oz" })).toEqual({ quantity: 56.7, unit: "g" });
    expect(amountInPickerUnits({ quantity: 5, unit: "oz" })).toEqual({
      quantity: 141.7,
      unit: "g",
    });
  });

  it("should turn fluid ounces into millilitres, to a tenth", () => {
    expect(amountInPickerUnits({ quantity: 8, unit: "fl_oz" })).toEqual({
      quantity: 236.6,
      unit: "ml",
    });
  });

  it("should land within half a tenth of the exact conversion, on a tenth", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.constantFrom("oz", "fl_oz"),
        (quantity, unit) => {
          const once = amountInPickerUnits({ quantity, unit });
          const factor = unit === "oz" ? GRAMS_PER_OUNCE : ML_PER_FLUID_OUNCE;

          expect(roundToTenth(once.quantity)).toBe(once.quantity);
          expect(Math.abs(once.quantity - quantity * factor)).toBeLessThanOrEqual(0.05 + 1e-9);
        },
      ),
    );
  });

  it("should leave a measure already in grams or millilitres alone, whatever the count", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 10_000, noNaN: true }),
        fc.constantFrom("g", "ml"),
        (quantity, unit) => {
          expect(amountInPickerUnits({ quantity, unit })).toEqual({ quantity, unit });
        },
      ),
    );
  });
});
