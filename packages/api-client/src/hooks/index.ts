// TanStack Query hooks over the repos land here from M2 onward.
export { useCreateFood } from "./useCreateFood";
export { useFood } from "./useFood";
export { useFoodByBarcode } from "./useFoodByBarcode";
export type {
  FoodByBarcodeError,
  FoodByBarcodeLookup,
  FoodByBarcodeResult,
  UseFoodByBarcodeOptions,
  UseFoodByBarcodeReturn,
} from "./useFoodByBarcode";
export { useFoodPortions } from "./useFoodPortions";
export { useFoodSearch } from "./useFoodSearch";
export type { FoodSearchOffError, FoodSearchResult, UseFoodSearchOptions } from "./useFoodSearch";
export { useMaterialiseOffProduct } from "./useMaterialiseOffProduct";
export { useUpdateFood } from "./useUpdateFood";
