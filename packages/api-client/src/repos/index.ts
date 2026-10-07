// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export {
  FoodsPartialWriteError,
  createFood,
  getFood,
  getFoodByBarcode,
  listFoodPortions,
  replaceFoodPortions,
  searchFoods,
  updateFood,
} from "./foods";
export type { CreatedFood, FoodSearchHit } from "./foods";
export { fetchOffProduct, searchOff } from "./off";
