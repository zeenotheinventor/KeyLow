import { assertEquals, assertObjectMatch, assertRejects } from "@std/assert";

import { logFood, softDeleteLogEntry } from "./repos.ts";

import type { Database } from "./core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

// These tests prove that the api-client repos run under Deno through the bundle, and that they build
// the queries the app builds. They use a stub client that records the calls of the query builder, so
// they need no database. The behaviour of each query is covered by the api-client's own tests.

type RecordedCall = { method: string; args: unknown[] };
type Answer = { data: unknown; error: null };

// A query builder that records every call and answers the awaited end of the chain. The repos end
// a chain with `single()` or `maybeSingle()`, so those two are the only methods that answer.
function stubClient(answer: (calls: RecordedCall[]) => Answer) {
  const calls: RecordedCall[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    };
  const answerWith =
    (method: string) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      return Promise.resolve(answer(calls));
    };
  const builder = {
    from: record("from"),
    insert: record("insert"),
    update: record("update"),
    eq: record("eq"),
    select: record("select"),
    single: answerWith("single"),
    maybeSingle: answerWith("maybeSingle"),
  };
  // The repos only call the methods above. The stub cannot satisfy the whole client type.
  const client = builder as unknown as SupabaseClient<Database>;
  return { client, calls };
}

function recordOf(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected an object");
  }
  return Object.fromEntries(Object.entries(value));
}

// The first argument of a recorded call, which the repos pass as an object (a row or a set of changes).
const objectArgumentOf = (call: RecordedCall | undefined) => recordOf(call?.args[0]);

const foodId = "22222222-2222-4222-8222-222222222222";
const entryId = "44444444-4444-4444-8444-444444444444";

const oats = {
  id: foodId,
  source: "user" as const,
  source_ref: null,
  owner_id: null,
  name: "Rolled oats",
  brand: null,
  barcode: null,
  basis: "per_100g" as const,
  density_g_per_ml: null,
  kcal: 200,
  protein_g: 10,
  fat_g: 5,
  sat_fat_g: null,
  carbs_g: 20,
  sugars_g: null,
  fibre_g: null,
  salt_g: null,
  micros: {},
  quality: {},
  food_group: null,
  fetched_at: null,
  deleted_at: null,
  created_at: "2026-10-07T10:00:00+00:00",
};

Deno.test(
  "logFood inserts a food entry built from the food and the amount, and returns the stored row",
  async () => {
    // The database adds the id and the creation time, and the kcal column is generated from the nutrients.
    const { client, calls } = stubClient((recorded) => {
      const inserted = objectArgumentOf(recorded[1]);
      return {
        data: {
          ...inserted,
          id: entryId,
          created_at: "2026-10-15T12:01:00+00:00",
          kcal: recordOf(inserted.nutrients).kcal,
        },
        error: null,
      };
    });

    const entry = await logFood(client, {
      food: oats,
      quantity: 50,
      unit: "g",
      loggedAt: "2026-10-15T12:00:00.000Z",
      localDate: "2026-10-15",
    });

    assertEquals(entry.id, entryId);
    assertEquals(entry.item_type, "food");
    assertEquals(calls[0], { method: "from", args: ["food_log_entries"] });
    assertEquals(calls[1]?.method, "insert");
    assertObjectMatch(objectArgumentOf(calls[1]), {
      item_type: "food",
      food_id: foodId,
      local_date: "2026-10-15",
      logged_at: "2026-10-15T12:00:00.000Z",
      quantity: 50,
      unit: "g",
      resolved_grams: 50,
      snapshot: { name: "Rolled oats", per100: { kcal: 200 } },
    });
    // 50 g of a food with 200 kcal per 100 g is 100 kcal, which the stub stores as the generated column.
    assertEquals(entry.kcal, 100);
    assertEquals(calls[2]?.method, "select");
    assertEquals(calls[3]?.method, "single");
  },
);

Deno.test(
  "softDeleteLogEntry sets deleted_at on the entry by id and does not delete the row",
  async () => {
    const { client, calls } = stubClient(() => ({ data: { id: entryId }, error: null }));

    await softDeleteLogEntry(client, entryId);

    assertEquals(calls[0], { method: "from", args: ["food_log_entries"] });
    assertEquals(calls[1]?.method, "update");
    assertEquals(typeof objectArgumentOf(calls[1]).deleted_at, "string");
    assertEquals(calls[2], { method: "eq", args: ["id", entryId] });
    assertEquals(calls[3], { method: "select", args: ["id"] });
    assertEquals(calls[4]?.method, "maybeSingle");
  },
);

Deno.test("softDeleteLogEntry throws when the entry is not visible to the caller", async () => {
  const { client } = stubClient(() => ({ data: null, error: null }));

  await assertRejects(() => softDeleteLogEntry(client, entryId), Error, entryId);
});
