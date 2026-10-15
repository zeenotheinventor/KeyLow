// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export { getDiaryDay, getDiaryWeek, getLogEntry, listCompleteDays, listRecentFoods } from "./diary";
export type { DiaryDay, DiaryWeekDay, RecentFood } from "./diary";
export { CopyDayPartialWriteError, copyDay, undoCopyDay } from "./diaryCopy";
export type { CopiedDay, CopyDayInput } from "./diaryCopy";
export type { DayLog, DayTotals, FoodLogEntry, LogEntry, QuickLogEntry } from "./diarySchemas";
export { setDayComplete } from "./dayLogs";
export {
  logFood,
  logQuickEntry,
  restoreLogEntry,
  softDeleteLogEntry,
  updateLogEntry,
} from "./diaryWrites";
export type { EntryTimeChange, EntryUpdate, LogFoodInput, LogQuickEntryInput } from "./diaryWrites";
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
export { getMyTargets, getMyTimeZone, updateMyTargets } from "./targets";
export type { Targets } from "./targets";
export { acceptTerms, getMyTermsAcceptance } from "./terms";
