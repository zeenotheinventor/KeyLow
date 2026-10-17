import { computeRecipe } from "./computeRecipe";
import { foodChangedSinceLogged, snapshotNutrientKeys } from "../diary/foodChangedSinceLogged";
import { foodEntryFields } from "../diary/foodEntryFields";
import { refreshSnapshotFromFood } from "../diary/refreshSnapshotFromFood";
import { nutrientsOfSnapshot } from "../diary/snapshotQuantity";

import type { RecipeComputed, RecipeIngredient } from "./schemas";
import type { FoodSnapshot } from "../diary/schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { Food, FoodPortion } from "../schemas/food";
import type { NullableNutrients } from "../schemas/nutrients";

/** A live food and its portions, as the refresh reads them. */
export type RefreshableFood = {
  food: Food;
  portions: readonly FoodPortion[];
};

/** The live foods by id. A food that is not in the map is treated like a soft deleted one. */
export type RefreshableFoods = ReadonlyMap<string, RefreshableFood>;

export type RefreshRecipeIngredientsInput<Ingredient extends RecipeIngredient> = {
  servings: number;
  /** The cooked weight, or null when the recipe has none. */
  yieldGrams: number | null;
  /** In the recipe's order. A stored row's own columns, such as `position`, are kept. */
  ingredients: readonly Ingredient[];
  foods: RefreshableFoods;
};

export type BeforeAndAfter<Value> = { before: Value; after: Value };

type NutrientKey = keyof NullableNutrients;

/** One per 100 value that differs. A value the food does not record is null. */
export type Per100Change = BeforeAndAfter<number | null> & { nutrient: NutrientKey };

/** How much of an ingredient there is, as the recipe lists it. `portionLabel` is set for the portion unit. */
export type IngredientAmount = {
  quantity: number;
  unit: QuantityUnit;
  portionLabel: string | null;
};

export type RecipeIngredientChange = {
  /** The ingredient's index in the recipe, which is the position the database stores. */
  position: number;
  foodId: string;
  /** True when the ingredient was rebuilt from its live food. */
  changed: boolean;
  /** True when the food is missing or soft deleted, so the ingredient was kept as it was. */
  foodGone: boolean;
  name: BeforeAndAfter<string>;
  /** The basis of the per 100 values, so a screen can head them "Per 100 g" or "Per 100 ml" and see a flip. */
  basis: BeforeAndAfter<FoodSnapshot["basis"]>;
  /** The per 100 values that differ, in a fixed order. Empty when none did. */
  per100Changes: Per100Change[];
  /** The ingredient's own calories, so for the amount in the recipe. Null when its food gives none. */
  kcal: BeforeAndAfter<number | null>;
  amount: BeforeAndAfter<IngredientAmount>;
  /** True when the portion it used is no longer on the food, so the amount became grams or millilitres. */
  portionFellBack: boolean;
};

/** The recipe's numbers per serving that the refresh screen leads with. */
export type PerServingChange = {
  kcal: BeforeAndAfter<number | null>;
  protein_g: BeforeAndAfter<number | null>;
  carbs_g: BeforeAndAfter<number | null>;
  fat_g: BeforeAndAfter<number | null>;
};

export type RefreshedRecipeIngredients<Ingredient extends RecipeIngredient> = {
  /** The new rows in the recipe's order. An ingredient that did not change is the same object as before. */
  ingredients: Ingredient[];
  before: RecipeComputed;
  after: RecipeComputed;
  perServing: PerServingChange;
  changes: RecipeIngredientChange[];
  /** True only when at least one ingredient was rebuilt. A food that is gone does not count. */
  hasChanges: boolean;
};

const per100ChangesBetween = (before: FoodSnapshot, after: FoodSnapshot): Per100Change[] =>
  snapshotNutrientKeys.flatMap((nutrient) => {
    const valueBefore = before.per100[nutrient] ?? null;
    const valueAfter = after.per100[nutrient] ?? null;
    return valueBefore === valueAfter ? [] : [{ nutrient, before: valueBefore, after: valueAfter }];
  });

const amountOf = (snapshot: FoodSnapshot): IngredientAmount => ({
  quantity: snapshot.quantity,
  unit: snapshot.unit,
  portionLabel: snapshot.portion?.label ?? null,
});

const describeChange = (
  position: number,
  before: RecipeIngredient,
  after: RecipeIngredient,
  flags: Pick<RecipeIngredientChange, "changed" | "foodGone" | "portionFellBack">,
): RecipeIngredientChange => ({
  position,
  foodId: before.food_id,
  ...flags,
  name: { before: before.snapshot.name, after: after.snapshot.name },
  basis: { before: before.snapshot.basis, after: after.snapshot.basis },
  per100Changes: per100ChangesBetween(before.snapshot, after.snapshot),
  kcal: {
    before: nutrientsOfSnapshot(before.snapshot).kcal,
    after: nutrientsOfSnapshot(after.snapshot).kcal,
  },
  amount: { before: amountOf(before.snapshot), after: amountOf(after.snapshot) },
});

const refreshIngredient = <Ingredient extends RecipeIngredient>(
  ingredient: Ingredient,
  position: number,
  live: RefreshableFood | undefined,
): { ingredient: Ingredient; change: RecipeIngredientChange } => {
  const kept = (flags: { foodGone: boolean }) => ({
    ingredient,
    change: describeChange(position, ingredient, ingredient, {
      changed: false,
      portionFellBack: false,
      ...flags,
    }),
  });
  if (live === undefined || live.food.deleted_at !== null) {
    return kept({ foodGone: true });
  }
  if (live.food.id !== ingredient.food_id) {
    throw new RangeError("The food is not the one this ingredient was added from");
  }
  if (!foodChangedSinceLogged(live.food, ingredient.snapshot)) {
    return kept({ foodGone: false });
  }
  const refreshed = refreshSnapshotFromFood(
    ingredient.snapshot,
    ingredient.portion_id,
    live.food,
    live.portions,
  );
  const { food_id, quantity, unit, portion_id, resolved_grams, snapshot } = foodEntryFields(
    refreshed.snapshot,
    refreshed.portionId,
  );
  const rebuilt: Ingredient = {
    ...ingredient,
    food_id,
    quantity,
    unit,
    portion_id,
    resolved_grams,
    snapshot,
  };
  return {
    ingredient: rebuilt,
    change: describeChange(position, ingredient, rebuilt, {
      changed: true,
      foodGone: false,
      portionFellBack: refreshed.portionFellBack,
    }),
  };
};

const beforeAndAfter = (
  before: NullableNutrients,
  after: NullableNutrients,
  nutrient: NutrientKey,
): BeforeAndAfter<number | null> => ({
  before: before[nutrient] ?? null,
  after: after[nutrient] ?? null,
});

/**
 * "Refresh ingredients": works out what a recipe's ingredients would be if each were rebuilt from its
 * live food, and the before and after of it, without changing anything. It is the only way a changed food
 * reaches a recipe (ADR 0003, Amendment 8), and the caller shows the diff before saving the new rows.
 *
 * Each ingredient is refreshed the way a diary entry is: `foodChangedSinceLogged` decides whether the
 * food differs from what the ingredient froze, and an ingredient that does is rebuilt by
 * `refreshSnapshotFromFood`, which keeps its quantity and unit, finds a portion again with
 * `matchPortionOnFood` and may land on a direct amount in grams or millilitres. An ingredient whose food
 * did not change is returned as the same object. One whose food is missing from `foods` or soft deleted is
 * kept as it was and flagged `foodGone`. A change to a portion alone does not count, as for an entry.
 *
 * Throws a `RangeError` for a food filed under another food's id, and what `computeRecipe` throws for
 * servings or a yield that is not above 0. The messages state the rule and never a name or a value.
 */
export const refreshRecipeIngredients = <Ingredient extends RecipeIngredient>(
  input: RefreshRecipeIngredientsInput<Ingredient>,
): RefreshedRecipeIngredients<Ingredient> => {
  const { servings, yieldGrams, ingredients, foods } = input;
  const before = computeRecipe({ servings, yieldGrams, ingredients });
  const refreshed = ingredients.map((ingredient, position) =>
    refreshIngredient(ingredient, position, foods.get(ingredient.food_id)),
  );
  const newIngredients = refreshed.map((row) => row.ingredient);
  const after = computeRecipe({ servings, yieldGrams, ingredients: newIngredients });
  const changes = refreshed.map((row) => row.change);

  return {
    ingredients: newIngredients,
    before,
    after,
    perServing: {
      kcal: beforeAndAfter(before.perServing, after.perServing, "kcal"),
      protein_g: beforeAndAfter(before.perServing, after.perServing, "protein_g"),
      carbs_g: beforeAndAfter(before.perServing, after.perServing, "carbs_g"),
      fat_g: beforeAndAfter(before.perServing, after.perServing, "fat_g"),
    },
    changes,
    hasChanges: changes.some((change) => change.changed),
  };
};
