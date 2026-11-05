import type { MuscleSheetBodyProps } from "./MuscleSheetBody";
import type { MuscleId } from "@keylow/core/training";

export type MuscleSheetProps = Omit<MuscleSheetBodyProps, "muscle"> & {
  /** The muscle whose sheet is open, or null for a closed sheet. */
  muscle: MuscleId | null;
  onClose: () => void;
  /**
   * The element focus goes back to when the sheet closes. Without it focus returns to whatever had focus
   * when the sheet opened, which is right for a muscle opened from the figures and wrong for a row that a
   * click did not focus. Set it together with `muscle`, and leave it while the sheet is open.
   */
  returnFocusTo?: Element | undefined;
};
