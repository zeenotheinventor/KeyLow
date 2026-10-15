import * as copy from "../../../src/copy";

// Every function `src/copy/diaryRing.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeEatenLine: () => [0, 1039].map(copy.describeEatenLine),
  describeTargetLine: () => [
    copy.describeTargetLine(2200, false),
    copy.describeTargetLine(2200, true),
  ],
  describeCalorieRing: () => [
    copy.describeCalorieRing(1039, 2200),
    copy.describeCalorieRing(2200, 2200),
    copy.describeCalorieRing(2412, 2200),
  ],
  describeMacroBar: () => [
    copy.describeMacroBar("Protein", 86, 160),
    copy.describeMacroBar("Fat", 81, 70),
    copy.describeMacroBar("Carbs", 129.1, 0),
  ],
  describeMacroTarget: () => [0, 160].map(copy.describeMacroTarget),
};
