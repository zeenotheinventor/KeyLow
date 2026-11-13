import { describe, expect, it } from "vitest";

import {
  broccoliLine,
  chickenLine,
  compareDraft,
  oilLine,
  riceLine,
  yogurtLine,
} from "./recipeCompareFixtures";
import { describeRecipeCompareCard } from "../../src/assistant";

import type { AdjustmentDraft } from "../../src/assistant";

describe("describeRecipeCompareCard", () => {
  const card = describeRecipeCompareCard(compareDraft, { isSaved: false });

  it("should title the card for the new recipe and say what changed, how many servings and that it is not saved", () => {
    expect(card.title).toBe("Eval chicken and rice, adjusted");
    expect(card.subtitle).toBe("30 g more protein a serving · 2 servings · Not saved yet");
  });

  it("should say the original stays as it is", () => {
    expect(card.originalStays).toBe("Eval chicken and rice stays as it is.");
  });

  it("should print before and after for each figure, from the draft", () => {
    expect(card.figuresLabel).toBe("Per serving");
    expect(card.beforeLabel).toBe("Before");
    expect(card.afterLabel).toBe("After");
    expect(card.figures).toEqual([
      { nutrient: "kcal", caption: "kcal", before: "518", after: "522" },
      { nutrient: "protein_g", caption: "Protein", before: "49 g", after: "78 g" },
      { nutrient: "carbs_g", caption: "Carbs", before: "58 g", after: "30 g" },
      { nutrient: "fat_g", caption: "Fat", before: "11 g", after: "11 g" },
    ]);
  });

  it("should leave a figure out when either side has no data, and never print it as 0", () => {
    const partial: AdjustmentDraft = {
      ...compareDraft,
      before: { ...compareDraft.before, carbs_g: null },
    };

    expect(
      describeRecipeCompareCard(partial, { isSaved: false }).figures.map(
        ({ nutrient }) => nutrient,
      ),
    ).toEqual(["kcal", "protein_g", "fat_g"]);
  });

  it("should say the fit is within what was asked", () => {
    expect(card.fit).toEqual({
      tone: "success",
      text: "Protein within 5 g of 79 g, calories within 5 % of 518 kcal",
    });
  });

  it("should word a fit that fell short with the misses, as the draft card does", () => {
    const short: AdjustmentDraft = {
      ...compareDraft,
      fit: {
        status: "unreachable",
        target: { protein_g: 79 },
        misses: [
          {
            nutrient: "protein_g",
            target: 79,
            achieved: 70,
            reason: "ingredient_bounds",
            limitedBy: ["Chicken"],
          },
        ],
      },
    };

    expect(describeRecipeCompareCard(short, { isSaved: false }).fit).toEqual({
      tone: "warning",
      text: "Protein is 9 g under the 79 g you asked for. It is held back by the Chicken.",
    });
  });

  it("should have no fit line when the draft has no fit", () => {
    expect(
      describeRecipeCompareCard({ ...compareDraft, fit: null }, { isSaved: false }).fit,
    ).toBeNull();
  });

  it("should draw each ingredient with its amounts and badge, in the draft's order", () => {
    expect(card.rows).toEqual([
      {
        name: chickenLine.name,
        detail: "260 g → 455 g",
        badge: "Changed",
      },
      { name: riceLine.name, detail: "360 g → 180 g", badge: "Changed" },
      { name: oilLine.name, detail: "15 g → 10 g", badge: "Changed" },
      { name: broccoliLine.name, detail: "160 g, unchanged", badge: null },
    ]);
  });

  it("should mark an added food with its own badge and say it is not in the method (NOT ON THE CANVAS)", () => {
    const withYogurt: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [...compareDraft.ingredients, yogurtLine],
    };

    expect(describeRecipeCompareCard(withYogurt, { isSaved: false }).rows.at(-1)).toEqual({
      name: "Yogurt, Greek style, plain",
      detail: "120 g added, not in the method",
      badge: "Added",
    });
  });

  it("should leave the change out of the subtitle when the target is under a whole unit from what it was", () => {
    const nearly: AdjustmentDraft = {
      ...compareDraft,
      fit: { status: "within", target: { kcal: 518.2, protein_g: 49.6 }, misses: [] },
    };

    expect(describeRecipeCompareCard(nearly, { isSaved: false }).subtitle).toBe(
      "2 servings · Not saved yet",
    );
  });

  it("should draw a line counted by portion as unchanged, with no 0 g", () => {
    const byPortion: AdjustmentDraft = {
      ...compareDraft,
      ingredients: [{ ...broccoliLine, grams: 0, beforeGrams: 0 }],
    };

    expect(describeRecipeCompareCard(byPortion, { isSaved: false }).rows).toEqual([
      { name: broccoliLine.name, detail: "Counted by portion, unchanged", badge: null },
    ]);
  });

  it("should say the card is saved once it is", () => {
    expect(describeRecipeCompareCard(compareDraft, { isSaved: true }).subtitle).toBe(
      "30 g more protein a serving · 2 servings · Saved to your recipes",
    );
  });

  it("should name a change in calories when the calories were what was asked", () => {
    const calories: AdjustmentDraft = {
      ...compareDraft,
      fit: { status: "within", target: { kcal: 400 }, misses: [] },
    };

    expect(describeRecipeCompareCard(calories, { isSaved: false }).subtitle).toBe(
      "118 kcal less a serving · 2 servings · Not saved yet",
    );
  });
});
