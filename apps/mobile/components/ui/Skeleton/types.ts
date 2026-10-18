export type SkeletonVariant =
  | "row"
  | "group"
  | "recipeGroup"
  | "entryGroup"
  | "recipeView"
  | "recipeRefresh"
  | "detail"
  | "diary"
  | "diaryDay"
  | "nutritionCard"
  | "thisWeekCard"
  | "bodyMapCard"
  | "trainHome";

export type SkeletonProps = {
  /**
   * What the skeleton stands in for. A `row` is one food row. A `group` is a card of rows, as a
   * grouped list draws one. A `recipeGroup` is a card of rows as the recipe library's loading board draws them: a tile, a title and a shorter caption, 80 points tall and with no value at the end. An `entryGroup` is a card of rows as the entry screen's loading board draws them: a name over a shorter line, 64 points tall, with no tile and no value. A `recipeView` is the recipe view's page as its loading board draws it: the Per serving card and the Servings card as blocks, then a card of three rows, with the screen's sides given by the screen. A `recipeRefresh` is the refresh screen as its loading board draws it: an intro line, the Per serving card as a heading over four lines of a label and a value, and two cards, with the screen's sides given by the screen. A `detail` is a food's page: its name, its source and the two cards under
   * them. A `diary` is the food log: the week's seven pills, the four bars and five hours, some with a
   * food, as the loading board draws them, with the screen's sides. A `diaryDay` is the same without the week, for a day that loads under a week
   * strip that is already on screen. A `nutritionCard` is the dashboard's card as its loading board draws it: a title, the ring, three bar rows and a caption. A `thisWeekCard` is the dashboard's This week card as its loading board draws it: a title, a value line, the bar, a caption and seven small circles. A `bodyMapCard` is the dashboard's body map card as it loads: a title and a view line, two figures and the legend, and two lines under a hairline. A `trainHome` is the Train home as its loading board draws it: the Today card as three lines and a button, the body map as two figures, and the week as seven cells, with the screen's sides given by the screen. Defaults to `row`.
   */
  variant?: SkeletonVariant;
  /** How many rows a `group`, a `recipeGroup` or an `entryGroup` has. Defaults to 3, as the loading board draws it. */
  rows?: number;
};
