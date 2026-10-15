import type { Food, FoodPortion } from "@keylow/core/schemas";

/** An amount of a food: a count of one of its portions, or grams, or millilitres. */
export type PortionAmount =
  | { unit: "g" | "ml"; quantity: number }
  | { unit: "portion"; quantity: number; portion: FoodPortion };

/** What the picker hands over when Add is pressed: the amount and the time the Time row shows. */
export type PortionSelection = PortionAmount & {
  /** The Time row's time as `HH:mm`. */
  time: string;
  /** The row still reads "Now": the person did not choose a time, so the moment of saving is the time. */
  isNow: boolean;
};

export type PortionPickerProps = {
  food: Food;
  portions: readonly FoodPortion[];
  /** Starts the amount at this instead of the food's default serving, such as the amount last logged. */
  initialAmount?: PortionAmount | undefined;
  /** The Time row's time as `HH:mm` when the picker opens. */
  time: string;
  /** The row reads "Now · 12:40" and not "12:40", until the person chooses a time. */
  isNow: boolean;
  /** A line under the header beside the food's source, such as "Scanned 5201054013410" or "Last logged 50 g, yesterday". */
  note?: string | undefined;
  /** Draws Add as working and stops it responding. */
  isSaving: boolean;
  /** Shows that the last Add was not saved. */
  hasSaveError: boolean;
  onSubmit: (selection: PortionSelection) => void;
  /** Opens the copy form, for a food that has to be reviewed before its first log. */
  onCopy: () => void;
  onBack: () => void;
};
