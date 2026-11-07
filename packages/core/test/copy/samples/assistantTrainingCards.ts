import * as copy from "../../../src/copy";

// Every function `src/copy/assistantTrainingCards.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.

const targets = { sets: 3, repMin: 12, repMax: 15, targetRir: 1 };

const rowWords = ({ name, detail }: { name: string; detail: string }): string[] => [name, detail];
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
  describeRoutineWeekday: () => [copy.describeRoutineWeekday(4), copy.describeRoutineWeekday(null)],
  describeRoutineUpdatedTitle: () => [copy.describeRoutineUpdatedTitle("Push Pull Legs")],
  describeRoutineChangeCount: () => [
    copy.describeRoutineChangeCount(1),
    copy.describeRoutineChangeCount(4),
  ],
  describeRoutineUpdatedSubForDay: () => [copy.describeRoutineUpdatedSubForDay("Legs", 4)],
  describeRoutineDayChangeCount: () => [
    copy.describeRoutineDayChangeCount(1),
    copy.describeRoutineDayChangeCount(3),
  ],
  describeRoutineUpdatedUndone: () => [copy.describeRoutineUpdatedUndone("Push Pull Legs")],
  describeRoutineTargets: () => [
    copy.describeRoutineTargets(targets),
    copy.describeRoutineTargets({ ...targets, targetRir: null }),
  ],
  describeAddedExerciseRow: () =>
    rowWords(copy.describeAddedExerciseRow("Leg extension", "Legs", targets)),
  describeSwappedExerciseRow: () => [
    ...rowWords(copy.describeSwappedExerciseRow("Leg press", "Hack squat", "Legs", targets)),
    ...rowWords(copy.describeSwappedExerciseRow("Leg press", "Hack squat", "Legs", null)),
  ],
  describeRemovedExerciseRow: () =>
    rowWords(copy.describeRemovedExerciseRow("Seated leg curl", "Legs")),
  describeChangedTargetsRow: () => [
    ...rowWords(
      copy.describeChangedTargetsRow("Barbell squat", "Legs", { ...targets, sets: 4 }, targets),
    ),
    ...rowWords(copy.describeChangedTargetsRow("Barbell squat", "Legs", targets, null)),
    ...rowWords(copy.describeChangedTargetsRow("Barbell squat", "Legs", null, null)),
  ],
  describeAddedDayRow: () => [
    ...rowWords(copy.describeAddedDayRow("Arms", 5, 0)),
    ...rowWords(copy.describeAddedDayRow("Arms", null, 2)),
  ],
  describeRenamedDayRow: () =>
    rowWords(copy.describeRenamedDayRow("Push", "Chest and shoulders", 0)),
  describeMovedDayRow: () => [
    ...rowWords(copy.describeMovedDayRow("Legs", 4, 3)),
    ...rowWords(copy.describeMovedDayRow("Legs", 4, null)),
  ],
  describeReorderedDayRow: () => rowWords(copy.describeReorderedDayRow("Legs", 2)),
  describeConfirmRemoveExercisesQuestion: () => [
    copy.describeConfirmRemoveExercisesQuestion(
      ["Leg press", "Seated leg curl"],
      "Legs",
      "Push Pull Legs",
    ),
    copy.describeConfirmRemoveExercisesQuestion(
      ["Leg press", "Bench press"],
      null,
      "Push Pull Legs",
    ),
  ],
  describeWorkoutInProgressRefusal: () => copy.describeWorkoutInProgressRefusal().split("\n\n"),
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
  describeGoalWas: () => [copy.describeGoalWas("Look better")],
  describeGoalsChangeDetail: () => [
    copy.describeGoalsChangeDetail(["Goal", "Days a week"]),
    copy.describeGoalsChangeDetail(["Session"]),
  ],
  describeGoalDays: () => [copy.describeGoalDays(3), copy.describeGoalDays(1)],
  describeGoalMinutes: () => [copy.describeGoalMinutes(60), copy.describeGoalMinutes(1)],
  describeGoalsStartedNote: () => [
    copy.describeGoalsStartedNote(["3 days a week", "60 minutes", "full gym"]),
    copy.describeGoalsStartedNote(["3 days a week"]),
  ],
  describeGoalsPutBack: () => [
    copy.describeGoalsPutBack(["4 days a week"]),
    copy.describeGoalsPutBack(["your goal, Look better", "4 days a week"]),
    copy.describeGoalsPutBack(["your goal, Look better", "4 days a week", "45 minutes a session"]),
  ],
  describeGoalMinutesPutBack: () => [copy.describeGoalMinutesPutBack(45)],
  describeGoalAnswerPutBack: () => [copy.describeGoalAnswerPutBack("Goal", "Look better")],
};
