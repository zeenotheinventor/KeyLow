import { canMeasureByVolume, spoonPortionWithLabel } from "../nutrition";

import type { RecipeIngredientInput } from "../recipes";
import type { Food, FoodPortion } from "../schemas/food";

/*
 * What `import_recipe_from_url` decides about each ingredient line, in the order it decides it: which hit of
 * the food search it takes, the simpler word it tries when the search found nothing, and the amount it saves.
 * The numbers are core's own, and a line that fails any of these is not counted and never invented.
 */

/**
 * The lowest `search_foods` score the import takes as the food of a line. The score is the search's own
 * (full text rank, trigram similarity and boosts). On the local stack with the full CoFID import, a food that
 * has every word of the query scored 1.8 to 2.3 ("olive oil" 2.189, "double cream" 1.818, "mascarpone"
 * 2.009), and a food found only by trigram similarity scored 1.2 or less ("red onion" 0.8, "cornflour"
 * 0.9, "plain flour" 1.179). The cut sits between the two. If the search's weights change, measure again.
 */
export const IMPORT_MATCH_MIN_SCORE = 1.5;

/**
 * The most a guessed amount can be, in grams or millilitres. A vague line ("a splash of milk" 50 ml, "salt to
 * taste" 2 g, "a handful of kale" 30 g) is a small amount, so a guess above this is cut to it and never
 * trusted to move the recipe's numbers further.
 */
export const IMPORT_GUESS_MAX_AMOUNT = 100;

export const isConfidentFoodMatch = (score: number): boolean => score >= IMPORT_MATCH_MIN_SCORE;

// A word shorter than this is not a food word ("red ox" has nothing simpler to try).
const SIMPLER_WORD_MIN_CHARACTERS = 3;

// Words that make the food a different one, so a line with one of them is never searched again without it:
// "coconut milk" is not milk, "peanut butter" is not butter, "cream cheese" is not cheese and "sweet
// potatoes" are not potatoes. A modifier that only makes the same food more precise ("semi skimmed",
// "plain", "whole", "baby") is not here.
const FOOD_CHANGING_WORDS: ReadonlySet<string> = new Set([
  "coconut",
  "almond",
  "soy",
  "soya",
  "oat",
  "rice",
  "peanut",
  "cashew",
  "hazelnut",
  "cream",
  "sweet",
  "tomato",
]);

/**
 * A simpler form of a food word to search again: its last word, the head noun ("semi skimmed milk" is
 * "milk", "plain flour" is "flour"). Null when there is nothing simpler, and when a word that would be
 * dropped makes it a different food (`FOOD_CHANGING_WORDS`), so that line is not counted and never counted
 * as the wrong food.
 */
export function simplerFoodWord(foodWord: string): string | null {
  const words = foodWord.trim().toLowerCase().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  const dropped = words.slice(0, -1);
  return words.length > 1 &&
    last.length >= SIMPLER_WORD_MIN_CHARACTERS &&
    !dropped.some((word) => FOOD_CHANGING_WORDS.has(word))
    ? last
    : null;
}

/** What the parse read of a line's amount. */
export type ImportedLineMeasure = {
  quantity: number | null;
  unit: string | null;
  /** A guess for a line with no quantity, in the unit of `guessUnit`. */
  guessAmount: number | null;
  guessUnit: "g" | "ml" | null;
};

/** The amount to build the ingredient with, and the guess it came from when the page gave no quantity. */
export type ImportedAmount = {
  input: Pick<RecipeIngredientInput, "quantity" | "unit" | "portion">;
  guess: { amount: number; unit: "g" | "ml" } | null;
};

type VolumeFood = Pick<Food, "basis" | "source" | "source_ref" | "food_group" | "density_g_per_ml">;
type PortionOfFood = Pick<FoodPortion, "id" | "label" | "grams" | "ml" | "is_default" | "position">;

// How each unit a page writes is saved. A spoon or a cup is the app's own spoon portion.
type UnitRule =
  | { kind: "convert"; unit: "g" | "ml" | "oz" | "fl_oz"; factor: number }
  | { kind: "spoon"; label: string };

const unitRules: Readonly<Record<string, UnitRule>> = {
  g: { kind: "convert", unit: "g", factor: 1 },
  gram: { kind: "convert", unit: "g", factor: 1 },
  grams: { kind: "convert", unit: "g", factor: 1 },
  kg: { kind: "convert", unit: "g", factor: 1000 },
  kilogram: { kind: "convert", unit: "g", factor: 1000 },
  kilograms: { kind: "convert", unit: "g", factor: 1000 },
  oz: { kind: "convert", unit: "oz", factor: 1 },
  ounce: { kind: "convert", unit: "oz", factor: 1 },
  ounces: { kind: "convert", unit: "oz", factor: 1 },
  lb: { kind: "convert", unit: "oz", factor: 16 },
  lbs: { kind: "convert", unit: "oz", factor: 16 },
  pound: { kind: "convert", unit: "oz", factor: 16 },
  pounds: { kind: "convert", unit: "oz", factor: 16 },
  ml: { kind: "convert", unit: "ml", factor: 1 },
  millilitre: { kind: "convert", unit: "ml", factor: 1 },
  millilitres: { kind: "convert", unit: "ml", factor: 1 },
  l: { kind: "convert", unit: "ml", factor: 1000 },
  litre: { kind: "convert", unit: "ml", factor: 1000 },
  litres: { kind: "convert", unit: "ml", factor: 1000 },
  "fl oz": { kind: "convert", unit: "fl_oz", factor: 1 },
  tsp: { kind: "spoon", label: "1 tsp" },
  teaspoon: { kind: "spoon", label: "1 tsp" },
  teaspoons: { kind: "spoon", label: "1 tsp" },
  tbsp: { kind: "spoon", label: "1 tbsp" },
  tablespoon: { kind: "spoon", label: "1 tbsp" },
  tablespoons: { kind: "spoon", label: "1 tbsp" },
  cup: { kind: "spoon", label: "1 cup" },
  cups: { kind: "spoon", label: "1 cup" },
};

const isUsable = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value > 0;

// A portion label that is a measure and not a thing: "100 g", "1 cup", "2 tbsp". The label is read without its
// leading number, and what is left is a unit or nothing.
const MEASURE_LABEL =
  /^[\d\s./½¼¾-]*(?:g|grams?|kg|mg|ml|l|litres?|oz|ounces?|lbs?|fl\.? ?oz|cups?|tbsp|tsp|tablespoons?|teaspoons?)?\.?$/i;

const namesAThing = (portion: PortionOfFood): boolean => !MEASURE_LABEL.test(portion.label.trim());

function measuredBy(
  quantity: number,
  unit: string | null,
  food: VolumeFood,
  portions: readonly PortionOfFood[],
): ImportedAmount["input"] | null {
  if (unit === null || unit.trim() === "") {
    // A count ("4 garlic cloves", "1 lemon") is a count of a portion that names the thing. A food whose only
    // portions are measures ("100 g") would make "3 onions" 300 g, which is a guess and not a count.
    const things = portions.filter(namesAThing);
    const own =
      things.find((candidate) => candidate.is_default) ??
      [...things].sort((first, second) => first.position - second.position)[0];
    return own === undefined ? null : { quantity, unit: "portion", portion: own };
  }
  const rule = unitRules[unit.trim().toLowerCase().replace(/\.$/, "")];
  if (rule === undefined) {
    return null;
  }
  if (rule.kind === "spoon") {
    const spoon = spoonPortionWithLabel(rule.label);
    return spoon !== undefined && canMeasureByVolume(food, portions)
      ? { quantity, unit: "portion", portion: spoon }
      : null;
  }
  const isVolume = rule.unit === "ml" || rule.unit === "fl_oz";
  return isVolume && !canMeasureByVolume(food, portions)
    ? null
    : { quantity: quantity * rule.factor, unit: rule.unit };
}

/**
 * The amount an imported line is saved with, or null when the line cannot be counted: a count of a food with
 * no portion that names the thing, a unit that cannot convert, a volume of a food with no density (it would be saved as grams), or
 * no quantity and no usable guess. A quantity is measured as the page wrote it. Without a quantity, the guess
 * stands in, cut to `IMPORT_GUESS_MAX_AMOUNT`, and the answer says so in `guess`.
 */
export function importedAmountOf(
  measure: ImportedLineMeasure,
  food: VolumeFood,
  portions: readonly PortionOfFood[],
): ImportedAmount | null {
  if (isUsable(measure.quantity)) {
    const input = measuredBy(measure.quantity, measure.unit, food, portions);
    return input === null ? null : { input, guess: null };
  }
  if (!isUsable(measure.guessAmount) || measure.guessUnit === null) {
    return null;
  }
  if (measure.guessUnit === "ml" && !canMeasureByVolume(food, portions)) {
    return null;
  }
  const amount = Math.min(measure.guessAmount, IMPORT_GUESS_MAX_AMOUNT);
  return {
    input: { quantity: amount, unit: measure.guessUnit },
    guess: { amount, unit: measure.guessUnit },
  };
}
