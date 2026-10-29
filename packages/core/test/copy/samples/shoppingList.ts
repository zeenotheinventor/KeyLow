import * as copy from "../../../src/copy";

// Every function `src/copy/shoppingList.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeLeftOutCount: () => [0, 1, 3].map(copy.describeLeftOutCount),
  describeRemoveItem: () => [copy.describeRemoveItem("Onions")],
  describeShoppingSources: () => [
    copy.describeShoppingSources(["Chilli"]),
    copy.describeShoppingSources(["Chilli", "Curry"]),
    copy.describeShoppingSources(["Chilli", "Curry", "Pie"]),
  ],
  describeShoppingAmount: () =>
    [
      copy.describeShoppingAmount({ grams: 450, portion_label: null, portion_count: null }),
      copy.describeShoppingAmount({ grams: 150, portion_label: "1 medium", portion_count: 1 }),
      copy.describeShoppingAmount({ grams: 375, portion_label: "1 medium", portion_count: 2.5 }),
    ].filter((text) => text !== null),
  describeAddAnyway: () => [copy.describeAddAnyway("Salt")],
  describeShoppingItemCaption: () =>
    [
      copy.describeShoppingItemCaption({
        grams: 300,
        portion_label: "1 medium",
        portion_count: 2,
        sources: [{ name: "Chilli" }, { name: "Curry" }],
      }),
      copy.describeShoppingItemCaption({
        grams: 450,
        portion_label: null,
        portion_count: null,
        sources: [],
      }),
    ].filter((text) => text !== null),
};
