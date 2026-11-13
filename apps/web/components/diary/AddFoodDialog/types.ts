import type { AddFoodRequest } from "@/lib/foodLogActions";
import type { DescribeInLogOpening } from "@keylow/core";

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
  /**
   * Called with the day and time being logged when the person describes a meal to the assistant, which opens
   * in the dialog's place. With food on the plate it is called once the plate is discarded. Without it the
   * dialog has no Describe row.
   */
  onDescribe?: ((opening: DescribeInLogOpening) => void) | undefined;
};
