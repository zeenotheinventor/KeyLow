import { describe, expect, it } from "vitest";

import {
  broccoliLine,
  chickenLine,
  compareDraft,
  oilLine,
  yogurtLine,
} from "./recipeCompareFixtures";
import {
  firstUnmatchedLineNameOf,
  matchedFoodIdsOf,
  recipeDraftPrefillOf,
} from "../../src/assistant";
import { validateRecipeDraft } from "../../src/recipes";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { AdjustmentDraft, AssistantRecipeDraft, PrefillFood } from "../../src/assistant";

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
