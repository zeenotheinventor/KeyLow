import { describeBasis } from "./nutrition";

import type { Food, NutrientBasis } from "../schemas/food";

/** The labels of the food detail screen, as the boards draw them. */
export const FOOD_DETAIL = {
  /** The title of a food's screen while it loads, fails to load or is not found. */
  title: "Food",
  back: "Back to foods",
  edit: "Edit",
  loading: "Loading food",
  macrosLabel: "Energy and macros",
  portions: "Portions",
  defaultPortion: "Default",
  usCarbsNote: "Carbohydrate includes fibre (US labelling convention).",
};

/** A food that failed to load. The failure itself is never shown, only this. */
export const FOOD_NOT_LOADED = {
  title: "Food not loaded",
  body: "The food could not be loaded. Try again later.",
};

export const FOOD_NOT_FOUND = {
  title: "Food not found",
  body: "This food does not exist, or you cannot see it.",
};

/** The rows of the nutrition table, in the order it draws them. */
export const FOOD_NUTRIENT_LABELS = {
  energy: "Energy",
  protein: "Protein",
  carbohydrate: "Carbohydrate",
  fat: "Fat",
  fibre: "Fibre",
};

/** The tiles of the energy card. */
export const FOOD_MACRO_LABELS = {
  protein: "Protein",
  carbs: "Carbs",
  fat: "Fat",
};

/** The heading of the nutrition table: "Nutrition per 100 g". */
export const describeNutritionHeading = (basis: NutrientBasis): string =>
  `Nutrition ${describeBasis(basis)}`;

// In the order of the nutrition table, so the sentence reads the way the table does.
const MISSING_NUTRIENT_NAMES = [
  ["kcal", "energy"],
  ["protein_g", "protein"],
  ["carbs_g", "carbohydrate"],
  ["fat_g", "fat"],
  ["fibre_g", "fibre"],
] as const;

// Written out because Hermes, which the mobile app runs on, has no `Intl.ListFormat`, and a missing
// constructor stops the whole copy module from loading. British English joins as "a, b and c".
const joinWithAnd = (names: readonly string[]): string =>
  names.length < 3
    ? names.join(" and ")
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

const capitalise = (text: string): string => `${text.charAt(0).toUpperCase()}${text.slice(1)}`;

/**
 * The body of the review banner: one sentence naming the nutrients the source does not give, and
 * what to do about it. A US label with only fibre missing says carbohydrate still includes it. With
 * no known nutrient named, a general sentence stands in.
 */
export const describeMissingValues = (
  fieldsMissing: readonly string[],
  carbsConvention: Food["quality"]["carbs_convention"],
): string => {
  const names = MISSING_NUTRIENT_NAMES.filter(([field]) => fieldsMissing.includes(field)).map(
    ([, name]) => name,
  );
  const [onlyName] = names;

  if (onlyName === undefined) {
    return "Some values are not given. Fill them in to save your own copy of this food.";
  }

  const isOnlyFibreOfAUsLabel =
    names.length === 1 && onlyName === "fibre" && carbsConvention === "us_total";
  const verb = names.length === 1 ? "is" : "are";
  const reason = isOnlyFibreOfAUsLabel ? ", so carbohydrate still includes it" : "";
  const pronoun = names.length === 1 ? "it" : "them";

  return `${capitalise(joinWithAnd(names))} ${verb} not given${reason}. Fill ${pronoun} in to save your own copy of this food.`;
};
