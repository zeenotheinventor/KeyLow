// TanStack Query hooks over the repos land here from M2 onward.
export { useAcceptTerms } from "./useAcceptTerms";
export type { DiaryReadOptions } from "./DiaryReadOptions";
export { useArchiveRecipe } from "./useArchiveRecipe";
export { useCompleteDays } from "./useCompleteDays";
export { useCopyDay } from "./useCopyDay";
export { useCreateFeatureRequest } from "./useCreateFeatureRequest";
export { useCreateFood } from "./useCreateFood";
export { useCreateRecipe } from "./useCreateRecipe";
export { useDebouncedValue } from "./useDebouncedValue";
export { useDeleteEntry } from "./useDeleteEntry";
export { useDeleteFood } from "./useDeleteFood";
export { useDiaryDay } from "./useDiaryDay";
export { useDiaryWeek } from "./useDiaryWeek";
export { useDuplicateRecipe } from "./useDuplicateRecipe";
export { useFavouriteFoods } from "./useFavouriteFoods";
export { useFavouriteRecipes } from "./useFavouriteRecipes";
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
export { useLogEntries } from "./useLogEntries";
export {
  PlateFoodGoneError,
  PlateFoodNeedsReviewError,
  plateEntriesOf,
  useLogPlateEntries,
} from "./useLogPlateEntries";
export type { LogPlateEntriesInput, PlateFoodReaders, PlateLoggedWhen } from "./useLogPlateEntries";
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
export { useRefreshOutdatedOffFood } from "./useRefreshOutdatedOffFood";
export { useRestoreEntry } from "./useRestoreEntry";
export { useSetDayComplete } from "./useSetDayComplete";
export { useProfileTimeZone } from "./useProfileTimeZone";
export { useSyncTimeZone } from "./useSyncTimeZone";
export type { UseSyncTimeZoneInput } from "./useSyncTimeZone";
export { useEditProgram } from "./useEditProgram";
export type { EditProgramInput } from "./useEditProgram";
export { useSaveSetup } from "./useSaveSetup";
export type { SaveSetupInput } from "./useSaveSetup";
export { useSetupDraft } from "./useSetupDraft";
export { useSetupState } from "./useSetupState";
export { useSkipSetup } from "./useSkipSetup";
export { targetsForDay, useTargets } from "./useTargets";
export { useTermsAcceptance } from "./useTermsAcceptance";
export { useToggleFavouriteFood } from "./useToggleFavouriteFood";
export { useToggleFavouriteRecipe } from "./useToggleFavouriteRecipe";
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
export { useWeighInEntry } from "./useWeighInEntry";
export type { UseWeighInEntryInput } from "./useWeighInEntry";
export { useWeightTrend } from "./useWeightTrend";
export { useBodyMeasurements } from "./useBodyMeasurements";
export { useBodyTrend } from "./useBodyTrend";
export { useBodyCompositionKind } from "./useBodyCompositionKind";
export type { BodyCompositionKind } from "./useBodyCompositionKind";
export { useImportBodyMeasurements } from "./useImportBodyMeasurements";
export { useHeatSets } from "./useHeatSets";
export { useMuscleState } from "./useMuscleState";
export { useWeekComparison } from "./useWeekComparison";
export { useActiveRoutine } from "./useActiveRoutine";
export { planRoutineOf } from "./planRoutineOf";
export { useWeekSessionRows } from "./useWeekSessionRows";
export { useTrainHome } from "./useTrainHome";
export type {
  PickDayOption,
  TodayCardView,
  TrainHome,
  TrainHomeSettings,
  TrainWeekView,
} from "./trainHomeTypes";
export { useActiveSession } from "./useActiveSession";
export { useSessionBarView } from "./useSessionBarView";
export type { SessionBarView } from "./useSessionBarView";
export { useHasLoggedSession } from "./useHasLoggedSession";
export { useLastPerformance } from "./useLastPerformance";
export type { UseLastPerformanceOptions } from "./useLastPerformance";
export { useExerciseProgress } from "./useExerciseProgress";
export type {
  ExerciseChartData,
  ExerciseProgress,
  ExerciseProgressBody,
  ExerciseWeekItem,
} from "./exerciseProgressTypes";
export { useExerciseTrendSets } from "./useExerciseTrendSets";
export type { UseTrendSetsOptions } from "./useExerciseTrendSets";
export { useRoutineProgress } from "./useRoutineProgress";
export type {
  RoutineProgress,
  RoutineProgressDayItem,
  RoutineProgressExercise,
  RoutineProgressState,
} from "./routineProgressTypes";
export { useRoutineTrendSets } from "./useRoutineTrendSets";
export { useSession } from "./useSession";
export { useWeightUnit } from "./useWeightUnit";
export type { TrainingReadResult } from "./trainingReadResult";
export { useBodyMap } from "./useBodyMap";
export type { BodyMap, BodyMapDay, BodyMapScale, UseBodyMapInput } from "./useBodyMap";
export { useDashboardBodyMap } from "./useDashboardBodyMap";
export type { DashboardBodyMap, DashboardToday } from "./useDashboardBodyMap";
export { useMuscleList } from "./useMuscleList";
export type { UseMuscleListInput } from "./useMuscleList";
export { useMuscleScaleList } from "./useMuscleScaleList";
export type { UseMuscleScaleListInput } from "./useMuscleScaleList";
export { useMuscleDetail } from "./useMuscleDetail";
export type { UseMuscleDetailInput } from "./useMuscleDetail";

export { useArchiveRoutine } from "./useArchiveRoutine";
export { useRoutine } from "./useRoutine";
export { useRoutines } from "./useRoutines";
export type { UseRoutinesOptions } from "./useRoutines";
export { useSaveRoutine } from "./useSaveRoutine";
export { useSetActiveRoutine } from "./useSetActiveRoutine";
export { useMakeRoutineActive } from "./useMakeRoutineActive";
export { useArchiveRoutineWithUndo } from "./useArchiveRoutineWithUndo";
export { useRestoreRoutine } from "./useRestoreRoutine";
export type { RoutineNotices } from "./routineNotices";

export { useDeleteSession } from "./useDeleteSession";
export { useFinishSession } from "./useFinishSession";
export type { FinishSessionInput } from "./useFinishSession";
export { useStartSession } from "./useStartSession";
export { useStartSessionAction } from "./useStartSessionAction";
export type { SessionStartRequest } from "./useStartSessionAction";
export { useDiscardSession } from "./useDiscardSession";
export { useSessionView } from "./useSessionView";
export { describeSessionDetail } from "./describeSessionDetail";
export { useSessionDetail } from "./useSessionDetail";
export type { SessionDetailSettings } from "./useSessionDetail";
export type {
  SessionDetailContent,
  SessionDetailExercise,
  SessionDetailMuscles,
  SessionDetailSet,
  SessionDetailView,
} from "./sessionDetailTypes";
export { describeFinishDetails, heatSetsOf } from "./describeFinishDetails";
export type { FinishDetails } from "./describeFinishDetails";
export { useSetLogging } from "./useSetLogging";
export { useChangeSetType } from "./useChangeSetType";
export { useAddToPastSession } from "./useAddToPastSession";
export type {
  AddSetEntry,
  AddToPastSession,
  AddToPastSessionOpening,
  PickedExercise,
  SetLogRequest,
} from "./useAddToPastSession";
export { useEditSet } from "./useEditSet";
export type { EditSet, EditSetOpening, EditSetOpeningState, SetChanges } from "./useEditSet";
export { useRemoveSetWithUndo } from "./useRemoveSetWithUndo";
export type { SetNotices } from "./useRemoveSetWithUndo";
export { useAddedExercises } from "./useAddedExercises";
export { isPendingSetId, usePendingSets } from "./pendingSets";
export type {
  AddedExercise,
  ChangeSetTypeRequest,
  ExercisePlan,
  LogSetRequest,
  PendingSet,
  PendingSets,
  PlannedExerciseName,
  RemoveSetRequest,
  ScreenSet,
  SessionView,
  SessionViewExercise,
  SetLogging,
} from "./sessionViewTypes";

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
export { useExerciseFormMedia } from "./useExerciseFormMedia";
export type { ExerciseFormMediaState } from "./useExerciseFormMedia";
export { useExerciseMuscles } from "./useExerciseMuscles";
export type { ExerciseMusclesState } from "./useExerciseMuscles";
export { useExerciseSearch } from "./useExerciseSearch";
export type {
  ExerciseSearchError,
  ExerciseSearchResult,
  UseExerciseSearchOptions,
} from "./useExerciseSearch";
export { useArchiveExercise } from "./useArchiveExercise";
export { useSaveExercise } from "./useSaveExercise";
export { useProgramSummary } from "./useProgramSummary";
export { useRunDueCheckins } from "./useRunDueCheckins";
export { useRunCheckinsIfDue } from "./useRunCheckinsIfDue";
export type { UseRunCheckinsIfDueOptions } from "./useRunCheckinsIfDue";
export { useProgramScreen } from "./useProgramScreen";
export type { ProgramScreenState, UseProgramScreenOptions } from "./useProgramScreen";
export { useSettlingChecklist } from "./useSettlingChecklist";
export type { UseSettlingChecklistOptions } from "./useSettlingChecklist";
export { useCheckinSummary } from "./useCheckinSummary";
export type { UseCheckinSummaryOptions } from "./useCheckinSummary";
export { useExpenditureChart } from "./useExpenditureChart";
export type { ExpenditureChartState, UseExpenditureChartOptions } from "./useExpenditureChart";
export { useExpenditureHistory } from "./useExpenditureHistory";
export { useTargetsHistory } from "./useTargetsHistory";
export type { ProgramHistoryOptions } from "./ProgramHistoryOptions";
export { useShoppingList } from "./useShoppingList";
export { useAddPalatePreference } from "./useAddPalatePreference";
export { useRemovePalatePreference } from "./useRemovePalatePreference";
export { usePalatePreferences } from "./usePalatePreferences";
export { usePalateStats } from "./usePalateStats";
export { usePalateFoods } from "./usePalateFoods";
export { useSetNotUsual } from "./useSetNotUsual";
export { usePalateLoggedDays } from "./usePalateLoggedDays";
export { useMealPlans } from "./useMealPlans";
export { useSaveMealPlan } from "./useSaveMealPlan";
export { useReplaceMealPlanDay } from "./useReplaceMealPlanDay";
export { useConfirmMealPlanDay } from "./useConfirmMealPlanDay";
export { useArchiveMealPlan } from "./useArchiveMealPlan";
export { useMealPlanRepeatLimit } from "./useMealPlanRepeatLimit";
export { useSetMealPlanRepeatLimit } from "./useSetMealPlanRepeatLimit";
export { useShoppingPreview } from "./useShoppingPreview";
export type { ShoppingPreviewState } from "./useShoppingPreview";
export { useAddRecipesToList } from "./useAddRecipesToList";
export type { AddRecipesToListInput, ShoppingRecipeChoice } from "./useAddRecipesToList";
export { useAddShoppingItem } from "./useAddShoppingItem";
export { useToggleShoppingItem } from "./useToggleShoppingItem";
export type { ToggleShoppingItemInput } from "./useToggleShoppingItem";
export { useRemoveShoppingItem } from "./useRemoveShoppingItem";
export { useClearTickedItems } from "./useClearTickedItems";
export { useAcceptedSuggestions } from "./useAcceptedSuggestions";
export { useAcceptSuggestion } from "./useAcceptSuggestion";
export type { AcceptSuggestionInput } from "./useAcceptSuggestion";
export { useUndoAcceptedSuggestion } from "./useUndoAcceptedSuggestion";
export { useSuggestion } from "./useSuggestion";
export type {
  SuggestionRead,
  SuggestionUnavailableReason,
  UseSuggestionInput,
} from "./useSuggestion";
export { useSuggestionCard } from "./useSuggestionCard";
export type {
  SuggestionCardState,
  SuggestionNotices,
  UseSuggestionCardInput,
} from "./useSuggestionCard";
export { useAssistantConsent } from "./useAssistantConsent";
export { useAssistantStatus } from "./useAssistantStatus";
export { useAssistantTurn } from "./useAssistantTurn";
export { useAssistantChat } from "./useAssistantChat";
export type { UseAssistantChatInput } from "./useAssistantChat";
export { useSetAssistantConsent } from "./useSetAssistantConsent";
export { useAssistantConversation } from "./useAssistantConversation";
export type { AssistantConversation } from "./useAssistantConversation";
export { useNewAssistantConversation } from "./useNewAssistantConversation";
export { useDeleteAllAssistantConversations } from "./useDeleteAllAssistantConversations";
export { useAssistantChanges } from "./useAssistantChanges";
export { useUndoAssistantAction } from "./useUndoAssistantAction";
export type { UndoAssistantActionInput } from "./useUndoAssistantAction";
export { useAssistantCardUndo } from "./useAssistantCardUndo";
export type { AssistantCardUndo } from "./useAssistantCardUndo";
export { useHeldWords, MINIMUM_WORDS_TIME_MS } from "./useHeldWords";
export { useAccountExportFile } from "./useAccountExportFile";
export type {
  AccountExportFile,
  AccountExportScreenEvent,
  UseAccountExportFile,
  UseAccountExportFileInput,
} from "./useAccountExportFile";
