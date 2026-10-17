import { describe, expect, it } from "vitest";

import { enteredViewServings, stepViewServings } from "../../src/recipes";

describe("enteredViewServings", () => {
  it.each([
    { text: "6", recipeServings: 4, expected: 6 },
    { text: "1", recipeServings: 4, expected: 1 },
    { text: "1000", recipeServings: 4, expected: 1000 },
    { text: "  12  ", recipeServings: 4, expected: 12 },
    { text: "007", recipeServings: 4, expected: 7 },
    { text: "4", recipeServings: 4, expected: 4 },
  ])("should read '$text' as $expected for a recipe of $recipeServings", (row) => {
    expect(enteredViewServings(row.text, row.recipeServings)).toBe(row.expected);
  });

  it.each([
    "",
    "   ",
    "0",
    "00",
    "1001",
    "99999999999999999999",
    "2.5",
    "2.0",
    "1000.0",
    "abc",
    "-1",
    "+3",
    "1e2",
    "4 5",
  ])("should refuse '%s' on a recipe of 4 servings", (text) => {
    expect(enteredViewServings(text, 4)).toBeNull();
  });

  it("should accept the recipe's own fractional servings typed back", () => {
    expect(enteredViewServings("2.5", 2.5)).toBe(2.5);
    expect(enteredViewServings(" 2.5 ", 2.5)).toBe(2.5);
    expect(enteredViewServings("0.5", 0.5)).toBe(0.5);
  });

  it("should still refuse a fraction that is not the recipe's own", () => {
    expect(enteredViewServings("2.6", 2.5)).toBeNull();
    expect(enteredViewServings("1.5", 2.5)).toBeNull();
  });

  it("should still take whole servings on a recipe saved with a fraction", () => {
    expect(enteredViewServings("3", 2.5)).toBe(3);
    expect(enteredViewServings("1", 0.5)).toBe(1);
  });
});

describe("stepViewServings", () => {
  it.each([
    { value: 4, direction: "plus", expected: 5 },
    { value: 4, direction: "minus", expected: 3 },
    { value: 2.5, direction: "plus", expected: 3 },
    { value: 2.5, direction: "minus", expected: 2 },
    { value: 0.5, direction: "plus", expected: 1 },
    { value: 0.5, direction: "minus", expected: null },
    { value: 1, direction: "plus", expected: 2 },
    { value: 1, direction: "minus", expected: null },
    { value: 2, direction: "minus", expected: 1 },
    { value: 1.5, direction: "minus", expected: 1 },
    { value: 999, direction: "plus", expected: 1000 },
    { value: 999.5, direction: "plus", expected: 1000 },
    { value: 1000, direction: "plus", expected: null },
    { value: 1000, direction: "minus", expected: 999 },
  ] as const)("should step $value $direction to $expected", (row) => {
    expect(stepViewServings(row.value, row.direction)).toBe(row.expected);
  });
});
