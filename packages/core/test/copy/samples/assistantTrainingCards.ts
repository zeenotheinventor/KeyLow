import * as copy from "../../../src/copy";

// Every function `src/copy/assistantTrainingCards.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
const squat = { setType: "working", loadKg: 100, reps: 8, rir: 2, rpe: null } as const;

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
  describeSetUpdatedPlace: () => [
    copy.describeSetUpdatedPlace("Legs"),
    copy.describeSetUpdatedPlace(null),
  ],
  describeSetUpdatedTitle: () => [
    copy.describeSetUpdatedTitle("Legs", 1),
    copy.describeSetUpdatedTitle("your workout", 3),
  ],
  describeSetUpdatedSub: () => [copy.describeSetUpdatedSub("2026-10-08")],
  describeSetRowName: () => [
    copy.describeSetRowName("Barbell squat", "working", 2),
    copy.describeSetRowName("Barbell squat", "warmup", 0),
    copy.describeSetRowName("Barbell squat", "drop", 3),
  ],
  describeSetFigures: () => [
    copy.describeSetFigures(squat, "kg", { effort: false, type: false }),
    copy.describeSetFigures({ ...squat, loadKg: null }, "lb", { effort: true, type: true }),
    copy.describeSetFigures({ ...squat, rir: null, rpe: 8.5 }, "kg", { effort: true, type: false }),
    copy.describeSetFigures({ ...squat, rir: null }, "kg", { effort: true, type: false }),
  ],
  describeSetWas: () => [copy.describeSetWas("100 kg × 6")],
  describeSetPutBack: () => [copy.describeSetPutBack("Barbell squat, set 2", "100 kg × 6")],
  describeSetsPutBack: () => [
    copy.describeSetsPutBack(3, "Legs"),
    copy.describeSetsPutBack(2, null),
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
