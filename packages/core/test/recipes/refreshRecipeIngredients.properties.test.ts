import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { buildRecipeIngredient, computeRecipe, refreshRecipeIngredients } from "../../src/recipes";
import { buildFood, buildFoodPortion } from "../../src/testing";

import type { RefreshableFoods } from "../../src/recipes";
import type { Food, FoodPortion } from "../../src/schemas";

const foodIds = [
  "00000000-0000-4000-8000-0000000000d1",
  "00000000-0000-4000-8000-0000000000d2",
  "00000000-0000-4000-8000-0000000000d3",
  "00000000-0000-4000-8000-0000000000d4",
] as const;

const slicePortionOf = (food: Food): FoodPortion =>
  buildFoodPortion({
    id: `00000000-0000-4000-8000-0000000000${food.id.slice(-2)}`,
    food_id: food.id,
    label: "Slice",
    grams: 30,
  });

const amount = fc.double({ min: 0, max: 900, noNaN: true });
const maybeAmount = fc.option(amount, { nil: null });

/** The foods as they were when the ingredients were added. */
const originalFoods: fc.Arbitrary<Food[]> = fc.tuple(
  ...foodIds.map((id) =>
    fc
      .record({
        kcal: maybeAmount,
        protein_g: maybeAmount,
        fat_g: maybeAmount,
        carbs_g: maybeAmount,
        sat_fat_g: maybeAmount,
        density_g_per_ml: fc.option(fc.double({ min: 0.1, max: 2, noNaN: true }), { nil: null }),
      })
      .map((values) => buildFood({ id, name: `Food ${id.slice(-1)}`, ...values })),
  ),
);

type Ingredient = {
  foodIndex: number;
  amount: "grams" | "millilitres" | "portion";
  quantity: number;
};

const ingredientChoice: fc.Arbitrary<Ingredient> = fc.record({
  foodIndex: fc.nat({ max: foodIds.length - 1 }),
  amount: fc.constantFrom("grams", "millilitres", "portion"),
  quantity: fc.double({ min: 0.1, max: 2000, noNaN: true }),
});

/** What can happen to a food after it was added: nothing, an edit, a new density, or it goes. */
type Edit =
  | { kind: "none" }
  | { kind: "energy"; kcal: number | null }
  | { kind: "rename" }
  | { kind: "density"; density: number | null }
  | { kind: "missing" }
  | { kind: "deleted" }
  | { kind: "portionResized" }
  | { kind: "portionRemoved" };

const edit: fc.Arbitrary<Edit> = fc.oneof(
  fc.constant<Edit>({ kind: "none" }),
  maybeAmount.map((kcal): Edit => ({ kind: "energy", kcal })),
  fc.constant<Edit>({ kind: "rename" }),
  fc
    .option(fc.double({ min: 0.1, max: 2, noNaN: true }), { nil: null })
    .map((density): Edit => ({ kind: "density", density })),
  fc.constant<Edit>({ kind: "missing" }),
  fc.constant<Edit>({ kind: "deleted" }),
  fc.constant<Edit>({ kind: "portionResized" }),
  fc.constant<Edit>({ kind: "portionRemoved" }),
);

const liveFoodsAfter = (original: readonly Food[], edits: readonly Edit[]): RefreshableFoods => {
  const live = new Map<string, { food: Food; portions: readonly FoodPortion[] }>();
  original.forEach((food, index) => {
    const change = edits[index] ?? { kind: "none" };
    const slice = slicePortionOf(food);
    switch (change.kind) {
      case "none":
        live.set(food.id, { food, portions: [slice] });
        break;
      case "energy":
        live.set(food.id, { food: { ...food, kcal: change.kcal }, portions: [slice] });
        break;
      case "rename":
        live.set(food.id, { food: { ...food, name: "Renamed" }, portions: [slice] });
        break;
      case "density":
        live.set(food.id, {
          food: { ...food, density_g_per_ml: change.density },
          portions: [slice],
        });
        break;
      case "deleted":
        live.set(food.id, {
          food: { ...food, kcal: 1, deleted_at: "2026-10-16T10:00:00+00:00" },
          portions: [slice],
        });
        break;
      case "portionResized":
        live.set(food.id, { food, portions: [{ ...slice, grams: 45 }] });
        break;
      case "portionRemoved":
        live.set(food.id, { food: { ...food, kcal: 77 }, portions: [] });
        break;
      case "missing":
        break;
    }
  });
  return live;
};

const scenario = fc.record({
  foods: originalFoods,
  choices: fc.array(ingredientChoice, { minLength: 1, maxLength: 8 }),
  edits: fc.array(edit, { minLength: foodIds.length, maxLength: foodIds.length }),
  servings: fc.double({ min: 0.01, max: 1000, noNaN: true }),
  yieldGrams: fc.option(fc.double({ min: 1, max: 100000, noNaN: true }), { nil: null }),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer Value> ? Value : never;

const ingredientsOf = ({ foods, choices }: Scenario) =>
  choices.map((choice) => {
    const food = foods[choice.foodIndex];
    if (food === undefined) {
      throw new Error("The food index is out of range");
    }
    switch (choice.amount) {
      case "grams":
        return buildRecipeIngredient(food, { quantity: choice.quantity, unit: "g" });
      case "millilitres":
        return buildRecipeIngredient(food, { quantity: choice.quantity, unit: "ml" });
      case "portion":
        return buildRecipeIngredient(food, {
          quantity: choice.quantity,
          unit: "portion",
          portion: slicePortionOf(food),
        });
    }
  });

const refreshScenario = (value: Scenario) => {
  const ingredients = ingredientsOf(value);
  const foods = liveFoodsAfter(value.foods, value.edits);
  const input = { servings: value.servings, yieldGrams: value.yieldGrams };
  return {
    ingredients,
    foods,
    input,
    result: refreshRecipeIngredients({ ...input, ingredients, foods }),
  };
};

describe("refreshRecipeIngredients properties", () => {
  it("should give the same rows when refreshed twice as when refreshed once", () => {
    fc.assert(
      fc.property(scenario, (value) => {
        const { foods, input, result } = refreshScenario(value);

        const again = refreshRecipeIngredients({
          ...input,
          ingredients: result.ingredients,
          foods,
        });

        expect(again.ingredients).toStrictEqual(result.ingredients);
        expect(again.hasChanges).toBe(false);
        expect(again.after).toStrictEqual(result.after);
      }),
    );
  });

  it("should keep the order, the foods and the positions of the ingredients", () => {
    fc.assert(
      fc.property(scenario, (value) => {
        const { ingredients, result } = refreshScenario(value);

        expect(result.ingredients.map((row) => row.food_id)).toStrictEqual(
          ingredients.map((row) => row.food_id),
        );
        expect(result.changes.map((change) => change.position)).toStrictEqual(
          ingredients.map((_row, index) => index),
        );
        expect(result.changes.map((change) => change.foodId)).toStrictEqual(
          ingredients.map((row) => row.food_id),
        );
      }),
    );
  });

  it("should keep every quantity and unit, except for a portion that fell back", () => {
    fc.assert(
      fc.property(scenario, (value) => {
        const { ingredients, result } = refreshScenario(value);

        result.ingredients.forEach((row, index) => {
          const old = ingredients[index];
          const change = result.changes[index];
          if (change?.portionFellBack === true) {
            expect(old?.unit).toBe("portion");
            expect(["g", "ml"]).toContain(row.unit);
            expect(row.portion_id).toBeNull();
          } else {
            expect(row.quantity).toBe(old?.quantity);
            expect(row.unit).toBe(old?.unit);
          }
        });
      }),
    );
  });

  it("should leave an ingredient whose food is gone exactly as it was", () => {
    fc.assert(
      fc.property(scenario, (value) => {
        const { ingredients, result } = refreshScenario(value);

        result.changes.forEach((change, index) => {
          if (change.foodGone) {
            expect(result.ingredients[index]).toBe(ingredients[index]);
            expect(change.changed).toBe(false);
          }
        });
      }),
    );
  });

  it("should have an after equal to the maths of the returned ingredients, and a before of the old ones", () => {
    fc.assert(
      fc.property(scenario, (value) => {
        const { ingredients, input, result } = refreshScenario(value);

        expect(result.after).toStrictEqual(
          computeRecipe({ ...input, ingredients: result.ingredients }),
        );
        expect(result.before).toStrictEqual(computeRecipe({ ...input, ingredients }));
        expect(result.hasChanges).toBe(result.changes.some((change) => change.changed));
      }),
    );
  });

  it("should leave the recipe alone when nothing changed", () => {
    fc.assert(
      fc.property(scenario, (value) => {
        const { result } = refreshScenario(value);

        if (!result.hasChanges) {
          expect(result.after).toStrictEqual(result.before);
        }
      }),
    );
  });
});
