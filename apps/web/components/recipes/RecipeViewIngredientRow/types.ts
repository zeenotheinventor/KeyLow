export type RecipeViewIngredientRowProps = {
  /** The food's name. */
  name: string;
  /** The amount as written, such as "750 g" or "3 × 1 large (150 g)". */
  caption: string;
  /** What a screen reader reads for the row: the name, then the amount. */
  accessibleName: string;
};
