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
export type FoodLogRowProps = {
  layout: FoodRowLayout;
  nameSegments: readonly FoodNameSegment[];
  brand?: string | undefined;
  /** The energy, already formatted, in kcal. Leave it out when the food has none. */
  energy?: string | undefined;
  macros?: FoodRowMacros | undefined;
  /** The line under the name: the time and amount ("08:05 · 50 g") or the serving ("1 breast (150 g)"). It is one line. */
  caption?: string | undefined;
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
  /** Shows the Edit button. Leave it out when there is no edit to open yet, and only Delete is drawn. */
  onEdit?: (() => void) | undefined;
  onDelete: () => void;
  /** Dims Delete and stops it responding, such as while offline. Edit is left alone. */
  deleteDisabled?: boolean | undefined;
  className?: string | undefined;
};

export type FoodRowProps = FoodListRowProps | FoodLogRowProps | FoodTableRowProps;
