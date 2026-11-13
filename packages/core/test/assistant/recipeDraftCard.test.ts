import { describe, expect, it } from "vitest";

import { describeRecipeDraftCard, recipeDraftKeyOf } from "../../src/assistant";

import type { AssistantRecipeDraft } from "../../src/assistant";

type Suggestion = Extract<AssistantRecipeDraft, { variant: "suggestion" }>;

const idOf = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const fitting: Suggestion = {
  variant: "suggestion",
  name: "Chicken and rice with yogurt sauce",
  servings: 2,
  ingredients: [
    {
      name: "chicken breast",
      foodId: idOf(1),
      foodName: "Chicken, breast, grilled without skin, meat only",
      foodSource: "cofid",
      grams: 220,
      beforeGrams: null,
      kcal: 325.6,
      change: "same",
    },
    {
      name: "olive oil",
      foodId: idOf(2),
      foodName: "Oil, olive",
      foodSource: null,
      grams: 20,
      beforeGrams: null,
      kcal: 179.8,
      change: "same",
    },
  ],
  dropped: [],
  perServing: { kcal: 599, protein_g: 46.4, carbs_g: 65.1, fat_g: 19 },
  fit: { status: "within", target: { kcal: 600, protein_g: 45 }, misses: [] },
  steps: ["Cook the rice.", "Grill the chicken."],
};

describe("describeRecipeDraftCard", () => {
  describe("a draft that fits", () => {
    const card = describeRecipeDraftCard(fitting, { isSaved: false });

    it("should title the card with the recipe's name and say it is not saved yet", () => {
      expect(card.title).toBe("Chicken and rice with yogurt sauce");
      expect(card.subtitle).toBe("2 servings · Not saved yet");
    });

    it("should print the per serving figures, with what was asked under the figures that were named", () => {
      expect(card.figures).toEqual([
        { nutrient: "kcal", caption: "kcal", value: "599", asked: "Asked 600", isMiss: false },
        {
          nutrient: "protein_g",
          caption: "Protein",
          value: "46 g",
          asked: "Asked 45 g",
          isMiss: false,
        },
        { nutrient: "carbs_g", caption: "Carbs", value: "65 g", asked: null, isMiss: false },
        { nutrient: "fat_g", caption: "Fat", value: "19 g", asked: null, isMiss: false },
      ]);
      expect(card.figuresLabel).toBe("Per serving");
    });

    it("should say the draft is within the tolerance in the success tone", () => {
      expect(card.fit).toEqual({
        tone: "success",
        text: "Within 5 % of 600 kcal and 5 g of 45 g protein",
      });
    });

    it("should draw each ingredient with its amount, its food and source, and its kcal for the whole recipe", () => {
      expect(card.rows).toEqual([
        {
          name: "220 g chicken breast",
          detail: "Chicken, breast, grilled without skin, meat only · UK CoFID",
          value: "326 kcal",
          notMatchedBadge: null,
        },
        { name: "20 g olive oil", detail: "Oil, olive", value: "180 kcal", notMatchedBadge: null },
      ]);
    });

    it("should hold the steps closed, numbered, under Instructions with their count", () => {
      expect(card.instructions).toEqual({
        title: "Instructions",
        summary: "2 steps",
        steps: ["1. Cook the rice.", "2. Grill the chicken."],
      });
    });
  });

  it("should say it is saved once it is", () => {
    expect(describeRecipeDraftCard(fitting, { isSaved: true }).subtitle).toBe(
      "2 servings · Saved to your recipes",
    );
  });

  it("should leave out the fit line and the asked captions when no figure was asked for", () => {
    const card = describeRecipeDraftCard({ ...fitting, fit: null }, { isSaved: false });

    expect(card.fit).toBeNull();
    expect(card.figures.map(({ asked }) => asked)).toEqual([null, null, null, null]);
  });

  it("should leave out a figure the foods have no data for and never print it as 0", () => {
    const card = describeRecipeDraftCard(
      { ...fitting, perServing: { ...fitting.perServing, carbs_g: null } },
      { isSaved: false },
    );

    expect(card.figures.map(({ nutrient }) => nutrient)).toEqual(["kcal", "protein_g", "fat_g"]);
  });

  it("should give no instructions row for a draft with no steps", () => {
    expect(
      describeRecipeDraftCard({ ...fitting, steps: [] }, { isSaved: false }).instructions,
    ).toBeNull();
  });

  describe("a draft that falls short", () => {
    const short: Suggestion = {
      ...fitting,
      fit: {
        status: "unreachable",
        target: { kcal: 600, protein_g: 60 },
        misses: [
          {
            nutrient: "protein_g",
            target: 60,
            achieved: 53,
            reason: "ingredient_bounds",
            limitedBy: ["salmon fillet"],
          },
        ],
      },
      perServing: { kcal: 624, protein_g: 53, carbs_g: 27, fat_g: 34 },
    };
    const card = describeRecipeDraftCard(short, { isSaved: false });

    it("should turn the missed figure's asked caption to a miss and no other", () => {
      expect(card.figures.map(({ nutrient, isMiss }) => [nutrient, isMiss])).toEqual([
        ["kcal", false],
        ["protein_g", true],
        ["carbs_g", false],
        ["fat_g", false],
      ]);
    });

    it("should say what fell short and what held it back, in the warning tone", () => {
      expect(card.fit).toEqual({
        tone: "warning",
        text: "Protein is 7 g under the 60 g you asked for. It is held back by the salmon fillet.",
      });
    });

    it("should word a conflict with no limiting ingredient without one", () => {
      const conflict = describeRecipeDraftCard(
        {
          ...short,
          fit: {
            status: "unreachable",
            target: { kcal: 600, protein_g: 60 },
            misses: [
              {
                nutrient: "protein_g",
                target: 60,
                achieved: 53,
                reason: "targets_conflict",
                limitedBy: [],
              },
            ],
          },
        },
        { isSaved: false },
      );

      expect(conflict.fit?.text).toBe(
        "Protein is 7 g under the 60 g you asked for. The figures you asked for pull against each other, so this is the closest fit.",
      );
    });

    it("should give each miss its sentence when several fell short", () => {
      const both = describeRecipeDraftCard(
        {
          ...short,
          fit: {
            status: "unreachable",
            target: { kcal: 500, protein_g: 60 },
            misses: [
              {
                nutrient: "kcal",
                target: 500,
                achieved: 560,
                reason: "targets_conflict",
                limitedBy: [],
              },
              {
                nutrient: "protein_g",
                target: 60,
                achieved: 50,
                reason: "targets_conflict",
                limitedBy: [],
              },
            ],
          },
        },
        { isSaved: false },
      );

      expect(both.fit?.text).toContain("Calories are 60 kcal over the 500 kcal you asked for.");
      expect(both.fit?.text).toContain("Protein is 10 g under the 60 g you asked for.");
    });
  });

  describe("a line that matched no food", () => {
    const unmatched: Suggestion = {
      ...fitting,
      ingredients: [
        ...fitting.ingredients,
        {
          name: "harissa paste",
          foodId: null,
          foodName: null,
          foodSource: null,
          grams: 30,
          beforeGrams: null,
          kcal: null,
          change: "same",
        },
      ],
    };
    const card = describeRecipeDraftCard(unmatched, { isSaved: false });

    it("should show it, with the words that it is not counted and the Not matched badge", () => {
      expect(card.rows.at(-1)).toEqual({
        name: "30 g harissa paste",
        detail: "Not counted. Choose a food in the recipe editor.",
        value: null,
        notMatchedBadge: "Not matched",
      });
    });

    it("should say the figures are without it", () => {
      expect(card.fit?.text).toBe(
        "Within 5 % of 600 kcal and 5 g of 45 g protein, without the harissa paste",
      );
    });
  });
});

describe("describeRecipeDraftCard, edge cases", () => {
  it("should print no value for a matched line whose food has no kcal", () => {
    const card = describeRecipeDraftCard(
      {
        ...fitting,
        ingredients: fitting.ingredients.map((line) => ({ ...line, kcal: null })),
      },
      { isSaved: false },
    );

    expect(card.rows.map(({ value }) => value)).toEqual([null, null]);
    expect(card.rows.map(({ notMatchedBadge }) => notMatchedBadge)).toEqual([null, null]);
  });

  it("should draw no fit line for an unreachable fit that holds no miss", () => {
    const card = describeRecipeDraftCard(
      { ...fitting, fit: { status: "unreachable", target: { kcal: 600 }, misses: [] } },
      { isSaved: false },
    );

    expect(card.fit).toBeNull();
    expect(card.figures.map(({ isMiss }) => isMiss)).toEqual([false, false, false, false]);
  });

  it("should draw no fit line when the fit names no figure, never Within on its own", () => {
    const card = describeRecipeDraftCard(
      { ...fitting, fit: { status: "within", target: {}, misses: [] } },
      { isSaved: false },
    );

    expect(card.fit).toBeNull();
  });
});

describe("recipeDraftKeyOf", () => {
  it("should differ when the steps differ", () => {
    expect(recipeDraftKeyOf(fitting)).not.toBe(
      recipeDraftKeyOf({ ...fitting, steps: ["Cook the rice."] }),
    );
  });

  it("should be the same for a draft read twice and differ when an amount differs", () => {
    const changed: Suggestion = {
      ...fitting,
      ingredients: fitting.ingredients.map((line) => ({ ...line, grams: line.grams + 5 })),
    };

    expect(recipeDraftKeyOf(fitting)).toBe(recipeDraftKeyOf(structuredClone(fitting)));
    expect(recipeDraftKeyOf(fitting)).not.toBe(recipeDraftKeyOf(changed));
  });

  it("should differ when the name or the servings differ", () => {
    expect(recipeDraftKeyOf(fitting)).not.toBe(recipeDraftKeyOf({ ...fitting, name: "Other" }));
    expect(recipeDraftKeyOf(fitting)).not.toBe(recipeDraftKeyOf({ ...fitting, servings: 3 }));
  });
});
