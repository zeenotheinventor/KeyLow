export type RecipeViewStepRowProps = {
  /** The step's place in the method, from 1. */
  number: number;
  /** The whole step. It wraps, and is never cut short. */
  text: string;
};
