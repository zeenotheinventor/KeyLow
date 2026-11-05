import type { WebListRowCopy } from "@keylow/core/copy";
import type { MuscleListRow } from "@keylow/core/training";

export type MuscleRowProps = {
  /** Opens the muscle's sheet, and is given the row so the sheet can return focus to it. */
  onOpen: (row: HTMLElement) => void;
} & (
  | {
      /** The muscle with its heat and ready time, from core's `muscleListGroups`. Its words are core's `describeMuscleListRow`. */
      row: MuscleListRow;
    }
  | {
      /** The words of a row on Volume or Gap, from core's `describeVolumeListRow` or `describeGapListRow`. */
      words: WebListRowCopy;
      /** The swatch's token class, written out in full (`bg-volume-growing`) so Tailwind sees it. */
      swatchClassName: string;
    }
);
