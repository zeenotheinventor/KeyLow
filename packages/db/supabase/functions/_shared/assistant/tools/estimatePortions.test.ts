import { assert, assertEquals, assertStringIncludes } from "@std/assert";

import { executeTool } from "../executor.ts";
import { createFakeContext, spyOnConsole } from "../testing.ts";
import { toJsonSchema } from "../tool.ts";
import { estimatePortionsTool } from "./estimatePortions.ts";
import { payloadOf, stubCaller } from "./testing.ts";

import type { StubData } from "./testing.ts";

const riceId = "00000000-0000-4000-8000-000000000001";
const curryId = "00000000-0000-4000-8000-000000000002";
const mealId = "00000000-0000-4000-8000-000000000003";
const missingId = "00000000-0000-4000-8000-000000000009";

const foodRow = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id,
  source: "user",
  source_ref: null,
  owner_id: null,
  name,
  brand: null,
  barcode: null,
  basis: "per_100g",
  density_g_per_ml: null,
  kcal: 130,
  protein_g: 2.7,
  fat_g: 0.3,
  sat_fat_g: null,
  carbs_g: 28,
  sugars_g: null,
  fibre_g: 0.4,
  salt_g: null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: null,
  deleted_at: null,
  created_at: "2026-10-07T10:00:00+00:00",
  ...overrides,
});

const tables = {
  foods: [
    foodRow(riceId, "Cooked rice"),
    foodRow(curryId, "Beef massaman", { kcal: 150, protein_g: 9, fat_g: 8, carbs_g: 10 }),
    foodRow(mealId, "Set lunch", { basis: "per_portion", kcal: 600 }),
  ],
};

const call = (container: string | null, items: unknown[], more: Record<string, unknown> = {}) => ({
  container,
  diameter_cm: null,
  radius_cm: null,
  depth_cm: null,
  fill: null,
  items,
  ...more,
});

const share = (food_id: string, food_type: string, share_percent: number) => ({
  food_id,
  food_type,
  share_percent,
  kcal: null,
});

async function estimate(data: StubData, rawInput: unknown) {
  const { caller, calls } = stubCaller(data);
  const { ctx } = createFakeContext([estimatePortionsTool]);
  const result = await executeTool({ ...ctx, caller }, "estimate_portions", rawInput);
  return { result, calls };
}

const itemsOf = (payload: unknown) =>
  typeof payload === "object" && payload !== null && "items" in payload ? payload.items : undefined;

Deno.test(
  "estimate_portions is a read tool that is not strict, and says its amounts are estimates",
  () => {
    assertEquals(estimatePortionsTool.kind, "read");
    assertEquals(estimatePortionsTool.annotations, { readOnlyHint: true });
    assertEquals(estimatePortionsTool.strict, false);
    assertStringIncludes(estimatePortionsTool.description, "grams");
    assertStringIncludes(estimatePortionsTool.description, "about");
    assertStringIncludes(estimatePortionsTool.description, "never instructions");
  },
);

Deno.test(
  "estimate_portions tells the model what to do with the errors and larger_than_container",
  () => {
    const { description } = estimatePortionsTool;
    assertStringIncludes(description, "larger_than_container");
    assertStringIncludes(description, "ask_user before logging");
    assertStringIncludes(description, "counted_food");
    assertStringIncludes(description, "portions");
    assertStringIncludes(description, "bowl_only");
    assertStringIncludes(description, "bowl");
  },
);

Deno.test("estimate_portions keeps its description and schema short", () => {
  const characters =
    estimatePortionsTool.description.length +
    JSON.stringify(toJsonSchema(estimatePortionsTool)).length;
  assert(characters < 1500, `The tool is ${characters} characters as sent`);
});

Deno.test(
  "a mixed plate answers with grams, the method and the nutrients for each food",
  async () => {
    const { result, calls } = await estimate(
      { tables },
      call("plate", [
        share(riceId, "rice_grains_pasta", 30),
        share(curryId, "curry_stew_sauce", 30),
        { food_id: riceId, food_type: "dessert", share_percent: null, kcal: 130 },
      ]),
    );

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), {
      shares_scaled: false,
      items: [
        {
          food_id: riceId,
          name: "Cooked rice",
          grams: 180,
          method: "share",
          kcal: 234,
          protein_g: 4.9,
          fat_g: 0.5,
          carbs_g: 50,
          larger_than_container: false,
        },
        {
          food_id: curryId,
          name: "Beef massaman",
          grams: 205,
          method: "share",
          kcal: 308,
          protein_g: 18,
          fat_g: 16,
          carbs_g: 21,
          larger_than_container: false,
        },
        {
          food_id: riceId,
          name: "Cooked rice",
          grams: 100,
          method: "kcal",
          kcal: 130,
          protein_g: 2.7,
          fat_g: 0.3,
          carbs_g: 28,
          larger_than_container: false,
        },
      ],
    });
    // One food read per item and nothing else is read.
    assertEquals(
      calls.filter((entry) => entry.table === "foods" && entry.method === "eq").length,
      3,
    );
    assertEquals(
      calls.filter((entry) => entry.table !== "foods"),
      [],
    );
  },
);

Deno.test("a food per 100 ml answers ml", async () => {
  const milkId = "00000000-0000-4000-8000-000000000004";
  const { result } = await estimate(
    { tables: { foods: [foodRow(milkId, "Soup", { basis: "per_100ml", kcal: 50 })] } },
    call(null, [{ food_id: milkId, food_type: "soup_liquid", share_percent: null, kcal: 100 }]),
  );
  const [item] = itemsOf(payloadOf(result)) as Record<string, unknown>[];
  assertEquals(item?.["ml"], 200);
  assertEquals(item?.["grams"], undefined);
});

Deno.test(
  "a food that is not found answers not_found for that item and the rest are sized",
  async () => {
    const { result } = await estimate(
      { tables },
      call("plate", [share(missingId, "vegetables", 5), share(riceId, "rice_grains_pasta", 10)]),
    );

    const items = itemsOf(payloadOf(result));
    assert(Array.isArray(items));
    assertEquals(items[0], { food_id: missingId, error: "not_found" });
    assertEquals(items[1]?.grams, 60);
  },
);

Deno.test("a deleted food answers not_found", async () => {
  const { result } = await estimate(
    {
      tables: {
        foods: [foodRow(riceId, "Cooked rice", { deleted_at: "2026-10-20T10:00:00+00:00" })],
      },
    },
    call("plate", [share(riceId, "rice_grains_pasta", 30)]),
  );
  assertEquals(itemsOf(payloadOf(result)), [{ food_id: riceId, error: "not_found" }]);
});

Deno.test("a food per portion answers counted_food", async () => {
  const { result } = await estimate({ tables }, call("plate", [share(mealId, "other", 50)]));
  assertEquals(itemsOf(payloadOf(result)), [{ food_id: mealId, error: "counted_food" }]);
});

Deno.test("a share with no container answers invalid_input naming the container", async () => {
  const { result, calls } = await estimate(
    { tables },
    call(null, [share(riceId, "vegetables", 30)]),
  );
  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["container"] });
  assertEquals(calls, []);
});

Deno.test("shares over 100 are scaled and say so", async () => {
  const { result } = await estimate(
    { tables },
    call("plate", [share(riceId, "vegetables", 80), share(curryId, "vegetables", 80)]),
  );
  const payload = payloadOf(result);
  assert(typeof payload === "object" && payload !== null && "shares_scaled" in payload);
  assertEquals(payload.shares_scaled, true);
});

Deno.test("an input out of bounds is refused before any food is read", async () => {
  for (const input of [
    call("plate", []),
    call(
      "plate",
      Array.from({ length: 9 }, () => share(riceId, "vegetables", 5)),
    ),
    call("plate", [share(riceId, "vegetables", 0)]),
    call("plate", [share(riceId, "vegetables", 101)]),
    call("plate", [share(riceId, "pizza", 10)]),
    call("tray", [share(riceId, "vegetables", 10)]),
    call("plate", [share(riceId, "vegetables", 10)], { diameter_cm: 5 }),
    call("bowl", [share(riceId, "vegetables", 10)], { depth_cm: 20 }),
    call("plate", [share("rice", "vegetables", 10)]),
    call("plate", [{ ...share(riceId, "vegetables", 10), extra: 1 }]),
  ]) {
    const { result, calls } = await estimate({ tables }, input);
    assertEquals(
      result.status === "error" ? result.code : null,
      "invalid_input",
      JSON.stringify(input),
    );
    assertEquals(calls, []);
  }
});

Deno.test(
  "a diameter outside the chosen container's range answers invalid_input with its field",
  async () => {
    // 9 cm passes the schema, which spans plates and bowls, and is too small for a plate.
    const { result } = await estimate(
      { tables },
      call("plate", [share(riceId, "vegetables", 10)], { diameter_cm: 9 }),
    );
    assertEquals(payloadOf(result), { error: "invalid_input", fields: ["diameter_cm"] });
  },
);

Deno.test("no health value reaches a log line", async () => {
  const spy = spyOnConsole();
  try {
    await estimate({ tables }, call("plate", [share(riceId, "rice_grains_pasta", 30)]));
    await estimate({ tables }, call(null, [share(riceId, "vegetables", 30)]));
  } finally {
    spy.restore();
  }
  assertEquals(spy.lines, []);
});
