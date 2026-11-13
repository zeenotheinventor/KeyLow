import { describe, expect, it } from "vitest";

import {
  KITCHEN_GENERATION_LIMITS,
  planRankingSchema,
  readPlanRanking,
  readRecipeSuggestion,
  readSubstitution,
  recipeSuggestionSchema,
  substitutionSchema,
} from "../../src/assistant";

const suggestion = {
  name: "Lemon chicken traybake",
  servings: 2,
  ingredients: [
    { name: "chicken thigh", grams: 300 },
    { name: "potato", grams: 400 },
  ],
  steps: ["Heat the oven to 200C.", "Roast everything for 40 minutes."],
};

describe("the limits", () => {
  it("states every bound as a literal", () => {
    expect(KITCHEN_GENERATION_LIMITS).toEqual({
      nameCharacters: 80,
      ingredientNameCharacters: 60,
      stepCharacters: 300,
      ingredients: 12,
      steps: 8,
      servingsMaximum: 24,
      gramsMaximum: 5000,
      substitutions: 3,
      rankedIds: 200,
      idCharacters: 64,
    });
  });
});

describe("readRecipeSuggestion", () => {
  it("reads a well formed suggestion", () => {
    expect(readRecipeSuggestion(suggestion)).toEqual(suggestion);
  });

  it("refuses an unknown key", () => {
    expect(readRecipeSuggestion({ ...suggestion, note: "extra" })).toBeNull();
  });

  it("refuses more than 12 ingredients", () => {
    const ingredients = Array.from({ length: 13 }, (_, index) => ({
      name: `food ${index}`,
      grams: 10,
    }));
    expect(readRecipeSuggestion({ ...suggestion, ingredients })).toBeNull();
  });

  it("refuses no ingredients", () => {
    expect(readRecipeSuggestion({ ...suggestion, ingredients: [] })).toBeNull();
  });

  it("refuses more than 8 steps", () => {
    const steps = Array.from({ length: 9 }, () => "Stir.");
    expect(readRecipeSuggestion({ ...suggestion, steps })).toBeNull();
  });

  it("refuses an oversized string", () => {
    expect(readRecipeSuggestion({ ...suggestion, name: "x".repeat(81) })).toBeNull();
    expect(readRecipeSuggestion({ ...suggestion, steps: ["x".repeat(301)] })).toBeNull();
    expect(
      readRecipeSuggestion({ ...suggestion, ingredients: [{ name: "x".repeat(61), grams: 1 }] }),
    ).toBeNull();
  });

  it("refuses an empty name or step", () => {
    expect(readRecipeSuggestion({ ...suggestion, name: "  " })).toBeNull();
    expect(readRecipeSuggestion({ ...suggestion, steps: [""] })).toBeNull();
  });

  it("refuses grams that are not a positive amount of at most 5,000", () => {
    for (const grams of [0, -5, 5001, Number.NaN]) {
      expect(
        readRecipeSuggestion({ ...suggestion, ingredients: [{ name: "salt", grams }] }),
      ).toBeNull();
    }
  });

  it("refuses servings outside 1 to 24 or a fraction", () => {
    for (const servings of [0, 25, 1.5]) {
      expect(readRecipeSuggestion({ ...suggestion, servings })).toBeNull();
    }
  });

  it("refuses something that is not an object", () => {
    expect(readRecipeSuggestion("a recipe")).toBeNull();
    expect(readRecipeSuggestion(null)).toBeNull();
  });

  it("has a schema that the model's output format is built from", () => {
    expect(recipeSuggestionSchema.safeParse(suggestion).success).toBe(true);
  });
});

describe("readSubstitution", () => {
  it("reads positions that are in the candidate list", () => {
    expect(readSubstitution({ positions: [2, 0] }, { candidateCount: 3 })).toEqual({
      positions: [2, 0],
    });
  });

  it("reads an empty answer, which means no swap", () => {
    expect(readSubstitution({ positions: [] }, { candidateCount: 3 })).toEqual({ positions: [] });
  });

  it("refuses a position outside the list", () => {
    expect(readSubstitution({ positions: [3] }, { candidateCount: 3 })).toBeNull();
    expect(readSubstitution({ positions: [-1] }, { candidateCount: 3 })).toBeNull();
  });

  it("refuses a position that is not a whole number", () => {
    expect(readSubstitution({ positions: [0.5] }, { candidateCount: 3 })).toBeNull();
  });

  it("refuses more than 3 positions", () => {
    expect(readSubstitution({ positions: [0, 1, 2, 3] }, { candidateCount: 9 })).toBeNull();
  });

  it("refuses a position given twice", () => {
    expect(readSubstitution({ positions: [1, 1] }, { candidateCount: 3 })).toBeNull();
  });

  it("refuses any position when the list is empty", () => {
    expect(readSubstitution({ positions: [0] }, { candidateCount: 0 })).toBeNull();
  });

  it("has a schema for the output format", () => {
    expect(substitutionSchema.safeParse({ positions: [0] }).success).toBe(true);
  });
});

describe("readPlanRanking", () => {
  const candidateIds = ["recipe-a", "recipe-b", "food-c"];

  it("reads ids from the list, in the order given", () => {
    expect(readPlanRanking({ ranking: ["food-c", "recipe-a"] }, { candidateIds })).toEqual({
      ranking: ["food-c", "recipe-a"],
    });
  });

  it("refuses an id that was not offered", () => {
    expect(readPlanRanking({ ranking: ["recipe-a", "invented"] }, { candidateIds })).toBeNull();
  });

  it("refuses an id given twice", () => {
    expect(readPlanRanking({ ranking: ["recipe-a", "recipe-a"] }, { candidateIds })).toBeNull();
  });

  it("refuses more ids than 200", () => {
    const many = Array.from({ length: 201 }, (_, index) => `id-${index}`);
    expect(readPlanRanking({ ranking: many }, { candidateIds: many })).toBeNull();
  });

  it("refuses an id longer than 64 characters", () => {
    const long = "x".repeat(65);
    expect(readPlanRanking({ ranking: [long] }, { candidateIds: [long] })).toBeNull();
  });

  it("has a schema for the output format", () => {
    expect(planRankingSchema.safeParse({ ranking: ["a"] }).success).toBe(true);
  });
});
