import { describe, expect, it } from "vitest";

import { recipeImportCard, recipeUnresolvedCard } from "./cardFixtures";
import { assistantCardSchema, buildRecipeImportedCard, withActionIds } from "../../src/assistant";

import type { RecipeImportedCardInput, RecipeImportedLine } from "../../src/assistant";

const recipeId = "00000000-0000-4000-8000-0000000000e1";
const actionIds: [string, ...string[]] = ["00000000-0000-4000-8000-0000000000d1"];

const matched = (text: string, foodName: string): RecipeImportedLine => ({
  text,
  foodWord: null,
  food: { name: foodName, source: "cofid" },
  guess: null,
});

const matchedLines: RecipeImportedLine[] = [
  matched("800 g chicken thighs, skinless", "Chicken, thigh, skinless, raw"),
  matched("750 g new potatoes", "Potatoes, new, raw"),
  matched("2 tbsp olive oil", "Olive oil"),
  matched("1 lemon", "Lemon, whole"),
  matched("4 garlic cloves", "Garlic, raw"),
];

const splashOfMilk: RecipeImportedLine = {
  text: "A splash of milk",
  foodWord: "milk",
  food: { name: "Milk, semi-skimmed", source: "cofid" },
  guess: { amount: 50, unit: "ml" },
};

const splashOfWine: RecipeImportedLine = {
  text: "A splash of white wine",
  foodWord: "white wine",
  food: null,
};

const traybake = (
  lines: RecipeImportedLine[],
  perServing: RecipeImportedCardInput["recipe"]["perServing"],
): RecipeImportedCardInput => ({
  recipe: { id: recipeId, name: "Lemon chicken traybake", servings: 4, perServing },
  sourceUrl: "https://example.com/lemon-traybake",
  lines,
});

const withMilk = { kcal: 570.2, protein_g: 42.1, carbs_g: 35.6, fat_g: 29.3 };
const withoutMilk = { kcal: 564.4, protein_g: 42.1, carbs_g: 35.3, fat_g: 29.1 };

describe("buildRecipeImportedCard", () => {
  it("should build the board's recipe-import card, with the guessed milk marked as an estimate", () => {
    const draft = buildRecipeImportedCard(traybake([...matchedLines, splashOfMilk], withMilk));

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      ...recipeImportCard,
      actionIds,
    });
  });

  it("should build the board's recipe-unresolved card, with the wine counted nowhere", () => {
    const draft = buildRecipeImportedCard(traybake([...matchedLines, splashOfWine], withoutMilk));

    expect(assistantCardSchema.parse(withActionIds(draft, actionIds))).toEqual({
      ...recipeUnresolvedCard,
      actionIds,
    });
  });

  it("should word the undone line as create_recipe does, because Undo archives the recipe", () => {
    const draft = buildRecipeImportedCard(traybake([...matchedLines, splashOfMilk], withMilk));

    expect(draft.undoneSub).toBe("Archived Lemon chicken traybake");
  });

  it("should mark no row as an estimate but the guessed one", () => {
    const draft = buildRecipeImportedCard(traybake([...matchedLines, splashOfMilk], withMilk));

    expect(draft.rows.map((row) => row.estimate)).toEqual([
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it("should link the first unresolved line, and name the food by its last word", () => {
    const draft = buildRecipeImportedCard(
      traybake(
        [splashOfWine, { text: "1 pinch saffron", foodWord: "saffron", food: null }],
        withoutMilk,
      ),
    );

    expect(draft.link).toEqual({
      label: "Choose a food for the wine",
      target: { screen: "recipe_add_ingredient", recipeId, query: "white wine" },
    });
  });

  it("should search the line itself when the model read no food word", () => {
    const draft = buildRecipeImportedCard(
      traybake([{ text: "Seasoning", foodWord: null, food: null }], withoutMilk),
    );

    expect(draft.link).toEqual({
      label: "Choose a food for the seasoning",
      target: { screen: "recipe_add_ingredient", recipeId, query: "Seasoning" },
    });
  });

  it("should keep the search text within what the editor's search takes", () => {
    const draft = buildRecipeImportedCard(
      traybake([{ text: "a".repeat(200), foodWord: null, food: null }], withoutMilk),
    );

    expect(draft.link?.target).toMatchObject({ query: "a".repeat(80) });
  });

  it("should say what a guess is of, in the words of the line, when the line says nothing of the amount", () => {
    const draft = buildRecipeImportedCard(
      traybake(
        [
          {
            ...splashOfMilk,
            text: "Salt to taste",
            foodWord: "salt",
            guess: { amount: 2, unit: "g" },
          },
          {
            ...splashOfMilk,
            text: "1 big handful of kale",
            foodWord: "kale",
            guess: { amount: 30, unit: "g" },
          },
          {
            ...splashOfMilk,
            text: "some milk",
            foodWord: "oat drink",
            guess: { amount: 40, unit: "ml" },
          },
        ],
        withMilk,
      ),
    );

    expect(draft.rows.map((row) => row.matchedFood)).toEqual([
      "Milk, semi-skimmed · 2 g (to taste, estimated) · UK CoFID",
      "Milk, semi-skimmed · 30 g (1 big handful, estimated) · UK CoFID",
      "Milk, semi-skimmed · 40 ml (estimated) · UK CoFID",
    ]);
  });

  it("should name the source of each food as the app does", () => {
    const draft = buildRecipeImportedCard(
      traybake(
        [
          {
            text: "1 tin beans",
            foodWord: null,
            food: { name: "Baked beans", source: "off" },
            guess: null,
          },
          {
            text: "1 tsp honey",
            foodWord: null,
            food: { name: "My honey", source: "user" },
            guess: null,
          },
        ],
        withMilk,
      ),
    );

    expect(draft.rows.map((row) => row.matchedFood)).toEqual([
      "Baked beans · Open Food Facts",
      "My honey · Yours",
    ]);
  });

  it("should link to the recipe editor when every line matched", () => {
    const draft = buildRecipeImportedCard(traybake(matchedLines, withMilk));

    expect(draft.link).toEqual({
      label: "Open in recipe editor",
      target: { screen: "recipe_editor", recipeId },
    });
  });

  it("should write the page as its host and path, without the scheme, www, query or fragment", () => {
    const sub = (sourceUrl: string) =>
      buildRecipeImportedCard({ ...traybake(matchedLines, withMilk), sourceUrl }).sub;

    expect(sub("https://www.example.com/recipes/lemon-traybake/?utm_source=x#top")).toBe(
      "From example.com/recipes/lemon-traybake",
    );
    expect(sub("http://example.com/")).toBe("From example.com");
    expect(sub(`https://example.com/${"a".repeat(100)}`)).toBe(
      `From example.com/${"a".repeat(47)}…`,
    );
  });

  it("should leave out a figure the recipe does not know in the total", () => {
    const draft = buildRecipeImportedCard(
      traybake(matchedLines, { kcal: 300, protein_g: null, carbs_g: null, fat_g: 4 }),
    );

    expect(draft.totalText).toBe("Per serving 300 kcal · F 4 g");
  });
});
