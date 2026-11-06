import type { AddFoodRequest } from "@/lib/foodLogActions";

export type AddFoodDialogProps = {
  /** The day to log on, and the hour when an hour's plus asked for one. */
  request: AddFoodRequest;
  /**
   * The control the first dialog was opened from, which focus goes back to when this one closes. It is the
   * diary's hour plus, Edit button or the top bar's search, and not whatever was focused inside a dialog before.
   */
  opener: Element | null;
  /** Called to close the dialog: Discard, or after the plate was logged. */
  onClose: () => void;
  /**
   * Called with whether the dialog holds food on its plate, so the page that owns it does not close it under the
   * person when the page changes, such as with the browser's Back. It is called with false when the dialog goes.
   */
  onHoldsPlateChange?: ((holdsPlate: boolean) => void) | undefined;
};
