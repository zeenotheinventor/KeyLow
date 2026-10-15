import * as copy from "../../../src/copy";

// Every function `src/copy/diaryDay.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeDatePickerButton: () => [
    copy.describeDatePickerButton("Today", "15 October"),
    copy.describeDatePickerButton("Mon 12 Oct"),
  ],
  describeIncompleteDays: () => [0, 1, 2].map(copy.describeIncompleteDays),
};
