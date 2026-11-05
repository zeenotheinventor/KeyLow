import type { MuscleListRow } from "@keylow/core/training";

export type MuscleRowProps = {
  /** The muscle with its heat and ready time, from core's `muscleListGroups`. Its words are core's `describeMuscleListRow`. */
  row: MuscleListRow;
  /** Opens the muscle's sheet, and is given the row so the sheet can return focus to it. */
  onOpen: (row: HTMLElement) => void;
};
