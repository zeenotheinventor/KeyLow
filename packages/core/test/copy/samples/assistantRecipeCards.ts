import * as copy from "../../../src/copy";

// Every function `src/copy/assistantRecipeCards.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeRecipeServings: () => [copy.describeRecipeServings(4), copy.describeRecipeServings(1)],
  describeRecipeCreatedTitle: () => [
    copy.describeRecipeCreatedTitle("Chicken and rice", 4),
    copy.describeRecipeCreatedTitle("Porridge", 2.5),
  ],
  describeRecipeCreatedUndone: () => [copy.describeRecipeCreatedUndone("Chicken and rice")],
  describeRecipeArchivedTitle: () => [copy.describeRecipeArchivedTitle("Pasta bake")],
  describeRecipeArchivedUndone: () => [copy.describeRecipeArchivedUndone("Pasta bake")],
  describeRecipeUpdatedTitle: () => [copy.describeRecipeUpdatedTitle("Chicken and rice")],
  describeRecipesCount: () => [copy.describeRecipesCount(1), copy.describeRecipesCount(3)],
  describePerServing: () =>
    [
      copy.describePerServing({ kcal: 550.25, protein_g: 37.05, carbs_g: 78.9, fat_g: 8.6 }),
      copy.describePerServing({ kcal: 300, protein_g: null, carbs_g: null, fat_g: 4 }),
    ].flatMap((sentence) => (sentence === null ? [] : [sentence])),
  describeImportedFrom: () => [
    copy.describeImportedFrom("https://example.com/lemon-traybake"),
    copy.describeImportedFrom("https://www.example.com/"),
  ],
  describeChooseFoodFor: () => [
    copy.describeChooseFoodFor("white wine"),
    copy.describeChooseFoodFor("salt"),
  ],
  describeGuessedAmount: () => [
    copy.describeGuessedAmount({ amount: 50, unit: "ml" }, "a splash"),
    copy.describeGuessedAmount({ amount: 2, unit: "g" }, null),
  ],
  describeMatchedImportLine: () => [
    copy.describeMatchedImportLine({ name: "Olive oil", source: "cofid" }, null),
    copy.describeMatchedImportLine(
      { name: "Milk, semi-skimmed", source: "cofid" },
      "50 ml (a splash, estimated)",
    ),
  ],
  describeConfirmArchiveQuestion: () => [copy.describeConfirmArchiveQuestion("Chicken and rice")],
};
