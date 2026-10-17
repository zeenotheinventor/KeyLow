import { describe, expect, it } from "vitest";

import {
  RECIPE_ARCHIVED_NOTICE,
  RECIPE_BADGE,
  RECIPE_UNITS,
  SEARCH_GROUP_HEADINGS,
  describeRawGramsNote,
  describeSpokenRawGramsNote,
  describeRecipeAmountBasis,
  describeRecipeLoggedAmount,
  describeRecipeLoggedRowName,
  describeRecipePer100Heading,
  describeRecipeSearchRowName,
  describeRecipeServing,
  describeRecipeYield,
  describeServingSuffix,
} from "../../src/copy";
import { freezeRecipe, withRecipeQuantity } from "../../src/diary/recipeSnapshotQuantity";

import type { RecipeSnapshot } from "../../src/diary";

type RecipeForSearch = Parameters<typeof describeRecipeSearchRowName>[1];
type LoggedAmount = Parameters<typeof describeRecipeLoggedAmount>[0];

const chickenAndRice: RecipeForSearch = {
  servings: 4,
  computed: {
    effectiveGrams: 1100,
    perServing: { kcal: 374.2, protein_g: 31.625, carbs_g: 42.55, fat_g: 8.125, fibre_g: null },
  },
};

describe("the Your recipes search group", () => {
  it("should be headed Your recipes with the caption Per serving", () => {
    expect(SEARCH_GROUP_HEADINGS.recipes).toEqual({
      title: "Your recipes",
      caption: "Per serving",
      label: "Your recipes, values per serving",
    });
  });
});

describe("the recipe strings of the amount step and the entry screen", () => {
  it("should pin the badge, the serving chip and the archived notice", () => {
    expect(RECIPE_BADGE).toBe("Recipe");
    expect(RECIPE_UNITS.serving).toBe("1 serving");
    expect(RECIPE_UNITS.grams).toBe("g");
    expect(RECIPE_ARCHIVED_NOTICE).toBe(
      "This recipe has been archived. Your entry keeps its saved values.",
    );
  });

  it("should end no chip or badge with a full stop", () => {
    expect(RECIPE_BADGE).not.toMatch(/\.$/);
    expect(RECIPE_UNITS.serving).not.toMatch(/\.$/);
    expect(RECIPE_UNITS.grams).not.toMatch(/\.$/);
  });
});

describe("describeServingSuffix", () => {
  it.each([
    [1, "serving"],
    [1.5, "servings"],
    [2, "servings"],
    [0.5, "servings"],
    [0, "servings"],
    [10, "servings"],
  ])("should write the suffix for %s as %s", (amount, expected) => {
    expect(describeServingSuffix(amount)).toBe(expected);
  });
});

describe("describeRecipeServing", () => {
  it("should write one serving with its cooked weight", () => {
    expect(describeRecipeServing(chickenAndRice)).toBe("1 serving (275 g)");
  });

  it("should weigh a serving by the raw total when there is no cooked weight", () => {
    expect(
      describeRecipeServing({
        ...chickenAndRice,
        computed: { ...chickenAndRice.computed, effectiveGrams: 720 },
      }),
    ).toBe("1 serving (180 g)");
  });
});

describe("describeRecipeLoggedAmount", () => {
  it.each<[string, LoggedAmount, string]>([
    ["one serving", { unit: "serving", quantity: 1, resolvedGrams: 275 }, "1 serving (275 g)"],
    [
      "one and a half, where 412.5 g rounds half up",
      { unit: "serving", quantity: 1.5, resolvedGrams: 412.5 },
      "1.5 servings (413 g)",
    ],
    [
      "a quarter",
      { unit: "serving", quantity: 0.25, resolvedGrams: 68.75 },
      "0.25 servings (69 g)",
    ],
    [
      "a third, rounded to two decimals",
      { unit: "serving", quantity: 1.333, resolvedGrams: 366.575 },
      "1.33 servings (367 g)",
    ],
    ["two", { unit: "serving", quantity: 2, resolvedGrams: 550 }, "2 servings (550 g)"],
    ["a big batch", { unit: "serving", quantity: 4, resolvedGrams: 1100 }, "4 servings (1,100 g)"],
    ["grams", { unit: "g", quantity: 300, resolvedGrams: 300 }, "300 g"],
    ["grams with a decimal", { unit: "g", quantity: 7.5, resolvedGrams: 7.5 }, "7.5 g"],
    ["grams past a thousand", { unit: "g", quantity: 1250, resolvedGrams: 1250 }, "1,250 g"],
  ])("should write %s", (_description, amount, expected) => {
    expect(describeRecipeLoggedAmount(amount)).toBe(expected);
  });

  it("should accept a recipe entry's snapshot as it is", () => {
    const snapshot = {
      unit: "serving",
      quantity: 1,
      resolvedGrams: 275,
    } satisfies Pick<RecipeSnapshot, "unit" | "quantity" | "resolvedGrams">;

    expect(describeRecipeLoggedAmount(snapshot)).toBe("1 serving (275 g)");
  });
});

describe("describeRecipeAmountBasis", () => {
  it.each<[LoggedAmount, string]>([
    [{ unit: "serving", quantity: 1, resolvedGrams: 275 }, "For 1 serving (275 g)"],
    [{ unit: "serving", quantity: 1.5, resolvedGrams: 412.5 }, "For 1.5 servings (413 g)"],
    [{ unit: "g", quantity: 300, resolvedGrams: 300 }, "For 300 g"],
    [{ unit: "g", quantity: 275, resolvedGrams: 275 }, "For 275 g"],
  ])("should write %j as %s", (amount, expected) => {
    expect(describeRecipeAmountBasis(amount)).toBe(expected);
  });
});

describe("describeRecipeYield", () => {
  it.each([
    [4, 1100, "Makes 4 · 1,100 g cooked"],
    [6, 1650, "Makes 6 · 1,650 g cooked"],
    [2, 310, "Makes 2 · 310 g cooked"],
    [4, 999, "Makes 4 · 999 g cooked"],
    [1, 50000, "Makes 1 · 50,000 g cooked"],
    [4, null, "Makes 4 · no cooked weight"],
    [2.5, 500, "Makes 2.5 · 500 g cooked"],
  ])(
    "should write %s servings and a cooked weight of %s as %s",
    (servings, yieldGrams, expected) => {
      expect(describeRecipeYield(servings, yieldGrams)).toBe(expected);
    },
  );

  it("should round a cooked weight under 10 g to whole grams, which formatGrams alone would not", () => {
    expect(describeRecipeYield(1, 7.5)).toBe("Makes 1 · 8 g cooked");
  });

  it("should write a cooked weight with a fraction of a gram as whole grams", () => {
    expect(describeRecipeYield(4, 1100.4)).toBe("Makes 4 · 1,100 g cooked");
  });
});

describe("describeRecipePer100Heading", () => {
  it("should say cooked for a recipe with a cooked weight and raw for one without", () => {
    expect(describeRecipePer100Heading(1100)).toBe("Per 100 g cooked");
    expect(describeRecipePer100Heading(null)).toBe("Per 100 g raw");
  });
});

describe("describeRawGramsNote", () => {
  it("should say the grams are of the raw ingredients, with their total", () => {
    expect(describeRawGramsNote(720)).toBe(
      "No cooked weight is set, so these grams are of the raw ingredients (720 g in total).",
    );
  });

  it("should group the thousands of the raw total", () => {
    expect(describeRawGramsNote(1496.8)).toBe(
      "No cooked weight is set, so these grams are of the raw ingredients (1,497 g in total).",
    );
  });
});

describe("describeSpokenRawGramsNote", () => {
  it("should read the amount and then the note with the raw total, as brief 23 writes it", () => {
    expect(describeSpokenRawGramsNote(275, 720)).toBe(
      "For 275 grams. No cooked weight is set, so these grams are of the raw ingredients, 720 grams in total.",
    );
  });

  it("should use the singular for exactly one gram", () => {
    expect(describeSpokenRawGramsNote(1, 720)).toContain("For 1 gram.");
  });
});

describe("describeRecipeSearchRowName", () => {
  it("should read the title, recipe, serving, energy and macros, then choose amount", () => {
    expect(describeRecipeSearchRowName("Chicken and rice", chickenAndRice)).toBe(
      "Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, choose amount",
    );
  });

  it("should leave out choose amount for a row that opens nothing yet", () => {
    expect(
      describeRecipeSearchRowName("Chicken and rice", chickenAndRice, { choosesAmount: false }),
    ).toBe(
      "Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
    );
  });
});

describe("describeRecipeLoggedRowName", () => {
  const frozenChickenAndRice = freezeRecipe({
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Chicken and rice",
    servings: 4,
    yield_grams: 1100,
    computed: {
      effectiveGrams: 1100,
      total: { kcal: 1496.8, protein_g: 126.5, carbs_g: 170.2, fat_g: 32.5, fibre_g: null },
    },
  });

  it("should read the time, title, recipe, amount and the stats of the amount logged", () => {
    const snapshot = withRecipeQuantity(frozenChickenAndRice, { unit: "serving", quantity: 1 });

    expect(describeRecipeLoggedRowName("18:00", snapshot)).toBe(
      "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
    );
  });

  it("should say the grams alone for an entry logged by grams", () => {
    const snapshot = withRecipeQuantity(frozenChickenAndRice, { unit: "g", quantity: 300 });

    expect(describeRecipeLoggedRowName("18:00", snapshot)).toBe(
      "18:00, Chicken and rice, recipe, 300 grams, 408 kilocalories, protein 35 grams, carbohydrate 46 grams, fat 8.9 grams",
    );
  });

  it("should use the plural for 1.5 servings", () => {
    const snapshot = withRecipeQuantity(frozenChickenAndRice, { unit: "serving", quantity: 1.5 });

    expect(describeRecipeLoggedRowName("18:00", snapshot)).toBe(
      "18:00, Chicken and rice, recipe, 1.5 servings 413 grams, 561 kilocalories, protein 47 grams, carbohydrate 64 grams, fat 12 grams",
    );
  });
});
