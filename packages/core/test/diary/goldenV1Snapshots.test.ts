import { describe, expect, it } from "vitest";

import { foodSnapshotSchema } from "../../src/diary/schemas";
import { nutrientsOfSnapshot, withQuantity } from "../../src/diary/snapshotQuantity";
import goldenEntries from "../fixtures/diary/goldenV1Snapshots.json";

/*
 * Four stored v1 snapshots, built with the code on main before KEY-258 touched anything, with the
 * nutrients and grams that code gave. They must never change: they prove an entry logged before spoons
 * and density estimates still gives exactly the same numbers.
 */
describe("golden v1 snapshots", () => {
  it.each(goldenEntries)("should still parse $name", ({ snapshot }) => {
    expect(foodSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it.each(goldenEntries)(
    "should give exactly the same nutrients as before for $name",
    ({ snapshot, expectedNutrients }) => {
      expect(nutrientsOfSnapshot(foodSnapshotSchema.parse(snapshot))).toEqual(expectedNutrients);
    },
  );

  it.each(goldenEntries)(
    "should keep exactly the same resolved grams as before for $name",
    ({ snapshot, expectedResolvedGrams }) => {
      const { v, kind, ref, name, basis, per100, density, quantity, unit, portion, resolvedGrams } =
        foodSnapshotSchema.parse(snapshot);

      expect(resolvedGrams).toBe(expectedResolvedGrams);
      expect(
        withQuantity({ v, kind, ref, name, basis, per100, density }, { quantity, unit, portion })
          .resolvedGrams,
      ).toBe(expectedResolvedGrams);
    },
  );
});
