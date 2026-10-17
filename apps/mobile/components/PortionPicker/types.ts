import type { ChosenAmount, FoodSnapshot, LiveFoodPortions } from "@keylow/core/diary";
import type { SpoonPortion } from "@keylow/core/nutrition";
import type { Food, FoodPortion } from "@keylow/core/schemas";
import type { ReactNode } from "react";

/** An amount of a food: a count of one of its portions, or grams, or millilitres. Core's, so the picker and its preview agree. */
export type PortionAmount = ChosenAmount<FoodPortion | SpoonPortion>;

/**
 * What the picker hands over when Add is pressed: the amount and the time the Time row shows. A portion is
 * one of the food's own, one of the spoons, or, on the entry screen, the portion the entry was logged with.
 */
export type PortionSelection = ChosenAmount & {
  /** The Time row's time as `HH:mm`. */
  time: string;
  /** The row still reads "Now": the person did not choose a time, so the time is the moment the screen opened. */
  isNow: boolean;
};

type PortionPickerBaseProps = {
  food: Food;
  onBack: () => void;
};

/** What the pages that log a food at a time have beyond the base: the Time row, and saving. */
type PortionPickerLoggingProps = PortionPickerBaseProps & {
  /** The Time row's time as `HH:mm` when the picker opens. */
  time: string;
  /** The row reads "Now · 12:40" and not "12:40", until the person chooses a time. */
  isNow: boolean;
  /** A line under the header beside the food's source, such as "Scanned 5201054013410" or "Last logged 50 g, yesterday". */
  note?: string | undefined;
  /** Draws Add or Save as working and stops it responding. */
  isSaving: boolean;
  /** Shows that the last Add or Save was not saved. */
  hasSaveError: boolean;
  /** False while the connection is lost: Add, Save and Delete stop responding. Defaults to true. */
  isOnline?: boolean | undefined;
  onSubmit: (selection: PortionSelection) => void;
};

/** The page for a food that is about to be logged: Add, or Copy to your foods for a food that must be reviewed first. */
type PortionPickerAddProps = PortionPickerLoggingProps & {
  mode: "add";
  /** The food's own portions. The picker adds g and, for a food measured by volume, ml and the spoons. */
  portions: readonly FoodPortion[];
  /** Starts the amount at this instead of the food's default serving, such as the amount last logged. */
  initialAmount?: PortionAmount | undefined;
  /** Opens the copy form, for a food that has to be reviewed before its first log. */
  onCopy: () => void;
};

/**
 * The page for a logged entry, which the food's own review does not apply to: Save in place of Add, with a
 * Delete under it. The food is the entry's own snapshot, and `time` is the entry's. The amount and the hero
 * work from `snapshot`, so a change to the live food never reaches them; the live food only decides which
 * portions the chips offer.
 */
type PortionPickerEditProps = PortionPickerLoggingProps & {
  mode: "edit";
  /** What the entry was logged with. */
  snapshot: FoodSnapshot;
  /**
   * The food's portions as they are now, so the chips offer them beside the one the entry was logged with.
   * Leave it out while they are not known, or when the food is deleted or cannot be read: the chips are then
   * the entry's own.
   */
  livePortions?: LiveFoodPortions | undefined;
  onDelete: () => void;
  /** A notice above the hero, such as the entry's "This food has changed" banner with its action. */
  banner?: ReactNode;
  /** A line of text above the hero, such as the entry's note that its food has been deleted. */
  caption?: string | undefined;
};

/**
 * The amount step of an ingredient already in a recipe (the picker's ingredient mode): the same page as a
 * logged entry's, from the ingredient's own snapshot, with no Time row and nothing saved. Save hands the
 * amount over, and "Remove from recipe" sits under it in place of Delete. Both work offline, because they
 * change the recipe's draft and not the database.
 */
type PortionPickerEditIngredientProps = PortionPickerBaseProps & {
  mode: "edit-ingredient";
  /** What the ingredient was added with. */
  snapshot: FoodSnapshot;
  /** The food's portions as they are now, as for a logged entry. Leave it out while they are not known. */
  livePortions?: LiveFoodPortions | undefined;
  onSubmit: (amount: ChosenAmount) => void;
  onRemove: () => void;
};

/**
 * The amount step of a food about to join a recipe (the picker's add-ingredient mode): the page for a food
 * about to be logged, from the food as it is now, with no Time row and nothing saved. "Add to recipe" hands
 * the amount over. A food that must be reviewed first shows the review banner and cannot be added, and offers
 * no Copy to your foods: that form would take the person away from the recipe, whose draft is unsaved.
 */
type PortionPickerAddIngredientProps = PortionPickerBaseProps & {
  mode: "add-ingredient";
  /** The food's own portions. The picker adds g and, for a food measured by volume, ml and the spoons. */
  portions: readonly FoodPortion[];
  /** Starts the amount at this instead of the food's default serving, such as the amount last logged. */
  initialAmount?: PortionAmount | undefined;
  onSubmit: (amount: ChosenAmount) => void;
};

export type PortionPickerProps =
  | PortionPickerAddProps
  | PortionPickerEditProps
  | PortionPickerAddIngredientProps
  | PortionPickerEditIngredientProps;
