// Plain async functions over SupabaseClient<Database> land here from M2 onward.
export { getDiaryDay, getDiaryWeek, getLogEntry, listCompleteDays, listRecentFoods } from "./diary";
export type { DiaryDay, DiaryWeekDay, RecentFood } from "./diary";
export { CopyDayPartialWriteError, copyDay, undoCopyDay } from "./diaryCopy";
export type { CopiedDay, CopyDayInput } from "./diaryCopy";
export type {
  DayLog,
  DayTotals,
  FoodLogEntry,
  LogEntry,
  QuickLogEntry,
  RecipeLogEntry,
} from "./diarySchemas";
export { setDayComplete } from "./dayLogs";
export {
  logFood,
  logQuickEntry,
  restoreLogEntry,
  softDeleteLogEntry,
  updateLogEntry,
} from "./diaryWrites";
export type {
  EntryTimeChange,
  EntryUpdate,
  LogFoodInput,
  LogQuickEntryInput,
  QuickEntryValues,
} from "./diaryWrites";
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
export {
  getMyTargets,
  getMyTimeZone,
  getMyWeightUnit,
  updateMyTargets,
  updateMyTimeZone,
} from "./targets";
export type { Targets } from "./targets";
export { acceptTerms, getMyTermsAcceptance } from "./terms";
export { createRecipe, duplicateRecipe, setRecipeArchived, updateRecipe } from "./recipeWrites";
export type { DuplicateRecipeInput, RecipeSave, RecipeUpdate } from "./recipeWrites";
export { getRecipe, listRecipes, searchRecipes } from "./recipes";
export type {
  RecipeDetail,
  RecipeListOptions,
  RecipeSearchOptions,
  RecipeSummary,
} from "./recipes";
export { logRecipe } from "./recipeEntries";
export type { LogRecipeInput } from "./recipeEntries";
export { applyRecipeRefresh } from "./recipeWrites";
export { previewRecipeRefresh } from "./recipes";
export type { RecipeRefreshDiff } from "./recipes";
export {
  WeighInNotEditableError,
  addWeighIn,
  importWeighIns,
  listWeighIns,
  softDeleteWeighIn,
  updateWeighIn,
} from "./weighIns";
export type { ImportResult, WeighInChange } from "./weighIns";
export type { WeighIn } from "./weighInSchemas";
export { getActiveRoutine, listSetsFrom, listWeekSessions } from "./training";
export type {
  ActiveRoutine,
  LastPerformanceSession,
  LastPerformanceSet,
  SessionSet,
  SessionWithSets,
  TrainingSet,
  WeekSession,
} from "./trainingSchemas";
export { getActiveSession, getLastPerformance, getSession } from "./trainingSessions";
export type { LastPerformanceOptions } from "./trainingSessions";
export { getRoutine, listRoutines } from "./routines";
export type { ListRoutinesOptions } from "./routines";
export { saveRoutine, setActiveRoutine, setRoutineArchived } from "./routineWrites";
export type { RoutineSave } from "./routineWrites";
export type { RoutineDetail, RoutineListEntry, RoutineRecord } from "./routineSchemas";
export { deleteSession, finishSession, startSession } from "./sessionWrites";
export type { SessionFinish, SessionStart } from "./sessionWrites";
