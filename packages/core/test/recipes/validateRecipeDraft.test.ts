import { describe, expect, it } from "vitest";

import {
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_NAME_LENGTH,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
  MAX_RECIPE_YIELD_GRAMS,
  buildRecipeIngredient,
  recipeSchema,
  validateRecipeDraft,
} from "../../src/recipes";
import { buildFood } from "../../src/testing";

import type { RecipeDraft, RecipeDraftProblem } from "../../src/recipes";

const food = buildFood();
const ingredient = buildRecipeIngredient(food, { quantity: 150, unit: "g" });

const validDraft: RecipeDraft = {
  name: "Chicken and rice",
  servings: "4",
  cookedWeight: "1100",
  ingredients: [ingredient],
  steps: ["Brown the chicken.", "Add the rice and water."],
};

const problemsOf = (changes: Partial<RecipeDraft>): readonly RecipeDraftProblem[] => {
  const result = validateRecipeDraft({ ...validDraft, ...changes });
  return result.ok ? [] : result.problems;
};

describe("validateRecipeDraft", () => {
  describe("a draft with nothing wrong", () => {
    it("should be ok and hand back the values ready for computeRecipe", () => {
      expect(validateRecipeDraft(validDraft)).toEqual({
        ok: true,
        value: {
          name: "Chicken and rice",
          servings: 4,
          yieldGrams: 1100,
          steps: ["Brown the chicken.", "Add the rice and water."],
        },
      });
    });

    it("should hand back a name and steps that are trimmed, without the blank steps", () => {
      const result = validateRecipeDraft({
        ...validDraft,
        name: "  Chicken and rice \n",
        steps: ["  Brown the chicken. ", "", "   ", "Add the rice."],
      });

      expect(result).toMatchObject({
        ok: true,
        value: { name: "Chicken and rice", steps: ["Brown the chicken.", "Add the rice."] },
      });
    });

    it("should be ok with no steps at all", () => {
      expect(problemsOf({ steps: [] })).toEqual([]);
    });

    it("should be accepted by the recipe schema once the cleaned values are saved", () => {
      const result = validateRecipeDraft(validDraft);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(
          recipeSchema.safeParse({
            name: result.value.name,
            servings: result.value.servings,
            yield_grams: result.value.yieldGrams,
            instructions: result.value.steps,
            is_archived: false,
          }).success,
        ).toBe(true);
      }
    });
  });

  describe("the name", () => {
    it.each([
      { name: "empty", text: "" },
      { name: "only spaces", text: "   " },
      { name: "only whitespace characters", text: " \t\n " },
    ])("should be a problem when it is $name", ({ text }) => {
      expect(problemsOf({ name: text })).toEqual(["name_required"]);
    });

    it("should accept a name of the maximum length", () => {
      expect(problemsOf({ name: "a".repeat(MAX_RECIPE_NAME_LENGTH) })).toEqual([]);
    });

    it("should be a problem one character over the maximum", () => {
      expect(problemsOf({ name: "a".repeat(MAX_RECIPE_NAME_LENGTH + 1) })).toEqual([
        "name_too_long",
      ]);
    });

    it("should count characters, so an emoji is one", () => {
      expect(problemsOf({ name: "🍗".repeat(MAX_RECIPE_NAME_LENGTH) })).toEqual([]);
      expect(problemsOf({ name: "🍗".repeat(MAX_RECIPE_NAME_LENGTH + 1) })).toEqual([
        "name_too_long",
      ]);
    });

    it("should measure the name without the spaces around it, as it is saved", () => {
      expect(problemsOf({ name: ` ${"a".repeat(MAX_RECIPE_NAME_LENGTH)} ` })).toEqual([]);
    });
  });

  describe("the servings", () => {
    it.each(["1", "4", "0.5", ".5", "12,5", " 3 ", String(MAX_RECIPE_SERVINGS)])(
      "should accept %j",
      (text) => {
        expect(problemsOf({ servings: text })).toEqual([]);
      },
    );

    it("should read 12,5 as 12.5, the way enteredNumber reads it", () => {
      expect(validateRecipeDraft({ ...validDraft, servings: "12,5" })).toMatchObject({
        ok: true,
        value: { servings: 12.5 },
      });
    });

    it.each(["", "   ", "0", "0.0", "-1", "abc", "1,200", "1e3", "Infinity", ".", ","])(
      "should be a problem when it is %j",
      (text) => {
        expect(problemsOf({ servings: text })).toEqual(["servings_invalid"]);
      },
    );

    it("should say 1,200 is a problem and not 1.2 servings", () => {
      expect(validateRecipeDraft({ ...validDraft, servings: "1,200" }).ok).toBe(false);
    });

    it("should be a problem one over the maximum", () => {
      expect(problemsOf({ servings: String(MAX_RECIPE_SERVINGS + 1) })).toEqual([
        "servings_too_many",
      ]);
      expect(problemsOf({ servings: `${MAX_RECIPE_SERVINGS}.5` })).toEqual(["servings_too_many"]);
    });
  });

  describe("the cooked weight", () => {
    it.each(["", "   "])("should be ok and mean no yield when it is %j", (text) => {
      expect(validateRecipeDraft({ ...validDraft, cookedWeight: text })).toMatchObject({
        ok: true,
        value: { yieldGrams: null },
      });
    });

    it.each(["1", "850.5", "850,5", String(MAX_RECIPE_YIELD_GRAMS)])("should accept %j", (text) => {
      expect(problemsOf({ cookedWeight: text })).toEqual([]);
    });

    it("should read 850,5 as 850.5", () => {
      expect(validateRecipeDraft({ ...validDraft, cookedWeight: "850,5" })).toMatchObject({
        ok: true,
        value: { yieldGrams: 850.5 },
      });
    });

    it.each(["0", "-1", "-5", "abc", "1,100", "1e3", "Infinity", "."])(
      "should be a problem when it is %j",
      (text) => {
        expect(problemsOf({ cookedWeight: text })).toEqual(["cooked_weight_invalid"]);
      },
    );

    it("should be a problem one over the maximum", () => {
      expect(problemsOf({ cookedWeight: String(MAX_RECIPE_YIELD_GRAMS + 1) })).toEqual([
        "cooked_weight_too_large",
      ]);
    });
  });

  describe("the ingredients", () => {
    it("should be a problem when there are none", () => {
      expect(problemsOf({ ingredients: [] })).toEqual(["ingredients_none"]);
    });

    it("should accept the maximum number", () => {
      const ingredients = Array.from({ length: MAX_RECIPE_INGREDIENTS }, () => ingredient);

      expect(problemsOf({ ingredients })).toEqual([]);
    });

    it("should be a problem one over the maximum number", () => {
      const ingredients = Array.from({ length: MAX_RECIPE_INGREDIENTS + 1 }, () => ingredient);

      expect(problemsOf({ ingredients })).toEqual(["ingredients_too_many"]);
    });

    it("should be a problem for an ingredient the schema refuses, even though the builder made it", () => {
      const half = buildRecipeIngredient(food, { quantity: 0, unit: "g" });

      expect(problemsOf({ ingredients: [ingredient, half] })).toEqual(["ingredient_invalid"]);
    });

    it("should report one problem however many ingredients the schema refuses", () => {
      const half = buildRecipeIngredient(food, { quantity: 0, unit: "g" });

      expect(problemsOf({ ingredients: [half, half, half] })).toEqual(["ingredient_invalid"]);
    });
  });

  describe("the steps", () => {
    it("should accept the maximum number", () => {
      expect(
        problemsOf({ steps: Array.from({ length: MAX_RECIPE_STEPS }, () => "Stir.") }),
      ).toEqual([]);
    });

    it("should be a problem one over the maximum number", () => {
      expect(
        problemsOf({ steps: Array.from({ length: MAX_RECIPE_STEPS + 1 }, () => "Stir.") }),
      ).toEqual(["steps_too_many"]);
    });

    it("should not count a blank step, which is dropped on save", () => {
      const steps = [...Array.from({ length: MAX_RECIPE_STEPS }, () => "Stir."), "", "   "];

      expect(problemsOf({ steps })).toEqual([]);
    });

    it("should accept a step of the maximum length", () => {
      expect(problemsOf({ steps: ["a".repeat(MAX_RECIPE_STEP_LENGTH)] })).toEqual([]);
    });

    it("should be a problem for a step one character over the maximum length", () => {
      expect(problemsOf({ steps: ["a".repeat(MAX_RECIPE_STEP_LENGTH + 1)] })).toEqual([
        "step_too_long",
      ]);
    });

    it("should measure a step without the spaces around it, as it is saved", () => {
      expect(problemsOf({ steps: [` ${"a".repeat(MAX_RECIPE_STEP_LENGTH)} `] })).toEqual([]);
    });

    it("should count characters, so an emoji is one", () => {
      expect(problemsOf({ steps: ["🍗".repeat(MAX_RECIPE_STEP_LENGTH)] })).toEqual([]);
    });

    it("should report one problem however many steps are too long", () => {
      const tooLong = "a".repeat(MAX_RECIPE_STEP_LENGTH + 1);

      expect(problemsOf({ steps: [tooLong, "Fine.", tooLong] })).toEqual(["step_too_long"]);
    });

    it("should report both the count and the length when both are over", () => {
      const steps = [
        "a".repeat(MAX_RECIPE_STEP_LENGTH + 1),
        ...Array.from({ length: MAX_RECIPE_STEPS }, () => "Stir."),
      ];

      expect(problemsOf({ steps })).toEqual(["steps_too_many", "step_too_long"]);
    });
  });

  describe("several problems at once", () => {
    it("should list them in field order: name, servings, cooked weight, ingredients, steps", () => {
      const result = validateRecipeDraft({
        name: " ",
        servings: "0",
        cookedWeight: "-5",
        ingredients: [],
        steps: ["a".repeat(MAX_RECIPE_STEP_LENGTH + 1)],
      });

      expect(result).toEqual({
        ok: false,
        problems: [
          "name_required",
          "servings_invalid",
          "cooked_weight_invalid",
          "ingredients_none",
          "step_too_long",
        ],
      });
    });

    it("should list the over-the-bound problems in the same field order", () => {
      const result = validateRecipeDraft({
        name: "a".repeat(MAX_RECIPE_NAME_LENGTH + 1),
        servings: String(MAX_RECIPE_SERVINGS + 1),
        cookedWeight: String(MAX_RECIPE_YIELD_GRAMS + 1),
        ingredients: Array.from({ length: MAX_RECIPE_INGREDIENTS + 1 }, () => ingredient),
        steps: Array.from({ length: MAX_RECIPE_STEPS + 1 }, () => "Stir."),
      });

      expect(result).toEqual({
        ok: false,
        problems: [
          "name_too_long",
          "servings_too_many",
          "cooked_weight_too_large",
          "ingredients_too_many",
          "steps_too_many",
        ],
      });
    });

    it("should give the same list for the same draft", () => {
      const draft = { ...validDraft, name: "", servings: "x", ingredients: [] };

      expect(validateRecipeDraft(draft)).toEqual(validateRecipeDraft(draft));
    });
  });

  describe("what it returns on a problem", () => {
    it("should carry codes only, never the text that was typed", () => {
      const result = validateRecipeDraft({
        ...validDraft,
        name: "",
        servings: "secret-serving-text",
        cookedWeight: "secret-weight-text",
        steps: ["a".repeat(MAX_RECIPE_STEP_LENGTH + 1)],
      });

      expect(result.ok).toBe(false);
      expect(JSON.stringify(result)).not.toMatch(/secret|aaaa/);
    });
  });

  describe("the problem codes", () => {
    // Fails to typecheck when a code is added without a case here, which is what a screen gets.
    const sentenceKeyOf = (problem: RecipeDraftProblem): string => {
      switch (problem) {
        case "name_required":
        case "name_too_long":
        case "servings_invalid":
        case "servings_too_many":
        case "cooked_weight_invalid":
        case "cooked_weight_too_large":
        case "ingredients_none":
        case "ingredients_too_many":
        case "ingredient_invalid":
        case "steps_too_many":
        case "step_too_long":
          return problem;
        default: {
          const unreachable: never = problem;
          return unreachable;
        }
      }
    };

    it("should be a closed union a screen can switch over", () => {
      expect(sentenceKeyOf("name_required")).toBe("name_required");
    });
  });
});
