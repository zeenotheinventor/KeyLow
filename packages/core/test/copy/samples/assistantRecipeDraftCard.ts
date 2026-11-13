import * as copy from "../../../src/copy";

// Every function `src/copy/assistantRecipeDraftCard.ts` exports, called with representative arguments.
export const samples: Record<string, () => string[]> = {
  describeRecipeDraftSubtitle: () => [
    copy.describeRecipeDraftSubtitle(2, false),
    copy.describeRecipeDraftSubtitle(1, true),
  ],
  describeRecipeDraftAsked: () => [
    copy.describeRecipeDraftAsked("kcal", 600),
    copy.describeRecipeDraftAsked("protein_g", 45),
  ],
  describeRecipeDraftSteps: () => [
    copy.describeRecipeDraftSteps(1),
    copy.describeRecipeDraftSteps(4),
  ],
  describeRecipeDraftFitWithin: () => [
    copy.describeRecipeDraftFitWithin({ kcal: 600, protein_g: 45 }, []) ?? "",
    copy.describeRecipeDraftFitWithin({ kcal: 500, protein_g: 50, carbs_g: 40, fat_g: 20 }, [
      "harissa paste",
    ]) ?? "",
  ],
  composerTextForAdjust: () => [
    copy.composerTextForAdjust(""),
    copy.composerTextForAdjust("More rice"),
  ],
  describeRecipeDraftMiss: () => [
    copy.describeRecipeDraftMiss({
      nutrient: "protein_g",
      target: 60,
      achieved: 53,
      reason: "ingredient_bounds",
      limitedBy: ["salmon fillet"],
    }),
    copy.describeRecipeDraftMiss({
      nutrient: "kcal",
      target: 600,
      achieved: 700,
      reason: "targets_conflict",
      limitedBy: [],
    }),
    copy.describeRecipeDraftMiss({
      nutrient: "carbs_g",
      target: 50,
      achieved: null,
      reason: "no_data",
      limitedBy: [],
    }),
  ],
  describeRecipeNotice: () =>
    (["timed_out", "refused"] as const).flatMap((code) => {
      const { title, body, button } = copy.describeRecipeNotice({ code });
      return button === null ? [title, body] : [title, body, button];
    }),
};
