import { describe, expect, it } from "vitest";

import {
  addStep,
  isRecipeDraftChanged,
  newRecipeDraft,
  recipeDraftOf,
  removeStep,
  validateRecipeDraft,
} from "../../src/recipes";
import { buildChickenAndRiceRecipe } from "../../src/testing";

import type { RecipeDraft, StoredRecipe } from "../../src/recipes";

const chickenAndRice = buildChickenAndRiceRecipe({ servings: 4, yieldGrams: 1100 });

const storedChickenAndRice = (overrides: Partial<StoredRecipe> = {}): StoredRecipe => ({
  name: "Chicken and rice",
  servings: 4,
  yield_grams: 1100,
  instructions: ["Boil the rice", "Fry the chicken"],
  ingredients: chickenAndRice.ingredients.map((ingredient, position) => ({
    ...ingredient,
    position,
  })),
  ...overrides,
});

const savedDraft = (): RecipeDraft => recipeDraftOf(storedChickenAndRice());

const [chicken, rice, oil] = chickenAndRice.ingredients;
if (chicken === undefined || rice === undefined || oil === undefined) {
  throw new Error("The golden recipe must have three ingredients");
}

describe("recipeDraftOf", () => {
  it("should read a stored recipe into the text of its fields", () => {
    const draft = savedDraft();

    expect(draft.name).toBe("Chicken and rice");
    expect(draft.servings).toBe("4");
    expect(draft.cookedWeight).toBe("1100");
    expect(draft.steps).toEqual(["Boil the rice", "Fry the chicken"]);
  });

  it("should give a blank cooked weight for a null yield", () => {
    expect(recipeDraftOf(storedChickenAndRice({ yield_grams: null })).cookedWeight).toBe("");
  });

  it("should write fractional servings as they are", () => {
    expect(recipeDraftOf(storedChickenAndRice({ servings: 2.5 })).servings).toBe("2.5");
  });

  it("should keep the ingredients in order and without their stored position", () => {
    const { ingredients } = savedDraft();

    expect(ingredients).toEqual([chicken, rice, oil]);
    expect(ingredients.every((ingredient) => !("position" in ingredient))).toBe(true);
  });

  it("should give a draft that validates to the stored recipe", () => {
    const result = validateRecipeDraft(savedDraft());

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Chicken and rice",
        servings: 4,
        yieldGrams: 1100,
        steps: ["Boil the rice", "Fry the chicken"],
      },
    });
  });

  it("should not change the recipe it was given or share its lists", () => {
    const stored = storedChickenAndRice();
    const before = structuredClone(stored);

    const draft = recipeDraftOf(stored);

    expect(stored).toEqual(before);
    expect(draft.steps).not.toBe(stored.instructions);
    expect(draft.ingredients).not.toBe(stored.ingredients);
  });
});

describe("newRecipeDraft", () => {
  it("should start at 1 serving with no cooked weight, ingredients or steps", () => {
    expect(newRecipeDraft()).toEqual({
      name: "",
      servings: "1",
      cookedWeight: "",
      ingredients: [],
      steps: [],
    });
  });

  it("should take the name it is given", () => {
    expect(newRecipeDraft("Soup").name).toBe("Soup");
  });

  it("should be refused until it has a name and an ingredient", () => {
    const problemsOf = (draft: RecipeDraft) => {
      const result = validateRecipeDraft(draft);
      return result.ok ? [] : result.problems;
    };

    expect(problemsOf(newRecipeDraft())).toEqual(["name_required", "ingredients_none"]);
    expect(problemsOf(newRecipeDraft("Soup"))).toEqual(["ingredients_none"]);
    expect(problemsOf({ ...newRecipeDraft(), ingredients: [oil] })).toEqual(["name_required"]);
    expect(validateRecipeDraft({ ...newRecipeDraft("Soup"), ingredients: [oil] }).ok).toBe(true);
  });
});

describe("isRecipeDraftChanged", () => {
  it("should be false for a draft compared with itself", () => {
    const saved = savedDraft();

    expect(isRecipeDraftChanged(saved, saved)).toBe(false);
  });

  it("should be false for a fresh draft of the same recipe", () => {
    expect(isRecipeDraftChanged(savedDraft(), savedDraft())).toBe(false);
  });

  it.each([
    { name: "retyping the servings as 4.0", change: { servings: "4.0" } },
    { name: "retyping the servings with a decimal comma", change: { servings: "4,0" } },
    { name: "padding the servings with spaces", change: { servings: " 4 " } },
    { name: "retyping the cooked weight as 1100.0", change: { cookedWeight: "1100.0" } },
    { name: "a trailing space in the name", change: { name: "Chicken and rice " } },
    { name: "a leading space in the name", change: { name: " Chicken and rice" } },
    {
      name: "a blank step added and not typed into",
      change: { steps: ["Boil the rice", "Fry the chicken", ""] },
    },
    {
      name: "a step padded with spaces",
      change: { steps: [" Boil the rice ", "Fry the chicken"] },
    },
  ])("should be false for $name", ({ change }) => {
    expect(isRecipeDraftChanged(savedDraft(), { ...savedDraft(), ...change })).toBe(false);
  });

  it("should be false for a blank cooked weight against a blank cooked weight", () => {
    const saved = recipeDraftOf(storedChickenAndRice({ yield_grams: null }));

    expect(isRecipeDraftChanged(saved, { ...saved, cookedWeight: "  " })).toBe(false);
  });

  it.each([
    { name: "a different name", change: { name: "Chicken and rise" } },
    { name: "a different case in the name", change: { name: "chicken and rice" } },
    { name: "different servings", change: { servings: "5" } },
    { name: "servings that are no longer a number", change: { servings: "abc" } },
    { name: "a different cooked weight", change: { cookedWeight: "1000" } },
    { name: "a cooked weight cleared", change: { cookedWeight: "" } },
    { name: "a step edited", change: { steps: ["Boil the rice", "Grill the chicken"] } },
    { name: "a step moved", change: { steps: ["Fry the chicken", "Boil the rice"] } },
    { name: "a step removed", change: { steps: ["Boil the rice"] } },
    { name: "a step added", change: { steps: ["Boil the rice", "Fry the chicken", "Serve"] } },
  ])("should be true for $name", ({ change }) => {
    expect(isRecipeDraftChanged(savedDraft(), { ...savedDraft(), ...change })).toBe(true);
  });

  it("should be true when a blank cooked weight gets a number", () => {
    const saved = recipeDraftOf(storedChickenAndRice({ yield_grams: null }));

    expect(isRecipeDraftChanged(saved, { ...saved, cookedWeight: "900" })).toBe(true);
  });

  it("should be false for adding then removing the same step", () => {
    const saved = savedDraft();
    const withStep = addStep(saved.steps, "Serve");
    const current = { ...saved, steps: removeStep(withStep, withStep.length - 1) };

    expect(isRecipeDraftChanged(saved, current)).toBe(false);
  });

  describe("the ingredients", () => {
    it("should be true when one amount changes", () => {
      const current = {
        ...savedDraft(),
        ingredients: [{ ...chicken, quantity: 501, resolved_grams: 501 }, rice, oil],
      };

      expect(isRecipeDraftChanged(savedDraft(), current)).toBe(true);
    });

    it("should be true when the order changes", () => {
      const current = { ...savedDraft(), ingredients: [rice, chicken, oil] };

      expect(isRecipeDraftChanged(savedDraft(), current)).toBe(true);
    });

    it("should be true when an ingredient is removed", () => {
      const current = { ...savedDraft(), ingredients: [chicken, rice] };

      expect(isRecipeDraftChanged(savedDraft(), current)).toBe(true);
    });

    it("should be true when a food is swapped for another", () => {
      const current = {
        ...savedDraft(),
        ingredients: [{ ...chicken, food_id: rice.food_id }, rice, oil],
      };

      expect(isRecipeDraftChanged(savedDraft(), current)).toBe(true);
    });

    it("should be true when the unit changes", () => {
      const current = {
        ...savedDraft(),
        ingredients: [{ ...chicken, unit: "ml" as const }, rice, oil],
      };

      expect(isRecipeDraftChanged(savedDraft(), current)).toBe(true);
    });

    it.each([
      { column: "food_id", change: { food_id: rice.food_id } },
      { column: "quantity", change: { quantity: 501 } },
      { column: "unit", change: { unit: "ml" as const } },
      { column: "portion_id", change: { portion_id: "00000000-0000-4000-8000-0000000000b2" } },
      { column: "resolved_grams", change: { resolved_grams: 501 } },
    ])("should be true when only the $column of one ingredient changes", ({ change }) => {
      const portioned = {
        ...chicken,
        unit: "portion" as const,
        portion_id: "00000000-0000-4000-8000-0000000000b1",
      };
      const saved = { ...savedDraft(), ingredients: [portioned, rice, oil] };
      const current = { ...saved, ingredients: [{ ...portioned, ...change }, rice, oil] };

      expect(isRecipeDraftChanged(saved, current)).toBe(true);
    });

    it("should be false when only the snapshot differs (the snapshot is not compared)", () => {
      const current = {
        ...savedDraft(),
        ingredients: [
          { ...chicken, snapshot: { ...chicken.snapshot, name: "Renamed" } },
          rice,
          oil,
        ],
      };

      expect(isRecipeDraftChanged(savedDraft(), current)).toBe(false);
    });
  });

  it("should be false for servings and cooked weight that are not numbers, compared with themselves", () => {
    const draft = { ...savedDraft(), servings: "abc", cookedWeight: "abc" };

    expect(isRecipeDraftChanged(draft, { ...draft })).toBe(false);
  });

  it("should not change either draft it was given", () => {
    const saved = savedDraft();
    const current = { ...savedDraft(), name: "Other", steps: ["", "a"] };
    const before = structuredClone([saved, current]);

    isRecipeDraftChanged(saved, current);

    expect([saved, current]).toEqual(before);
  });
});
