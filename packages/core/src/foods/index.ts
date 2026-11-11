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
  portionsToFormFields,
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
export {
  OFF_SEARCH_EMPTY_FRESH_MS,
  OFF_SEARCH_FRESH_MS,
  OFF_SEARCH_KEEP_MS,
  OFF_SEARCH_KEEP_SECONDS,
  offSearchQueryKey,
  offSearchRowState,
  readStoredOffSearch,
} from "./offSearchStore";
export type { OffSearchRowState, StoredOffSearch } from "./offSearchStore";
export { MEASURE_ONLY_PORTION_LABEL, deriveOffPortions } from "./deriveOffPortions";
export { withDefaultPortion } from "./withDefaultPortion";
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
  isGeneratedEstimate,
  isOurEstimate,
} from "./estimatedPortion";
export type { EnergyBand, EstimateCategoryRow, EstimateSize } from "./estimatedPortion";
export { readPackSize } from "./packSize";
export type { PackSize } from "./packSize";
export { packPortion } from "./packPortion";
export { canBeCopiedToYourFoods } from "./canBeCopiedToYourFoods";
export { portionLabelOfFoodPerPortion } from "./portionLabelOfFoodPerPortion";
export { requiresConfirmation } from "./quality";
export { resolveCarbs } from "./offRules";
export { LABEL_KCAL_TOLERANCE, labelFoodInput, macroKcalOf } from "./labelFood";
export type { LabelFoodResult, LabelFoodValues } from "./labelFood";
export * from "./portionEstimate";
