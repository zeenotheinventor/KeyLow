// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export {
  FoodsPartialWriteError,
  createFood,
  getFood,
  listFoodPortions,
  replaceFoodPortions,
  updateFood,
} from "./foods";
export type { CreatedFood } from "./foods";
