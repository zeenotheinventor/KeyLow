import { describe, expect, it } from "vitest";

import * as shopping from "../../src/shopping";

describe("the shopping module", () => {
  it("should export its public surface", () => {
    expect(Object.keys(shopping).sort()).toEqual([
      "MAX_SHOPPING_ITEMS_PER_SAVE",
      "MAX_SHOPPING_ITEM_GRAMS",
      "MAX_SHOPPING_ITEM_NAME_LENGTH",
      "MAX_SHOPPING_ITEM_SOURCES",
      "MAX_SHOPPING_PORTION_COUNT",
      "MAX_SHOPPING_PORTION_LABEL_LENGTH",
      "aggregateIngredients",
      "classifyIngredient",
      "groupShoppingList",
      "nextShoppingPosition",
      "planListMerge",
      "planTypedItem",
      "shoppingItemSchema",
      "shoppingItemWriteSchema",
      "shoppingSourceSchema",
    ]);
  });
});
