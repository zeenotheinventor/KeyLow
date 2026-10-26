import type { LoggableRecipe } from "../diary/recipeSnapshotQuantity";
import type { RecipeEntryUnit } from "../diary/schemas";

/** The four values a plate shows, for an amount or for one of a unit. A value a food does not give counts as 0. */
export type PlateValues = {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

/**
 * What a food on the plate is counted in: grams, millilitres, or a count of one of its portions. A portion
 * keeps its label and its size, so the row scales and is worded with no food loaded, and `portionId` is null
 * for a portion that was replaced since a Recent entry was logged.
 */
export type PlateFoodUnit =
  | { kind: "g" }
  | { kind: "ml" }
  | {
      kind: "portion";
      portionId: string | null;
      label: string;
      size: { amount: number; unit: "g" | "ml" };
    };

type PlateItemBase = {
  /** Names the row for as long as it is on the plate. A merge keeps the existing row's key. */
  key: string;
  /** What the person typed in the row's amount field. */
  quantityText: string;
  /** What the text reads as: a number above 0, or 0 while the text is empty, 0, negative or not a number. */
  quantity: number;
  /** The values for one of the unit (one gram, one millilitre, one portion, one serving), so a row scales by itself. */
  perUnit: PlateValues;
};

export type PlateFoodItem = PlateItemBase & {
  kind: "food";
  foodId: string;
  name: string;
  unit: PlateFoodUnit;
};

export type PlateRecipeItem = PlateItemBase & {
  kind: "recipe";
  /** The recipe as the search holds it, which is what logging a recipe entry is made from. */
  recipe: LoggableRecipe;
  unit: RecipeEntryUnit;
};

export type PlateItem = PlateFoodItem | PlateRecipeItem;
