import * as copy from "../../../src/copy";

// Every function `src/copy/exerciseForm.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFormVideoLink: () => [
    copy.describeFormVideoLink("Barbell back squat", "Strength Basics"),
  ],
  describeFormAndMusclesButton: () => [copy.describeFormAndMusclesButton("Barbell back squat")],
  describeFormPhoto: () => [
    copy.describeFormPhoto("Barbell back squat", "start"),
    copy.describeFormPhoto("Barbell back squat", "end"),
  ],
};
