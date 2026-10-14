export {
  AUTH_FIELD_PROBLEMS,
  CHECK_EMAIL_TITLE,
  PASSWORD_HELPER,
  SIGN_IN_LINK_INVALID,
  SIGN_IN_LINK_NOT_VERIFIED,
  SIGN_IN_REFUSED,
  describeAuthError,
  describeCheckEmail,
} from "./auth";
export {
  BARCODE_LOOKUP_FAILED,
  BARCODE_LOOKUP_PROGRESS,
  BARCODE_NOT_FOUND,
  BARCODE_NOT_RECOGNISED_TITLE,
  SCANNED_BARCODE_PROBLEMS,
  TYPED_BARCODE_PROBLEMS,
  describeBarcodeRateLimit,
} from "./barcode";
export { GENERIC_ERROR, describeEdgeError, describeRateLimit } from "./errors";
export {
  FOOD_FORM,
  FOOD_FORM_BARCODE_NOT_VALID,
  FOOD_FORM_BARCODE_PROBLEMS,
  FOOD_FORM_BUTTONS,
  FOOD_REVIEW_BANNER,
  describeAmountUnitNote,
  describeNameProblem,
  describeNutrientProblem,
  describePortionAmountField,
  describePortionField,
  describePortionAmountProblem,
  describePortionLabelAndAmountProblem,
  describePortionLabelProblem,
} from "./foodForm";
export type { FoodFormNutrient, NutrientProblem } from "./foodForm";
export {
  FOOD_DETAIL,
  FOOD_MACRO_LABELS,
  FOOD_NOT_FOUND,
  FOOD_NOT_LOADED,
  FOOD_NUTRIENT_LABELS,
  describeMissingValues,
  describeNutritionHeading,
} from "./foodDetail";
export { describeFoodSource } from "./foodSources";
export {
  ENERGY_NOT_GIVEN,
  NOT_GIVEN,
  SHARES_OF_ENERGY_ARE_ESTIMATES,
  VALUES_PER_100_G_NOTE,
  describeBasis,
  describeEnergy,
  describeShareOfEnergy,
  describeSpokenBasis,
} from "./nutrition";
export {
  ADD_PRODUCT_FAILED,
  ADD_PRODUCT_NOT_FOUND,
  OPEN_FOOD_FACTS_BUSY,
  OPEN_FOOD_FACTS_SEARCH_FAILED,
  SEARCH_EMPTY,
  SEARCH_FAILED_MOBILE,
  SEARCH_FAILED_WEB,
  SEARCH_GROUP_HEADINGS,
  SEARCH_IDLE,
  SEARCH_STATUS,
  YOUR_FOODS_EMPTY,
  describeSeeMore,
} from "./search";
export type { SearchGroupKey } from "./search";
export {
  ADD_FOOD_BUTTON_LABEL,
  COMING_SOON_TITLE,
  PLACEHOLDER_BODIES,
  SEARCH_LAUNCHER,
  TAB_BAR_LABEL,
  TAB_TITLES,
} from "./shell";
