import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import {
  addShoppingItem,
  clearTickedItems,
  deleteShoppingItem,
  getShoppingSources,
  listShoppingItems,
  saveShoppingItems,
  setShoppingItemChecked,
} from "../../src/repos/shoppingList";
import { createTestClient } from "../createTestClient";
import {
  BEEF_ID,
  CHILLI_ID,
  CURRY_ID,
  ONION_ID,
  RECOGNISABLE_GRAMS,
  RECOGNISABLE_ITEM_NAME,
  SALT_ID,
  installShoppingListFake,
  shoppingItemRow,
} from "../support/shoppingList";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const expectNoHealthData = (error: unknown) => {
  expect(error).toBeInstanceOf(Error);
  const text = `${(error as Error).message} ${JSON.stringify((error as Error).cause)}`;
  expect(text).not.toContain(RECOGNISABLE_ITEM_NAME);
  expect(text).not.toContain(String(RECOGNISABLE_GRAMS));
};

describe("listShoppingItems", () => {
  it("should read the list in position order", async () => {
    const second = shoppingItemRow({ position: 1, name: "Rice" });
    const first = shoppingItemRow({ position: 0 });
    const fake = installShoppingListFake(server, [second, first]);

    await expect(listShoppingItems(createTestClient())).resolves.toEqual([first, second]);
    expect(fake.requests[0]?.url.searchParams.get("order")).toBe("position.asc,id.asc");
  });

  it("should name the action and the code only when the read fails", async () => {
    const fake = installShoppingListFake(server);
    fake.failWith("XX000");

    const error = await listShoppingItems(createTestClient()).catch((caught: unknown) => caught);

    expect((error as Error).message).toBe("Could not load your shopping list (XX000)");
    expect((error as Error).cause).toEqual({ code: "XX000" });
    expectNoHealthData(error);
  });
});

describe("getShoppingSources", () => {
  it("should read each recipe once, in the order asked, with its ingredients in list order", async () => {
    installShoppingListFake(server);

    const sources = await getShoppingSources(createTestClient(), [CURRY_ID, CHILLI_ID, CURRY_ID]);

    expect(sources.map(({ id }) => id)).toEqual([CURRY_ID, CHILLI_ID, CURRY_ID]);
    expect(sources[1]?.ingredients).toEqual([
      {
        foodId: BEEF_ID,
        name: "Beef mince",
        food: { name: "Beef mince", food_group: null },
        quantity: 500,
        unit: "g",
        resolvedGrams: 500,
        portionLabel: null,
      },
      {
        foodId: ONION_ID,
        name: "Onions",
        food: { name: "Onions", food_group: "DG" },
        quantity: 2,
        unit: "portion",
        resolvedGrams: 300,
        portionLabel: "1 medium",
      },
      {
        foodId: SALT_ID,
        name: "Salt",
        food: { name: "Salt", food_group: "WY" },
        quantity: 5,
        unit: "g",
        resolvedGrams: 5,
        portionLabel: null,
      },
    ]);
  });

  it("should leave out a recipe the user cannot see", async () => {
    installShoppingListFake(server);

    const sources = await getShoppingSources(createTestClient(), [
      "99999999-9999-4999-8999-999999999999",
      CHILLI_ID,
    ]);

    expect(sources.map(({ id }) => id)).toEqual([CHILLI_ID]);
  });

  it("should send no request for no recipes", async () => {
    const fake = installShoppingListFake(server);

    await expect(getShoppingSources(createTestClient(), [])).resolves.toEqual([]);
    expect(fake.requests).toEqual([]);
  });
});

describe("saveShoppingItems", () => {
  it("should send every row in one call", async () => {
    const open = shoppingItemRow();
    const fake = installShoppingListFake(server, [open]);
    const added = { ...shoppingItemRow({ food_id: BEEF_ID, name: "Beef mince" }), id: null };

    await saveShoppingItems(createTestClient(), [{ ...open, grams: 450 }, added]);

    expect(fake.requests.map(({ method }) => method)).toEqual(["RPC"]);
    expect(fake.requests[0]?.body).toEqual({ p_items: [{ ...open, grams: 450 }, added] });
    expect(fake.rows.map(({ name, grams }) => [name, grams])).toEqual([
      ["Onions", 450],
      ["Beef mince", 300],
    ]);
  });

  it("should send nothing for no rows", async () => {
    const fake = installShoppingListFake(server);

    await saveShoppingItems(createTestClient(), []);

    expect(fake.requests).toEqual([]);
  });

  it("should refuse a row the table would refuse before sending anything, naming the field only", async () => {
    const fake = installShoppingListFake(server);
    const row = {
      ...shoppingItemRow({ name: RECOGNISABLE_ITEM_NAME }),
      grams: -RECOGNISABLE_GRAMS,
    };

    const error = await saveShoppingItems(createTestClient(), [row]).catch(
      (caught: unknown) => caught,
    );

    expect((error as Error).message).toBe(
      "Could not add to your shopping list: row at index 0 has an unexpected shape at grams",
    );
    expectNoHealthData(error);
    expect(fake.requests).toEqual([]);
  });

  it("should name the action and the code only when the save fails", async () => {
    const fake = installShoppingListFake(server);
    fake.failWith("23514");

    const error = await saveShoppingItems(createTestClient(), [
      { ...shoppingItemRow(), id: null },
    ]).catch((caught: unknown) => caught);

    expect((error as Error).message).toBe("Could not add to your shopping list (23514)");
    expectNoHealthData(error);
  });
});

describe("addShoppingItem", () => {
  it("should insert the typed item without an id and resolve to it as stored", async () => {
    const fake = installShoppingListFake(server);
    const row = {
      id: null,
      food_id: null,
      name: "Bin bags",
      grams: null,
      portion_label: null,
      portion_count: null,
      sources: [],
      position: 3,
      checked_at: null,
    };

    const stored = await addShoppingItem(createTestClient(), row);

    expect(fake.requests[0]?.body).not.toHaveProperty("id");
    expect(stored).toEqual({ ...row, id: fake.rows[0]?.id });
  });
});

describe("setShoppingItemChecked", () => {
  it("should stamp the tick, and clear it to untick", async () => {
    const item = shoppingItemRow();
    const fake = installShoppingListFake(server, [item]);

    await setShoppingItemChecked(createTestClient(), item.id, true);
    expect(typeof fake.rows[0]?.checked_at).toBe("string");
    expect(fake.requests[0]?.url.searchParams.get("id")).toBe(`eq.${item.id}`);

    await setShoppingItemChecked(createTestClient(), item.id, false);
    expect(fake.rows[0]?.checked_at).toBeNull();
  });

  it("should name the action and the code only when it fails", async () => {
    const fake = installShoppingListFake(server, [shoppingItemRow()]);
    fake.failWith("XX000");

    const error = await setShoppingItemChecked(createTestClient(), "x", true).catch(
      (caught: unknown) => caught,
    );

    expect((error as Error).message).toBe("Could not tick the item (XX000)");
    expectNoHealthData(error);
  });
});

describe("deleteShoppingItem and clearTickedItems", () => {
  it("should remove one item by its id", async () => {
    const kept = shoppingItemRow();
    const removed = shoppingItemRow({ position: 1 });
    const fake = installShoppingListFake(server, [kept, removed]);

    await deleteShoppingItem(createTestClient(), removed.id);

    expect(fake.rows).toEqual([kept]);
  });

  it("should remove every ticked item and keep what is still to buy", async () => {
    const open = shoppingItemRow();
    const ticked = shoppingItemRow({ position: 1, checked_at: "2026-10-29T10:00:00+00:00" });
    const fake = installShoppingListFake(server, [open, ticked]);

    await clearTickedItems(createTestClient());

    expect(fake.rows).toEqual([open]);
    expect(fake.requests[0]?.url.searchParams.get("checked_at")).toBe("not.is.null");
  });

  it("should name the action and the code only when clearing fails", async () => {
    const fake = installShoppingListFake(server);
    fake.failWith("XX000");

    const error = await clearTickedItems(createTestClient()).catch((caught: unknown) => caught);

    expect((error as Error).message).toBe("Could not clear the ticked items (XX000)");
    expectNoHealthData(error);
  });
});
