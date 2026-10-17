import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { MAX_RECIPE_SERVINGS, enteredViewServings, stepViewServings } from "../../src/recipes";

const recipeServings = fc.oneof(
  fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS }),
  fc.integer({ min: 1, max: 200 }).map((halves) => halves / 2),
);

// Mostly text that looks like a number, so the accepting branches are reached as often as the refusing ones.
const typedText = fc.oneof(
  fc.string(),
  fc.integer({ min: -5, max: 1100 }).map(String),
  fc.integer({ min: 1, max: 200 }).map((halves) => String(halves / 2)),
  fc
    .tuple(fc.constantFrom(" ", ""), fc.integer({ min: 0, max: 1100 }), fc.constantFrom(" ", ""))
    .map(([before, digits, after]) => `${before}${digits}${after}`),
);

const wholeOrOwn = (value: number, own: number): boolean =>
  (Number.isInteger(value) && value >= 1 && value <= MAX_RECIPE_SERVINGS) || value === own;

describe("enteredViewServings properties", () => {
  it("should give only a whole number from 1 to the maximum, or the recipe's own", () => {
    fc.assert(
      fc.property(typedText, recipeServings, (text, own) => {
        const result = enteredViewServings(text, own);

        expect(result === null || wholeOrOwn(result, own)).toBe(true);
      }),
    );
  });

  it("should accept text with a decimal point only when it is the recipe's own servings", () => {
    fc.assert(
      fc.property(typedText, recipeServings, (text, own) => {
        const result = enteredViewServings(text, own);

        expect(!text.includes(".") || result === null || result === own).toBe(true);
      }),
    );
  });

  it("should accept the text of any whole number in range", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS }),
        recipeServings,
        (servings, own) => {
          expect(enteredViewServings(String(servings), own)).toBe(servings);
        },
      ),
    );
  });

  it("should accept the recipe's own servings written as they are stored", () => {
    fc.assert(
      fc.property(recipeServings, (own) => {
        expect(enteredViewServings(String(own), own)).toBe(own);
      }),
    );
  });
});

describe("stepViewServings properties", () => {
  const value = fc.oneof(
    fc.integer({ min: 1, max: MAX_RECIPE_SERVINGS }),
    fc.integer({ min: 1, max: 2000 }).map((halves) => halves / 2),
  );

  it("should step by less than or exactly one, to a whole number, and stay in range", () => {
    fc.assert(
      fc.property(value, fc.constantFrom("plus", "minus"), (from, direction) => {
        const next = stepViewServings(from, direction);
        if (next === null) {
          return;
        }

        expect(Number.isInteger(next)).toBe(true);
        expect(next).toBeGreaterThanOrEqual(1);
        expect(next).toBeLessThanOrEqual(MAX_RECIPE_SERVINGS);
        expect(direction === "plus" ? next > from : next < from).toBe(true);
        expect(Math.abs(next - from)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it("should refuse a step only at an end of the range", () => {
    fc.assert(
      fc.property(value, fc.constantFrom("plus", "minus"), (from, direction) => {
        const refused = stepViewServings(from, direction) === null;
        const atEnd = direction === "plus" ? from >= MAX_RECIPE_SERVINGS : from <= 1;

        expect(refused).toBe(atEnd);
      }),
    );
  });
});
