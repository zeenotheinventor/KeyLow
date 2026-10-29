import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { ShoppingItem, ShoppingItemWrite } from "@keylow/core/shopping";
import type { SetupServer } from "msw/node";

/** A name and an amount nobody would pick by chance, to look for in an error message. */
export const RECOGNISABLE_ITEM_NAME = "shop29-recognisable-item";
export const RECOGNISABLE_GRAMS = 812.345;

export const CHILLI_ID = "11111111-1111-4111-8111-111111111111";
export const CURRY_ID = "22222222-2222-4222-8222-222222222222";
export const BEEF_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
export const ONION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
export const SALT_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

let rowCounter = 0;

/** A `shopping_list_items` row as PostgREST returns it for the list's columns. Ids count up from one. */
export function shoppingItemRow(overrides: Partial<ShoppingItem> = {}): ShoppingItem {
  rowCounter += 1;
  return {
    id: `77777777-7777-4777-8777-${rowCounter.toString(16).padStart(12, "0")}`,
    food_id: ONION_ID,
    name: "Onions",
    grams: 300,
    portion_label: "1 medium",
    portion_count: 2,
    sources: [{ recipeId: CHILLI_ID, name: "Chilli" }],
    position: 0,
    checked_at: null,
    ...overrides,
  };
}

const snapshotOf = (
  foodId: string,
  name: string,
  quantity: number,
  grams: number,
  label?: string,
) => ({
  v: 1,
  kind: "food",
  ref: foodId,
  name,
  basis: "per_100g",
  per100: { kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1, fibre_g: 1 },
  quantity,
  unit: label === undefined ? "g" : "portion",
  portion: label === undefined ? null : { label, grams: grams / quantity },
  density: null,
  resolvedGrams: grams,
  engineVersion: 1,
});

const ingredientOf = (
  position: number,
  foodId: string,
  name: string,
  food_group: string | null,
  quantity: number,
  grams: number,
  label?: string,
) => ({
  position,
  food_id: foodId,
  quantity,
  unit: label === undefined ? "g" : "portion",
  resolved_grams: grams,
  snapshot: snapshotOf(foodId, name, quantity, grams, label),
  foods: { name, food_group },
});

/**
 * Two recipes as the shopping list reads them. Chilli serves 4: 500 g of beef mince, 2 medium onions
 * (300 g) and 5 g of salt. Curry serves 2: 1 medium onion (150 g) and 250 g of beef mince. The
 * ingredients are out of position order on purpose.
 */
export const sourceRecipeRows = [
  {
    id: CHILLI_ID,
    name: "Chilli",
    servings: 4,
    recipe_ingredients: [
      ingredientOf(2, SALT_ID, "Salt", "WY", 5, 5),
      ingredientOf(0, BEEF_ID, "Beef mince", null, 500, 500),
      ingredientOf(1, ONION_ID, "Onions", "DG", 2, 300, "1 medium"),
    ],
  },
  {
    id: CURRY_ID,
    name: "Curry",
    servings: 2,
    recipe_ingredients: [
      ingredientOf(0, ONION_ID, "Onions", "DG", 1, 150, "1 medium"),
      ingredientOf(1, BEEF_ID, "Beef mince", null, 250, 250),
    ],
  },
];

type Request = { method: string; url: URL; body: unknown };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * A small stand-in for `shopping_list_items` and the recipe read behind MSW, so a test can see what a
 * write does to what a read then returns. `save_shopping_items` writes its rows as the function does: a
 * null id is a new row, and an id that exists keeps its food. `holdWrites` stops the answers to writes
 * until released, and `failWith` makes the next requests fail with a database error whose message and
 * details quote a row.
 */
export function installShoppingListFake(server: SetupServer, seed: ShoppingItem[] = []) {
  const rows: ShoppingItem[] = seed.map((row) => ({ ...row }));
  const requests: Request[] = [];
  const control: { writeGate: Promise<void> | null; failure: string | null } = {
    writeGate: null,
    failure: null,
  };
  let created = 0;
  const newId = () => {
    created += 1;
    return `88888888-8888-4888-8888-${created.toString(16).padStart(12, "0")}`;
  };

  const failure = () =>
    control.failure === null
      ? null
      : postgrestError(400, control.failure, `failing row contains (${RECOGNISABLE_ITEM_NAME})`, {
          details: `Failing row contains ${RECOGNISABLE_ITEM_NAME}, ${RECOGNISABLE_GRAMS}`,
        });

  const eq = (url: URL, name: string) => url.searchParams.get(name)?.replace(/^eq\./, "");

  const ordered = () =>
    [...rows].sort(
      (first, second) => first.position - second.position || first.id.localeCompare(second.id),
    );

  const write = async (request: globalThis.Request, method: string) => {
    const url = new URL(request.url);
    const body: unknown = method === "DELETE" ? undefined : await request.clone().json();
    requests.push({ method, url, body });
    await control.writeGate;
    return { url, body, failed: failure() };
  };

  server.use(
    http.get(`${REST_URL}/shopping_list_items`, ({ request }) => {
      const url = new URL(request.url);
      requests.push({ method: "GET", url, body: undefined });
      return failure() ?? postgrestRows(request, ordered());
    }),
    http.get(`${REST_URL}/recipes`, ({ request }) => {
      const url = new URL(request.url);
      requests.push({ method: "GET", url, body: undefined });
      const failed = failure();
      if (failed !== null) {
        return failed;
      }
      const ids = (url.searchParams.get("id") ?? "")
        .replace(/^in\.\(/, "")
        .replace(/\)$/, "")
        .split(",");
      return postgrestRows(
        request,
        sourceRecipeRows.filter((recipe) => ids.includes(recipe.id)),
      );
    }),
    http.post(`${REST_URL}/shopping_list_items`, async ({ request }) => {
      const { body, failed } = await write(request, "POST");
      if (failed !== null) {
        return failed;
      }
      const stored = { ...(body as Omit<ShoppingItem, "id">), id: newId() };
      rows.push(stored);
      return postgrestRows(request, [stored], 201);
    }),
    http.post(`${REST_URL}/rpc/save_shopping_items`, async ({ request }) => {
      const { body, failed } = await write(request, "RPC");
      if (failed !== null) {
        return failed;
      }
      const items = isObject(body) && Array.isArray(body["p_items"]) ? body["p_items"] : [];
      for (const item of items as ShoppingItemWrite[]) {
        const existing = rows.find((row) => row.id === item.id);
        if (existing === undefined) {
          rows.push({ ...item, id: item.id ?? newId() });
        } else {
          Object.assign(existing, { ...item, id: existing.id, food_id: existing.food_id });
        }
      }
      return new Response(null, { status: 204 });
    }),
    http.patch(`${REST_URL}/shopping_list_items`, async ({ request }) => {
      const { url, body, failed } = await write(request, "PATCH");
      if (failed !== null) {
        return failed;
      }
      for (const row of rows.filter(({ id }) => id === eq(url, "id"))) {
        Object.assign(row, body);
      }
      return new Response(null, { status: 204 });
    }),
    http.delete(`${REST_URL}/shopping_list_items`, async ({ request }) => {
      const { url, failed } = await write(request, "DELETE");
      if (failed !== null) {
        return failed;
      }
      const onlyTicked = url.searchParams.get("checked_at") === "not.is.null";
      const id = eq(url, "id");
      const kept = rows.filter((row) =>
        onlyTicked ? row.checked_at === null : id !== undefined && row.id !== id,
      );
      rows.splice(0, rows.length, ...kept);
      return new Response(null, { status: 204 });
    }),
  );

  const hold = () => {
    let release = () => {};
    control.writeGate = new Promise<void>((resolve) => {
      release = resolve;
    });
    return () => {
      release();
      control.writeGate = null;
    };
  };

  return {
    rows,
    requests,
    holdWrites: hold,
    failWith: (code: string | null) => {
      control.failure = code;
    },
  };
}
