import { describe, expect, it } from "vitest";

import {
  ADJUSTMENT_ADDITION_GRAMS,
  adjustmentCandidatesOf,
  adjustmentSummaryOf,
  assistantRecipeDraftSchema,
  buildAdjustmentDraft,
  unmetAfterFit,
} from "../../src/assistant";
import { buildRecipeIngredient, computeRecipe } from "../../src/recipes";
import { adjustmentTarget, isWithinTolerance } from "../../src/recipes/fit";
import { buildFood } from "../../src/testing";

import type { AdjustmentCandidate, AdjustmentRecipe } from "../../src/assistant";
import type { PalatePreference } from "../../src/palate";
import type { RecipeIngredient } from "../../src/recipes";
import type { Food } from "../../src/schemas/food";

const idOf = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const chicken = buildFood({
  id: idOf(1),
  name: "Chicken, breast, grilled without skin, meat only",
  kcal: 148,
  protein_g: 32,
  fat_g: 2.2,
  carbs_g: 0,
});
const rice = buildFood({
  id: idOf(2),
  name: "Rice, white, long grain, boiled in unsalted water",
  kcal: 131,
  protein_g: 2.8,
  fat_g: 0.4,
  carbs_g: 31.1,
});
const broccoli = buildFood({
  id: idOf(3),
  name: "Broccoli, green, boiled in unsalted water",
  kcal: 28,
  protein_g: 3.3,
  fat_g: 0.5,
  carbs_g: 2.8,
});
const oil = buildFood({
  id: idOf(4),
  name: "Oil, olive",
  kcal: 899,
  protein_g: 0,
  fat_g: 99.9,
  carbs_g: 0,
});
const oats = buildFood({
  id: idOf(5),
  name: "Porridge oats, unfortified",
  kcal: 381,
  protein_g: 10.9,
  fat_g: 8.1,
  carbs_g: 70.7,
});
const milk = buildFood({
  id: idOf(6),
  name: "Milk, whole, pasteurised, average",
  kcal: 63,
  protein_g: 3.4,
  fat_g: 3.6,
  carbs_g: 4.6,
});
const banana = buildFood({
  id: idOf(7),
  name: "Bananas, flesh only",
  kcal: 81,
  protein_g: 1.2,
  fat_g: 0.1,
  carbs_g: 20.3,
});
const peanutButter = buildFood({
  id: idOf(8),
  name: "Peanut butter, smooth",
  kcal: 623,
  protein_g: 22,
  fat_g: 51,
  carbs_g: 13,
});
const bucket = buildFood({
  id: idOf(9),
  name: "Restaurant bucket",
  basis: "per_portion",
  kcal: 500,
  protein_g: 20,
  fat_g: 30,
  carbs_g: 40,
});

const ingredientOf = (food: Food, grams: number) =>
  buildRecipeIngredient(food, { quantity: grams, unit: "g" });

const chickenAndRice = (): AdjustmentRecipe => ({
  id: idOf(100),
  name: "Eval chicken and rice",
  servings: 2,
  steps: ["Grill the chicken.", "Boil the rice."],
  ingredients: [
    ingredientOf(chicken, 260),
    ingredientOf(rice, 360),
    ingredientOf(broccoli, 160),
    ingredientOf(oil, 15),
  ],
});

const porridge = (): AdjustmentRecipe => ({
  id: idOf(101),
  name: "Eval porridge bowl",
  servings: 1,
  steps: ["Heat the oats and the milk."],
  ingredients: [ingredientOf(oats, 50), ingredientOf(milk, 200), ingredientOf(banana, 90)],
});

const withIngredient = (
  recipe: AdjustmentRecipe,
  ingredient: RecipeIngredient,
): AdjustmentRecipe => ({ ...recipe, ingredients: [...recipe.ingredients, ingredient] });

const perServingOf = (recipe: AdjustmentRecipe) =>
  computeRecipe({ servings: recipe.servings, yieldGrams: null, ingredients: recipe.ingredients })
    .perServing;

const proteinPlus30 = (recipe: AdjustmentRecipe) =>
  adjustmentTarget(perServingOf(recipe), { nutrient: "protein_g", mode: "add", value: 30 });

const candidateOf = (food: Food): AdjustmentCandidate => ({ food, portions: [] });

const preference = (kind: PalatePreference["kind"], label: string): PalatePreference => ({
  id: idOf(900),
  kind,
  foodId: null,
  recipeId: null,
  label,
});

const drafted = (
  input: Partial<Parameters<typeof buildAdjustmentDraft>[0]> & { recipe: AdjustmentRecipe },
) => {
  const outcome = buildAdjustmentDraft({
    target: proteinPlus30(input.recipe),
    additions: [],
    preferences: [],
    ...input,
  });
  if (outcome.status !== "drafted") {
    throw new Error(`Expected a draft, got ${outcome.status}`);
  }
  return outcome.draft;
};

describe("buildAdjustmentDraft, by scaling", () => {
  it("should draft chicken and rice with 30 g more protein a serving and the calories held", () => {
    const recipe = chickenAndRice();
    const draft = drafted({ recipe });

    expect(draft.variant).toBe("adjustment");
    expect(draft.recipeId).toBe(recipe.id);
    expect(draft.fit?.status).toBe("within");
    expect(draft.perServing.protein_g).toBeGreaterThanOrEqual(74.3);
    expect(draft.perServing.kcal).toBeGreaterThanOrEqual(518 * 0.95);
    expect(draft.perServing.kcal).toBeLessThanOrEqual(518 * 1.05);
    expect(draft.ingredients.every(({ change }) => change !== "added")).toBe(true);
  });

  it("should give a draft the schema accepts, with name, servings and steps of the recipe", () => {
    const recipe = chickenAndRice();
    const draft = drafted({ recipe });

    expect(assistantRecipeDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft.name).toBe("Eval chicken and rice");
    expect(draft.servings).toBe(2);
    expect(draft.steps).toEqual(["Grill the chicken.", "Boil the rice."]);
  });

  it("should state before as the figures of the stored recipe a serving", () => {
    const recipe = chickenAndRice();
    const stored = perServingOf(recipe);
    const draft = drafted({ recipe });

    expect(draft.before).toEqual({
      kcal: stored.kcal,
      protein_g: stored.protein_g,
      carbs_g: stored.carbs_g,
      fat_g: stored.fat_g,
    });
  });

  it("should state after as exactly computeRecipe over the amounts of the lines", () => {
    const recipe = chickenAndRice();
    const draft = drafted({ recipe });
    const foods = [chicken, rice, broccoli, oil];
    const computed = computeRecipe({
      servings: draft.servings,
      yieldGrams: null,
      ingredients: draft.ingredients.map(({ grams }, index) =>
        ingredientOf(foods[index] ?? chicken, grams),
      ),
    });

    expect(draft.perServing).toEqual({
      kcal: computed.perServing.kcal,
      protein_g: computed.perServing.protein_g,
      carbs_g: computed.perServing.carbs_g,
      fat_g: computed.perServing.fat_g,
    });
  });

  it("should mark each line as changed or same and keep the grams it had before", () => {
    const recipe = chickenAndRice();
    const draft = drafted({ recipe });

    expect(draft.ingredients.map(({ beforeGrams }) => beforeGrams)).toEqual([260, 360, 160, 15]);
    for (const line of draft.ingredients) {
      expect(line.change).toBe(line.grams === line.beforeGrams ? "same" : "changed");
    }
    expect(draft.ingredients[0]?.grams).toBeGreaterThan(260);
    expect(draft.ingredients[0]?.foodName).toBe(chicken.name);
    expect(draft.ingredients[0]?.foodId).toBe(chicken.id);
  });

  it("should leave the recipe it was given untouched", () => {
    const recipe = chickenAndRice();
    const copy = structuredClone(recipe);
    drafted({ recipe });

    expect(recipe).toEqual(copy);
  });

  it("should keep a food per portion as it is and count it", () => {
    const recipe = withIngredient(
      chickenAndRice(),
      buildRecipeIngredient(bucket, {
        quantity: 1,
        unit: "portion",
        portion: { id: idOf(300), label: "1 bucket", grams: null, ml: null },
      }),
    );
    const draft = drafted({ recipe, target: { kcal: perServingOf(recipe).kcal ?? 0 } });
    const bucketLine = draft.ingredients.at(-1);

    expect(bucketLine?.grams).toBe(0);
    expect(bucketLine?.change).toBe("same");
    expect(bucketLine?.kcal).toBe(500);
    expect(draft.perServing.kcal).toBeCloseTo(perServingOf(recipe).kcal ?? 0, 6);
  });
});

describe("buildAdjustmentDraft, the frozen line each ingredient carries", () => {
  it("should carry the original ingredient of a changed line, not the rescaled one", () => {
    const recipe = chickenAndRice();
    const draft = drafted({ recipe });
    const changed = draft.ingredients.findIndex(({ change }) => change === "changed");

    expect(changed).toBeGreaterThanOrEqual(0);
    expect(draft.ingredients[changed]?.frozen).toEqual(recipe.ingredients[changed]);
  });

  it("should carry a line counted by portion with its quantity, unit and portion", () => {
    const bucketLine = buildRecipeIngredient(bucket, {
      quantity: 2,
      unit: "portion",
      portion: { id: idOf(300), label: "1 bucket", grams: null, ml: null },
    });
    const recipe = withIngredient(chickenAndRice(), bucketLine);
    const draft = drafted({ recipe, target: { kcal: perServingOf(recipe).kcal ?? 0 } });

    expect(draft.ingredients.at(-1)?.frozen).toEqual(bucketLine);
    expect(draft.ingredients.at(-1)?.frozen).toMatchObject({
      quantity: 2,
      unit: "portion",
      portion_id: idOf(300),
      resolved_grams: 0,
    });
  });

  it("should carry the ingredient it made for an added food, in the grams drawn", () => {
    const recipe = porridge();
    const draft = drafted({
      recipe,
      target: proteinPlus30(recipe),
      additions: [candidateOf(chicken)],
    });
    const added = draft.ingredients.find(({ change }) => change === "added");

    expect(added?.frozen).toEqual(
      buildRecipeIngredient(chicken, { quantity: added?.grams ?? 0, unit: "g" }),
    );
  });
});

describe("assistantRecipeDraftSchema, the frozen line", () => {
  const withoutFrozen = () => {
    const [first] = drafted({ recipe: chickenAndRice() }).ingredients;
    return { ...first, frozen: undefined };
  };
  const parsedLine = (line: unknown) => {
    const draft = drafted({ recipe: chickenAndRice() });
    const parsed = assistantRecipeDraftSchema.parse({ ...draft, ingredients: [line] });
    return parsed.ingredients[0];
  };

  it("should read a draft stored before the frozen line existed, with none", () => {
    expect(parsedLine(withoutFrozen())?.frozen ?? null).toBeNull();
  });

  it("should read a frozen line it cannot parse as none, never a failed turn", () => {
    expect(parsedLine({ ...withoutFrozen(), frozen: { food_id: "x" } })?.frozen).toBeNull();
  });

  it("should keep a frozen line it can parse", () => {
    const draft = drafted({ recipe: chickenAndRice() });
    const first = draft.ingredients[0];

    expect(parsedLine(first)?.frozen).toEqual(first?.frozen);
  });
});

describe("buildAdjustmentDraft, when scaling is not enough", () => {
  it("should be unreachable for porridge by scaling alone, saying what limits it", () => {
    const recipe = porridge();
    const outcome = buildAdjustmentDraft({
      recipe,
      target: proteinPlus30(recipe),
      additions: [],
      preferences: [],
    });

    expect(outcome.status).toBe("unreachable");
    if (outcome.status !== "unreachable") {
      return;
    }
    expect(outcome.misses.map(({ nutrient }) => nutrient)).toContain("protein_g");
    expect(outcome.reached.protein_g).toBeLessThan(35);
    expect(outcome.misses.flatMap(({ limitedBy }) => limitedBy).length).toBeGreaterThan(0);
    for (const name of outcome.misses.flatMap(({ limitedBy }) => limitedBy)) {
      expect(recipe.ingredients.map(({ snapshot }) => snapshot.name)).toContain(name);
    }
  });

  it("should reach the target by adding a food, verified by core, and mark the line added", () => {
    const recipe = porridge();
    const target = proteinPlus30(recipe);
    const draft = drafted({ recipe, target, additions: [candidateOf(chicken)] });
    const added = draft.ingredients.find(({ change }) => change === "added");

    expect(added?.foodId).toBe(chicken.id);
    expect(added?.beforeGrams).toBeNull();
    expect(added?.grams).toBeGreaterThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.minimum);
    expect(added?.grams).toBeLessThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.maximum);
    expect(isWithinTolerance({ ...draft.perServing, fibre_g: null }, target)).toBe(true);
    expect(draft.fit?.status).toBe("within");
  });

  it("should state after as computeRecipe over the amounts of the lines, an added food included", () => {
    const recipe = porridge();
    const draft = drafted({ recipe, additions: [candidateOf(chicken)] });
    const foods = [oats, milk, banana, chicken];
    const computed = computeRecipe({
      servings: draft.servings,
      yieldGrams: null,
      ingredients: draft.ingredients.map(({ grams }, index) =>
        ingredientOf(foods[index] ?? chicken, grams),
      ),
    });

    expect(draft.perServing.protein_g).toBe(computed.perServing.protein_g);
    expect(draft.perServing.kcal).toBe(computed.perServing.kcal);
  });

  it("should still be unreachable when the added food does not help, with the closest figures", () => {
    const recipe = porridge();
    const outcome = buildAdjustmentDraft({
      recipe,
      target: proteinPlus30(recipe),
      additions: [candidateOf(banana)],
      preferences: [],
    });

    expect(outcome.status).toBe("unreachable");
  });
});

describe("buildAdjustmentDraft, foods the person avoids", () => {
  it("should leave an added food the person avoids out of the draft, and not list it as dropped", () => {
    const recipe = porridge();
    const draft = drafted({
      recipe,
      additions: [candidateOf(peanutButter), candidateOf(chicken)],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(draft.ingredients.map(({ foodId }) => foodId)).not.toContain(peanutButter.id);
    expect(draft.dropped).toEqual([]);
  });

  it("should be unreachable, not drafted, when the only food that could close the gap is avoided", () => {
    const recipe = porridge();
    const outcome = buildAdjustmentDraft({
      recipe,
      target: proteinPlus30(recipe),
      additions: [candidateOf(peanutButter)],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(outcome.status).toBe("unreachable");
  });

  it("should refuse a recipe that holds an avoided ingredient, naming it, and adjust nothing", () => {
    const recipe = withIngredient(chickenAndRice(), ingredientOf(peanutButter, 30));
    const outcome = buildAdjustmentDraft({
      recipe,
      target: { kcal: 500 },
      additions: [],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(outcome).toEqual({ status: "has_avoided_ingredient", foods: [peanutButter.name] });
  });

  it("should refuse a recipe made only of an avoided ingredient the same way", () => {
    const recipe: AdjustmentRecipe = {
      ...chickenAndRice(),
      ingredients: [ingredientOf(peanutButter, 30)],
    };
    const outcome = buildAdjustmentDraft({
      recipe,
      target: { kcal: 100 },
      additions: [],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(outcome.status).toBe("has_avoided_ingredient");
  });

  it("should refuse a recipe whose name mentions a food the person avoids", () => {
    const recipe = { ...chickenAndRice(), name: "Peanut chicken" };
    const outcome = buildAdjustmentDraft({
      recipe,
      target: proteinPlus30(recipe),
      additions: [],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(outcome.status).toBe("mentions_avoided");
  });

  it("should refuse a recipe whose step mentions a food the person avoids", () => {
    const recipe = { ...chickenAndRice(), steps: ["Stir in the peanut butter."] };
    const outcome = buildAdjustmentDraft({
      recipe,
      target: proteinPlus30(recipe),
      additions: [],
      preferences: [preference("dislike", "peanut butter")],
    });

    expect(outcome.status).toBe("mentions_avoided");
  });
});

describe("buildAdjustmentDraft, additions", () => {
  it("should not add a food the recipe already holds", () => {
    const recipe = porridge();
    const draft = drafted({ recipe, additions: [candidateOf(oats), candidateOf(chicken)] });

    expect(draft.ingredients.filter(({ foodId }) => foodId === oats.id)).toHaveLength(1);
    expect(draft.ingredients.filter(({ change }) => change === "added")).toHaveLength(1);
  });

  it("should reach for more than the default band of an added food when the gap needs it", () => {
    const recipe = porridge();
    const draft = drafted({ recipe, additions: [candidateOf(chicken)] });
    const added = draft.ingredients.find(({ change }) => change === "added");

    // The fitter's default band for a 50 g start is 25 g to 100 g. The protein needs more than that.
    expect(added?.grams).toBeGreaterThan(100);
    expect(added?.grams).toBeLessThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.maximum);
  });

  it("should let an added food go below the fitter's default band, down to its own minimum", () => {
    const recipe = porridge();
    const draft = drafted({
      recipe,
      target: { kcal: perServingOf(recipe).kcal ?? 0 },
      additions: [candidateOf(oil)],
    });
    const added = draft.ingredients.find(({ change }) => change === "added");

    // Below the 25 g that the fitter's default band would allow, so only an explicit minimum gives this.
    expect(added?.grams).toBeLessThan(25);
    expect(added?.grams).toBeGreaterThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.minimum);
  });

  it("should keep every added line inside the band", () => {
    const recipe = porridge();
    const draft = drafted({
      recipe,
      additions: [candidateOf(chicken), candidateOf(rice), candidateOf(broccoli)],
    });

    for (const line of draft.ingredients.filter(({ change }) => change === "added")) {
      expect(line.grams).toBeGreaterThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.minimum);
      expect(line.grams).toBeLessThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.maximum);
    }
  });
});

describe("buildAdjustmentDraft, a food per portion", () => {
  it("should hold it at its amount, so a target only moving it would reach is unreachable", () => {
    const bucketLine = buildRecipeIngredient(bucket, {
      quantity: 1,
      unit: "portion",
      portion: { id: idOf(300), label: "1 bucket", grams: null, ml: null },
    });
    const recipe: AdjustmentRecipe = {
      ...chickenAndRice(),
      servings: 1,
      ingredients: [bucketLine, ingredientOf(rice, 100)],
    };
    // 500 kcal of bucket plus at least 65 kcal of rice cannot come within 5 % of 320 kcal unless the bucket moves.
    const outcome = buildAdjustmentDraft({
      recipe,
      target: { kcal: 320 },
      additions: [],
      preferences: [],
    });

    expect(outcome.status).toBe("unreachable");
    if (outcome.status === "unreachable") {
      // The fitter itself held the bucket and ran the rice down to its lower bound.
      expect(outcome.misses[0]?.reason).toBe("ingredient_bounds");
      expect(outcome.misses[0]?.limitedBy).toEqual([rice.name]);
    }
  });
});

describe("adjustmentCandidatesOf", () => {
  const read = (foods: readonly Food[], preferences: PalatePreference[] = []) =>
    adjustmentCandidatesOf({
      foods: foods.map((food) => ({ food, portions: [] })),
      recipe: porridge(),
      preferences,
    }).map(({ food }) => food.id);

  it("should offer the foods in the order given", () => {
    expect(read([chicken, rice])).toEqual([chicken.id, rice.id]);
  });

  it("should show the figures of 100 g of each food it offers", () => {
    const [offered] = adjustmentCandidatesOf({
      foods: [{ food: chicken, portions: [] }],
      recipe: porridge(),
      preferences: [],
    });

    expect(offered?.per100).toEqual({ kcal: 148, protein_g: 32, carbs_g: 0, fat_g: 2.2 });
  });

  it("should leave out a food the person avoids", () => {
    expect(read([chicken, peanutButter], [preference("allergy", "peanuts")])).toEqual([chicken.id]);
  });

  it("should leave out a food already in the recipe", () => {
    expect(read([oats, chicken])).toEqual([chicken.id]);
  });

  it("should leave out a food with no weight, which cannot be added in grams", () => {
    expect(read([bucket, chicken])).toEqual([chicken.id]);
  });
});

describe("adjustmentSummaryOf", () => {
  it("should give the model the figures and the names added, and no line or step", () => {
    const recipe = porridge();
    const draft = drafted({ recipe, additions: [candidateOf(chicken)] });
    const summary = adjustmentSummaryOf(draft);

    expect(summary.name).toBe("Eval porridge bowl");
    expect(summary.before).toEqual(draft.before);
    expect(summary.per_serving).toEqual(draft.perServing);
    expect(summary.added_not_in_method).toEqual([chicken.name]);
    expect(summary.fit).toBe("within");
    expect(JSON.stringify(summary)).not.toContain("Heat the oats");
  });
});

describe("the limits of an added food", () => {
  it("should start at 50 g and stay between 10 g and 300 g", () => {
    expect(ADJUSTMENT_ADDITION_GRAMS).toEqual({ start: 50, minimum: 10, maximum: 300 });
  });
});

describe("unmetAfterFit", () => {
  const figures = (kcal: number, protein_g: number) => ({
    kcal,
    protein_g,
    fat_g: 0,
    carbs_g: 0,
    fibre_g: null,
  });

  it("should give the fitter's own misses when it says unreachable", () => {
    const miss = {
      nutrient: "protein_g" as const,
      target: 80,
      achieved: 40,
      reason: "ingredient_bounds" as const,
      limitedBy: ["kept-0"],
    };

    expect(
      unmetAfterFit({ status: "unreachable", misses: [miss] }, figures(500, 40), { protein_g: 80 }),
    ).toEqual([miss]);
  });

  it("should give nothing when the fitter says within and the figures meet the target", () => {
    expect(
      unmetAfterFit({ status: "within", misses: [] }, figures(500, 78), {
        kcal: 500,
        protein_g: 80,
      }),
    ).toEqual([]);
  });

  it("should still give the miss when the fitter says within and the figures do not meet it", () => {
    expect(
      unmetAfterFit({ status: "within", misses: [] }, figures(500, 60), {
        kcal: 500,
        protein_g: 80,
      }),
    ).toEqual([
      {
        nutrient: "protein_g",
        target: 80,
        achieved: 60,
        reason: "targets_conflict",
        limitedBy: [],
      },
    ]);
  });

  it("should never read a figure with no data as met", () => {
    expect(
      unmetAfterFit(
        { status: "within", misses: [] },
        { kcal: 500, protein_g: null, fat_g: 0, carbs_g: 0, fibre_g: null },
        { protein_g: 80 },
      ),
    ).toEqual([
      { nutrient: "protein_g", target: 80, achieved: null, reason: "no_data", limitedBy: [] },
    ]);
  });
});

describe("the largest an added food may be", () => {
  const withProtein = (protein_g: number) =>
    buildAdjustmentDraft({
      recipe: porridge(),
      target: { protein_g },
      additions: [candidateOf(chicken)],
      preferences: [],
    });

  it("should reach a target that needs a large addition, never above the maximum", () => {
    const outcome = withProtein(90);

    expect(outcome.status).toBe("drafted");
    if (outcome.status === "drafted") {
      const added = outcome.draft.ingredients.find(({ change }) => change === "added");
      expect(added?.grams).toBeGreaterThan(150);
      expect(added?.grams).toBeLessThanOrEqual(ADJUSTMENT_ADDITION_GRAMS.maximum);
    }
  });

  it("should be unreachable when 300 g of the food is not enough", () => {
    expect(withProtein(150).status).toBe("unreachable");
  });
});
