import type { HighlightSegment } from "@keylow/core/search";
import type { ReactNode } from "react";

/** The macros as the row writes them, in grams, with a sentence for a screen reader. */
export type FoodRowMacros = {
  protein: string;
  carbs: string;
  fat: string;
  /** Spells the macros out, such as "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams". */
  description: string;
};

/** The M2 row has no layout of its own. The food log has these three. */
export type FoodRowLayout = "search" | "recent" | "diary" | "recipe";

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
   * tile, the time and amount, a trailing chevron and, with `onDelete`, swipe to delete. `recipe` is a
   * recipe in the library: the ChefHat tile, the serving and the yield under the title, the values of one
   * serving on the stats line, no chevron and a `trailing` slot for the row's menu. Leave it out for the
   * M2 row.
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
  /**
   * Opens the food. Leave it out when there is nothing to open yet, and the row is plain text with no
   * chevron and no press (it still swipes to delete when it has `onDelete`).
   */
  onPress?: (() => void) | undefined;
  /**
   * Names the row's button in place of the words the row writes from its parts, for a `recipe` row whose
   * screen spells the serving and the values out, such as "Chicken and rice, 1 serving 275 grams, makes 4,
   * 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open".
   */
  openLabel?: string | undefined;
  /**
   * A `recipe` row's own control at its trailing edge, beside the row and not inside it, so pressing it does
   * not press the row. The row menu ticket puts the More button here. Leave it out for none.
   */
  trailing?: ReactNode;
};
