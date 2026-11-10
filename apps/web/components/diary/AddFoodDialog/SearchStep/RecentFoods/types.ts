import type { RecentFood } from "@keylow/api-client";

export type RecentFoodsProps = {
  /** Dims the plus and stops it responding, such as while the plate is being logged. */
  addDisabled: boolean;
  /** Lists only the foods a recipe can hold as an ingredient (core's `canBeRecipeIngredient`). */
  forRecipeIngredient?: boolean | undefined;
  /** A press on a row: go to the portion step at the amount it was last logged with. */
  onOpen: (food: RecentFood) => void;
  /**
   * A press on a row's plus: put the amount it was last logged with on the plate. Leave it out for rows with no
   * plus. A food that needed review when it was logged has a chevron in place of the plus, as a search result does.
   */
  onAdd?: ((food: RecentFood) => void) | undefined;
};
