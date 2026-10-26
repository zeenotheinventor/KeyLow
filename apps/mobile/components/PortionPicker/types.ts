import type {
  ChosenAmount,
  FoodSnapshot,
  LiveFoodPortions,
  RecipeAmount,
} from "@keylow/core/diary";
import type { SpoonPortion } from "@keylow/core/nutrition";
import type { RecipeOfSnapshot } from "@keylow/core/recipes";
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

/**
 * What the recipe's Add hands over: the amount (a number of servings, or grams of cooked weight) and the time
 * the Time row shows.
 */
export type RecipeSelection = RecipeAmount & {
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
 * The amount step of a food about to join the plate (the picker's add-to-plate mode): the page for a food
 * about to be logged, with no Time row, because the time belongs to the plate, and nothing saved. "Add to
 * plate" hands the amount over, and works offline because nothing is written. A food that must be reviewed
 * first has the review banner and Copy to your foods in place of the button, as on the add page.
 */
type PortionPickerAddToPlateProps = PortionPickerBaseProps & {
  mode: "add-to-plate";
  /** The food's own portions. The picker adds g and, for a food measured by volume, ml and the spoons. */
  portions: readonly FoodPortion[];
  /** Starts the amount at this instead of the food's default serving, such as the amount last logged. */
  initialAmount?: PortionAmount | undefined;
  /** A line under the header beside the food's source, such as "Scanned 5201054013410" or "Last logged 50 g, yesterday". */
  note?: string | undefined;
  /** The plate is being logged, so nothing more can be put on it: Add to plate is dimmed. */
  isPlateLogging?: boolean | undefined;
  /** Opens the copy form, for a food that has to be reviewed before its first log. */
  onCopy: () => void;
  onSubmit: (amount: ChosenAmount) => void;
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

/** What every page of a recipe has in common: the recipe they draw and the way back. */
type RecipePickerBaseProps = {
  /**
   * The recipe with its `computed` cache: the search hit for a recipe about to be logged (a `RecipeSummary`
   * fits), or the recipe made from an entry's own snapshot, so a logged entry never draws the live recipe.
   */
  recipe: RecipeOfSnapshot;
  onBack: () => void;
};

/** What the pages of a recipe that log it at a time have beyond the base: the Time row, and saving. */
type RecipePickerLoggingProps = RecipePickerBaseProps & {
  /** The Time row's time as `HH:mm` when the picker opens. */
  time: string;
  /** Draws Add or Save as working and stops it responding. */
  isSaving: boolean;
  /** Shows that the last Add or Save was not saved. */
  hasSaveError: boolean;
  /** False while the connection is lost: Add, Save and Delete stop responding. Defaults to true. */
  isOnline?: boolean | undefined;
  onSubmit: (selection: RecipeSelection) => void;
};

/**
 * The amount step of a recipe about to be logged (the picker's recipe mode): the recipe's name under Back, its
 * yield, what the chosen amount comes to, its values per 100 g, and at the bottom the amount, the unit chips
 * (1 serving and g), the Time row and Add. The recipe is the search hit, with its `computed` cache, so the
 * hero and the entry that is stored are worked out from the same figures. It has no food.
 */
export type RecipePortionPickerProps = RecipePickerLoggingProps & {
  mode: "recipe";
  /** The row reads "Now · 12:40" and not "12:40", until the person chooses a time. */
  isNow: boolean;
};

/**
 * The page for a logged recipe entry (the picker's edit-recipe mode): the recipe page with Save in place of
 * Add, a Delete under it, and the Time row showing the entry's own time. The recipe is made from the entry's
 * snapshot, so a recipe edited since changes nothing on it.
 */
export type RecipeEntryPickerProps = RecipePickerLoggingProps & {
  mode: "edit-recipe";
  /** What the entry was logged with, which the amount and the unit chip start on. */
  amount: RecipeAmount;
  /** A line of text under the yield line, such as the entry's note that its recipe has been archived. */
  caption?: string | undefined;
  onDelete: () => void;
};

/**
 * The amount step of a recipe about to join the plate (the picker's recipe-to-plate mode): the recipe page
 * with no Time row and nothing saved. "Add to plate" hands the amount over, and works offline.
 */
export type RecipeToPlatePickerProps = RecipePickerBaseProps & {
  mode: "recipe-to-plate";
  /** The plate is being logged, so nothing more can be put on it: Add to plate is dimmed. */
  isPlateLogging?: boolean | undefined;
  onSubmit: (amount: RecipeAmount) => void;
};

/** The pages of a food, which the picker has had since the diary was built. */
export type FoodPortionPickerProps =
  | PortionPickerAddProps
  | PortionPickerEditProps
  | PortionPickerAddIngredientProps
  | PortionPickerAddToPlateProps
  | PortionPickerEditIngredientProps;

export type PortionPickerProps =
  | FoodPortionPickerProps
  | RecipePortionPickerProps
  | RecipeEntryPickerProps
  | RecipeToPlatePickerProps;
