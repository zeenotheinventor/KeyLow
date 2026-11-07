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
};
