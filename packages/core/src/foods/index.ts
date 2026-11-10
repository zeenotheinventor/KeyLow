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
export { MAX_FAVOURITES } from "./favourites";
export { isFoodId } from "./isFoodId";
export {
  OFF_FRESHNESS_MS,
  OFF_PORTION_RULES_FROM,
  isBeforePortionRules,
  offFreshness,
} from "./freshness";
export type { OffFreshness } from "./freshness";
export { normaliseOffCandidate, normaliseOffProduct, offProductPayloadSchema } from "./off";
export type { NormaliseOffResult, OffFoodInput, OffPortionInput, OffProductPayload } from "./off";
export {
  OFF_SEARCH_FIELDS,
  buildOffSearchQuery,
  normaliseOffSearchHit,
  normaliseOffSearchTerms,
} from "./offSearchHit";
export { deriveOffPortions } from "./deriveOffPortions";
export { NATURAL_UNIT_PROCESSED_TAGS, NATURAL_UNIT_TYPES, naturalUnitsFor } from "./naturalUnits";
export type { NaturalUnitPortion, NaturalUnitType } from "./naturalUnits";
export {
  ESTIMATE_CATEGORY_ROWS,
  ESTIMATE_DRY_KCAL_PER_100,
  ESTIMATE_ENERGY_BANDS_PER_100G,
  ESTIMATE_ENERGY_BANDS_PER_100ML,
  ESTIMATE_GENERIC_NOUN,
  ESTIMATE_UNKNOWN_ENERGY_SIZE,
  estimatedPortion,
  estimatedPortionLabel,
  isEstimatedPortion,
} from "./estimatedPortion";
export type { EnergyBand, EstimateCategoryRow, EstimateSize } from "./estimatedPortion";
export { readPackSize } from "./packSize";
export type { PackSize } from "./packSize";
export { packPortion } from "./packPortion";
export { requiresConfirmation } from "./quality";
export { resolveCarbs } from "./offRules";
export { LABEL_KCAL_TOLERANCE, labelFoodInput, macroKcalOf } from "./labelFood";
export type { LabelFoodResult, LabelFoodValues } from "./labelFood";
