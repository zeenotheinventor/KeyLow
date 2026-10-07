export type MissingValuesReviewProps = {
  foodId: string;
  /** The `quality.fields_missing` keys of the food, such as `protein_g`. */
  fieldsMissing: string[];
};
