import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  ARCHIVED_RECIPES,
  DIARY_LOAD_FAILED,
  RECIPE_ACTIONS,
  RECIPE_TOASTS,
  RECIPES_EMPTY,
  RECIPES_LIBRARY,
  RECIPES_LOAD_FAILED,
  RECIPES_LOADING_LABEL,
  RECIPES_OFFLINE,
  RECIPES_SEARCH_EMPTY,
  RECIPES_TABLE,
  describeArchiveRecipe,
  describeArchivedLink,
  describeArchivedLinkName,
  describeDuplicateName,
  describeDuplicateRecipe,
  describeMoreForRecipe,
  describeRecipeCount,
  describeRecipeRowName,
  describeRecipeServingCaption,
  describeRestoreRecipe,
} from "../../src/copy";
import { MAX_RECIPE_NAME_LENGTH } from "../../src/recipes";

import type { RecipeComputed } from "../../src/recipes";

type RecipeForLibrary = Parameters<typeof describeRecipeRowName>[1];

/** Only what the describers read: the per-serving values, and the cooked weight or else the raw total. */
const libraryRecipe = (
  servings: number,
  effectiveGrams: number,
  perServing: Partial<RecipeComputed["perServing"]> = {},
): RecipeForLibrary => ({
  servings,
  computed: {
    effectiveGrams,
    perServing: { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, ...perServing },
  },
});

const chickenAndRice = libraryRecipe(4, 1100, {
  kcal: 374.2,
  protein_g: 31.625,
  carbs_g: 42.55,
  fat_g: 8.125,
});

describe("the library and archive strings", () => {
  it("should pin the library strings the boards draw", () => {
    expect(RECIPES_LIBRARY).toEqual({
      newRecipe: "New recipe",
      searchPlaceholder: "Search recipes",
      archivedLink: "Archived recipes",
      perServingNote: "Values per serving",
    });
    expect(RECIPES_TABLE).toEqual({ recipe: "Recipe", servings: "Servings" });
  });

  it("should pin the empty, loading, failed and offline states", () => {
    expect(RECIPES_SEARCH_EMPTY).toEqual({
      title: "No recipes found",
      body: "Try another word, or create the recipe.",
    });
    expect(RECIPES_EMPTY).toEqual({
      title: "No recipes yet",
      body: "Add the foods and the method once, then log it by the serving.",
    });
    expect(RECIPES_LOADING_LABEL).toBe("Loading your recipes");
    expect(RECIPES_LOAD_FAILED.title).toBe("Couldn't load your recipes");
    expect(RECIPES_OFFLINE).toEqual({
      body: "Recipes need a connection. They'll appear when you're back online.",
      inMemoryBody: "Showing your recipes from this session. Changes need a connection.",
    });
  });

  it("should reuse the diary's failed-load sentence instead of copying it", () => {
    expect(RECIPES_LOAD_FAILED.body).toBe(DIARY_LOAD_FAILED.body);
    expect(RECIPES_LOAD_FAILED.body).toBe("Check your connection and try again.");
  });

  it("should pin the archived list, the row actions and the toasts", () => {
    expect(ARCHIVED_RECIPES).toEqual({
      title: "Archived recipes",
      note: "Archived recipes are hidden from your list and from food search. Diary entries keep their values.",
      restore: "Restore",
      empty: "Nothing archived",
    });
    expect(RECIPE_ACTIONS).toEqual({
      refresh: "Refresh ingredients",
      refreshCaption: "Check your foods for changes",
      duplicate: "Duplicate",
      duplicateCaption: "Makes a copy you can change",
      archive: "Archive",
      archiveCaption: "Hidden until you restore it",
    });
    expect(RECIPE_TOASTS).toEqual({
      archived: "Recipe archived",
      duplicated: "Recipe duplicated",
      restored: "Recipe restored",
      saved: "Recipe saved",
      ingredientRemoved: "Ingredient removed",
      stepRemoved: "Step removed",
      refreshed: "Ingredients refreshed",
    });
  });

  it("should end no button, link or toast label with a full stop", () => {
    const labels = [
      RECIPES_LIBRARY.newRecipe,
      RECIPES_LIBRARY.archivedLink,
      RECIPES_TABLE.recipe,
      RECIPES_TABLE.servings,
      ARCHIVED_RECIPES.restore,
      RECIPE_ACTIONS.duplicate,
      RECIPE_ACTIONS.archive,
      ...collectStrings(RECIPE_TOASTS),
    ];

    for (const label of labels) {
      expect(label).not.toMatch(/\.$/);
    }
  });
});

describe("describeRecipeServingCaption", () => {
  it.each([
    ["Beef chilli", libraryRecipe(6, 2100), "1 serving (350 g) · makes 6"],
    ["Chicken and rice", chickenAndRice, "1 serving (275 g) · makes 4"],
    ["Lentil and tomato soup", libraryRecipe(4, 1600), "1 serving (400 g) · makes 4"],
    ["Overnight oats, a single serving", libraryRecipe(1, 290), "1 serving (290 g) · makes 1"],
    ["Spinach and cheddar frittata", libraryRecipe(4, 620), "1 serving (155 g) · makes 4"],
    ["Turkey meatballs, archived", libraryRecipe(4, 840), "1 serving (210 g) · makes 4"],
    ["Veggie chilli, archived", libraryRecipe(4, 1520), "1 serving (380 g) · makes 4"],
  ])("should write %s as the board does", (_title, recipe, expected) => {
    expect(describeRecipeServingCaption(recipe)).toBe(expected);
  });

  it("should weigh a serving by the raw total when there is no cooked weight (720 g over 4 is 180 g)", () => {
    expect(describeRecipeServingCaption(libraryRecipe(4, 720))).toBe("1 serving (180 g) · makes 4");
  });

  it("should write a fractional number of servings with its fraction", () => {
    expect(describeRecipeServingCaption(libraryRecipe(2.5, 500))).toBe(
      "1 serving (200 g) · makes 2.5",
    );
  });

  it("should group the thousands of a large batch", () => {
    expect(describeRecipeServingCaption(libraryRecipe(1000, 2000000))).toBe(
      "1 serving (2,000 g) · makes 1,000",
    );
  });
});

describe("describeRecipeRowName", () => {
  it("should read the name, serving, yield, energy and macros, then open, as brief 20 writes it", () => {
    expect(describeRecipeRowName("Chicken and rice", chickenAndRice)).toBe(
      "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open",
    );
  });

  it("should say makes 1 for a one-serving recipe", () => {
    const overnightOats = libraryRecipe(1, 290, {
      kcal: 389,
      protein_g: 20,
      carbs_g: 52,
      fat_g: 11,
    });

    expect(describeRecipeRowName("Overnight oats", overnightOats)).toBe(
      "Overnight oats, 1 serving 290 grams, makes 1, 389 kilocalories, protein 20 grams, carbohydrate 52 grams, fat 11 grams, open",
    );
  });
});

describe("the names of a row's buttons", () => {
  it("should name the recipe each button acts on", () => {
    expect(describeMoreForRecipe("Chicken and rice")).toBe("More for Chicken and rice");
    expect(describeRestoreRecipe("Turkey meatballs")).toBe("Restore Turkey meatballs");
    expect(describeDuplicateRecipe("Chicken and rice")).toBe("Duplicate Chicken and rice");
    expect(describeArchiveRecipe("Chicken and rice")).toBe("Archive Chicken and rice");
  });
});

describe("describeArchivedLink", () => {
  it.each([
    [2, "Archived recipes (2)"],
    [1, "Archived recipes (1)"],
    [12, "Archived recipes (12)"],
  ])("should write %s archived recipes as %s", (count, expected) => {
    expect(describeArchivedLink(count)).toBe(expected);
  });
});

describe("describeArchivedLinkName", () => {
  it.each([
    [2, "Archived recipes, 2"],
    [1, "Archived recipes, 1"],
  ])("should read %s archived recipes as %s", (count, expected) => {
    expect(describeArchivedLinkName(count)).toBe(expected);
  });
});

describe("describeRecipeCount", () => {
  it.each([
    [0, "No recipes"],
    [1, "1 recipe"],
    [2, "2 recipes"],
    [25, "25 recipes"],
  ])("should write %s as %s", (count, expected) => {
    expect(describeRecipeCount(count)).toBe(expected);
  });
});

describe("describeDuplicateName", () => {
  it("should add (copy) to a name that has no copy yet", () => {
    expect(describeDuplicateName("Chicken and rice", ["Chicken and rice", "Beef chilli"])).toBe(
      "Chicken and rice (copy)",
    );
  });

  it("should number the second copy 2 and the third 3", () => {
    const first = ["Chicken and rice", "Chicken and rice (copy)"];

    expect(describeDuplicateName("Chicken and rice", first)).toBe("Chicken and rice (copy 2)");
    expect(describeDuplicateName("Chicken and rice", [...first, "Chicken and rice (copy 2)"])).toBe(
      "Chicken and rice (copy 3)",
    );
  });

  it("should take the first free number when the numbering has gaps", () => {
    expect(
      describeDuplicateName("Chicken and rice", [
        "Chicken and rice",
        "Chicken and rice (copy)",
        "Chicken and rice (copy 3)",
      ]),
    ).toBe("Chicken and rice (copy 2)");
    expect(
      describeDuplicateName("Chicken and rice", [
        "Chicken and rice",
        "Chicken and rice (copy 2)",
        "Chicken and rice (copy 3)",
      ]),
    ).toBe("Chicken and rice (copy)");
  });

  it("should not mind copies of other recipes", () => {
    expect(describeDuplicateName("Beef chilli", ["Chicken and rice (copy)"])).toBe(
      "Beef chilli (copy)",
    );
  });

  it("should copy a copy as its own recipe", () => {
    expect(describeDuplicateName("Chicken and rice (copy)", ["Chicken and rice (copy)"])).toBe(
      "Chicken and rice (copy) (copy)",
    );
  });

  it("should shorten the original, never the suffix, to stay within the name bound", () => {
    const longName = "x".repeat(MAX_RECIPE_NAME_LENGTH);

    const copy = describeDuplicateName(longName, [longName]);

    expect(copy).toBe(`${"x".repeat(MAX_RECIPE_NAME_LENGTH - " (copy)".length)} (copy)`);
    expect(copy).toHaveLength(MAX_RECIPE_NAME_LENGTH);
  });

  it("should keep a numbered suffix whole when the original is shortened", () => {
    const longName = "x".repeat(MAX_RECIPE_NAME_LENGTH);
    const firstCopy = describeDuplicateName(longName, [longName]);

    const secondCopy = describeDuplicateName(longName, [longName, firstCopy]);

    expect(secondCopy).toBe(`${"x".repeat(MAX_RECIPE_NAME_LENGTH - " (copy 2)".length)} (copy 2)`);
    expect(secondCopy).toHaveLength(MAX_RECIPE_NAME_LENGTH);
  });

  it("should count characters as the database does, by code point and not by UTF-16 unit", () => {
    const longName = "🍲".repeat(MAX_RECIPE_NAME_LENGTH);

    const copy = describeDuplicateName(longName, [longName]);

    expect(Array.from(copy)).toHaveLength(MAX_RECIPE_NAME_LENGTH);
    expect(copy.endsWith(" (copy)")).toBe(true);
  });

  it("should not leave a space in front of the suffix when the cut falls after a space", () => {
    const longName = `${"x".repeat(192)} ${"y".repeat(7)}`;

    expect(describeDuplicateName(longName, [longName])).toBe(`${"x".repeat(192)} (copy)`);
  });

  it("should keep a name that fits as it is, with its own spaces", () => {
    expect(describeDuplicateName("Chicken  and rice", [])).toBe("Chicken  and rice (copy)");
  });
});
