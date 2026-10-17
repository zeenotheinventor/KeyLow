import { describe, expect, it } from "vitest";

import {
  nutrientsOfRecipeSnapshot,
  recipeSnapshotSchema,
  recomputeRecipeEntry,
} from "../../src/diary";
import { withRecipeQuantity } from "../../src/diary/recipeSnapshotQuantity";
import goldenEntries from "../fixtures/diary/goldenRecipeV1Snapshots.json";

import type { RecipeLogEntryInsert } from "../../src/diary";

/*
 * Seven stored recipe snapshots at v1. The nutrients and grams were worked out by hand-written arithmetic in
 * the order ADR 0003, Amendment 8 fixes, not by the code under test. The last two are chosen so that the
 * other orders of the same arithmetic differ in the last digit. They must never change: they prove an
 * entry logged today still gives exactly the same numbers when the maths is touched later. This file is
 * the recipe counterpart of goldenV1Snapshots.json, which is not touched.
 */
describe("golden recipe v1 snapshots", () => {
  it.each(goldenEntries)("should still parse $name", ({ snapshot }) => {
    expect(recipeSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it.each(goldenEntries)(
    "should rebuild exactly the stored nutrients from the snapshot alone for $name",
    ({ snapshot, expectedNutrients }) => {
      expect(nutrientsOfRecipeSnapshot(recipeSnapshotSchema.parse(snapshot))).toStrictEqual(
        expectedNutrients,
      );
    },
  );

  it.each(goldenEntries)(
    "should keep exactly the same resolved grams for $name",
    ({ snapshot, expectedResolvedGrams }) => {
      const { quantity, unit, resolvedGrams, engineVersion, ...frozen } =
        recipeSnapshotSchema.parse(snapshot);

      expect(resolvedGrams).toBe(expectedResolvedGrams);
      expect(withRecipeQuantity(frozen, { quantity, unit }).resolvedGrams).toBe(
        expectedResolvedGrams,
      );
      expect(engineVersion).toBe(1);
    },
  );

  it.each(goldenEntries)(
    "should recompute the stored amount to the stored nutrients for $name",
    ({ snapshot, expectedNutrients, expectedResolvedGrams }) => {
      const parsed = recipeSnapshotSchema.parse(snapshot);
      const stored: RecipeLogEntryInsert = {
        local_date: "2026-10-17",
        logged_at: "2026-10-17T12:30:00+01:00",
        item_type: "recipe",
        food_id: null,
        recipe_id: parsed.ref,
        quantity: parsed.quantity,
        unit: parsed.unit,
        portion_id: null,
        resolved_grams: parsed.resolvedGrams,
        snapshot: parsed,
        nutrients: expectedNutrients,
      };

      const recomputed = recomputeRecipeEntry(stored, {
        quantity: parsed.quantity,
        unit: parsed.unit,
      });

      expect(recomputed.nutrients).toStrictEqual(expectedNutrients);
      expect(recomputed.resolved_grams).toBe(expectedResolvedGrams);
    },
  );
});
