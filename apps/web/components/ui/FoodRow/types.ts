import type { ReactNode } from "react";

/** A part of the food's name. Matched parts are the ones that match the search. */
export type FoodNameSegment = { text: string; matched: boolean };

/** The macros as written on the row, in grams, with a sentence for a screen reader. */
export type FoodRowMacros = {
  protein: string;
  carbs: string;
  fat: string;
  /** Spells the macros out, such as "protein 31 grams, fat 3.6 grams, carbohydrate 0 grams". */
  description: string;
};

/** The three macros as written on a row's stats line. The sentence for a screen reader is the row's own name. */
export type FoodRowMacroValues = Pick<FoodRowMacros, "protein" | "carbs" | "fat">;

export type FoodRowContent = {
  nameSegments: readonly FoodNameSegment[];
  brand?: string;
  /** The energy, already formatted, in kcal. */
  energy?: string;
  macros?: FoodRowMacros;
  /** What the macros are per when it is not 100 g, such as "per 100 ml". */
  basis?: string;
  /** Takes the place of the macros, such as "Energy not given". */
  note?: string;
  /** Says what is happening, such as "Adding to your foods". The row is busy while it is set. */
  busyLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** A row either goes to the food's page or runs an action, such as adding the product. */
export type FoodListRowProps = FoodRowContent &
  ({ href: string; onClick?: never } | { onClick: () => void; href?: never }) & {
    layout?: undefined;
  };

/** The food log's two rows: `stacked` is a logged food in the diary, `search` is a result in the add dialog. */
export type FoodRowLayout = "stacked" | "search";

/**
 * A food in the food log. The stats line replaces the big energy numeral on the right, and its
 * macros are always protein, carbohydrate, fat. `stacked` is a logged food: the name over the time
 * and amount, the stats line and a chevron. `search` is a result: the food icon tile, the serving,
 * the stats line and a trailing add button. Leave `layout` out for the M2 row.
 */
export type FoodLogRowProps = FoodLogRowContent &
  (
    | {
        layout: "stacked";
        /**
         * The row's own buttons, such as a recipe ingredient's Edit and Remove, stacked at its end, with the
         * row's text to the left of them. They are not part of the row's press.
         */
        actions?: ReactNode | undefined;
      }
    | { layout: Exclude<FoodRowLayout, "stacked">; actions?: never }
  );

type FoodLogRowContent = {
  nameSegments: readonly FoodNameSegment[];
  brand?: string | undefined;
  /** The energy, already formatted, in kcal. Leave it out when the food has none. */
  energy?: string | undefined;
  macros?: FoodRowMacros | undefined;
  /** The line under the name: the time and amount ("08:05 · 50 g") or the serving ("1 breast (150 g)"). It is one line. */
  caption?: string | undefined;
  /**
   * Makes a `stacked` row a logged recipe's: a chef's hat before the name, which stays on one line, and
   * this sentence as the row's name ("18:00, Chicken and rice, recipe, 1 serving 275 grams, ..."). Leave
   * it out for a food.
   */
  recipeRowName?: string | undefined;
  /** The food is missing a macro. The stats line says "Needs review" in place of the macros, and the add button gives way to a chevron. */
  needsReview?: boolean | undefined;
  /** Dims the row and stops it, and its add button, responding. */
  disabled?: boolean | undefined;
  className?: string | undefined;
  /**
   * Opens the food: the edit dialog for a `stacked` row, the portion picker for a `search` row. Leave it
   * out when there is nothing to open yet, and the row is plain text with no chevron.
   */
  onClick?: (() => void) | undefined;
  /** Logs the serving at once. Gives a `search` row its add button. Pressing it does not press the row. */
  onAdd?: (() => void) | undefined;
  /** Dims the add button and stops it responding, such as while offline, and leaves the row alone. */
  addDisabled?: boolean | undefined;
};

/**
 * The macros of a table row. A value that is null is written as a dash with no unit, such as the
 * macros of a quick add made with calories alone.
 */
export type FoodTableRowMacros = {
  protein: string | null;
  carbs: string | null;
  fat: string | null;
};

/**
 * A logged food at the wide width, one row of the diary's table: the name and the time and amount, then
 * protein, carbs, fat and energy in columns, and Edit and Delete buttons that show on hover and on focus
 * within the row. Put it inside an element with `role="table"`, under a `FoodTableHeader`.
 */
export type FoodTableRowProps = {
  layout: "table";
  nameSegments: readonly FoodNameSegment[];
  /** The line under the name: the time and amount ("08:05 · 50 g"). It is one line. */
  caption?: string | undefined;
  /** The energy, already formatted, in kcal. Leave it out for an entry that has none, and the cell is a dash. */
  energy?: string | undefined;
  /** The macros as `formatGrams` writes them. The table adds the unit. */
  macros: FoodTableRowMacros;
  /**
   * Makes the row a logged recipe's: a chef's hat before the name, which stays on one line, and this
   * sentence as the row's name ("18:00, Chicken and rice, recipe, 1 serving 275 grams, ..."). Leave it
   * out for a food and the row is named by its cells.
   */
  recipeRowName?: string | undefined;
  /** Shows the Edit button. Leave it out when there is no edit to open yet, and only Delete is drawn. */
  onEdit?: (() => void) | undefined;
  onDelete: () => void;
  /** Dims Delete and stops it responding, such as while offline. Edit is left alone. */
  deleteDisabled?: boolean | undefined;
  className?: string | undefined;
};

/**
 * A recipe in the library at the narrow width: the chef's hat tile, the name with the matched letters in
 * bold, the serving and what it makes under it, and the stats line of one serving. The whole row is a link
 * to the recipe. Put it inside a `GroupedList` or any `ul`.
 */
export type RecipeRowProps = {
  layout: "recipe";
  nameSegments: readonly FoodNameSegment[];
  /** Where the recipe opens. */
  href: string;
  /** The name of the link, with the serving, what it makes and the values read in words. */
  openLabel: string;
  /** The line under the name: "1 serving (275 g) · makes 4". It is one line. */
  caption: string;
  /** The energy of one serving, already formatted, in kcal. */
  energy?: string | undefined;
  /** The macros of one serving. Without them the stats line says "Needs review". */
  macros?: FoodRowMacroValues | undefined;
  className?: string | undefined;
};

/**
 * A recipe in the library at the wide width, one row of the table that `FoodTable` draws with its `recipe`
 * variant: the name as a link and the serving under it, then servings, protein, carbs, fat and energy, and
 * an actions cell that is empty until a screen has something to put in it.
 */
export type RecipeTableRowProps = {
  layout: "recipeTable";
  nameSegments: readonly FoodNameSegment[];
  /** Where the recipe opens. */
  href: string;
  /** The line under the name: "1 serving (275 g)". It is one line. */
  servingCaption: string;
  /** How many servings the recipe makes, already formatted. */
  servings: string;
  /** The energy of one serving, already formatted, in kcal. Leave it out for a recipe that has none, and the cell is a dash. */
  energy?: string | undefined;
  /** The macros of one serving as `formatGrams` writes them. The table adds the unit. */
  macros: FoodTableRowMacros;
  className?: string | undefined;
};

/**
 * An ingredient of a recipe at the wide width, one row of the table that `FoodTable` draws with its
 * `ingredient` variant: the food's name, the amount it is used in, then protein, carbs, fat and energy for
 * that amount, and an actions cell that is empty until a screen has something to put in it. The actions show
 * on hover and on keyboard focus within the row, and always where there is no hover, as the diary's do.
 */
export type IngredientTableRowProps = {
  layout: "ingredientTable";
  nameSegments: readonly FoodNameSegment[];
  /** The amount as the diary writes it: "100 g", "1 medium (110 g)". It is one line. */
  amount: string;
  /** The energy for the amount, already formatted, in kcal. Leave it out when there is none, and the cell is a dash. */
  energy?: string | undefined;
  /** The macros for the amount as `formatGrams` writes them. The table adds the unit. */
  macros: FoodTableRowMacros;
  /** The row's buttons, such as Edit and Remove, side by side in the last cell. Leave it out and the cell is empty. */
  actions?: ReactNode | undefined;
  className?: string | undefined;
};

export type FoodRowProps =
  | FoodListRowProps
  | FoodLogRowProps
  | FoodTableRowProps
  | RecipeRowProps
  | RecipeTableRowProps
  | IngredientTableRowProps;
