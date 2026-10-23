import type { MuscleSheetBodyProps } from "./MuscleSheetBody";
import type { MuscleId } from "@keylow/core/training";

export type MuscleSheetProps = Omit<MuscleSheetBodyProps, "muscle"> & {
  /** The muscle whose sheet is open, or null for a closed sheet. */
  muscle: MuscleId | null;
};
