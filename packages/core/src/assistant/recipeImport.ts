import { isOurEstimate } from "../foods/estimatedPortion";
import { canMeasureByVolume, spoonPortionWithLabel } from "../nutrition";
import { canBeRecipeIngredient } from "../recipes/canBeRecipeIngredient";

import type { RecipeIngredientInput } from "../recipes";
import type { Food, FoodPortion } from "../schemas/food";

/*
 * What `import_recipe_from_url` decides about each ingredient line, in the order it decides it: which words it
 * searches the foods for, the short list of foods it offers the model to choose from, and the amount it saves.
 * The numbers are core's own, and a line that fails any of these is not counted and never invented.
 */

/**
 * The most a guessed amount can be, in grams or millilitres. A vague line ("a splash of milk" 50 ml, "salt to
 * taste" 2 g, "a handful of kale" 30 g) is a small amount, so a guess above this is cut to it and never
 * trusted to move the recipe's numbers further.
 */
export const IMPORT_GUESS_MAX_AMOUNT = 100;

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

// The first word of a name of more than one word, when it is a food word of its own: "red onion" is also a
// "red" food, and "coconut milk" is not a "coconut" food.
function leadingFoodWord(foodWord: string): string | null {
  const words = foodWord.trim().toLowerCase().split(/\s+/);
  const first = words[0] ?? "";
  return words.length > 1 &&
    first.length >= SIMPLER_WORD_MIN_CHARACTERS &&
    !FOOD_CHANGING_WORDS.has(first)
    ? first
    : null;
}

/**
 * The words to search the foods for, for a food word of a line, in the order their hits are joined: the
 * phrase, then its last word (`simplerFoodWord`), then its first word. Three at most.
 */
export function importSearchWords(foodWord: string): string[] {
  const phrase = foodWord.trim().toLowerCase().replace(/\s+/g, " ");
  if (phrase === "") {
    return [];
  }
  const words = [phrase, simplerFoodWord(phrase), leadingFoodWord(phrase)].flatMap((word) =>
    word === null ? [] : [word],
  );
  return [...new Set(words)].slice(0, IMPORT_SEARCH_WORDS_MAX);
}

/** The most foods offered to the model for one line. */
export const IMPORT_CANDIDATES_MAX = 40;

const IMPORT_SEARCH_WORDS_MAX = 3;
const CANDIDATE_NAME_MAX_CHARACTERS = 80;
const CANDIDATE_BRAND_MAX_CHARACTERS = 40;

// "potato" is also "potatos" and "potatoes", "berry" is "berries". Only the forms a name starts with matter.
function pluralFormsOf(word: string): string[] {
  return word.endsWith("y")
    ? [word, `${word}s`, `${word}es`, `${word.slice(0, -1)}ies`]
    : [word, `${word}s`, `${word}es`];
}

/** The part of a food's name before its first comma, in lower case: "Potatoes" of "Potatoes, old, raw". */
const firstPartOf = (name: string): string => (name.split(",")[0] ?? "").trim().toLowerCase();

/** The part after the first comma, in lower case: the kind ("old", "semi-skimmed", "Cheddar") or "" when there is none. */
const kindOf = (name: string): string => (name.split(",")[1] ?? "").trim().toLowerCase();

// Takes one name of each kind in turn, in the order the kinds first appear, so a kind with sixty names does not
// push out a kind with one: "Cheese, Cheddar, English" is not lost behind forty other cheeses.
function onePerKindInTurn<Food extends CandidateFood>(foods: readonly Food[]): Food[] {
  const kinds = new Map<string, Food[]>();
  for (const food of foods) {
    const kind = kindOf(food.name);
    kinds.set(kind, [...(kinds.get(kind) ?? []), food]);
  }
  const rounds = Math.max(0, ...[...kinds.values()].map((names) => names.length));
  return Array.from({ length: rounds }, (_, round) =>
    [...kinds.values()].flatMap((names) => (names[round] === undefined ? [] : [names[round]])),
  ).flat();
}

type CandidateFood = { id: string; name: string; basis: Food["basis"] };

/**
 * The foods to offer the model for a line. The lists of `importSearchWords` are joined in order and a food
 * found twice is kept once. The foods whose first part is the food word, its plural or one of its words go
 * first ("Potatoes, old, raw" for "potato", where a dish such as "Potato rings" ties with it on score), taken
 * one of each kind in turn (the part after the first comma), the rest keep their order, and the list is cut at
 * `IMPORT_CANDIDATES_MAX`. The order is only a way to put the likely foods inside the cut. The model chooses,
 * so there is no list of dish or cooking words here. A food per portion is never offered, because a recipe's
 * weight is a sum of grams.
 */
export function importFoodCandidates<Food extends CandidateFood>(
  foodWord: string,
  hitLists: readonly (readonly Food[])[],
): Food[] {
  const phrase = foodWord.trim().toLowerCase().replace(/\s+/g, " ");
  const wanted = new Set(
    [phrase, ...phrase.split(/[\s-]+/)].filter((word) => word !== "").flatMap(pluralFormsOf),
  );
  const seen = new Set<string>();
  const joined = hitLists.flat().filter((food) => {
    // A food per portion has no weight, so it cannot be an ingredient.
    if (!canBeRecipeIngredient(food)) {
      return false;
    }
    if (seen.has(food.id)) {
      return false;
    }
    seen.add(food.id);
    return true;
  });
  const [named, others] = [
    joined.filter((food) => wanted.has(firstPartOf(food.name))),
    joined.filter((food) => !wanted.has(firstPartOf(food.name))),
  ];
  return [...onePerKindInTurn(named), ...others].slice(0, IMPORT_CANDIDATES_MAX);
}

/** One food as the model reads it: its name, and whether it is the person's own food. */
export type ImportCandidate = { name: string; own: boolean };

/**
 * How a candidate food is written to the model: its name cut at 80 characters, then the brand when it has one
 * (cut at 40), and `own` for the person's own food. `own` comes from the food's source and never from the text,
 * so a product named "Potatoes (the person's own)" is not taken for one. The model never sees the food's id.
 */
export function importCandidate(food: {
  name: string;
  brand: string | null;
  source: string;
}): ImportCandidate {
  const brand = food.brand?.trim().slice(0, CANDIDATE_BRAND_MAX_CHARACTERS) ?? "";
  return {
    name: `${food.name.slice(0, CANDIDATE_NAME_MAX_CHARACTERS)}${brand === "" ? "" : ` (${brand})`}`,
    own: food.source === "user",
  };
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

type VolumeFood = Pick<
  Food,
  "basis" | "source" | "source_ref" | "food_group" | "kcal" | "density_g_per_ml"
>;
type PortionOfFood = Pick<
  FoodPortion,
  "id" | "label" | "grams" | "ml" | "is_default" | "position" | "owner_id"
>;

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
    // portions are measures ("100 g") would make "3 onions" 300 g, which is a guess and not a count. The same
    // goes for an estimate Ki-Lo generated ("1 typical serving"), which nobody chose. A portion the person
    // typed with the same words is theirs, so it is our estimate that is ruled out and not the wording.
    const things = portions.filter(
      (portion) => namesAThing(portion) && !isOurEstimate(food, portion, portions),
    );
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
