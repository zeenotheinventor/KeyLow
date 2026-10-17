import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  ADD_INGREDIENT,
  DISCARD_SHEET,
  RECIPE_EDITOR,
  RECIPE_NOT_FOUND,
  RECIPE_PROBLEMS,
  RECIPE_TOASTS,
  STEP_SHEET,
  describeCookedWeightHelper,
  describeCountSuffix,
  describeChooseAmountRowName,
  describeCountedHeading,
  describeEditStep,
  describeIngredientRowName,
  describeMoveStep,
  describeRecipePer100,
  describeRecipePerServing,
  describeRecipePerServingCard,
  describeRecipeProblem,
  describeRemoveIngredient,
  describeRemoveStep,
  describeServingsFieldSuffix,
  describeStepLength,
  describeStepMoved,
  describeStepRowName,
  describeStepTextName,
  describeStepTitle,
} from "../../src/copy";
import {
  MAX_RECIPE_INGREDIENTS,
  MAX_RECIPE_NAME_LENGTH,
  MAX_RECIPE_SERVINGS,
  MAX_RECIPE_STEPS,
  MAX_RECIPE_STEP_LENGTH,
  MAX_RECIPE_YIELD_GRAMS,
  validateRecipeDraft,
} from "../../src/recipes";

import type { RecipeDraftProblem } from "../../src/recipes";

describe("the editor's strings", () => {
  it("should pin the editor strings brief 21 lists", () => {
    expect(RECIPE_EDITOR).toEqual({
      newTitle: "New recipe",
      loadingTitle: "Recipe",
      loadingLabel: "Loading recipe",
      namePlaceholder: "e.g. Veggie chilli",
      servings: "Servings",
      cookedWeight: "Cooked weight (optional)",
      cookedWeightName: "Cooked weight in grams, optional",
      perServingNoValue: "Per serving",
      perServingRegionName: "Per serving",
      ingredients: "Ingredients",
      ingredientsEmpty: "Add the foods that go into it.",
      addIngredient: "Add ingredient",
      instructions: "Instructions",
      instructionsEmpty: "No steps yet. Add the method one step at a time.",
      reorder: "Reorder",
      addStep: "Add step",
      addToRecipe: "Add to recipe",
      removeFromRecipe: "Remove from recipe",
      offlineEditingBody: "Your changes stay on this screen. Saving needs a connection.",
    });
  });

  it("should pin the amount step titles, the step sheet and the discard sheet", () => {
    expect(ADD_INGREDIENT).toEqual({ title: "Add ingredient", editTitle: "Edit ingredient" });
    expect(STEP_SHEET).toEqual({
      done: "Done",
      remove: "Remove step",
      placeholder: "Describe this step",
    });
    expect(DISCARD_SHEET).toEqual({
      editTitle: "Discard changes?",
      editBody: "Your changes to this recipe won't be saved.",
      newTitle: "Discard this recipe?",
      newBody: "It hasn't been saved yet.",
      discard: "Discard changes",
      keepEditing: "Keep editing",
    });
  });

  it("should pin the not found state and the editor's toasts", () => {
    expect(RECIPE_NOT_FOUND).toEqual({
      title: "Recipe not found",
      body: "Check the link, or go back to your recipes.",
    });
    expect(RECIPE_TOASTS).toMatchObject({
      saved: "Recipe saved",
      ingredientRemoved: "Ingredient removed",
      stepRemoved: "Step removed",
    });
  });

  it("should end no button, link, heading, toast or title with a full stop", () => {
    const labels = [
      RECIPE_EDITOR.newTitle,
      RECIPE_EDITOR.servings,
      RECIPE_EDITOR.cookedWeight,
      RECIPE_EDITOR.ingredients,
      RECIPE_EDITOR.addIngredient,
      RECIPE_EDITOR.instructions,
      RECIPE_EDITOR.reorder,
      RECIPE_EDITOR.addStep,
      RECIPE_EDITOR.addToRecipe,
      RECIPE_EDITOR.removeFromRecipe,
      ...collectStrings(ADD_INGREDIENT),
      ...collectStrings(STEP_SHEET),
      DISCARD_SHEET.editTitle,
      DISCARD_SHEET.newTitle,
      DISCARD_SHEET.discard,
      DISCARD_SHEET.keepEditing,
      RECIPE_NOT_FOUND.title,
      RECIPE_TOASTS.saved,
      RECIPE_TOASTS.ingredientRemoved,
      RECIPE_TOASTS.stepRemoved,
    ];

    for (const label of labels) {
      expect(label).not.toMatch(/\.$/);
    }
  });

  it("should hold only non-empty text without an em dash", () => {
    const strings = [
      ...collectStrings(RECIPE_EDITOR),
      ...collectStrings(ADD_INGREDIENT),
      ...collectStrings(STEP_SHEET),
      ...collectStrings(RECIPE_PROBLEMS),
      ...collectStrings(DISCARD_SHEET),
      ...collectStrings(RECIPE_NOT_FOUND),
    ];

    for (const text of strings) {
      expect(text.trim()).not.toBe("");
      expect(text).not.toContain("\u2014");
    }
  });
});

describe("the problem sentences", () => {
  it("should pin the sentences brief 21 draws", () => {
    expect(RECIPE_PROBLEMS).toEqual({
      servings: "Enter servings above 0.",
      servingsTooMany: "Enter 1,000 servings or fewer.",
      cookedWeight: "Enter a cooked weight above 0, or leave it blank.",
      cookedWeightTooLarge: "Enter 100,000 g or less.",
      noIngredient: "Add at least one ingredient.",
      ingredientLimit: "Up to 100 ingredients",
      stepLimit: "Up to 50 steps",
      stepTooLong: "Keep a step to 1,000 characters or fewer.",
      ingredientInvalid: "Check the amount of each ingredient.",
    });
  });

  it("should write the bounds that core holds", () => {
    expect(MAX_RECIPE_SERVINGS).toBe(1000);
    expect(MAX_RECIPE_YIELD_GRAMS).toBe(100000);
    expect(MAX_RECIPE_INGREDIENTS).toBe(100);
    expect(MAX_RECIPE_STEPS).toBe(50);
    expect(MAX_RECIPE_STEP_LENGTH).toBe(1000);
    expect(MAX_RECIPE_NAME_LENGTH).toBe(200);
  });
});

describe("describeRecipeProblem", () => {
  const cases = [
    ["name_required", "Name is required"],
    ["name_too_long", "Name must be 200 characters or fewer"],
    ["servings_invalid", "Enter servings above 0."],
    ["servings_too_many", "Enter 1,000 servings or fewer."],
    ["cooked_weight_invalid", "Enter a cooked weight above 0, or leave it blank."],
    ["cooked_weight_too_large", "Enter 100,000 g or less."],
    ["ingredients_none", "Add at least one ingredient."],
    ["ingredients_too_many", "Up to 100 ingredients"],
    ["ingredient_invalid", "Check the amount of each ingredient."],
    ["steps_too_many", "Up to 50 steps"],
    ["step_too_long", "Keep a step to 1,000 characters or fewer."],
  ] as const satisfies readonly (readonly [RecipeDraftProblem, string])[];

  it("should list every code in the union, so a code added to core fails the build until it has copy", () => {
    // True only while the cases cover the whole union: the assignment does not compile otherwise.
    const everyCodeIsListed: [RecipeDraftProblem] extends [(typeof cases)[number][0]]
      ? true
      : never = true;

    expect(everyCodeIsListed).toBe(true);
  });

  it.each(cases)("should write %s as %s", (code, sentence) => {
    expect(describeRecipeProblem(code)).toBe(sentence);
  });

  it("should give every code a sentence of its own", () => {
    const sentences = cases.map(([code]) => describeRecipeProblem(code));

    expect(new Set(sentences).size).toBe(cases.length);
  });

  it("should read the four problems of the invalid board in field order", () => {
    const result = validateRecipeDraft({
      name: "",
      servings: "0",
      cookedWeight: "-5",
      ingredients: [],
      steps: [],
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems.map(describeRecipeProblem)).toEqual([
      "Name is required",
      "Enter servings above 0.",
      "Enter a cooked weight above 0, or leave it blank.",
      "Add at least one ingredient.",
    ]);
  });
});

describe("describeServingsFieldSuffix", () => {
  it.each([
    ["1", "serving"],
    ["1.0", "serving"],
    ["4", "servings"],
    ["2.5", "servings"],
    ["0", "servings"],
    ["", "servings"],
    ["abc", "servings"],
  ])("should write the suffix of a field reading %j as %s", (fieldText, expected) => {
    expect(describeServingsFieldSuffix(fieldText)).toBe(expected);
  });
});

describe("describeCookedWeightHelper", () => {
  it("should name the raw total in brackets (500 + 200 + 20 g)", () => {
    const chicken = [{ resolved_grams: 500 }, { resolved_grams: 200 }, { resolved_grams: 20 }];

    expect(describeCookedWeightHelper(chicken)).toBe(
      "The whole dish once cooked. Leave it blank and per 100 g uses the raw total (720 g).",
    );
  });

  it("should leave the brackets out when there are no ingredients", () => {
    expect(describeCookedWeightHelper([])).toBe(
      "The whole dish once cooked. Leave it blank and per 100 g uses the raw total.",
    );
  });

  it("should write the raw total in whole grams with a thousands separator, as the board does", () => {
    expect(describeCookedWeightHelper([{ resolved_grams: 1234.4 }, { resolved_grams: 300 }])).toBe(
      "The whole dish once cooked. Leave it blank and per 100 g uses the raw total (1,534 g).",
    );
    expect(describeCookedWeightHelper([{ resolved_grams: 4.6 }])).toBe(
      "The whole dish once cooked. Leave it blank and per 100 g uses the raw total (5 g).",
    );
  });
});

describe("the Per serving card", () => {
  it.each([
    [275, "Per serving (275 g)"],
    [180, "Per serving (180 g)"],
    [220, "Per serving (220 g)"],
    [2000, "Per serving (2,000 g)"],
    [6.25, "Per serving (6.3 g)"],
  ])("should caption %s g of a serving as %s", (grams, expected) => {
    expect(describeRecipePerServing(grams)).toBe(expected);
  });

  it("should write the per 100 g line of a cooked weight and of the raw total", () => {
    expect(describeRecipePer100("cooked", 136.4)).toBe("Per 100 g cooked: 136 kcal");
    expect(describeRecipePer100("raw", 207.8)).toBe("Per 100 g raw: 208 kcal");
  });

  it("should write an en dash for a per 100 g value that is not known", () => {
    expect(describeRecipePer100("raw", null)).toBe("Per 100 g raw: – kcal");
  });

  it("should read the card for a screen reader", () => {
    expect(
      describeRecipePerServingCard({
        kcal: 374.2,
        protein_g: 31.625,
        carbs_g: 42.55,
        fat_g: 8.125,
      }),
    ).toBe("374 kilocalories per serving, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams");
  });

  it("should read the macros alone when the energy is not known", () => {
    expect(
      describeRecipePerServingCard({ kcal: null, protein_g: 32, carbs_g: 43, fat_g: 8.1 }),
    ).toBe("protein 32 grams, carbohydrate 43 grams, fat 8.1 grams");
  });

  it("should flag a macro that is not known in lower case after the energy", () => {
    expect(
      describeRecipePerServingCard({ kcal: 374.2, protein_g: 32, carbs_g: null, fat_g: 8.1 }),
    ).toBe("374 kilocalories per serving, needs review");
  });

  it("should flag the review alone when nothing is known", () => {
    expect(
      describeRecipePerServingCard({ kcal: null, protein_g: null, carbs_g: null, fat_g: null }),
    ).toBe("Needs review");
  });

  it("should say 1 kilocalorie and 1 gram in the singular", () => {
    expect(describeRecipePerServingCard({ kcal: 1, protein_g: 1, carbs_g: 0, fat_g: 0.4 })).toBe(
      "1 kilocalorie per serving, protein 1 gram, carbohydrate 0 grams, fat 0.4 grams",
    );
  });
});

describe("the names of the ingredient controls", () => {
  it("should name the food each button removes", () => {
    expect(describeRemoveIngredient("Onions, raw")).toBe("Remove Onions, raw");
  });

  it("should name the row that opens the amount step, as the board does", () => {
    expect(describeIngredientRowName("Onions, raw", "1 medium (110 g)")).toBe(
      "Onions, raw, 1 medium (110 g), change amount",
    );
  });
});

describe("the name of an ingredient search row", () => {
  it("should name the food, its serving and what the row does, as the brief does", () => {
    expect(describeChooseAmountRowName("Spinach, baby, raw", "100 g")).toBe(
      "Spinach, baby, raw, 100 g, choose amount",
    );
  });

  it("should put a brand after the name", () => {
    expect(describeChooseAmountRowName("Protein bar", "1 bar (60 g)", { brand: "Barebells" })).toBe(
      "Protein bar, Barebells, 1 bar (60 g), choose amount",
    );
  });

  it("should say a food needs review before it says what the row does", () => {
    expect(describeChooseAmountRowName("Mystery bar", "100 g", { needsReview: true })).toBe(
      "Mystery bar, 100 g, Needs review, choose amount",
    );
  });
});

describe("the names of the step controls", () => {
  it("should title a step by its place", () => {
    expect(describeStepTitle(3)).toBe("Step 3");
    expect(describeStepTitle(6)).toBe("Step 6");
  });

  it("should name the text area of a step", () => {
    expect(describeStepTextName(3)).toBe("Step 3 text");
  });

  it("should name the move buttons by the step's place", () => {
    expect(describeMoveStep(1, "up")).toBe("Move step 1 up");
    expect(describeMoveStep(1, "down")).toBe("Move step 1 down");
    expect(describeMoveStep(12, "up")).toBe("Move step 12 up");
  });

  it("should announce where a moved step landed", () => {
    expect(describeStepMoved(1, 5)).toBe("Step moved to 1 of 5");
    expect(describeStepMoved(5, 5)).toBe("Step moved to 5 of 5");
  });

  it("should name the web buttons of a step", () => {
    expect(describeEditStep(3)).toBe("Edit step 3");
    expect(describeRemoveStep(3)).toBe("Remove step 3");
  });

  it("should name a step's row with its whole text, then edit", () => {
    const text =
      "Heat the oil in a large pan and fry the chicken over a medium-high heat for 6 to 8 minutes, turning it now and then, until it is golden on every side and cooked through with no pink left in the middle.";

    expect(describeStepRowName(3, text)).toBe(`Step 3, ${text}, edit`);
  });
});

describe("describeStepLength", () => {
  it("should write the counter of the sample step 3 as 201 / 1,000", () => {
    expect(describeStepLength("x".repeat(201))).toBe("201 / 1,000");
  });

  it("should write an empty step as 0 / 1,000", () => {
    expect(describeStepLength("")).toBe("0 / 1,000");
  });

  it("should count an emoji as one character, as the database does", () => {
    expect(describeStepLength("Serve with lime \u{1F34B}\u{1F34B}")).toBe("18 / 1,000");
    expect("Serve with lime \u{1F34B}\u{1F34B}".length).toBe(20);
  });

  it("should count the step as it is saved, without the spaces round it", () => {
    expect(describeStepLength("  Stir.  ")).toBe("5 / 1,000");
  });

  it("should agree with the validator at the bound: 1,000 characters pass, 1,001 are refused", () => {
    const problemsOf = (step: string) => {
      const result = validateRecipeDraft({
        name: "Chicken and rice",
        servings: "4",
        cookedWeight: "",
        ingredients: [],
        steps: [step],
      });

      return result.ok ? [] : result.problems;
    };
    const atTheBound = "\u{1F34B}".repeat(MAX_RECIPE_STEP_LENGTH);
    const overTheBound = `${atTheBound}x`;

    expect(describeStepLength(atTheBound)).toBe("1,000 / 1,000");
    expect(problemsOf(atTheBound)).not.toContain("step_too_long");
    expect(describeStepLength(overTheBound)).toBe("1,001 / 1,000");
    expect(problemsOf(overTheBound)).toContain("step_too_long");
  });

  it("should write a step over the bound with its true length", () => {
    expect(describeStepLength("x".repeat(1001))).toBe("1,001 / 1,000");
  });
});

describe("the count after a heading", () => {
  it.each([
    [1, " · 1"],
    [3, " · 3"],
    [100, " · 100"],
  ])("should write a count of %s as %j", (count, expected) => {
    expect(describeCountSuffix(count)).toBe(expected);
  });

  it("should write no count for none, as the empty boards draw it", () => {
    expect(describeCountSuffix(0)).toBe("");
  });

  it("should join a heading and its count", () => {
    expect(describeCountedHeading(RECIPE_EDITOR.ingredients, 3)).toBe("Ingredients · 3");
    expect(describeCountedHeading(RECIPE_EDITOR.instructions, 0)).toBe("Instructions");
  });
});
