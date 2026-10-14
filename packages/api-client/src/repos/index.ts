// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export {
  FoodsPartialWriteError,
  MIN_SEARCH_LENGTH,
  createFood,
  getFood,
  getFoodByBarcode,
  listFoodPortions,
  listOwnFoods,
  replaceFoodPortions,
  searchFoods,
  updateFood,
} from "./foods";
export type { CreatedFood, FoodSearchHit } from "./foods";
export { fetchOffProduct, searchOff } from "./off";
