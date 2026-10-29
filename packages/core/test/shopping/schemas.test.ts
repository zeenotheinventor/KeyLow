import { describe, expect, it } from "vitest";

import { shoppingItemSchema, shoppingItemWriteSchema } from "../../src/shopping";

const item = {
  id: "e0000000-0000-4000-8000-000000000001",
  food_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Onions",
  grams: 300,
  portion_label: "1 medium",
  portion_count: 2,
  sources: [{ recipeId: "11111111-1111-4111-8111-111111111111", name: "Chilli" }],
  position: 0,
  checked_at: null,
};

describe("shoppingItemSchema", () => {
  it("should accept a stored row", () => {
    expect(shoppingItemSchema.parse(item)).toEqual(item);
  });

  it.each([
    ["a blank name", { name: "  " }],
    ["a name of 201 characters", { name: "n".repeat(201) }],
    ["0 g", { grams: 0 }],
    ["more than 100000 g", { grams: 100000.5 }],
    ["a label without a count", { portion_count: null }],
    ["a count without a label", { portion_label: null }],
    ["a count over 10000", { portion_count: 10001 }],
    ["51 sources", { sources: Array.from({ length: 51 }, () => item.sources[0]) }],
    ["a negative position", { position: -1 }],
    ["a missing id", { id: null }],
  ])("should refuse %s, as the table does", (_rule, change) => {
    expect(shoppingItemSchema.safeParse({ ...item, ...change }).success).toBe(false);
  });
});

describe("shoppingItemWriteSchema", () => {
  it("should accept a new row with no id", () => {
    expect(shoppingItemWriteSchema.safeParse({ ...item, id: null }).success).toBe(true);
  });

  it("should accept an item typed by hand", () => {
    expect(
      shoppingItemWriteSchema.safeParse({
        ...item,
        id: null,
        food_id: null,
        grams: null,
        portion_label: null,
        portion_count: null,
        sources: [],
      }).success,
    ).toBe(true);
  });
});
