// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export {
  FoodsPartialWriteError,
  createFood,
  getFood,
  listFoodPortions,
  replaceFoodPortions,
  searchFoods,
  updateFood,
} from "./foods";
export type { CreatedFood, FoodSearchHit } from "./foods";
export { searchOff } from "./off";
