import * as copy from "../../../src/copy";

// Every function `src/copy/palate.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeUsualMostDays: () => [
    copy.describeUsualMostDays(["apples"]),
    copy.describeUsualMostDays(["apples", "broccoli", "eggs", "bread"]),
  ],
  describeUsualMostWeeks: () => [
    copy.describeUsualMostWeeks(["yogurt"]),
    copy.describeUsualMostWeeks(["yogurt", "porridge oats", "chicken", "rice"]),
  ],
  describeRareSummary: () => [
    copy.describeRareSummary(["drinks"]),
    copy.describeRareSummary(["legumes and nuts", "sweets and snacks"]),
    copy.describeRareSummary(["legumes and nuts", "sweets and snacks", "drinks"]),
  ],
  describeAvoidSummary: () => [
    copy.describeAvoidSummary([{ label: "Peanuts", kind: "allergy" }]),
    copy.describeAvoidSummary([
      { label: "Peanuts", kind: "allergy" },
      { label: "Mushrooms", kind: "dislike" },
      { label: "Coriander", kind: "dislike" },
    ]),
  ],
  describeFoodDetail: () => [
    copy.describeFoodDetail(28, 100),
    copy.describeFoodDetail(4, 4.5),
    copy.describeFoodDetail(5, null),
  ],
  describeRecipeDetail: () => [
    copy.describeRecipeDetail(14, 1),
    copy.describeRecipeDetail(14, 1.5),
    copy.describeRecipeDetail(14, null),
  ],
  describeBandFoods: () => [copy.describeBandFoods(["yogurt", "apples", "porridge oats"])],
  describeGroupTitle: () => [copy.describeGroupTitle("legumes and nuts")],
  describeRareGroupDetail: () => [copy.describeRareGroupDetail(0), copy.describeRareGroupDetail(1)],
  describeNotTrue: () => [copy.describeNotTrue("Eggs, chicken, whole, boiled")],
  describeUndo: () => [copy.describeUndo("Eggs, chicken, whole, boiled")],
  describeShowAll: () => [copy.describeShowAll(10)],
  describeEmptyPalate: () => [0, 1, 2].map(copy.describeEmptyPalate),
};
