import { describe, expect, it } from "vitest";

import { buildLogEntry } from "../../src/diary/buildLogEntry";
import { matchPortionOnFood } from "../../src/diary/matchPortionOnFood";
import { recomputeEntry, refreshEntryFromFood } from "../../src/diary/recomputeEntry";
import { foodLogEntryInsertSchema } from "../../src/diary/schemas";
import { estimateDensity } from "../../src/nutrition/density";
import { SPOON_PORTIONS } from "../../src/nutrition/volume";
import { buildFood, buildFoodPortion } from "../../src/testing";

const [teaspoon, tablespoon] = SPOON_PORTIONS;
if (teaspoon === undefined || tablespoon === undefined) {
  throw new Error("The spoon portions must be a teaspoon and a tablespoon");
}

const when = {
  localDate: "2026-10-15",
  loggedAt: "2026-10-15T12:30:00+01:00",
} as const;

// Explicit density, so these tests do not depend on the numbers in the density table.
const oil = buildFood({
  id: "00000000-0000-4000-8000-0000000000e1",
  name: "Test oil",
  density_g_per_ml: 0.92,
  kcal: 884,
  protein_g: 0,
  fat_g: 100,
  carbs_g: 0,
});
const slice = buildFoodPortion({
  id: "00000000-0000-4000-8000-0000000000c1",
  food_id: oil.id,
  label: "Slice",
  grams: 35,
});

describe("logging a spoon", () => {
  it.each([
    { name: "1 tsp", spoon: teaspoon, quantity: 1, grams: 4.6 },
    { name: "1 tbsp", spoon: tablespoon, quantity: 1, grams: 13.8 },
    { name: "2 tbsp", spoon: tablespoon, quantity: 2, grams: 27.6 },
  ])(
    "should resolve $name on a food with density 0.92 to $grams grams",
    ({ spoon, quantity, grams }) => {
      const entry = buildLogEntry({
        food: oil,
        quantity,
        unit: "portion",
        portion: spoon,
        ...when,
      });

      expect(entry.resolved_grams).toBeCloseTo(grams, 10);
      expect(entry.nutrients.kcal).toBeCloseTo(8.84 * grams, 10);
      expect(entry.nutrients.fat_g).toBeCloseTo(grams, 10);
    },
  );

  it("should scale 2 tbsp to 0.276 times the per 100 g values", () => {
    const entry = buildLogEntry({
      food: oil,
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });

    expect(entry.nutrients.kcal).toBeCloseTo(884 * 0.276, 10);
    expect(entry.nutrients.kcal).toBeCloseTo(243.984, 10);
  });

  it("should resolve 250 ml on a food with density 1.03 to 257.5 grams", () => {
    const milk = buildFood({ density_g_per_ml: 1.03 });

    const entry = buildLogEntry({ food: milk, quantity: 250, unit: "ml", ...when });

    expect(entry.resolved_grams).toBeCloseTo(257.5, 10);
  });

  it("should need no density for a per 100 ml food, because grams are never read", () => {
    const drink = buildFood({
      basis: "per_100ml",
      density_g_per_ml: null,
      kcal: 40,
      protein_g: 2,
      fat_g: 1,
      carbs_g: 5,
    });

    const entry = buildLogEntry({
      food: drink,
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });

    expect(entry.nutrients.kcal).toBeCloseTo(12, 10);
    expect(entry.snapshot.portion).toStrictEqual({ label: "1 tbsp", ml: 15 });
  });

  it("should work through the real density table for a CoFID oil", () => {
    const cofidOil = buildFood({
      id: "00000000-0000-4000-8000-0000000000e2",
      source: "cofid",
      source_ref: null,
      food_group: "OC",
      density_g_per_ml: null,
      kcal: 899,
      fat_g: 99.9,
    });
    const estimate = estimateDensity(cofidOil);
    if (estimate === null) {
      throw new Error("A CoFID oil must have a density estimate");
    }

    const entry = buildLogEntry({
      food: cofidOil,
      quantity: 1,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });

    expect(entry.resolved_grams).toBe(15 * estimate.gPerMl);
    expect(entry.snapshot.density).toBe(estimate.gPerMl);
  });
});

describe("the portion link of a spoon", () => {
  it("should be null on buildLogEntry, and the entry should pass the insert schema", () => {
    const entry = buildLogEntry({
      food: oil,
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });

    expect(entry.portion_id).toBeNull();
    expect(foodLogEntryInsertSchema.safeParse(entry).success).toBe(true);
  });

  it("should still be the real portion's id for a real portion", () => {
    const entry = buildLogEntry({
      food: oil,
      quantity: 1,
      unit: "portion",
      portion: slice,
      ...when,
    });

    expect(entry.portion_id).toBe(slice.id);
    expect(foodLogEntryInsertSchema.safeParse(entry).success).toBe(true);
  });

  it("should be null on recomputeEntry when the caller supplies a spoon id as the link", () => {
    const gramEntry = buildLogEntry({ food: oil, quantity: 10, unit: "g", ...when });

    const entry = recomputeEntry(gramEntry, {
      quantity: 2,
      unit: "portion",
      portion: { label: tablespoon.label, ml: tablespoon.ml },
      portionId: tablespoon.id,
    });

    expect(entry.portion_id).toBeNull();
    expect(foodLogEntryInsertSchema.safeParse(entry).success).toBe(true);
  });

  it("should stay null when only the quantity of a spoon entry changes", () => {
    const spoonEntry = buildLogEntry({
      food: oil,
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
      ...when,
    });

    const entry = recomputeEntry(spoonEntry, { quantity: 3, unit: "portion" });

    expect(entry.portion_id).toBeNull();
    expect(entry.resolved_grams).toBeCloseTo(41.4, 10);
  });
});

describe("keeping a spoon when the entry is updated or logged again", () => {
  const twoTablespoons = buildLogEntry({
    food: oil,
    quantity: 2,
    unit: "portion",
    portion: tablespoon,
    ...when,
  });
  const previous = {
    quantity: 2,
    portionId: null,
    portion: { label: tablespoon.label, ml: tablespoon.ml },
  };

  it.each([
    ["without portions", []],
    ["with portions of its own", [slice]],
  ])("should give 2 of the tablespoon portion from matchPortionOnFood %s", (_name, portions) => {
    expect(matchPortionOnFood(previous, portions)).toEqual({
      quantity: 2,
      unit: "portion",
      portion: tablespoon,
    });
  });

  it("should give 2 of the teaspoon portion for a teaspoon entry", () => {
    const oneTeaspoon = {
      quantity: 3,
      portionId: null,
      portion: { label: teaspoon.label, ml: teaspoon.ml },
    };

    expect(matchPortionOnFood(oneTeaspoon, [])).toEqual({
      quantity: 3,
      unit: "portion",
      portion: teaspoon,
    });
  });

  it("should prefer the food's own portion with the same label to the spoon", () => {
    const ownTablespoon = buildFoodPortion({ ...slice, label: tablespoon.label, grams: 14 });

    expect(matchPortionOnFood(previous, [ownTablespoon])).toEqual({
      quantity: 2,
      unit: "portion",
      portion: ownTablespoon,
    });
  });

  it.each([
    ["without portions", []],
    ["with portions of its own", [slice]],
  ])("should keep 2 tbsp, not 30 ml, when refreshEntryFromFood runs %s", (_name, portions) => {
    const retunedOil = buildFood({ ...oil, density_g_per_ml: 0.9 });

    const entry = refreshEntryFromFood(twoTablespoons, retunedOil, portions);

    expect(entry.unit).toBe("portion");
    expect(entry.quantity).toBe(2);
    expect(entry.snapshot.portion).toStrictEqual({ label: "1 tbsp", ml: 15 });
    expect(entry.resolved_grams).toBeCloseTo(27, 10);
    expect(entry.portion_id).toBeNull();
    expect(foodLogEntryInsertSchema.safeParse(entry).success).toBe(true);
  });

  it("should still fall back to the direct amount for a gram portion that no longer exists", () => {
    const sliceEntry = buildLogEntry({
      food: oil,
      quantity: 2,
      unit: "portion",
      portion: slice,
      ...when,
    });

    const entry = refreshEntryFromFood(sliceEntry, oil, [buildFoodPortion({ label: "Roll" })]);

    expect(entry.unit).toBe("g");
    expect(entry.quantity).toBe(70);
    expect(entry.portion_id).toBeNull();
  });
});
