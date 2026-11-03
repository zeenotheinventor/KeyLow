// Functions import the api-client repos through this file, never through ./repos/index.js directly.
// The bundle behind it is written by `bundle-core-for-deno` and typed by the @ts-self-types pragma in
// it, so a missing or stale bundle fails `deno check` here. A tool writes through these repos with a
// client that carries the caller's JWT, so row-level security and the snapshot rules apply exactly as
// they do when the app writes. Export what a function needs.
export type {
  DiaryWeekDay,
  EntryTimeChange,
  EntryUpdate,
  LogEntriesItem,
  LogEntry,
  LogEntryState,
  LogEntryStamp,
  LogFoodInput,
  LogQuickEntryInput,
  QuickEntryValues,
  Targets,
  WeighIn,
} from "./repos/index.js";
export {
  getDiaryDay,
  getDiaryWeek,
  getFood,
  getLogEntry,
  getMyTargets,
  getMyTimeZone,
  getRecipe,
  listFoodPortions,
  listRecipes,
  listWeighIns,
  logEntries,
  logFood,
  logQuickEntry,
  logRecipe,
  readLogEntryStamps,
  restoreLogEntry,
  searchFoods,
  searchRecipes,
  softDeleteLogEntries,
  softDeleteLogEntry,
  updateLogEntry,
} from "./repos/index.js";
