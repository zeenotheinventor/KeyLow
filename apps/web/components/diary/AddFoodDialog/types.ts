import type { AddFoodRequest } from "@/lib/foodLogActions";

export type AddFoodDialogProps = {
  /** The day to log on, and the hour when an hour's plus asked for one. */
  request: AddFoodRequest;
  /** Called to close the dialog: Cancel, Close, Escape, or after Add. */
  onClose: () => void;
};
