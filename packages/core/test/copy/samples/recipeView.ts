import * as copy from "../../../src/copy";

// Every function `src/copy/recipeView.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeEditRecipe: () => [copy.describeEditRecipe("Chicken and rice")],
  describeResetServings: () => [4, 1, 2.5].map(copy.describeResetServings),
  describeServingsValue: () => [6, 1, 2.5].map(copy.describeServingsValue),
  describeIngredientsFor: () => [4, 1].map(copy.describeIngredientsFor),
  describeStepsServingsNote: () => [4, 1].map(copy.describeStepsServingsNote),
  describeServingsAnnouncement: () => [
    copy.describeServingsAnnouncement(6, 1650),
    copy.describeServingsAnnouncement(1, 155),
    copy.describeServingsAnnouncement(6, null),
  ],
};
