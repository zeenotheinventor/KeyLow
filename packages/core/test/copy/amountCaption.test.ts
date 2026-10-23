import { describe, expect, it } from "vitest";

import { amountCaptionOf } from "../../src/copy";
import { buildRecipeIngredient } from "../../src/recipes/buildRecipeIngredient";
import { buildFood } from "../../src/testing/foodBuilders";

describe("amountCaptionOf", () => {
  const food = buildFood({ id: "00000000-0000-4000-8000-0000000000a1", name: "Chicken breast" });

  it("should write grams as the diary writes an amount", () => {
    const ingredient = {
      ...buildRecipeIngredient(food, { quantity: 500, unit: "g" }),
      position: 0,
    };

    expect(amountCaptionOf(ingredient)).toBe("500 g");
  });

  it("should write a portion with its size, as the diary does", () => {
    const portion = {
      id: "00000000-0000-4000-8000-0000000000b1",
      label: "Medium",
      grams: 110,
      ml: null,
    };
    const ingredient = {
      ...buildRecipeIngredient(food, { quantity: 1, unit: "portion", portion }),
      position: 1,
    };

    expect(amountCaptionOf(ingredient)).toBe("Medium (110 g)");
  });
});
