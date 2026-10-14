import { CustomFoodValidationError, FoodsPartialWriteError } from "@keylow/api-client";
import { FOOD_FORM } from "@keylow/core/copy";

import type { SaveNotice } from "./types";

/** A title and a sentence for a failed save, never the raw error. The partial save is the one a review notice draws. */
export function describeSaveError(error: unknown): SaveNotice {
  if (error instanceof FoodsPartialWriteError) {
    return { variant: "review", ...FOOD_FORM.portionsNotSavedNotice };
  }
  if (error instanceof CustomFoodValidationError) {
    return { variant: "error", ...FOOD_FORM.detailsNotValidNotice };
  }
  return { variant: "error", ...FOOD_FORM.saveFailedNotice };
}
