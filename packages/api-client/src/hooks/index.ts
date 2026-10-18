// TanStack Query hooks over the repos land here from M2 onward.
export { useAcceptTerms } from "./useAcceptTerms";
export type { DiaryReadOptions } from "./DiaryReadOptions";
export { useArchiveRecipe } from "./useArchiveRecipe";
export { useCompleteDays } from "./useCompleteDays";
export { useCopyDay } from "./useCopyDay";
export { useCreateFood } from "./useCreateFood";
export { useCreateRecipe } from "./useCreateRecipe";
export { useDebouncedValue } from "./useDebouncedValue";
export { useDeleteEntry } from "./useDeleteEntry";
export { useDeleteFood } from "./useDeleteFood";
export { useDiaryDay } from "./useDiaryDay";
export { useDiaryWeek } from "./useDiaryWeek";
export { useDuplicateRecipe } from "./useDuplicateRecipe";
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
export type {
  FoodSearchLocalError,
  FoodSearchOffError,
  FoodSearchResult,
  UseFoodSearchOptions,
} from "./useFoodSearch";
export { useFoodWithPortions } from "./useFoodWithPortions";
export type { FoodWithPortionsState } from "./useFoodWithPortions";
export { useLogEntry } from "./useLogEntry";
export { useLogFood } from "./useLogFood";
export { useMaterialiseOffProduct } from "./useMaterialiseOffProduct";
export { useOwnFoods } from "./useOwnFoods";
export { useQuickAdd } from "./useQuickAdd";
export { useRecentFoods } from "./useRecentFoods";
export { useRecipe } from "./useRecipe";
export type { RecipeState } from "./useRecipe";
export { useRecipeSearch } from "./useRecipeSearch";
export type {
  RecipeSearchError,
  RecipeSearchResult,
  UseRecipeSearchOptions,
} from "./useRecipeSearch";
export { useRecipes } from "./useRecipes";
export type { UseRecipesOptions } from "./useRecipes";
export { useRestoreEntry } from "./useRestoreEntry";
export { useSetDayComplete } from "./useSetDayComplete";
export { useProfileTimeZone } from "./useProfileTimeZone";
export { useSyncTimeZone } from "./useSyncTimeZone";
export type { UseSyncTimeZoneInput } from "./useSyncTimeZone";
export { useTargets } from "./useTargets";
export { useTermsAcceptance } from "./useTermsAcceptance";
export { useUndoCopyDay } from "./useUndoCopyDay";
export { useUpdateEntry } from "./useUpdateEntry";
export { useUpdateFood } from "./useUpdateFood";
export { useUpdateRecipe } from "./useUpdateRecipe";
export { TargetsValidationError, useUpdateTargets } from "./useUpdateTargets";
export { useLogRecipeServing } from "./useLogRecipeServing";
export { useRecipeRefreshPreview } from "./useRecipeRefreshPreview";
export type { RecipeRefreshPreviewState } from "./useRecipeRefreshPreview";
export { useRefreshRecipeIngredients } from "./useRefreshRecipeIngredients";
export { useAddWeighIn } from "./useAddWeighIn";
export { useDeleteWeighIn } from "./useDeleteWeighIn";
export { useImportWeighIns } from "./useImportWeighIns";
export { useUpdateWeighIn } from "./useUpdateWeighIn";
export { useWeighIns } from "./useWeighIns";
export { useWeightTrend } from "./useWeightTrend";
export { useMuscleState } from "./useMuscleState";
export { useWeekComparison } from "./useWeekComparison";
export { useActiveRoutine } from "./useActiveRoutine";
export { planRoutineOf } from "./planRoutineOf";
export { useWeekSessionRows } from "./useWeekSessionRows";
export { useActiveSession } from "./useActiveSession";
export { useHasLoggedSession } from "./useHasLoggedSession";
export { useLastPerformance } from "./useLastPerformance";
export type { UseLastPerformanceOptions } from "./useLastPerformance";
export { useSession } from "./useSession";
export { useWeightUnit } from "./useWeightUnit";
export type { TrainingReadResult } from "./trainingReadResult";
export { useBodyMap } from "./useBodyMap";
export type { BodyMap, BodyMapDay, BodyMapScale, UseBodyMapInput } from "./useBodyMap";
export { useDashboardBodyMap } from "./useDashboardBodyMap";
export type { DashboardBodyMap, DashboardToday } from "./useDashboardBodyMap";
export { useMuscleList } from "./useMuscleList";
export type { UseMuscleListInput } from "./useMuscleList";
export { useMuscleDetail } from "./useMuscleDetail";
export type { UseMuscleDetailInput } from "./useMuscleDetail";

export { useArchiveRoutine } from "./useArchiveRoutine";
export { useRoutine } from "./useRoutine";
export { useRoutines } from "./useRoutines";
export type { UseRoutinesOptions } from "./useRoutines";
export { useSaveRoutine } from "./useSaveRoutine";
export { useSetActiveRoutine } from "./useSetActiveRoutine";

export { useDeleteSession } from "./useDeleteSession";
export { useFinishSession } from "./useFinishSession";
export type { FinishSessionInput } from "./useFinishSession";
export { useStartSession } from "./useStartSession";

export { useAddSet } from "./useAddSet";
export { useRemoveSet } from "./useRemoveSet";
export { useReorderSets } from "./useReorderSets";
export type { ReorderSetsInput } from "./useReorderSets";
export { useRestoreSet } from "./useRestoreSet";
export { useUpdateSet } from "./useUpdateSet";
export type { UpdateSetInput } from "./useUpdateSet";

export { useHistoryWeek } from "./useHistoryWeek";
export { useHistory } from "./useHistory";
export type { UseHistoryOptions, UseHistoryResult } from "./useHistory";
export type { HistoryEntry, HistoryWeek } from "./historyEntries";
export { useSaveTrainingGoals } from "./useSaveTrainingGoals";
export { useTrainingGoals } from "./useTrainingGoals";
export { useTrainingGoalsHistory } from "./useTrainingGoalsHistory";
export { useExercise } from "./useExercise";
export type { ExerciseState } from "./useExercise";
export { useExerciseSearch } from "./useExerciseSearch";
export type {
  ExerciseSearchError,
  ExerciseSearchResult,
  UseExerciseSearchOptions,
} from "./useExerciseSearch";
export { useArchiveExercise } from "./useArchiveExercise";
export { useSaveExercise } from "./useSaveExercise";
