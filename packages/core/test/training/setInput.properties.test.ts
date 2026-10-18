import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { displayLoad, parseLoadInput } from "../../src/training";
import { roundToGram } from "../../src/weight/roundToGram";

const wholeGramLoadKg = fc.integer({ min: 0, max: 1_000_000 }).map((grams) => grams / 1000);

const gramsOf = (kilograms: number): number => Math.round(kilograms * 1000);

const kgOf = (text: string, unit: "kg" | "lb"): number => {
  const result = parseLoadInput(text, unit);
  if (!result.ok || result.kg === null) {
    throw new Error("The text should have read as a load");
  }
  return result.kg;
};

describe("a load round trips through the screen", () => {
  it("should show the same pounds after typing back what a stored load displayed", () => {
    fc.assert(
      fc.property(wholeGramLoadKg, (kilograms) => {
        const shown = displayLoad(kilograms, "lb");
        const typedBack = kgOf(shown, "lb");

        expect(displayLoad(typedBack, "lb")).toBe(shown);
        // The first round trip moves the load by half a step of 0.1 lb (22.7 g) and the gram at most.
        expect(Math.abs(gramsOf(typedBack) - gramsOf(kilograms))).toBeLessThanOrEqual(23);
        // After that it stays within 1 g, and is stored in whole grams.
        const roundTripAgain = kgOf(displayLoad(typedBack, "lb"), "lb");
        expect(Math.abs(gramsOf(roundTripAgain) - gramsOf(typedBack))).toBeLessThanOrEqual(1);
        expect(roundToGram(typedBack)).toBe(typedBack);
      }),
    );
  });

  it("should show a pound load as typed, for every tenth of a pound from 0 to 2204.6", () => {
    for (let tenthsOfPounds = 0; tenthsOfPounds <= 22_046; tenthsOfPounds += 1) {
      const typed = String(tenthsOfPounds / 10);

      expect(displayLoad(kgOf(typed, "lb"), "lb")).toBe(typed);
    }
  });

  it("should give a kilogram load back exactly, to the tenth of a kilogram", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000 }), (tenthsOfKilograms) => {
        const kilograms = tenthsOfKilograms / 10;

        expect(kgOf(displayLoad(kilograms, "kg"), "kg")).toBe(kilograms);
      }),
    );
  });

  it("should show a whole-gram kilogram load within 0.05 kg and keep it there", () => {
    fc.assert(
      fc.property(wholeGramLoadKg, (kilograms) => {
        const typedBack = kgOf(displayLoad(kilograms, "kg"), "kg");

        expect(Math.abs(gramsOf(typedBack) - gramsOf(kilograms))).toBeLessThanOrEqual(50);
        expect(kgOf(displayLoad(typedBack, "kg"), "kg")).toBe(typedBack);
      }),
    );
  });

  it("should show 225 back to a pound user who types 225", () => {
    expect(displayLoad(kgOf("225", "lb"), "lb")).toBe("225");
  });
});
