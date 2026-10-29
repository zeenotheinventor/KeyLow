import { DIARY_LOAD_FAILED } from "./diary";
import {
  describeOneServing,
  describeSpokenGrams,
  describeSpokenNutrients,
  gramsOfOneServing,
} from "./recipeWording";
import { formatScaledCount } from "../format/scaledCount";
import { MAX_RECIPE_NAME_LENGTH } from "../recipes/bounds";

import type { RecipeServings } from "./recipeWording";
import type { RecipeComputed } from "../recipes/schemas";

/** The library screen (brief 20): the header button, the search field, the archived link and the web caption. */
export const RECIPES_LIBRARY = {
  /** The library's heading, and the name of the links back to it. */
  title: "Recipes",
  /** The name of the library's back control, which leads to More, where its row is. */
  backLabel: "Back to More",
  newRecipe: "New recipe",
  searchPlaceholder: "Search recipes",
  /** The words of the link. The count is added by `describeArchivedLink`. */
  archivedLink: "Archived recipes",
  /** The caption over the web table. */
  perServingNote: "Values per serving",
};

/** The two headings of the web table that the diary table does not have. Protein, Carbs, Fat and kcal are the diary's. */
export const RECIPES_TABLE = {
  recipe: "Recipe",
  servings: "Servings",
};

export const RECIPES_SEARCH_EMPTY = {
  title: "No recipes found",
  body: "Try another word, or create the recipe.",
};

export const RECIPES_EMPTY = {
  title: "No recipes yet",
  body: "Add the foods and the method once, then log it by the serving.",
};

/** The name of the region of skeleton rows, for a screen reader. */
export const RECIPES_LOADING_LABEL = "Loading your recipes";

/** The failed load. Its button is `RETRY_LABEL`. */
export const RECIPES_LOAD_FAILED = {
  title: "Couldn't load your recipes",
  body: DIARY_LOAD_FAILED.body,
};

/** What sits under the offline banner's title, which is `OFFLINE_BANNER.title`. */
export const RECIPES_OFFLINE = {
  body: "Recipes need a connection. They'll appear when you're back online.",
  /** For recipes loaded earlier in the session and still in memory. */
  inMemoryBody: "Showing your recipes from this session. Changes need a connection.",
};

export const ARCHIVED_RECIPES = {
  title: "Archived recipes",
  note: "Archived recipes are hidden from your list and from food search. Diary entries keep their values.",
  restore: "Restore",
  /** The empty state's title, which has no body and no action. */
  empty: "Nothing archived",
};

/**
 * The row menu on mobile and the row buttons on web, which are also the recipe view's: the view has no
 * "save first" variant, because it never has unsaved changes.
 */
export const RECIPE_ACTIONS = {
  /** Opens the refresh screen of brief 22. */
  refresh: "Refresh ingredients",
  refreshCaption: "Check your foods for changes",
  duplicate: "Duplicate",
  duplicateCaption: "Makes a copy you can change",
  archive: "Archive",
  archiveCaption: "Hidden until you restore it",
};

/**
 * The toasts of the recipe screens. Archived, duplicated and the two removals take Undo, which is
 * `UNDO_LABEL`. Saved and refreshed take no action.
 */
export const RECIPE_TOASTS = {
  archived: "Recipe archived",
  duplicated: "Recipe duplicated",
  restored: "Recipe restored",
  saved: "Recipe saved",
  ingredientRemoved: "Ingredient removed",
  stepRemoved: "Step removed",
  refreshed: "Ingredients refreshed",
};

/** What a library row reads: the servings, the weight of the dish and the values of one serving. */
type RecipeForLibraryRow = RecipeServings & {
  computed: Pick<RecipeComputed, "perServing">;
};

/** The line under a recipe's title: "1 serving (275 g) · makes 4", and "makes 1" for a one-serving recipe. */
export const describeRecipeServingCaption = (recipe: RecipeServings): string =>
  `${describeOneServing(recipe)} · makes ${formatScaledCount(recipe.servings)}`;

/**
 * The name of a library row's open control, read in words: "Chicken and rice, 1 serving 275 grams,
 * makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open".
 */
export const describeRecipeRowName = (name: string, recipe: RecipeForLibraryRow): string =>
  [
    name,
    `1 serving ${describeSpokenGrams(gramsOfOneServing(recipe))}`,
    `makes ${formatScaledCount(recipe.servings)}`,
    describeSpokenNutrients(recipe.computed.perServing),
    "open",
  ].join(", ");

/** The name of a mobile row's More button: "More for Chicken and rice". */
export const describeMoreForRecipe = (recipeName: string): string => `More for ${recipeName}`;

/** The name of an archived row's Restore button: "Restore Turkey meatballs". */
export const describeRestoreRecipe = (recipeName: string): string =>
  `${ARCHIVED_RECIPES.restore} ${recipeName}`;

/** The name of a web row's Duplicate button: "Duplicate Chicken and rice". */
export const describeDuplicateRecipe = (recipeName: string): string =>
  `${RECIPE_ACTIONS.duplicate} ${recipeName}`;

/** The name of a web row's Archive button: "Archive Chicken and rice". */
export const describeArchiveRecipe = (recipeName: string): string =>
  `${RECIPE_ACTIONS.archive} ${recipeName}`;

/** The link under the list: "Archived recipes (2)". */
export const describeArchivedLink = (archivedCount: number): string =>
  `${RECIPES_LIBRARY.archivedLink} (${archivedCount})`;

/** The name of the archived link for a screen reader: "Archived recipes, 2". */
export const describeArchivedLinkName = (archivedCount: number): string =>
  `${RECIPES_LIBRARY.archivedLink}, ${archivedCount}`;

/** The result count announced after a search: "2 recipes", "1 recipe" and "No recipes". */
export const describeRecipeCount = (count: number): string =>
  count === 0 ? "No recipes" : count === 1 ? "1 recipe" : `${count} recipes`;

const copySuffix = (copyNumber: number): string =>
  copyNumber === 1 ? " (copy)" : ` (copy ${copyNumber})`;

/** Cuts a name to a number of characters counted as the database counts them, without a space left at the cut. */
const shortenedTo = (name: string, maximumLength: number): string => {
  const characters = Array.from(name);

  return characters.length <= maximumLength
    ? name
    : characters.slice(0, maximumLength).join("").trimEnd();
};

/**
 * The name of a copy: the original's plus " (copy)", then " (copy 2)", " (copy 3)" and so on, taking the
 * first one that no recipe in the library has. A name too long for the bound gives up its own end and
 * never the suffix.
 */
export const describeDuplicateName = (
  originalName: string,
  existingNames: readonly string[],
): string => {
  for (let copyNumber = 1; ; copyNumber += 1) {
    const suffix = copySuffix(copyNumber);
    const candidate = `${shortenedTo(originalName, MAX_RECIPE_NAME_LENGTH - suffix.length)}${suffix}`;
    if (!existingNames.includes(candidate)) {
      return candidate;
    }
  }
};
