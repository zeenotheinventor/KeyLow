import type { Food, FoodPortion } from "@keylow/core/schemas";
import type { ReactNode } from "react";

/** An amount of a food: a count of one of its portions, or grams, or millilitres. */
export type PortionAmount =
  | { unit: "g" | "ml"; quantity: number }
  | { unit: "portion"; quantity: number; portion: FoodPortion };

/** What the picker hands over when Add is pressed: the amount and the time the Time row shows. */
export type PortionSelection = PortionAmount & {
  /** The Time row's time as `HH:mm`. */
  time: string;
  /** The row still reads "Now": the person did not choose a time, so the time is the moment the screen opened. */
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
  /** False while the connection is lost: Add, Save and Delete stop responding. Defaults to true. */
  isOnline?: boolean | undefined;
  /**
   * Draws the picker for a logged entry, which the food's own review does not apply to: Save in place of Add,
   * with this Delete under it. The food is then the entry's own snapshot, and `time` is the entry's.
   */
  onDelete?: (() => void) | undefined;
  /** A notice above the hero, such as the entry's "This food has changed" banner with its action. */
  banner?: ReactNode;
  /** A line of text above the hero, such as the entry's note that its food has been deleted. */
  caption?: string | undefined;
  onSubmit: (selection: PortionSelection) => void;
  /** Opens the copy form, for a food that has to be reviewed before its first log. A logged entry has none. */
  onCopy?: (() => void) | undefined;
  onBack: () => void;
};
