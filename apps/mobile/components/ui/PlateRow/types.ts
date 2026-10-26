import type { FoodRowMacros } from "../FoodRow";

/**
 * One food or recipe on the plate, in the "Your plate" sheet's list. Every text is given already written,
 * as a `FoodRow`'s are: the row formats no amount, so `energy` comes from `formatCalories`, the macros from
 * `formatGrams`, and the unit words from the plate's unit words in core.
 */
export type PlateRowProps = {
  name: string;
  /** Writes "Recipe" under the name. */
  isRecipe?: boolean | undefined;
  /** The energy of the amount on the row, in kcal. */
  energy: string;
  /** The macros of the amount on the row. Only `protein`, `carbs` and `fat` are read: the row is named by its energy alone. */
  macros: FoodRowMacros;
  /** What the amount field reads. It may be empty or not above 0, which the caller shows with `error`. */
  amountText: string;
  /** The word after the amount, in the singular for exactly 1: "serving", "pot", "medium", "ml". */
  unitWord: string;
  /** The plural of the unit word: "servings", "pots", "ml". It names the amount field. */
  unitsWord: string;
  onAmountChange: (text: string) => void;
  /**
   * Opens the food to change the amount or the unit. Pressing the name does it. Leave it out where the unit
   * cannot be changed yet, and the name and its stats are plain text: no button, and no dimming.
   */
  onOpen?: (() => void) | undefined;
  onRemove: () => void;
  /** With `onOpen`, dims the name to 40 percent and stops it responding, such as offline, when the unit change needs the food's portions. The field and the X still work. */
  isOpenDisabled?: boolean | undefined;
  /** Dims the whole row to 40 percent and stops every control responding, while the plate is being logged. */
  disabled?: boolean | undefined;
  /** Puts the focus in the amount field when the row appears, as the `plate · edit-amount` board draws it. */
  autoFocus?: boolean | undefined;
  /** What is wrong with the amount, such as "Enter an amount above 0.". It is drawn under the row, across its width. */
  error?: string | undefined;
};
