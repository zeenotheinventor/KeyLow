export type SkeletonVariant = "row" | "group" | "detail";

export type SkeletonProps = {
  /**
   * What the skeleton stands in for. A `row` is one food row. A `group` is a card of rows, as a
   * grouped list draws one. A `detail` is a food's page: its name, its source and the two cards under
   * them. Defaults to `row`.
   */
  variant?: SkeletonVariant;
  /** How many rows a `group` has. Defaults to 3, as the loading board draws it. */
  rows?: number;
};
