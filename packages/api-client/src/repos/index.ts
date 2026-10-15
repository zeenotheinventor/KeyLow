// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export { getDiaryDay, getDiaryWeek, listCompleteDays, listRecentFoods } from "./diary";
export type { DiaryDay, DiaryWeekDay, RecentFood } from "./diary";
export type { DayLog, DayTotals, LogEntry } from "./diarySchemas";
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
  softDeleteFood,
  updateFood,
} from "./foods";
export type { CreatedFood, FoodSearchHit } from "./foods";
export { fetchOffProduct, searchOff } from "./off";
export { acceptTerms, getMyTermsAcceptance } from "./terms";
