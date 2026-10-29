import { describe, expect, it } from "vitest";

import {
  MAX_SHOPPING_ITEM_GRAMS,
  groupShoppingList,
  nextShoppingPosition,
  planListMerge,
  planTypedItem,
  shoppingItemWriteSchema,
} from "../../src/shopping";

import type { ShoppingDraft, ShoppingItem } from "../../src/shopping";

const CHILLI = { recipeId: "11111111-1111-4111-8111-111111111111", name: "Chilli" };
const CURRY = { recipeId: "22222222-2222-4222-8222-222222222222", name: "Curry" };
const ONION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BEEF_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const row = (overrides: Partial<ShoppingItem> & Pick<ShoppingItem, "id">): ShoppingItem => ({
  food_id: ONION_ID,
  name: "Onions",
  grams: 300,
  portion_label: "1 medium",
  portion_count: 2,
  sources: [CHILLI],
  position: 0,
  checked_at: null,
  ...overrides,
});

const draft = (overrides: Partial<ShoppingDraft> = {}): ShoppingDraft => ({
  foodId: ONION_ID,
  name: "Onions",
  grams: 150,
  portionLabel: "1 medium",
  portionCount: 1,
  sources: [CURRY],
  rule: "default",
  ...overrides,
});

const OPEN_ID = "e0000000-0000-4000-8000-000000000001";
const TICKED_ID = "e0000000-0000-4000-8000-000000000002";
const TYPED_ID = "e0000000-0000-4000-8000-000000000003";

describe("planListMerge", () => {
  it("should merge a draft into the open row of the same food", () => {
    const { upserts } = planListMerge([row({ id: OPEN_ID })], [draft()]);

    expect(upserts).toEqual([
      {
        id: OPEN_ID,
        food_id: ONION_ID,
        name: "Onions",
        grams: 450,
        portion_label: "1 medium",
        portion_count: 3,
        sources: [CHILLI, CURRY],
        position: 0,
        checked_at: null,
      },
    ]);
  });

  it("should keep the grams and drop the count when the portions differ", () => {
    const { upserts } = planListMerge(
      [row({ id: OPEN_ID })],
      [draft({ portionLabel: "1 large", portionCount: 1, grams: 200 })],
    );

    expect(upserts[0]).toMatchObject({ grams: 500, portion_label: null, portion_count: null });
  });

  it("should name a recipe once when it is added again", () => {
    const { upserts } = planListMerge([row({ id: OPEN_ID })], [draft({ sources: [CHILLI] })]);

    expect(upserts[0]?.sources).toEqual([CHILLI]);
  });

  it("should never change a ticked row, and start a new open row at the end instead", () => {
    const { upserts } = planListMerge(
      [row({ id: TICKED_ID, checked_at: "2026-10-29T10:00:00+00:00", position: 4 })],
      [draft()],
    );

    expect(upserts).toEqual([
      {
        id: null,
        food_id: ONION_ID,
        name: "Onions",
        grams: 150,
        portion_label: "1 medium",
        portion_count: 1,
        sources: [CURRY],
        position: 5,
        checked_at: null,
      },
    ]);
  });

  it("should never merge into an item typed by hand", () => {
    const typed = row({
      id: TYPED_ID,
      food_id: null,
      name: "Onions",
      grams: null,
      portion_label: null,
      portion_count: null,
      sources: [],
    });
    const { upserts } = planListMerge([typed], [draft()]);

    expect(upserts.map(({ id, position }) => [id, position])).toEqual([[null, 1]]);
  });

  it("should put merged rows first and new rows after, in the drafts' order and at the end", () => {
    const { upserts } = planListMerge(
      [row({ id: OPEN_ID, position: 2 }), row({ id: TYPED_ID, food_id: null, position: 7 })],
      [
        draft({ foodId: BEEF_ID, name: "Beef mince" }),
        draft(),
        draft({ foodId: "x", name: "Rice" }),
      ],
    );

    expect(upserts.map(({ id, name, position }) => [id, name, position])).toEqual([
      [OPEN_ID, "Onions", 2],
      [null, "Beef mince", 8],
      [null, "Rice", 9],
    ]);
  });

  it("should start a new row when a merge would take the grams over the most an item holds", () => {
    const { upserts } = planListMerge(
      [row({ id: OPEN_ID, grams: MAX_SHOPPING_ITEM_GRAMS - 100 })],
      [draft({ grams: 101 })],
    );

    expect(upserts.map(({ id }) => id)).toEqual([null]);
  });

  it("should drop a count that the table could not hold, and keep the grams", () => {
    const { upserts } = planListMerge(
      [],
      [draft({ portionLabel: "p".repeat(201) }), draft({ foodId: BEEF_ID, portionCount: 10001 })],
    );

    expect(
      upserts.map(({ portion_label, portion_count }) => [portion_label, portion_count]),
    ).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it("should write rows the save accepts", () => {
    const { upserts } = planListMerge(
      [row({ id: OPEN_ID })],
      [draft(), draft({ foodId: BEEF_ID })],
    );

    for (const upsert of upserts) {
      expect(shoppingItemWriteSchema.safeParse(upsert).success).toBe(true);
    }
  });

  it("should write nothing for no drafts", () => {
    expect(planListMerge([row({ id: OPEN_ID })], [])).toEqual({ upserts: [] });
  });
});

describe("nextShoppingPosition", () => {
  it("should be after the last item, or 0 on an empty list", () => {
    expect(nextShoppingPosition([])).toBe(0);
    expect(nextShoppingPosition([{ position: 3 }, { position: 1 }])).toBe(4);
  });
});

describe("planTypedItem", () => {
  it("should trim the words and put the item at the end, with no food and no amount", () => {
    expect(planTypedItem([{ position: 2 }], "  Bin bags ")).toEqual({
      id: null,
      food_id: null,
      name: "Bin bags",
      grams: null,
      portion_label: null,
      portion_count: null,
      sources: [],
      position: 3,
      checked_at: null,
    });
  });

  it("should answer null for blank words", () => {
    expect(planTypedItem([], "   ")).toBeNull();
  });

  it("should cut the words to what the list holds", () => {
    expect(planTypedItem([], "n".repeat(250))?.name).toHaveLength(200);
  });
});

describe("groupShoppingList", () => {
  it("should put what is still to buy first and the ticked items after, each in list order", () => {
    const items = [
      row({ id: "c", position: 3 }),
      row({ id: "a", position: 1, checked_at: "2026-10-29T10:00:00+00:00" }),
      row({ id: "b", position: 0 }),
    ];

    const { toBuy, ticked } = groupShoppingList(items);

    expect(toBuy.map(({ id }) => id)).toEqual(["b", "c"]);
    expect(ticked.map(({ id }) => id)).toEqual(["a"]);
  });
});
