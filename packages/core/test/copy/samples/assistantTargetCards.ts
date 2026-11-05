import * as copy from "../../../src/copy";

// Every function `src/copy/assistantTargetCards.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeConfirmTargetsQuestion: () => [
    copy.describeConfirmTargetsQuestion(2140, 2000, true),
    copy.describeConfirmTargetsQuestion(1900, 2000, false),
    copy.describeConfirmTargetsQuestion(null, 2000, false),
  ],
  describeTargetsChangedTitle: () => [copy.describeTargetsChangedTitle(2000)],
  describeTargetsChangedSub: () => [
    copy.describeTargetsChangedSub(2140, true),
    copy.describeTargetsChangedSub(1900, false),
  ],
  describeTargetsChangedNote: () => [
    copy.describeTargetsChangedNote(2140),
    copy.describeTargetsChangedNote(null),
  ],
  describeMacrosAdjustedNote: () => [
    copy.describeMacrosAdjustedNote({ protein_g: 118, carbs_g: 229, fat_g: 68 }),
    copy.describeMacrosAdjustedNote({ protein_g: 118, carbs_g: null, fat_g: null }),
  ],
  describeMacrosAdjustedAmount: () => [
    copy.describeMacrosAdjustedAmount({ protein_g: 118, carbs_g: 229, fat_g: 68 }),
    copy.describeMacrosAdjustedAmount({ protein_g: null, carbs_g: 229, fat_g: null }),
  ],
  describeTargetsChangedUndone: () => [
    copy.describeTargetsChangedUndone(2140),
    copy.describeTargetsChangedUndone(null),
  ],
};
