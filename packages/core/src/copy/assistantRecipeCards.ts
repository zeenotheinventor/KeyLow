import { formatCalories, formatGrams } from "../format/numbers";
import { formatScaledCount } from "../format/scaledCount";

import type { NullableNutrients } from "../schemas/nutrients";

/*
 * The words of the assistant's recipe cards, from the approved canvas "Ki-Lo assistant screens"
 * (assistant-card recipe-created, assistant confirm, assistant-settings changes). A string marked NOT ON
 * THE CANVAS is a draft in the board's style that the designers have not drawn, and waits for Zee's
 * approval.
 */

/** "4 servings", "1 serving", "2.5 servings". */
export const describeRecipeServings = (servings: number): string =>
  `${formatScaledCount(servings)} ${servings === 1 ? "serving" : "servings"}`;

/** "Added recipe Chicken and rice, 4 servings". */
export const describeRecipeCreatedTitle = (name: string, servings: number): string =>
  `Added recipe ${name}, ${describeRecipeServings(servings)}`;

/** The line under "Undone" for a created recipe: "Archived Chicken and rice". */
export const describeRecipeCreatedUndone = (name: string): string => `Archived ${name}`;

/** "Archived recipe Pasta bake", which is also the changes list's own title. */
export const describeRecipeArchivedTitle = (name: string): string => `Archived recipe ${name}`;

/** NOT ON THE CANVAS: the line under "Undone" for an archived recipe, in the words of its Restore button. */
export const describeRecipeArchivedUndone = (name: string): string => `Restored ${name}`;

/** NOT ON THE CANVAS: the card after the assistant edits a recipe. */
export const describeRecipeUpdatedTitle = (name: string): string => `Updated recipe ${name}`;

/** NOT ON THE CANVAS: the card after an edit has no Undo, as for a diary entry. */
export const RECIPE_UPDATED_NOTE = "Undo is off for changes. Edit it again in the recipe editor.";

export const OPEN_IN_RECIPE_EDITOR = "Open in recipe editor";

/** "Archived 2 recipes", NOT ON THE CANVAS: several recipe cards of one tool in a turn are one card. */
export const describeRecipesCount = (count: number): string =>
  count === 1 ? "1 recipe" : `${count} recipes`;

/**
 * "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g". A figure the recipe does not know is left out and
 * never written as 0, and null when it knows none.
 */
export const describePerServing = (
  nutrients: Pick<NullableNutrients, "kcal" | "protein_g" | "carbs_g" | "fat_g">,
): string | null => {
  const parts = [
    nutrients.kcal === null ? null : `${formatCalories(nutrients.kcal)} kcal`,
    ...(
      [
        ["P", nutrients.protein_g],
        ["C", nutrients.carbs_g],
        ["F", nutrients.fat_g],
      ] as const
    ).map(([letter, grams]) => (grams === null ? null : `${letter} ${formatGrams(grams)} g`)),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : `Per serving ${parts.join(" · ")}`;
};

/** The archive confirmation: the question is the model's own words, and these are its two buttons. */
export const CONFIRM_ARCHIVE_BUTTONS = {
  confirm: "Archive recipe",
  cancel: "Keep it",
};

/** "Archive Chicken and rice? It leaves your recipe list. Entries already logged from it stay in your diary." */
export const describeConfirmArchiveQuestion = (name: string): string =>
  `Archive ${name}? It leaves your recipe list. Entries already logged from it stay in your diary.`;
