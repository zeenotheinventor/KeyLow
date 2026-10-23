export { DATA_SOURCE_ATTRIBUTION } from "./attribution";
export { normaliseBarcode } from "./barcode";
export type { BarcodeInvalidReason, BarcodeSymbology, NormaliseBarcodeResult } from "./barcode";
export { FORM_NUTRIENTS, classifyCustomFoodIssues } from "./customFoodProblems";
export type {
  ClassifiableValues,
  CustomFoodIssue,
  CustomFoodProblem,
  FormNutrient,
} from "./customFoodProblems";
export { carriedNutrients, withCarriedNutrients } from "./carriedNutrients";
export type { CarriedNutrients } from "./carriedNutrients";
export {
  REQUIRED_FOOD_NUTRIENTS,
  amountUnit,
  copyFormStart,
  customFoodInputFrom,
  foodToFormFields,
  parseFormNumber,
  portionAmountKey,
  portionToFormFields,
} from "./foodForm";
export type {
  CopyFormStart,
  FoodFormFields,
  FoodFormFieldsWithPortions,
  PortionFormFields,
  RequiredFoodNutrient,
} from "./foodForm";
export { isFoodId } from "./isFoodId";
export { OFF_FRESHNESS_MS, offFreshness } from "./freshness";
export type { OffFreshness } from "./freshness";
export { normaliseOffCandidate, normaliseOffProduct, offProductPayloadSchema } from "./off";
export type { NormaliseOffResult, OffFoodInput, OffPortionInput, OffProductPayload } from "./off";
export { readPackSize } from "./packSize";
export type { PackSize } from "./packSize";
export { requiresConfirmation } from "./quality";
