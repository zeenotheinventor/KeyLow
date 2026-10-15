import { describe, expect, it } from "vitest";

import { importPortions } from "../../../scripts/portions/importPortions";
import { portionId } from "../../../scripts/portions/portionId";

import type { PortionStore, PortionWrite } from "../../../scripts/portions/importPortions";
import type { PortionRow } from "../../../scripts/portions/portionRows";

const row = (overrides: Partial<PortionRow> = {}): PortionRow => ({
  foodCode: "14-318",
  label: "1 medium",
  grams: 118,
  ml: null,
  isDefault: false,
  position: 0,
  ...overrides,
});

/**
 * A store that behaves like the table: rows by id, and the partial unique index that allows one default
 * per food. A write that would leave two defaults for a food throws, as Postgres does.
 */
function createFakeStore(foodIdsByCode: Record<string, string>) {
  const portions = new Map<string, PortionWrite>();
  const calls: string[] = [];

  const assertOneDefaultPerFood = (): void => {
    const defaultsByFood = new Map<string, number>();
    for (const { foodId, isDefault } of portions.values()) {
      if (isDefault) {
        defaultsByFood.set(foodId, (defaultsByFood.get(foodId) ?? 0) + 1);
      }
    }
    if ([...defaultsByFood.values()].some((count) => count > 1)) {
      throw new Error(
        "duplicate key value violates unique constraint food_portions_one_default_per_food_idx",
      );
    }
  };

  const store: PortionStore = {
    findFoodIds(foodCodes) {
      calls.push("findFoodIds");
      return Promise.resolve(
        new Map(
          foodCodes.flatMap((code) =>
            code in foodIdsByCode ? [[code, foodIdsByCode[code] ?? ""]] : [],
          ),
        ),
      );
    },
    clearDefaultsExcept(foodId, keepPortionId) {
      calls.push("clearDefaultsExcept");
      for (const [id, portion] of portions) {
        if (portion.foodId === foodId && id !== keepPortionId) {
          portions.set(id, { ...portion, isDefault: false });
        }
      }
      return Promise.resolve();
    },
    upsertPortions(batch) {
      calls.push("upsertPortions");
      for (const portion of batch) {
        portions.set(portion.id, portion);
        assertOneDefaultPerFood();
      }
      return Promise.resolve();
    },
  };
  return { store, portions, calls };
}

const run = (store: PortionStore, rows: PortionRow[], options: { dryRun?: boolean } = {}) =>
  importPortions(store, { rows, dryRun: options.dryRun ?? false, log: () => undefined });

describe("importPortions", () => {
  it("should write each row under the id made from its food code and label", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });

    await run(store, [
      row({ label: "1 medium", isDefault: true }),
      row({ label: "1 large", grams: 136, position: 1 }),
    ]);

    expect([...portions.keys()].sort()).toEqual(
      [portionId("14-318", "1 medium"), portionId("14-318", "1 large")].sort(),
    );
    expect(portions.get(portionId("14-318", "1 medium"))).toEqual({
      id: portionId("14-318", "1 medium"),
      foodId: "food-banana",
      label: "1 medium",
      grams: 118,
      ml: null,
      isDefault: true,
      position: 0,
    });
  });

  it("should report the foods matched, the rows written and the codes with no food", async () => {
    const { store } = createFakeStore({ "14-318": "food-banana" });

    const summary = await run(store, [
      row(),
      row({ label: "1 large", grams: 136 }),
      row({ foodCode: "99-999" }),
    ]);

    expect(summary).toEqual({
      foodsMatched: 1,
      rowsWritten: 2,
      missingFoodCodes: ["99-999"],
    });
  });

  it("should list a missing code once however many rows it has", async () => {
    const { store } = createFakeStore({});

    const summary = await run(store, [
      row({ foodCode: "99-999" }),
      row({ foodCode: "99-999", label: "1 large" }),
    ]);

    expect(summary.missingFoodCodes).toEqual(["99-999"]);
    expect(summary.rowsWritten).toBe(0);
  });

  it("should change nothing when run twice", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });
    const rows = [row({ isDefault: true }), row({ label: "1 large", grams: 136, position: 1 })];

    await run(store, rows);
    const afterFirst = JSON.stringify([...portions.entries()]);
    await run(store, rows);

    expect(JSON.stringify([...portions.entries()])).toBe(afterFirst);
  });

  it("should update a corrected weight in place under the same id", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });
    await run(store, [row({ grams: 118 })]);

    await run(store, [row({ grams: 120 })]);

    expect([...portions.values()].map(({ id, grams }) => [id, grams])).toEqual([
      [portionId("14-318", "1 medium"), 120],
    ]);
  });

  it("should leave one default when a re-run moves the default to the other portion", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });
    const medium = row({ label: "1 medium", isDefault: true, position: 0 });
    const large = row({ label: "1 large", grams: 136, isDefault: false, position: 1 });
    await run(store, [medium, large]);

    await run(store, [
      { ...medium, isDefault: false },
      { ...large, isDefault: true },
    ]);

    expect(
      [...portions.values()].filter(({ isDefault }) => isDefault).map(({ label }) => label),
    ).toEqual(["1 large"]);
  });

  it("should move the default even when the file lists the new default before the old one", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });
    const medium = row({ label: "1 medium", isDefault: true, position: 0 });
    const large = row({ label: "1 large", grams: 136, isDefault: false, position: 1 });
    await run(store, [medium, large]);

    await run(store, [
      { ...large, isDefault: true },
      { ...medium, isDefault: false },
    ]);

    expect(
      [...portions.values()].filter(({ isDefault }) => isDefault).map(({ label }) => label),
    ).toEqual(["1 large"]);
  });

  it("should clear a default the file no longer lists when it gives the food another default", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });
    await run(store, [row({ label: "1 medium", isDefault: true })]);

    await run(store, [row({ label: "1 large", grams: 136, isDefault: true })]);

    expect(
      [...portions.values()].filter(({ isDefault }) => isDefault).map(({ label }) => label),
    ).toEqual(["1 large"]);
  });

  it("should not delete a portion that is no longer in the file", async () => {
    const { store, portions } = createFakeStore({ "14-318": "food-banana" });
    await run(store, [row({ label: "1 medium" }), row({ label: "1 large", grams: 136 })]);

    await run(store, [row({ label: "1 medium" })]);

    expect(portions.size).toBe(2);
  });

  it("should write nothing on a dry run, but still report what it matched", async () => {
    const { store, calls } = createFakeStore({ "14-318": "food-banana" });

    const summary = await run(store, [row({ isDefault: true }), row({ foodCode: "99-999" })], {
      dryRun: true,
    });

    expect(calls).toEqual(["findFoodIds"]);
    expect(summary).toEqual({ foodsMatched: 1, rowsWritten: 0, missingFoodCodes: ["99-999"] });
  });
});
