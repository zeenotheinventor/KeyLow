import { describe, expect, it } from "vitest";

import { importPortions } from "../../../scripts/portions/importPortions";
import { portionId } from "../../../scripts/portions/portionId";
import { createSupabasePortionStore } from "../../../scripts/portions/supabasePortionStore";
import { adminClient } from "../support/stack";

import type { PortionStore } from "../../../scripts/portions/importPortions";
import type { PortionRow } from "../../../scripts/portions/portionRows";

type TestFoods = { codes: [string, string]; ids: [string, string] };

async function removeTestFoods(codes: readonly string[]): Promise<void> {
  const { error } = await adminClient()
    .from("foods")
    .delete()
    .in("source_ref", [...codes]);
  if (error) {
    throw new Error("Could not remove the test foods", { cause: error });
  }
}

/**
 * Gives the test its own two CoFID foods, with codes (`TEST-<uuid>-n`) that no CoFID code can equal and no
 * other session shares, and removes them afterwards, whether the test passed or not. Deleting a food
 * deletes its portions (on delete cascade). Nothing here counts a whole table.
 */
async function withTestFoods(body: (foods: TestFoods) => Promise<void>): Promise<void> {
  const tag = crypto.randomUUID();
  const codes: [string, string] = [`TEST-${tag}-1`, `TEST-${tag}-2`];
  const admin = adminClient();

  const { data, error } = await admin
    .from("foods")
    .insert(
      codes.map((code, index) => ({
        source: "cofid" as const,
        source_ref: code,
        name: `Portion loader test food ${index + 1} ${tag}`,
        basis: "per_100g" as const,
      })),
    )
    .select("id, source_ref");
  if (error) {
    throw new Error("Could not create the test foods", { cause: error });
  }
  const idOf = (code: string): string => {
    const food = data.find(({ source_ref }) => source_ref === code);
    if (food === undefined) {
      throw new Error(`The test food ${code} was not created`);
    }
    return food.id;
  };

  try {
    await body({ codes, ids: [idOf(codes[0]), idOf(codes[1])] });
  } finally {
    await removeTestFoods(codes);
  }
}

const rowFor = (foodCode: string, overrides: Partial<PortionRow> = {}): PortionRow => ({
  foodCode,
  label: "1 medium",
  grams: 118,
  ml: null,
  isDefault: true,
  position: 0,
  ...overrides,
});

const loadInto = (rows: PortionRow[], options: { store?: PortionStore; dryRun?: boolean } = {}) =>
  importPortions(options.store ?? createSupabasePortionStore(adminClient()), {
    rows,
    dryRun: options.dryRun ?? false,
    log: () => undefined,
  });

async function readPortions(foodIds: readonly string[]) {
  const { data, error } = await adminClient()
    .from("food_portions")
    .select("*")
    .in("food_id", [...foodIds])
    .order("food_id")
    .order("position");
  if (error) {
    throw new Error("Could not read the test portions", { cause: error });
  }
  return data;
}

describe("the portions loader against the local database", () => {
  it("should insert the rows under their deterministic ids with no owner", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      const summary = await loadInto([
        rowFor(codes[0]),
        rowFor(codes[0], { label: "1 large", grams: 136, isDefault: false, position: 1 }),
        rowFor(codes[1], { label: "1 glass", grams: null, ml: 250 }),
      ]);

      const portions = await readPortions(ids);
      expect(summary).toEqual({ foodsMatched: 2, rowsWritten: 3, missingFoodCodes: [] });
      expect(portions.map((portion) => portion.id).sort()).toEqual(
        [
          portionId(codes[0], "1 medium"),
          portionId(codes[0], "1 large"),
          portionId(codes[1], "1 glass"),
        ].sort(),
      );
      expect(portions.every((portion) => portion.owner_id === null)).toBe(true);
      expect(portions.find((portion) => portion.label === "1 glass")).toMatchObject({
        grams: null,
        ml: 250,
      });
    });
  });

  it("should change no row when the same file is loaded again", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      const rows = [
        rowFor(codes[0]),
        rowFor(codes[0], { label: "1 large", grams: 136, isDefault: false, position: 1 }),
      ];
      await loadInto(rows);
      const first = await readPortions(ids);

      await loadInto(rows);
      const second = await readPortions(ids);

      expect(second).toEqual(first);
      expect(second).toHaveLength(2);
    });
  });

  it("should update a corrected weight in place, keeping the id and the creation time", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      await loadInto([rowFor(codes[0], { grams: 118 })]);
      const [before] = await readPortions(ids);

      await loadInto([rowFor(codes[0], { grams: 120 })]);
      const after = await readPortions(ids);

      expect(after).toHaveLength(1);
      expect(after[0]).toEqual({ ...before, grams: 120 });
    });
  });

  it("should leave exactly one default when the default moves to the other portion", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      const medium = rowFor(codes[0], { label: "1 medium", isDefault: true, position: 0 });
      const large = rowFor(codes[0], {
        label: "1 large",
        grams: 136,
        isDefault: false,
        position: 1,
      });
      await loadInto([medium, large]);

      await loadInto([
        { ...medium, isDefault: false },
        { ...large, isDefault: true },
      ]);

      const portions = await readPortions(ids);
      expect(
        portions.filter((portion) => portion.is_default).map((portion) => portion.label),
      ).toEqual(["1 large"]);
      expect(portions).toHaveLength(2);
    });
  });

  it("should move the default even when the file lists the new default before the old one", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      const medium = rowFor(codes[0], { label: "1 medium", isDefault: true, position: 0 });
      const large = rowFor(codes[0], {
        label: "1 large",
        grams: 136,
        isDefault: false,
        position: 1,
      });
      await loadInto([medium, large]);

      await loadInto([
        { ...large, isDefault: true },
        { ...medium, isDefault: false },
      ]);

      const defaults = (await readPortions(ids)).filter((portion) => portion.is_default);
      expect(defaults.map((portion) => portion.label)).toEqual(["1 large"]);
    });
  });

  it("should move the default to a portion that is new to the food", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      await loadInto([rowFor(codes[0], { label: "1 medium", isDefault: true })]);

      await loadInto([rowFor(codes[0], { label: "1 large", grams: 136, isDefault: true })]);

      const defaults = (await readPortions(ids)).filter((portion) => portion.is_default);
      expect(defaults.map((portion) => portion.label)).toEqual(["1 large"]);
    });
  });

  it("should report a code with no food and skip it", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      const missingCode = `TEST-${crypto.randomUUID()}-missing`;

      const summary = await loadInto([rowFor(codes[0]), rowFor(missingCode)]);

      expect(summary).toEqual({ foodsMatched: 1, rowsWritten: 1, missingFoodCodes: [missingCode] });
      expect(await readPortions(ids)).toHaveLength(1);
    });
  });

  it("should write nothing on a dry run, which is proved by a store that throws on any write", async () => {
    await withTestFoods(async ({ codes, ids }) => {
      const real = createSupabasePortionStore(adminClient());
      const storeThatMustNotWrite: PortionStore = {
        findFoodIds: (foodCodes) => real.findFoodIds(foodCodes),
        clearDefaultsExcept: () => Promise.reject(new Error("A dry run must not write")),
        upsertPortions: () => Promise.reject(new Error("A dry run must not write")),
      };

      const summary = await loadInto([rowFor(codes[0])], {
        store: storeThatMustNotWrite,
        dryRun: true,
      });

      expect(summary).toEqual({ foodsMatched: 1, rowsWritten: 0, missingFoodCodes: [] });
      expect(await readPortions(ids)).toEqual([]);
    });
  });
});
