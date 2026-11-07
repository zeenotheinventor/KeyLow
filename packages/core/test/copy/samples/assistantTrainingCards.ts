import * as copy from "../../../src/copy";

// Every function `src/copy/assistantTrainingCards.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeRoutineActiveTitle: () => [copy.describeRoutineActiveTitle("Push Pull Legs")],
  describeRoutineActiveSub: () => [
    copy.describeRoutineActiveSub("Upper Lower"),
    copy.describeRoutineActiveSub(null),
  ],
  describeRoutineActiveChangeDetail: () => [copy.describeRoutineActiveChangeDetail("Upper Lower")],
  describeRoutineActiveUndone: () => [
    copy.describeRoutineActiveUndone("Upper Lower"),
    copy.describeRoutineActiveUndone(null),
  ],
  describeRoutineClearedSub: () => [copy.describeRoutineClearedSub("Upper Lower")],
  describeRoutineArchivedTitle: () => [copy.describeRoutineArchivedTitle("Upper Lower")],
  describeRoutineArchivedUndone: () => [copy.describeRoutineArchivedUndone("Upper Lower")],
  describeConfirmArchiveRoutineQuestion: () => [
    copy.describeConfirmArchiveRoutineQuestion("Upper Lower"),
  ],
  describeRoutineCreatedTitle: () => [
    copy.describeRoutineCreatedTitle("Push Pull Legs", 3),
    copy.describeRoutineCreatedTitle("Full body", 1),
  ],
  describeRoutineCreatedSub: () => [
    copy.describeRoutineCreatedSub("aesthetic", "intermediate"),
    copy.describeRoutineCreatedSub("hybrid", "beginner"),
  ],
  describeBuiltDayName: () => [
    copy.describeBuiltDayName("Push", 0),
    copy.describeBuiltDayName("Pull", null),
  ],
  describeBuiltDaySummary: () => [
    copy.describeBuiltDaySummary(5, 15, 50),
    copy.describeBuiltDaySummary(1, 1, 5),
  ],
  describeBuiltExerciseDetail: () => [
    copy.describeBuiltExerciseDetail({ sets: 3, repMin: 8, repMax: 10, targetRir: 2 }),
    copy.describeBuiltExerciseDetail({ sets: 1, repMin: 5, repMax: 5, targetRir: null }),
  ],
  describeBuiltWeekTotal: () => [
    copy.describeBuiltWeekTotal(45, 3),
    copy.describeBuiltWeekTotal(15, 1),
  ],
  describeRoutineCreatedChange: () => [
    copy.describeRoutineCreatedChange(4, 60),
    copy.describeRoutineCreatedChange(1, 15),
  ],
  describeRoutineCreatedUndone: () => [copy.describeRoutineCreatedUndone("Push Pull Legs")],
};
