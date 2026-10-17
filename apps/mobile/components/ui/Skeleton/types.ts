export type SkeletonVariant =
  "row" | "group" | "detail" | "diary" | "diaryDay" | "nutritionCard" | "thisWeekCard";

export type SkeletonProps = {
  /**
   * What the skeleton stands in for. A `row` is one food row. A `group` is a card of rows, as a
   * grouped list draws one. A `detail` is a food's page: its name, its source and the two cards under
   * them. A `diary` is the food log: the week's seven pills, the four bars and five hours, some with a
   * food, as the loading board draws them, with the screen's sides. A `diaryDay` is the same without the week, for a day that loads under a week
   * strip that is already on screen. A `nutritionCard` is the dashboard's card as its loading board draws it: a title, the ring, three bar rows and a caption. A `thisWeekCard` is the dashboard's This week card as its loading board draws it: a title, a value line, the bar, a caption and seven small circles. Defaults to `row`.
   */
  variant?: SkeletonVariant;
  /** How many rows a `group` has. Defaults to 3, as the loading board draws it. */
  rows?: number;
};
