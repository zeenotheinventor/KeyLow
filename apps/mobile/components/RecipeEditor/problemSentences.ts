import { describeRecipeProblem } from "@keylow/core/copy";

import type { RecipeDraftProblem } from "@keylow/core/recipes";

/** The sentences for what is wrong, grouped by where the editor shows them. A field has at most one. */
export type ProblemSentences = {
  name?: string | undefined;
  servings?: string | undefined;
  cookedWeight?: string | undefined;
  ingredients: string[];
};

/**
 * Sorts the codes `validateRecipeDraft` gives into the field they belong to, each with core's sentence.
 * The steps have no field on this page: the step sheet keeps a step that cannot be stored out of the draft,
 * and a saved recipe's steps are valid, so their codes show nothing.
 */
export function problemSentences(problems: readonly RecipeDraftProblem[]): ProblemSentences {
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
}
