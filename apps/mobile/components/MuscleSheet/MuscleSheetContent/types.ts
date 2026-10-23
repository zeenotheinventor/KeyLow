import type { MuscleSheetCopy } from "@keylow/core/copy";
import type { MuscleDetail } from "@keylow/core/training";

export type MuscleSheetContentProps = {
  /** The sheet's words, from `describeMuscleSheet`. */
  copy: MuscleSheetCopy;
  /** The detail the words were written from. */
  detail: MuscleDetail;
  onClose: () => void;
};
