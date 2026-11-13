import { describe, expect, it } from "vitest";

import { assistantRecipeDraftSchema, type AssistantRecipeDraft } from "../../src/assistant";

const foodId = "00000000-0000-4000-8000-0000000000f1";
const recipeId = "00000000-0000-4000-8000-0000000000e1";

const without = (value: object, key: string) =>
  Object.fromEntries(Object.entries(value).filter(([name]) => name !== key));

const perServing = { kcal: 520, protein_g: 38, fat_g: 14, carbs_g: 55 };

const suggestion: AssistantRecipeDraft = {
  variant: "suggestion",
  name: "Chicken and rice bowl",
  servings: 2,
  ingredients: [
    {
      name: "Chicken breast",
      foodId,
      foodName: "Chicken, breast, grilled without skin, meat only",
      grams: 300,
      kcal: 495,
      beforeGrams: null,
      change: "same",
    },
    {
      name: "Saffron",
      foodId: null,
      foodName: null,
      grams: 1,
      kcal: null,
      beforeGrams: null,
      change: "same",
    },
  ],
  dropped: [{ name: "Peanuts", reason: "avoided" }],
  perServing,
  fit: {
    status: "within",
    target: { kcal: 500, protein_g: 40 },
    misses: [],
  },
  steps: ["Cook the rice.", "Fry the chicken."],
};

const adjustment: Extract<AssistantRecipeDraft, { variant: "adjustment" }> = {
  ...suggestion,
  variant: "adjustment",
  recipeId,
  before: { kcal: 640, protein_g: null, fat_g: 22, carbs_g: 60 },
  ingredients: [
    {
      name: "Chicken breast",
      foodId,
      foodName: "Chicken, breast, grilled without skin, meat only",
      grams: 350,
      kcal: 578,
      beforeGrams: 300,
      change: "changed",
    },
    {
      name: "Peas",
      foodId,
      foodName: "Peas, frozen, boiled",
      grams: 80,
      kcal: 62,
      beforeGrams: null,
      change: "added",
    },
    {
      name: "Butter",
      foodId,
      foodName: "Butter, salted",
      grams: 0,
      kcal: 0,
      beforeGrams: 20,
      change: "removed",
    },
  ],
  fit: {
    status: "unreachable",
    target: { protein_g: 60 },
    misses: [
      {
        nutrient: "protein_g",
        target: 60,
        achieved: 48,
        reason: "ingredient_bounds",
        limitedBy: ["Chicken breast"],
      },
    ],
  },
};

describe("assistantRecipeDraftSchema", () => {
  it.each([
    ["a suggestion", suggestion],
    ["an adjustment", adjustment],
    ["a draft with no target to fit", { ...suggestion, fit: null }],
    [
      "a draft with a nutrient that has no data",
      { ...suggestion, perServing: { ...perServing, kcal: null } },
    ],
  ])("should parse %s", (_name, draft) => {
    expect(assistantRecipeDraftSchema.parse(draft)).toEqual(draft);
  });

  it("should list exactly the two variants", () => {
    expect(assistantRecipeDraftSchema.options.map((option) => option.shape.variant.value)).toEqual([
      "suggestion",
      "adjustment",
    ]);
  });

  it("should read a figure with no data as null and never as 0", () => {
    const parsed = assistantRecipeDraftSchema.parse({
      ...suggestion,
      perServing: { ...perServing, kcal: null },
    });

    expect(parsed.perServing.kcal).toBeNull();
  });

  describe("forward tolerance, so an app that is behind never fails the turn", () => {
    it("should strip a field it does not know from the draft and from every nested object", () => {
      const ahead = {
        ...adjustment,
        newField: 1,
        perServing: { ...perServing, fibre_g: 4 },
        before: { ...adjustment.before, fibre_g: 4 },
        fit: {
          ...adjustment.fit,
          extra: true,
          misses: [{ ...(adjustment.fit?.misses[0] ?? {}), note: "x" }],
        },
        ingredients: [{ ...adjustment.ingredients[0], organic: true }],
        dropped: [{ name: "Peanuts", reason: "avoided", why: "x" }],
      };

      const parsed = assistantRecipeDraftSchema.parse(ahead);

      expect(parsed).not.toHaveProperty("newField");
      expect(parsed.perServing).toEqual(perServing);
      expect(parsed.ingredients[0]).not.toHaveProperty("organic");
      expect(parsed.dropped[0]).toEqual({ name: "Peanuts", reason: "avoided" });
      expect(parsed.fit?.misses[0]).not.toHaveProperty("note");
    });
  });

  describe("a value a later version adds to an enum, which an app that is behind reads as a fallback", () => {
    it("should read an unknown change as changed", () => {
      const parsed = assistantRecipeDraftSchema.parse({
        ...suggestion,
        ingredients: [{ ...suggestion.ingredients[0], change: "swapped" }],
      });

      expect(parsed.ingredients[0]?.change).toBe("changed");
    });

    it("should read an unknown miss reason as targets_conflict", () => {
      const parsed = assistantRecipeDraftSchema.parse({
        ...suggestion,
        fit: {
          status: "unreachable",
          target: {},
          misses: [{ nutrient: "kcal", target: 1, achieved: 0, reason: "other", limitedBy: [] }],
        },
      });

      expect(parsed.fit?.misses[0]?.reason).toBe("targets_conflict");
    });

    it("should read an unknown dropped reason as avoided", () => {
      const parsed = assistantRecipeDraftSchema.parse({
        ...suggestion,
        dropped: [{ name: "Peanuts", reason: "disliked" }],
      });

      expect(parsed.dropped[0]?.reason).toBe("avoided");
    });
  });

  describe("the variants", () => {
    it("should require the recipe and its figures before on an adjustment", () => {
      const withoutRecipe = without(adjustment, "recipeId");
      const withoutBefore = without(adjustment, "before");

      expect(assistantRecipeDraftSchema.safeParse(withoutRecipe).success).toBe(false);
      expect(assistantRecipeDraftSchema.safeParse(withoutBefore).success).toBe(false);
    });

    it("should not carry a recipe or figures before on a suggestion", () => {
      const parsed = assistantRecipeDraftSchema.parse({
        ...suggestion,
        recipeId,
        before: perServing,
      });

      expect(parsed).not.toHaveProperty("recipeId");
      expect(parsed).not.toHaveProperty("before");
    });
  });

  describe("what it still rejects", () => {
    const withoutSteps = without(suggestion, "steps");
    const withoutDropped = without(suggestion, "dropped");
    const withoutPerServing = without(suggestion, "perServing");
    const longName = "x".repeat(201);

    it.each([
      ["no steps field", withoutSteps],
      ["no dropped field", withoutDropped],
      ["no per serving figures", withoutPerServing],
      ["a variant it does not list", { ...suggestion, variant: "swap" }],
      ["no name", { ...suggestion, name: "" }],
      ["a name over 200 characters", { ...suggestion, name: longName }],
      ["servings of 0", { ...suggestion, servings: 0 }],
      ["servings above 1,000", { ...suggestion, servings: 1001 }],
      [
        "more than 100 ingredients",
        { ...suggestion, ingredients: Array(101).fill(suggestion.ingredients[0]) },
      ],
      [
        "grams above 100,000",
        { ...suggestion, ingredients: [{ ...suggestion.ingredients[0], grams: 100001 }] },
      ],
      [
        "an ingredient with no food name",
        {
          ...suggestion,
          ingredients: [
            { name: "Oil", foodId, grams: 5, kcal: 1, beforeGrams: null, change: "same" },
          ],
        },
      ],
      [
        "an ingredient with no kcal",
        {
          ...suggestion,
          ingredients: [
            { name: "Oil", foodId, foodName: "Oil", grams: 5, beforeGrams: null, change: "same" },
          ],
        },
      ],
      ["more than 50 steps", { ...suggestion, steps: Array(51).fill("Stir.") }],
      ["an empty step", { ...suggestion, steps: [""] }],
      ["a negative figure", { ...suggestion, perServing: { ...perServing, kcal: -1 } }],
      [
        "a miss with a nutrient it does not list",
        {
          ...suggestion,
          fit: {
            status: "unreachable",
            target: {},
            misses: [
              { nutrient: "fibre_g", target: 1, achieved: 0, reason: "no_data", limitedBy: [] },
            ],
          },
        },
      ],
      [
        "a fit status it does not list",
        { ...suggestion, fit: { status: "close", target: {}, misses: [] } },
      ],
    ])("should reject %s", (_name, draft) => {
      expect(assistantRecipeDraftSchema.safeParse(draft).success).toBe(false);
    });
  });
});
