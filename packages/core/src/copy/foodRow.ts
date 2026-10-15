import { FOOD_DETAIL } from "./foodDetail";
import { spokenAmount } from "./spokenAmount";

/** The words on a food row that no caller writes: the review flag and the swipe action. */
export const FOOD_ROW = {
  /** Takes the place of the macros on a food that is missing one, and must be reviewed before its first log. */
  needsReview: "Needs review",
  /** The swipe action, and the accessibility action that does the same without the gesture. */
  deleteAction: "Delete",
  /** The unit written after an energy on a row. */
  energyUnit: "kcal",
  /** The heading of the food column of the diary table. The macro columns use `FOOD_MACRO_LABELS` and the energy one `energyUnit`. */
  foodColumn: "Food",
  /** The heading of the column of Edit and Delete buttons, which is not drawn and is read out. */
  actionsColumn: "Actions",
  /** The unit written after a macro in the diary table. */
  gramUnit: "g",
  /** The amount of a food logged with its energy alone, written after the time: "12:45 · Quick add". */
  quickAdd: "Quick add",
} as const;

/** The name of a diary table row's edit button: "Edit Porridge oats". */
export const describeEditFood = (foodName: string): string => `${FOOD_DETAIL.edit} ${foodName}`;

/** The name of a diary table row's delete button: "Delete Porridge oats". */
export const describeDeleteFood = (foodName: string): string =>
  `${FOOD_ROW.deleteAction} ${foodName}`;

/** The name of a row's add button: the food and the serving it logs, such as "Add Banana, 1 medium (100 g)". */
export const describeAddFood = (foodName: string, serving?: string): string =>
  serving === undefined ? `Add ${foodName}` : `Add ${foodName}, ${serving}`;

type FoodRowStats = {
  /** The energy as `formatCalories` writes it. Leave it out for a food that has none. */
  energy?: string | undefined;
  /** The macros as `formatGrams` writes them. Leave one out, and the row says it needs review instead. */
  protein?: string | undefined;
  carbs?: string | undefined;
  fat?: string | undefined;
};

/**
 * A row's stats line read in words: the energy, then protein, carbohydrate and fat in that order,
 * with the units spelled out. A food missing a macro gets the review flag in place of the macros.
 */
export const describeFoodRowStats = ({ energy, protein, carbs, fat }: FoodRowStats): string => {
  const spokenEnergy =
    energy === undefined ? undefined : spokenAmount(energy, "kilocalorie", "kilocalories");
  const spokenMacros =
    protein === undefined || carbs === undefined || fat === undefined
      ? [FOOD_ROW.needsReview]
      : [
          `protein ${spokenAmount(protein, "gram", "grams")}`,
          `carbohydrate ${spokenAmount(carbs, "gram", "grams")}`,
          `fat ${spokenAmount(fat, "gram", "grams")}`,
        ];
  return [spokenEnergy, ...spokenMacros].filter((part) => part !== undefined).join(", ");
};
