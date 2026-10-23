import * as copy from "../../../src/copy";
import { buildRecipeIngredient } from "../../../src/recipes/buildRecipeIngredient";
import { buildFood } from "../../../src/testing/foodBuilders";

// Every function `src/copy/amountCaption.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
const food = buildFood();
const portion = {
  id: "00000000-0000-4000-8000-0000000000b1",
  label: "Medium",
  grams: 110,
  ml: null,
};

export const samples: Record<string, () => string[]> = {
  amountCaptionOf: () => [
    copy.amountCaptionOf({
      ...buildRecipeIngredient(food, { quantity: 500, unit: "g" }),
      position: 0,
    }),
    copy.amountCaptionOf({
      ...buildRecipeIngredient(food, { quantity: 1, unit: "portion", portion }),
      position: 1,
    }),
  ],
};
