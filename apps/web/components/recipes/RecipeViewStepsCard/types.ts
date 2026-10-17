export type RecipeViewStepsCardProps = {
  /** The method, step 1 first. The card is not drawn for a recipe with no steps. */
  steps: readonly string[];
  /** Once the servings are scaled, the line that says the steps are not: "The steps are written for 4 servings." */
  servingsNote: string | null;
};
