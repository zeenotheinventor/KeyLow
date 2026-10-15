export type SkeletonVariant = "row" | "group" | "detail" | "diary";

export type SkeletonProps = {
  /**
   * What the skeleton stands in for. A `row` is one food row. A `group` is a card of rows, as a
   * grouped list draws one. A `detail` is a food's page: its name, its source and the two cards under
   * them. A `diary` is the food log: the week's seven pills, the four bars and five hours, some with a
   * food, as the loading board draws them, with the screen's sides. Defaults to `row`.
   */
  variant?: SkeletonVariant;
  /** How many rows a `group` has. Defaults to 3, as the loading board draws it. */
  rows?: number;
};
