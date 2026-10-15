import { offProductResponseSchema } from "@keylow/core";
import { afterAll, describe, expect, it } from "vitest";

import { generateBarcode } from "../support/barcodes";
import { deleteGeneratedFoods } from "../support/foods";
import { adminClient } from "../support/stack";

// Two writers racing for one barcode is the case no pgTAP file can show, because pgTAP runs in one
// transaction. Each call here is its own transaction on its own connection, and they start together.
// The writers differ in name, portion labels and which portion is the default, so a store that mixed
// two writers' rows (a name from one, portions from another) would show up.

afterAll(async () => {
  await deleteGeneratedFoods();
});

const writerCount = 8;

function foodOf(code: string, writer: number) {
  return {
    source: "off",
    source_ref: code,
    name: `Writer ${writer}`,
    barcode: code,
    basis: "per_100g",
    kcal: 100 + writer,
    micros: {},
    quality: {},
  };
}

function portionsOf(writer: number) {
  return [
    { label: `writer ${writer} first`, grams: 10, ml: null, is_default: true },
    { label: `writer ${writer} second`, grams: 20, ml: null, is_default: false },
  ];
}

async function storeAsWriter(code: string, writer: number) {
  return await adminClient().rpc("store_off_product", {
    p_food: foodOf(code, writer),
    p_portions: portionsOf(writer),
    p_raw: { code, writer },
  });
}

async function readStored(code: string) {
  const admin = adminClient();
  const { data: foods, error } = await admin
    .from("foods")
    .select("id, name")
    .eq("source", "off")
    .eq("source_ref", code);
  expect(error).toBeNull();
  const food = foods?.[0];
  if (food === undefined) {
    throw new Error(`Nothing was stored for ${code}`);
  }
  const { data: portions, error: portionError } = await admin
    .from("food_portions")
    .select("label, is_default, position")
    .eq("food_id", food.id)
    .order("position");
  expect(portionError).toBeNull();
  const { data: raw, error: rawError } = await admin
    .from("food_source_data")
    .select("raw")
    .eq("food_id", food.id);
  expect(rawError).toBeNull();
  return { foodCount: foods?.length, food, portions, raw };
}

describe("store_off_product under concurrency", () => {
  it("should let simultaneous first stores of one barcode all succeed, leaving one writer's whole product", async () => {
    const code = generateBarcode();

    const results = await Promise.all(
      Array.from({ length: writerCount }, (_, writer) => storeAsWriter(code, writer)),
    );

    expect(results.map(({ error }) => error)).toEqual(Array(writerCount).fill(null));
    const stored = await readStored(code);
    expect(stored.foodCount).toBe(1);
    const winner = Number(stored.food.name.replace("Writer ", ""));
    expect(stored.portions).toEqual([
      { label: `writer ${winner} first`, is_default: true, position: 0 },
      { label: `writer ${winner} second`, is_default: false, position: 1 },
    ]);
    expect(stored.raw).toEqual([{ raw: { code, writer: winner } }]);
  });

  it("should let simultaneous refreshes of a stored barcode all succeed, leaving one writer's whole product", async () => {
    const code = generateBarcode();
    const first = await storeAsWriter(code, 100);
    expect(first.error).toBeNull();

    const results = await Promise.all(
      Array.from({ length: writerCount }, (_, writer) => storeAsWriter(code, writer)),
    );

    expect(results.map(({ error }) => error)).toEqual(Array(writerCount).fill(null));
    const stored = await readStored(code);
    expect(stored.foodCount).toBe(1);
    const winner = Number(stored.food.name.replace("Writer ", ""));
    expect(stored.portions).toEqual([
      { label: `writer ${winner} first`, is_default: true, position: 0 },
      { label: `writer ${winner} second`, is_default: false, position: 1 },
    ]);
    expect(stored.raw).toEqual([{ raw: { code, writer: winner } }]);
    // Every caller was answered with the one food, whichever of them wrote last.
    const answeredIds = new Set(
      results.map(({ data }) => offProductResponseSchema.parse(data).food.id),
    );
    expect(answeredIds).toEqual(new Set([stored.food.id]));
  });
});
