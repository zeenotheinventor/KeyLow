import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { designFormat } from "./designFormat";
import { formatCalories, formatDeltaGrams, formatGrams, formatWeight } from "../../src/format";

// The design's calories() prints a negative zero as "-0" (Intl keeps the sign). The port prints
// "0", which is the one deliberate difference, so inputs that round to -0 stay out of the property.
const roundsToNegativeZero = (value: number) => Object.is(Math.round(value), -0);

const caloriesTable = [
  0, 0.4, 0.5, 1, 9.5, 99, 100, 148, 148.5, 380, 999, 999.5, 1000, 1234.56, 2480, 2480.4, 2499.5,
  10000, 99999.5, 100000, 1234567, 1e9, 1e12, -1, -148, -1234, -2480.5,
];

const gramsTable = [
  0, 0.04, 0.05, 0.1, 0.5, 1, 2.2, 3, 7.5, 9.04, 9.94, 9.95, 9.99, 10, 10.4, 10.5, 13.5, 29.8, 142,
  142.5, 999.5, 1000, 12345.6, -0.04, -0.5, -2.2, -9.95, -10, -142.5,
];

const weightTable = [0, 0.04, 0.05, 61, 82.4, 82.44, 82.45, 82.5, 100, 181.7, 999.95, 13.25];

const deltaTable = [0, 0.4, 7.5, 9.95, 10, 12.4, 142, 1500, -0.5, -7.5, -9.95, -10, -142, -1500];

describe("parity with the design's Format", () => {
  it.each(caloriesTable)("should write calories(%s) as the design does", (kcal) => {
    expect(formatCalories(kcal)).toBe(designFormat.calories(kcal));
  });

  it.each(gramsTable)("should write grams(%s) as the design does", (grams) => {
    expect(formatGrams(grams)).toBe(designFormat.grams(grams));
  });

  it.each(weightTable)("should write weight(%s) as the design does in every unit", (value) => {
    for (const unit of ["kg", "lb", "st"] as const) {
      expect(formatWeight(value, unit)).toBe(designFormat.weight(value, unit));
    }
  });

  it.each(deltaTable)("should write deltaGrams(%s) as the design does", (grams) => {
    expect(formatDeltaGrams(grams)).toBe(designFormat.deltaGrams(grams));
  });

  it("should match the design for calories across a property range", () => {
    fc.assert(
      fc.property(
        fc
          .double({ min: -1e12, max: 1e12, noNaN: true })
          .filter((kcal) => !roundsToNegativeZero(kcal)),
        (kcal) => {
          expect(formatCalories(kcal)).toBe(designFormat.calories(kcal));
        },
      ),
      { numRuns: 2000 },
    );
  });

  it("should match the design for grams across a property range", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (grams) => {
        expect(formatGrams(grams)).toBe(designFormat.grams(grams));
      }),
      { numRuns: 2000 },
    );
  });

  it("should match the design for weight across a property range", () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1000, noNaN: true }), (value) => {
        expect(formatWeight(value, "kg")).toBe(designFormat.weight(value, "kg"));
      }),
      { numRuns: 2000 },
    );
  });

  it("should match the design for delta grams across a property range", () => {
    fc.assert(
      fc.property(fc.double({ min: -1e6, max: 1e6, noNaN: true }), (grams) => {
        expect(formatDeltaGrams(grams)).toBe(designFormat.deltaGrams(grams));
      }),
      { numRuns: 2000 },
    );
  });
});
