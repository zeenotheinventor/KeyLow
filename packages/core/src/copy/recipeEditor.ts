import { FOOD_DETAIL } from "./foodDetail";
import { FOOD_FORM, describeNameProblem } from "./foodForm";
import { FOOD_ROW } from "./foodRow";
import { PORTION_PICKER } from "./portionPicker";
import { describeServingSuffix } from "./recipeLog";
import { describeSpokenNutrients } from "./recipeWording";
import { spokenAmount } from "./spokenAmount";
import { enteredNumber } from "../diary/rules/enteredNumber";
import { formatGroupedGrams } from "../format/groupedGrams";
import { formatCalories } from "../format/numbers";
import { formatScaledCount } from "../format/scaledCount";
import {
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
  MAX_RECIPE_YIELD_GRAMS,
} from "../recipes/bounds";
import { characterCount } from "../recipes/characterCount";

import type { RecipeCard } from "../recipes/recipeCard";
import type { RecipeIngredient } from "../recipes/schemas";
import type { RecipeDraftProblem } from "../recipes/validateRecipeDraft";
import type { NullableNutrients } from "../schemas/nutrients";

/** The Per serving card's heading, which the refresh screen's card shares. */
const PER_SERVING = "Per serving";

/** The words of the recipe editor (brief 21). Its Save is `ENTRY_SCREEN.saveAction` and its Back and Close are `FOOD_FORM`'s. */
export const RECIPE_EDITOR = {
  newTitle: "New recipe",
  /** The title of the recipe view while its recipe loads or cannot be shown (brief 25). */
  loadingTitle: "Recipe",
  loadingLabel: "Loading recipe",
  namePlaceholder: "e.g. Veggie chilli",
  /** The field's label. Its suffix is `describeServingsFieldSuffix`. */
  servings: "Servings",
  cookedWeight: "Cooked weight (optional)",
  /** What a screen reader calls the cooked weight field, which shows "g" as its suffix. */
  cookedWeightName: "Cooked weight in grams, optional",
  /** The card's caption while there is nothing to work out. */
  perServingNoValue: PER_SERVING,
  /** The Per serving card as a region. */
  perServingRegionName: PER_SERVING,
  ingredients: "Ingredients",
  ingredientsEmpty: "Add the foods that go into it.",
  addIngredient: "Add ingredient",
  instructions: "Instructions",
  instructionsEmpty: "No steps yet. Add the method one step at a time.",
  reorder: "Reorder",
  /** Also the button that adds a step in the step sheet. */
  addStep: "Add step",
  /** The amount step's button while adding an ingredient. */
  addToRecipe: "Add to recipe",
  /** The amount step's button while editing an ingredient. */
  removeFromRecipe: "Remove from recipe",
  /** What sits under the offline banner's title when the connection drops while editing. */
  offlineEditingBody: "Your changes stay on this screen. Saving needs a connection.",
};

/** The titles of the amount step (the mobile sheet and the web dialog) in its ingredient mode. */
export const ADD_INGREDIENT = {
  title: "Add ingredient",
  editTitle: "Edit ingredient",
};

/** The step sheet (mobile) and the inline editor (web). Its title is `describeStepTitle`. */
export const STEP_SHEET = {
  /** Also the reorder mode's link, which replaces "Reorder" until it is pressed. */
  done: "Done",
  remove: "Remove step",
  placeholder: "Describe this step",
};

/**
 * The sentence for each way a draft can be wrong. The bounds are core's own, so a changed bound changes
 * the sentence. Name problems are `describeNameProblem`'s, and `describeRecipeProblem` reads them all.
 */
export const RECIPE_PROBLEMS = {
  servings: "Enter servings above 0.",
  servingsTooMany: `Enter ${formatScaledCount(MAX_RECIPE_SERVINGS)} servings or fewer.`,
  cookedWeight: "Enter a cooked weight above 0, or leave it blank.",
  cookedWeightTooLarge: `Enter ${formatScaledCount(MAX_RECIPE_YIELD_GRAMS)} g or less.`,
  noIngredient: "Add at least one ingredient.",
  /** The caption under the disabled Add ingredient row. */
  ingredientLimit: `Up to ${formatScaledCount(MAX_RECIPE_INGREDIENTS)} ingredients`,
  /** The caption under the disabled Add step row. */
  stepLimit: `Up to ${formatScaledCount(MAX_RECIPE_STEPS)} steps`,
  stepTooLong: `Keep a step to ${formatScaledCount(MAX_RECIPE_STEP_LENGTH)} characters or fewer.`,
  ingredientInvalid: "Check the amount of each ingredient.",
};

/** Asked when leaving the editor with unsaved changes: a bottom sheet on mobile and a dialog on web. */
export const DISCARD_SHEET = {
  editTitle: "Discard changes?",
  editBody: "Your changes to this recipe won't be saved.",
  newTitle: "Discard this recipe?",
  newBody: "It hasn't been saved yet.",
  discard: "Discard changes",
  keepEditing: "Keep editing",
};

/** The empty state of a recipe that is not there: on the mobile view and on the web editor. */
export const RECIPE_NOT_FOUND = {
  title: "Recipe not found",
  body: "Check the link, or go back to your recipes.",
};

/**
 * One sentence for each code in `RecipeDraftProblem`, so a screen needs no copy of its own. The `switch`
 * has no default, so adding a code to core is a type error here until it has a sentence.
 */
export const describeRecipeProblem = (problem: RecipeDraftProblem): string => {
  switch (problem) {
    case "name_required":
      return describeNameProblem("required");
    case "name_too_long":
      return describeNameProblem("too_long");
    case "servings_invalid":
      return RECIPE_PROBLEMS.servings;
    case "servings_too_many":
      return RECIPE_PROBLEMS.servingsTooMany;
    case "cooked_weight_invalid":
      return RECIPE_PROBLEMS.cookedWeight;
    case "cooked_weight_too_large":
      return RECIPE_PROBLEMS.cookedWeightTooLarge;
    case "ingredients_none":
      return RECIPE_PROBLEMS.noIngredient;
    case "ingredients_too_many":
      return RECIPE_PROBLEMS.ingredientLimit;
    case "ingredient_invalid":
      return RECIPE_PROBLEMS.ingredientInvalid;
    case "steps_too_many":
      return RECIPE_PROBLEMS.stepLimit;
    case "step_too_long":
      return RECIPE_PROBLEMS.stepTooLong;
  }
};

/** The suffix of the Servings field, from the text in it: "serving" when it reads 1 (or 1.0), else "servings". */
export const describeServingsFieldSuffix = (fieldText: string): string =>
  describeServingSuffix(enteredNumber(fieldText) ?? Number.NaN);

/**
 * The helper under the Cooked weight field: it says what a blank field means, with the raw total of the
 * ingredients in brackets when there are any. The total is in whole grams, as the yield line writes it.
 */
export const describeCookedWeightHelper = (
  ingredients: readonly Pick<RecipeIngredient, "resolved_grams">[],
): string => {
  const explanation = "The whole dish once cooked. Leave it blank and per 100 g uses the raw total";
  if (ingredients.length === 0) {
    return `${explanation}.`;
  }
  const totalGrams = ingredients.reduce((sum, ingredient) => sum + ingredient.resolved_grams, 0);

  return `${explanation} (${formatGroupedGrams(Math.round(totalGrams))} g).`;
};

/** The caption on the right of the Per serving card: "Per serving (275 g)". */
export const describeRecipePerServing = (servingGrams: number): string =>
  `${PER_SERVING} (${formatGroupedGrams(servingGrams)} g)`;

/**
 * The line under the card's tiles: "Per 100 g cooked: 136 kcal", or "Per 100 g raw: 208 kcal" when the
 * recipe has no cooked weight. An energy that cannot be worked out reads as the picker's en dash.
 */
export const describeRecipePer100 = (
  basis: RecipeCard["per100gBasis"],
  kcal: number | null,
): string =>
  `Per 100 g ${basis}: ${kcal === null ? PORTION_PICKER.noValue : formatCalories(kcal)} kcal`;

/**
 * What the Per serving card announces after typing stops: "374 kilocalories per serving, protein 32
 * grams, carbohydrate 43 grams, fat 8.1 grams". Without an energy it is the macros alone. A macro that
 * is not known gives the food row's review flag, in lower case after the energy: "374 kilocalories per
 * serving, needs review".
 */
export const describeRecipePerServingCard = (
  perServing: Pick<NullableNutrients, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
): string => {
  const macros = describeSpokenNutrients({ ...perServing, kcal: null });
  if (perServing.kcal === null) {
    return macros;
  }
  const energy = spokenAmount(formatCalories(perServing.kcal), "kilocalorie", "kilocalories");
  const spokenMacros = macros === FOOD_ROW.needsReview ? macros.toLowerCase() : macros;

  return `${energy} per serving, ${spokenMacros}`;
};

/** The name of an ingredient row's remove button: "Remove Onions, raw". */
export const describeRemoveIngredient = (foodName: string): string =>
  `${FOOD_FORM.remove} ${foodName}`;

/**
 * The name of an ingredient row on mobile, which opens the amount step: "Onions, raw, 1 medium (110 g),
 * change amount". The amount is the one `describeLoggedAmount` writes for the row's caption.
 */
export const describeIngredientRowName = (foodName: string, amount: string): string =>
  `${foodName}, ${amount}, change amount`;

/**
 * The name of a result row in the ingredient search, which opens the amount step: "Spinach, baby, raw, 100 g,
 * choose amount". A branded food's brand follows its name, and a food that must be reviewed says so before the
 * words that say what the row does.
 */
export const describeChooseAmountRowName = (
  foodName: string,
  serving: string,
  details: { brand?: string | undefined; needsReview?: boolean | undefined } = {},
): string =>
  [
    foodName,
    details.brand,
    serving,
    details.needsReview === true ? FOOD_ROW.needsReview : undefined,
    "choose amount",
  ]
    .filter((part) => part !== undefined)
    .join(", ");

/** The title of the step sheet, and the first words of a step's names. A step's place counts from 1. */
export const describeStepTitle = (position: number): string => `Step ${position}`;

/** The name of the step's text area: "Step 3 text". */
export const describeStepTextName = (position: number): string =>
  `${describeStepTitle(position)} text`;

/**
 * The counter under a step's text area: "201 / 1,000". Counted in code points, as the database counts
 * them, and as the step is saved (trimmed), so the counter is over the bound only when Save would refuse.
 */
export const describeStepLength = (text: string): string =>
  `${formatScaledCount(characterCount(text.trim()))} / ${formatScaledCount(MAX_RECIPE_STEP_LENGTH)}`;

/** The name of a reorder button: "Move step 1 up". */
export const describeMoveStep = (position: number, direction: "up" | "down"): string =>
  `Move step ${position} ${direction}`;

/** The polite announcement after a move: "Step moved to 1 of 5". */
export const describeStepMoved = (position: number, stepCount: number): string =>
  `Step moved to ${position} of ${stepCount}`;

/** The name of a web step's edit button: "Edit step 3". */
export const describeEditStep = (position: number): string =>
  `${FOOD_DETAIL.edit} step ${position}`;

/** The name of a web step's remove button: "Remove step 3". */
export const describeRemoveStep = (position: number): string =>
  `${FOOD_FORM.remove} step ${position}`;

/** The name of a step's row, which opens its sheet: "Step 3, Heat the oil in a large pan ... , edit". */
export const describeStepRowName = (position: number, text: string): string =>
  `${describeStepTitle(position)}, ${text}, edit`;

/**
 * The count after a section heading: " · 3". It is empty for none, which the empty boards draw without
 * one. The screen sets it apart in muted type.
 */
export const describeCountSuffix = (count: number): string => (count === 0 ? "" : ` · ${count}`);

/** A heading with its count in one string, for a name or a screen that does not style the count: "Changed · 1". */
export const describeCountedHeading = (heading: string, count: number): string =>
  `${heading}${describeCountSuffix(count)}`;

/** The sentences for what is wrong, grouped by where the editor shows them. A field has at most one. */
export type ProblemSentences = {
  name?: string | undefined;
  servings?: string | undefined;
  cookedWeight?: string | undefined;
  ingredients: string[];
};

/**
 * Sorts the codes `validateRecipeDraft` gives into the field they belong to, each with core's sentence, so
 * the web and mobile editors show the same words under the same field. The steps have no field on the
 * editor page, and a saved recipe's steps are valid, so their codes show nothing.
 */
export const problemSentences = (problems: readonly RecipeDraftProblem[]): ProblemSentences => {
  const sentences: ProblemSentences = { ingredients: [] };

  for (const problem of problems) {
    const sentence = describeRecipeProblem(problem);

    switch (problem) {
      case "name_required":
      case "name_too_long":
        sentences.name ??= sentence;
        break;
      case "servings_invalid":
      case "servings_too_many":
        sentences.servings ??= sentence;
        break;
      case "cooked_weight_invalid":
      case "cooked_weight_too_large":
        sentences.cookedWeight ??= sentence;
        break;
      case "ingredients_none":
      case "ingredients_too_many":
      case "ingredient_invalid":
        sentences.ingredients.push(sentence);
        break;
      case "steps_too_many":
      case "step_too_long":
        break;
    }
  }

  return sentences;
};
