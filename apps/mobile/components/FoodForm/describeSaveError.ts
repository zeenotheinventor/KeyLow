import { CustomFoodValidationError, FoodsPartialWriteError } from "@keylow/api-client";

/** A plain sentence for a failed save, never the raw error. */
export function describeSaveError(error: unknown): string {
  if (error instanceof FoodsPartialWriteError) {
    return "Your food was saved but its portions were not. Edit the food to add them again.";
  }
  if (error instanceof CustomFoodValidationError) {
    return "Some details are not valid. Check the fields and try again.";
  }
  return "Your food could not be saved. Check your connection and try again.";
}
