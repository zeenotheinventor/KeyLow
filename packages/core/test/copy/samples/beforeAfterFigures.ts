import * as copy from "../../../src/copy";

// Every function `src/copy/beforeAfterFigures.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
const sentencesOf = ({ before, after, accessibleName }: copy.BeforeAfterFigures): string[] => [
  before,
  after,
  accessibleName,
];

export const samples: Record<string, () => string[]> = {
  beforeAfterFigures: () => [
    ...sentencesOf(copy.beforeAfterFigures("Calories", { before: 374.2, after: 361.7 }, "energy")),
    ...sentencesOf(copy.beforeAfterFigures("Carbs", { before: 42.55, after: 42.6 }, "grams")),
    ...sentencesOf(copy.beforeAfterFigures("Fibre", { before: 2, after: null }, "grams")),
  ],
};
