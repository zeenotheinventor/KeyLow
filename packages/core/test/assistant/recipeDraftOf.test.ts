import { describe, expect, it } from "vitest";

import {
  assistantRecipeDraftSchema,
  buildSuggestionDraft,
  recipeDraftSummaryOf,
} from "../../src/assistant";
import { computeRecipe, buildRecipeIngredient, isWithinTolerance } from "../../src/recipes";
import { buildFood } from "../../src/testing";

import type { SuggestionLine } from "../../src/assistant";
import type { PalatePreference } from "../../src/palate";

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
const peanutButter = buildFood({
  id: idOf(5),
  name: "Peanut butter, smooth",
  kcal: 623,
  protein_g: 22,
  fat_g: 51,
  carbs_g: 13,
});
const noFigures = buildFood({
  id: idOf(6),
  name: "Mystery spice",
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
});
const bucket = buildFood({
  id: idOf(7),
  name: "Restaurant bucket",
  basis: "per_portion",
  kcal: 500,
});

const lineOf = (name: string, grams: number, food: SuggestionLine["food"]): SuggestionLine => ({
  name,
  grams,
  food,
  portions: [],
});

const dinnerLines = [
  lineOf("chicken breast", 220, chicken),
  lineOf("cooked white rice", 390, rice),
  lineOf("broccoli", 100, broccoli),
  lineOf("olive oil", 20, oil),
];

const draftOf = (overrides: Partial<Parameters<typeof buildSuggestionDraft>[0]> = {}) => {
  const outcome = buildSuggestionDraft({
    name: "Chicken and rice",
    servings: 2,
    steps: ["Cook the rice.", "Grill the chicken."],
    lines: dinnerLines,
    target: { kcal: 600, protein_g: 45 },
    preferences: [],
    ...overrides,
  });
  if (outcome.status !== "drafted") {
    throw new Error("Expected a draft");
  }
  return outcome.draft;
};

const preference = (kind: PalatePreference["kind"], label: string): PalatePreference => ({
  id: idOf(900),
  kind,
  foodId: null,
  recipeId: null,
  label,
});

describe("buildSuggestionDraft", () => {
  it("should build a suggestion that the draft schema accepts", () => {
    const draft = draftOf();

    expect(assistantRecipeDraftSchema.safeParse(draft).success).toBe(true);
    expect(draft.variant).toBe("suggestion");
    expect(draft.name).toBe("Chicken and rice");
    expect(draft.servings).toBe(2);
    expect(draft.steps).toEqual(["Cook the rice.", "Grill the chicken."]);
  });

  it("should give per serving figures equal to computeRecipe over the draft's own lines", () => {
    const draft = draftOf();
    const computed = computeRecipe({
      servings: draft.servings,
      yieldGrams: null,
      ingredients: draft.ingredients.flatMap(({ foodId, grams }) => {
        const food = [chicken, rice, broccoli, oil].find(({ id }) => id === foodId);
        return food === undefined
          ? []
          : [buildRecipeIngredient(food, { quantity: grams, unit: "g" })];
      }),
    });

    expect(draft.perServing).toEqual({
      kcal: computed.perServing.kcal,
      protein_g: computed.perServing.protein_g,
      carbs_g: computed.perServing.carbs_g,
      fat_g: computed.perServing.fat_g,
    });
  });

  it("should fit the draft within tolerance of the target and say so", () => {
    const draft = draftOf();

    expect(draft.fit).toEqual({
      status: "within",
      target: { kcal: 600, protein_g: 45 },
      misses: [],
    });
    expect(
      isWithinTolerance({ ...draft.perServing, fibre_g: null }, { kcal: 600, protein_g: 45 }),
    ).toBe(true);
  });

  it("should name each matched line by its food with the line's kcal for the whole recipe", () => {
    const draft = draftOf();
    const [first] = draft.ingredients;

    expect(first).toMatchObject({
      name: "chicken breast",
      foodId: chicken.id,
      foodName: chicken.name,
      beforeGrams: null,
      change: "same",
    });
    const totalKcal = draft.ingredients.reduce((sum, { kcal }) => sum + (kcal ?? 0), 0);
    expect(totalKcal / draft.servings).toBeCloseTo(draft.perServing.kcal ?? 0, 6);
  });

  it("should leave an unmatched line out of the numbers and list it last, never invented", () => {
    const withHarissa = [lineOf("harissa paste", 30, null), ...dinnerLines];

    const draft = draftOf({ lines: withHarissa });

    expect(draft.ingredients.at(-1)).toEqual({
      name: "harissa paste",
      foodId: null,
      foodName: null,
      grams: 30,
      beforeGrams: null,
      kcal: null,
      change: "same",
    });
    expect(draft.perServing).toEqual(draftOf().perServing);
  });

  it("should treat a food that cannot be weighed as unmatched", () => {
    const draft = draftOf({ lines: [...dinnerLines, lineOf("bucket", 100, bucket)] });

    expect(draft.ingredients.at(-1)).toMatchObject({ name: "bucket", foodId: null, kcal: null });
  });

  it("should drop a matched food the person avoids, with the reason avoided", () => {
    const draft = draftOf({
      lines: [...dinnerLines, lineOf("peanut butter", 30, peanutButter)],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(draft.dropped).toEqual([{ name: "peanut butter", reason: "avoided" }]);
    expect(draft.ingredients.map(({ foodId }) => foodId)).not.toContain(peanutButter.id);
    expect(draft.ingredients.map(({ name }) => name)).not.toContain("peanut butter");
  });

  it("should drop a line whose own words name an avoided food even when no food matched", () => {
    const draft = draftOf({
      lines: [...dinnerLines, lineOf("crushed peanuts", 15, null)],
      preferences: [preference("dislike", "peanuts")],
    });

    expect(draft.dropped).toEqual([{ name: "crushed peanuts", reason: "avoided" }]);
    expect(draft.ingredients.map(({ name }) => name)).not.toContain("crushed peanuts");
  });

  it("should keep the avoided food out of the numbers", () => {
    const without = draftOf();
    const withPeanuts = draftOf({
      lines: [...dinnerLines, lineOf("peanut butter", 30, peanutButter)],
      preferences: [preference("allergy", "peanut")],
    });

    expect(withPeanuts.perServing).toEqual(without.perServing);
  });

  it("should drop a line whose own words are safe when the food it matched is avoided by name", () => {
    const draft = draftOf({
      lines: [...dinnerLines, lineOf("nut butter", 30, peanutButter)],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(draft.dropped).toEqual([{ name: "nut butter", reason: "avoided" }]);
    expect(draft.ingredients.map(({ foodId }) => foodId)).not.toContain(peanutButter.id);
  });

  it("should refuse the recipe when its name mentions an avoided food", () => {
    expect(
      buildSuggestionDraft({
        name: "Peanut satay chicken",
        servings: 2,
        steps: ["Grill the chicken."],
        lines: dinnerLines,
        target: { kcal: 600, protein_g: 45 },
        preferences: [preference("allergy", "peanuts")],
      }),
    ).toEqual({ status: "mentions_avoided" });
  });

  it("should refuse the recipe when a step mentions an avoided food, though its line was dropped", () => {
    expect(
      buildSuggestionDraft({
        name: "Chicken satay",
        servings: 2,
        steps: ["Grill the chicken.", "Stir in the peanut butter."],
        lines: [...dinnerLines, lineOf("peanut butter", 30, peanutButter)],
        target: { kcal: 600, protein_g: 45 },
        preferences: [preference("allergy", "peanuts")],
      }),
    ).toEqual({ status: "mentions_avoided" });
  });

  it("should keep a dropped line in dropped when neither the name nor the steps mention it", () => {
    const draft = draftOf({
      lines: [...dinnerLines, lineOf("peanut butter", 30, peanutButter)],
      preferences: [preference("allergy", "peanuts")],
    });

    expect(draft.dropped).toHaveLength(1);
  });

  it("should share a food's fitted grams between its lines in proportion to what was proposed", () => {
    const draft = draftOf({
      lines: [
        lineOf("chicken breast", 150, chicken),
        lineOf("chicken, diced", 50, chicken),
        lineOf("cooked white rice", 390, rice),
        lineOf("broccoli", 100, broccoli),
      ],
      target: { kcal: 600, protein_g: 55 },
    });

    const [large, small] = draft.ingredients.filter(({ foodId }) => foodId === chicken.id);
    expect(large?.grams).toBeCloseTo(3 * (small?.grams ?? 0), 6);
    expect((large?.grams ?? 0) + (small?.grams ?? 0)).not.toBeCloseTo(200, 3);
  });

  it("should report nothing matched when no line has a food that is not avoided", () => {
    expect(
      buildSuggestionDraft({
        name: "Toast with spread",
        servings: 1,
        steps: [],
        lines: [lineOf("peanut butter", 30, peanutButter), lineOf("saffron", 1, null)],
        target: { kcal: 400, protein_g: 20 },
        preferences: [preference("allergy", "peanuts")],
      }),
    ).toEqual({ status: "nothing_matched", leftOutAvoided: ["peanut butter"] });
  });

  it("should pass one fitter ingredient for a food that two lines share and share its grams back", () => {
    const draft = draftOf({
      lines: [
        lineOf("chicken breast", 100, chicken),
        lineOf("chicken, diced", 100, chicken),
        lineOf("cooked white rice", 390, rice),
        lineOf("broccoli", 100, broccoli),
      ],
      target: { kcal: 600, protein_g: 55 },
    });

    const chickenLines = draft.ingredients.filter(({ foodId }) => foodId === chicken.id);
    expect(chickenLines).toHaveLength(2);
    expect(chickenLines[0]?.grams).toBeCloseTo(chickenLines[1]?.grams ?? 0, 6);
    expect(draft.fit?.status).toBe("within");
  });

  it("should report an unreachable target with the closest fit and the limiting ingredient names", () => {
    const draft = draftOf({
      lines: [lineOf("rice", 100, rice), lineOf("olive oil", 10, oil)],
      target: { kcal: 600, protein_g: 60 },
    });

    expect(draft.fit?.status).toBe("unreachable");
    const protein = draft.fit?.misses.find(({ nutrient }) => nutrient === "protein_g");
    expect(protein).toBeDefined();
    expect(protein?.target).toBe(60);
    expect(protein?.limitedBy.length).toBeGreaterThan(0);
    for (const name of protein?.limitedBy ?? []) {
      expect(["rice", "olive oil"]).toContain(name);
    }
  });

  it("should leave the lines as proposed and the fit empty when no figure is asked for", () => {
    const draft = draftOf({ target: {} });

    expect(draft.fit).toBeNull();
    expect(draft.ingredients.map(({ grams }) => grams)).toEqual([220, 390, 100, 20]);
  });

  it("should say a figure is unknown, never 0, when no matched food has data for it", () => {
    const draft = draftOf({
      lines: [lineOf("mystery spice", 5, noFigures)],
      target: { kcal: 300 },
    });

    expect(draft.perServing.kcal).toBeNull();
    expect(draft.fit?.status).toBe("unreachable");
    expect(draft.fit?.misses[0]).toMatchObject({
      nutrient: "kcal",
      achieved: null,
      reason: "no_data",
    });
  });
});

describe("recipeDraftSummaryOf", () => {
  it("should give the model the name, servings, figures and fit but no ingredients or steps", () => {
    const summary = recipeDraftSummaryOf(
      draftOf({ lines: [...dinnerLines, lineOf("harissa paste", 30, null)] }),
    );

    expect(summary).toMatchObject({
      name: "Chicken and rice",
      servings: 2,
      fit: "within",
      not_matched: ["harissa paste"],
      left_out_avoided: [],
    });
    expect(Object.keys(summary)).not.toContain("ingredients");
    expect(Object.keys(summary)).not.toContain("steps");
  });

  it("should carry each miss with its nutrient, target, closest figure and reason", () => {
    const summary = recipeDraftSummaryOf(
      draftOf({
        lines: [lineOf("rice", 100, rice), lineOf("olive oil", 10, oil)],
        target: { kcal: 600, protein_g: 60 },
      }),
    );

    expect(summary.fit).toBe("unreachable");
    expect(
      summary.misses.some(({ nutrient, target }) => nutrient === "protein_g" && target === 60),
    ).toBe(true);
  });

  it("should name what was left out because the person avoids it", () => {
    const summary = recipeDraftSummaryOf(
      draftOf({
        lines: [...dinnerLines, lineOf("peanut butter", 30, peanutButter)],
        preferences: [preference("allergy", "peanuts")],
      }),
    );

    expect(summary.left_out_avoided).toEqual(["peanut butter"]);
  });
});
