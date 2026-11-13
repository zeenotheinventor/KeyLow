import { describe, expect, it } from "vitest";

import {
  broccoliLine,
  chickenLine,
  compareDraft,
  oilLine,
  yogurtLine,
} from "./recipeCompareFixtures";
import {
  buildAdjustmentDraft,
  firstUnmatchedLineNameOf,
  matchedFoodIdsOf,
  recipeDraftPrefillOf,
} from "../../src/assistant";
import { buildRecipeIngredient, computeRecipe, validateRecipeDraft } from "../../src/recipes";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { AdjustmentDraft, AssistantRecipeDraft, PrefillFood } from "../../src/assistant";
import type { RecipeIngredient } from "../../src/recipes";

type Suggestion = Extract<AssistantRecipeDraft, { variant: "suggestion" }>;

const idOf = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const chicken = buildFood({ id: idOf(1), name: "Chicken, breast", kcal: 148, protein_g: 32 });
const oil = buildFood({ id: idOf(2), name: "Oil, olive", kcal: 899 });
const foods = new Map<string, PrefillFood>(
  [chicken, oil].map((food) => [food.id, { food, portions: [] }] as const),
);

// The editor's draft, or null when the prefill refused.
const draftOf = (...input: Parameters<typeof recipeDraftPrefillOf>) => {
  const outcome = recipeDraftPrefillOf(...input);
  return outcome.ok ? outcome.draft : null;
};

const line = (name: string, foodId: string | null, grams: number) => ({
  name,
  foodId,
  foodName: foodId === null ? null : name,
  foodSource: null,
  grams,
  beforeGrams: null,
  kcal: null,
  change: "same" as const,
});

const draft: Suggestion = {
  variant: "suggestion",
  name: "Chicken and oil",
  servings: 2,
  ingredients: [line("chicken", idOf(1), 220), line("olive oil", idOf(2), 20)],
  dropped: [],
  perServing: { kcal: 300, protein_g: 35, carbs_g: 0, fat_g: 10 },
  fit: null,
  steps: ["Cook the chicken.", "Add the oil."],
};

describe("recipeDraftPrefillOf", () => {
  it("should carry the name, the servings as the field's text and the steps", () => {
    const prefill = draftOf(draft, foods);

    expect(prefill).toMatchObject({
      name: "Chicken and oil",
      servings: "2",
      cookedWeight: "",
      steps: ["Cook the chicken.", "Add the oil."],
    });
  });

  it("should make each matched line an ingredient of the food in grams, with its snapshot", () => {
    const prefill = draftOf(draft, foods);

    expect(prefill?.ingredients).toHaveLength(2);
    expect(prefill?.ingredients[0]).toMatchObject({
      food_id: idOf(1),
      quantity: 220,
      unit: "g",
      resolved_grams: 220,
      portion_id: null,
    });
    expect(prefill?.ingredients[0]?.snapshot.name).toBe("Chicken, breast");
  });

  it("should be a draft the recipe editor's own checks accept", () => {
    const prefill = draftOf(draft, foods);

    expect(prefill === null ? null : validateRecipeDraft(prefill).ok).toBe(true);
  });

  it("should leave a line that matched no food out", () => {
    const withHarissa: Suggestion = {
      ...draft,
      ingredients: [...draft.ingredients, line("harissa paste", null, 30)],
    };

    expect(draftOf(withHarissa, foods)?.ingredients).toHaveLength(2);
  });

  it("should be null when a matched food could not be found, so a recipe is never saved short", () => {
    expect(draftOf(draft, new Map([[chicken.id, { food: chicken, portions: [] }]]))).toBeNull();
  });
});

describe("recipeDraftPrefillOf, an adjustment", () => {
  const compareFoods = new Map<string, PrefillFood>(
    [1, 2, 3, 4, 5].map((number) => {
      const food = buildFood({ id: idOf(number), name: `Food ${number}`, kcal: 100 });
      return [food.id, { food, portions: [] }] as const;
    }),
  );
  const withYogurt: AdjustmentDraft = {
    ...compareDraft,
    ingredients: [...compareDraft.ingredients, yogurtLine],
  };

  it("should open a new recipe named for the adjustment, with the draft's amounts and the recipe's own steps", () => {
    const prefill = draftOf(withYogurt, compareFoods);

    expect(prefill).toMatchObject({
      name: "Eval chicken and rice, adjusted",
      servings: "2",
      cookedWeight: "",
      steps: ["Cook the rice.", "Grill the chicken.", "Steam the broccoli."],
    });
    expect(
      prefill?.ingredients.map(({ food_id, resolved_grams }) => [food_id, resolved_grams]),
    ).toEqual([
      [idOf(1), 455],
      [idOf(2), 180],
      [idOf(3), 10],
      [idOf(4), 160],
      [idOf(5), 120],
    ]);
  });

  it("should be a draft the recipe editor's own checks accept", () => {
    const prefill = draftOf(withYogurt, compareFoods);

    expect(prefill === null ? null : validateRecipeDraft(prefill).ok).toBe(true);
  });

  it("should be null when a food could not be found, so a recipe is never opened short", () => {
    const missing = new Map(compareFoods);
    missing.delete(idOf(3));

    expect(draftOf(compareDraft, missing)).toBeNull();
  });

  it("should be null for a line that has no weight, which cannot be rebuilt in grams", () => {
    const weightless: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [{ ...broccoliLine, grams: 0, beforeGrams: 0 }],
    };

    expect(draftOf(weightless, compareFoods)).toBeNull();
  });

  it("should refuse a line with no food as not rebuildable, never as a missing food", () => {
    const noFood: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [{ ...broccoliLine, foodId: null, foodName: null }],
    };

    expect(recipeDraftPrefillOf(noFood, compareFoods)).toEqual({
      ok: false,
      reason: "not_rebuildable",
    });
  });

  it("should refuse a line counted by portion as not rebuildable", () => {
    const weightless: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [{ ...broccoliLine, grams: 0, beforeGrams: 0 }],
    };

    expect(recipeDraftPrefillOf(weightless, compareFoods)).toEqual({
      ok: false,
      reason: "not_rebuildable",
    });
  });

  it("should refuse a food that was not loaded as missing, which is a failure to load", () => {
    const missing = new Map(compareFoods);
    missing.delete(idOf(3));

    expect(recipeDraftPrefillOf(compareDraft, missing)).toEqual({
      ok: false,
      reason: "food_missing",
    });
  });

  it("should leave a removed line out", () => {
    const removed: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [chickenLine, { ...oilLine, grams: 0, change: "removed" }],
    };

    expect(draftOf(removed, compareFoods)?.ingredients).toHaveLength(1);
  });

  it("should open the editor on no search word, because every line matched a food", () => {
    expect(firstUnmatchedLineNameOf(compareDraft)).toBeNull();
  });
});

describe("recipeDraftPrefillOf, the food's own portions", () => {
  it("should freeze each food with its own portions, so the editor's density is the food's", () => {
    const portion = buildFoodPortion({
      id: idOf(50),
      food_id: idOf(2),
      label: "1 tbsp (15 g)",
      grams: 15,
      ml: null,
    });
    const withPortion = new Map(foods).set(idOf(2), { food: oil, portions: [portion] });
    const without = draftOf(draft, foods);
    const withPortions = draftOf(draft, withPortion);

    expect(withPortions?.ingredients[1]?.snapshot.density).not.toBe(
      without?.ingredients[1]?.snapshot.density,
    );
  });
});

describe("matchedFoodIdsOf", () => {
  it("should name the foods of the matched lines in line order and skip an unmatched one", () => {
    const withHarissa: Suggestion = {
      ...draft,
      ingredients: [line("harissa paste", null, 30), ...draft.ingredients],
    };

    expect(matchedFoodIdsOf(withHarissa)).toEqual([idOf(1), idOf(2)]);
  });
});

describe("firstUnmatchedLineNameOf", () => {
  it("should name the first line that matched no food", () => {
    const withTwo: Suggestion = {
      ...draft,
      ingredients: [...draft.ingredients, line("harissa paste", null, 30), line("sumac", null, 2)],
    };

    expect(firstUnmatchedLineNameOf(withTwo)).toBe("harissa paste");
  });

  it("should be null when every line matched", () => {
    expect(firstUnmatchedLineNameOf(draft)).toBeNull();
  });
});

describe("recipeDraftPrefillOf, an adjustment rebuilt from the frozen lines", () => {
  const chickenFood = buildFood({
    id: idOf(1),
    name: "Chicken, breast",
    kcal: 148,
    protein_g: 32,
    carbs_g: 0,
    fat_g: 2.2,
  });
  const riceFood = buildFood({
    id: idOf(2),
    name: "Rice, white",
    kcal: 131,
    protein_g: 2.8,
    carbs_g: 31.1,
    fat_g: 0.4,
  });
  const bucketFood = buildFood({
    id: idOf(3),
    name: "Restaurant bucket",
    basis: "per_portion",
    kcal: 500,
    protein_g: 20,
    carbs_g: 40,
    fat_g: 30,
  });
  const spoon = { id: "spoon-tbsp", label: "1 tbsp", grams: null, ml: 15 };
  const oilFood = buildFood({ id: idOf(4), name: "Oil, olive", kcal: 899, fat_g: 99.9 });
  const oilLineOfTwoSpoons = buildRecipeIngredient(oilFood, {
    quantity: 2,
    unit: "portion",
    portion: spoon,
  });
  const bucketLine = buildRecipeIngredient(bucketFood, {
    quantity: 2,
    unit: "portion",
    portion: { id: idOf(300), label: "1 bucket", grams: null, ml: null },
  });
  const original = {
    id: idOf(100),
    name: "Eval chicken and rice",
    servings: 2,
    steps: ["Grill the chicken."],
    ingredients: [
      buildRecipeIngredient(chickenFood, { quantity: 260, unit: "g" }),
      buildRecipeIngredient(riceFood, { quantity: 360, unit: "g" }),
      bucketLine,
    ],
  };
  const adjustment = (): AdjustmentDraft => {
    const outcome = buildAdjustmentDraft({
      recipe: original,
      target: { protein_g: 85 },
      additions: [],
      preferences: [],
    });
    if (outcome.status !== "drafted") {
      throw new Error(`Expected a draft, got ${outcome.status}`);
    }
    return outcome.draft;
  };
  // The foods as they are today, after the person edited the chicken and the rice since the recipe was written.
  const editedFoods = new Map<string, PrefillFood>([
    [idOf(1), { food: { ...chickenFood, kcal: 190, protein_g: 20 }, portions: [] }],
    [idOf(2), { food: { ...riceFood, kcal: 99, carbs_g: 20 }, portions: [] }],
    [idOf(3), { food: { ...bucketFood, kcal: 900 }, portions: [] }],
  ]);
  const perServingOf = (ingredients: readonly RecipeIngredient[], servings: number) =>
    computeRecipe({ servings, yieldGrams: null, ingredients }).perServing;

  it("should save figures equal to the card's After exactly, after the foods were edited", () => {
    const draft = adjustment();
    const prefill = draftOf(draft, editedFoods);

    expect(draft.ingredients.some(({ change }) => change === "changed")).toBe(true);
    const saved = perServingOf(prefill?.ingredients ?? [], draft.servings);
    expect({
      kcal: saved.kcal,
      protein_g: saved.protein_g,
      carbs_g: saved.carbs_g,
      fat_g: saved.fat_g,
    }).toEqual(draft.perServing);
  });

  it("should keep a line counted by portion as a portion with the same count", () => {
    const prefill = draftOf(adjustment(), editedFoods);
    const bucket = prefill?.ingredients.find(({ food_id }) => food_id === idOf(3));

    expect(bucket).toEqual(bucketLine);
    expect(prefill === null ? null : validateRecipeDraft(prefill).ok).toBe(true);
  });

  it("should keep an unchanged line in its own amount and unit, not in grams", () => {
    const sameOil: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [
        {
          ...oilLine,
          foodId: idOf(4),
          grams: oilLineOfTwoSpoons.resolved_grams,
          beforeGrams: oilLineOfTwoSpoons.resolved_grams,
          change: "same",
          frozen: oilLineOfTwoSpoons,
        },
      ],
    };

    expect(draftOf(sameOil, new Map())?.ingredients).toEqual([oilLineOfTwoSpoons]);
  });

  it("should not need the live food of a line that carries its frozen ingredient", () => {
    const prefill = recipeDraftPrefillOf(adjustment(), new Map());

    expect(prefill.ok).toBe(true);
  });

  it("should ask for no food of a line that carries its frozen ingredient", () => {
    expect(matchedFoodIdsOf(adjustment())).toEqual([]);
  });

  it("should leave a removed line out even when it carries a frozen ingredient", () => {
    const draft = adjustment();
    const removed: AdjustmentDraft = {
      ...draft,
      ingredients: draft.ingredients.map((line, index) =>
        index === 0 ? { ...line, grams: 0, change: "removed" } : line,
      ),
    };

    expect(draftOf(removed, editedFoods)?.ingredients).toHaveLength(2);
  });

  describe("a draft stored before the frozen line existed", () => {
    const older = (): AdjustmentDraft => {
      const draft = adjustment();
      return {
        ...draft,
        ingredients: draft.ingredients.map((line) => ({ ...line, frozen: null })),
      };
    };

    it("should fall back to the live food in grams for a line that has a weight", () => {
      const draft = older();
      const weighed: AdjustmentDraft = {
        ...draft,
        ingredients: draft.ingredients.filter(({ grams }) => grams > 0),
      };

      expect(draftOf(weighed, editedFoods)?.ingredients.map(({ unit }) => unit)).toEqual([
        "g",
        "g",
      ]);
    });

    it("should refuse a line counted by portion as not rebuildable, as it always did", () => {
      expect(recipeDraftPrefillOf(older(), editedFoods)).toEqual({
        ok: false,
        reason: "not_rebuildable",
      });
    });

    it("should still ask for the food of each line", () => {
      expect(matchedFoodIdsOf(older())).toEqual([idOf(1), idOf(2), idOf(3)]);
    });
  });
});
