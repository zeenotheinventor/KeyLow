import type { HighlightSegment } from "@keylow/core/search";

/** The macros as the row writes them, in grams, with a sentence for a screen reader. */
export type FoodRowMacros = {
  protein: string;
  carbs: string;
  fat: string;
  /** Spells the macros out, such as "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams". */
  description: string;
};

/** The M2 row has no layout of its own. The food log has these three. */
export type FoodRowLayout = "search" | "recent" | "diary";

/**
 * A food on the search and Your foods lists. Every text is given already written: the row never
 * formats an amount or matches a name, so the name comes from `highlightMatch`, the amounts from
 * `formatGrams` and `formatCalories`, and the sentence from `describeMacros`.
 */
export type FoodRowProps = {
  /** The name cut into the parts that match the search and the parts that do not. */
  nameSegments: readonly HighlightSegment[];
  brand?: string | undefined;
  /** The energy in kcal. Leave it out when the food has none. */
  energy?: string | undefined;
  macros?: FoodRowMacros | undefined;
  /** What the macros are per when it is not 100 g, such as "per 100 ml". */
  basis?: string | undefined;
  /** Takes the place of the macros, such as "Energy not given". */
  note?: string | undefined;
  /** Says what is happening, such as "Adding to your foods". The row is busy while it is set. */
  busyLabel?: string | undefined;
  /** Dims the row to half and stops it responding. A busy row is not dimmed: the rows around it are. */
  disabled?: boolean | undefined;
  /**
   * Opts into the food log's look, where the stats line replaces the big calorie numeral on the right and
   * the macros are always protein, carbohydrate, fat. `search` is a result: the food icon tile, the
   * serving and a trailing add button. `recent` is the same row as Recent draws it, with the amount last
   * logged for a serving, 56 points tall and the whole name in semibold. `diary` is a logged food: no
   * tile, the time and amount, a trailing chevron and, with `onDelete`, swipe to delete. Leave it out for
   * the M2 row.
   */
  layout?: FoodRowLayout | undefined;
  /**
   * The line under the title in the food log layouts: the serving ("1 medium (100 g)", the amount last
   * logged, or "Quick add") or, in the diary, the time and amount ("08:05 · 50 g"). It is one line.
   */
  caption?: string | undefined;
  /** The food is missing a macro. The stats line says "Needs review" in place of the macros, and the add button gives way to a chevron. */
  needsReview?: boolean | undefined;
  /** Logs the serving at once. Gives a `search` or `recent` row its add button. Pressing it does not press the row. */
  onAdd?: (() => void) | undefined;
  /** Dims the add button and stops it responding, such as while offline, and leaves the row alone. A disabled row disables its add button too. */
  addDisabled?: boolean | undefined;
  /** Makes a `diary` row delete on a swipe left and on the Delete accessibility action. It acts at once. */
  onDelete?: (() => void) | undefined;
  /** Draws a deletable `diary` row already swiped, as the swiped board does. */
  startsSwiped?: boolean | undefined;
  /**
   * Controls a deletable `diary` row: it is swiped open while this is true. A screen that keeps at most
   * one row open, and closes them on scroll, sets this on every row and follows `onSwipedChange`.
   */
  isSwiped?: boolean | undefined;
  /** Called when a swipe, a tap on the open row or the Delete action opens or closes the row. */
  onSwipedChange?: ((isSwiped: boolean) => void) | undefined;
  onPress: () => void;
};
