import { describe, expect, it } from "vitest";

import {
  buildLogEntry,
  buildQuickEntry,
  foodLogEntryInsertSchema,
  logEntryInsertSchema,
  quickLogEntryInsertSchema,
  recipeLogEntryInsertSchema,
  recipeSnapshotSchema,
} from "../../src/diary";
import { buildFood } from "../../src/testing";

import type { RecipeLogEntryInsert, RecipeSnapshot } from "../../src/diary";

const recipeId = "00000000-0000-4000-8000-0000000000b1";

const snapshot: RecipeSnapshot = {
  v: 1,
  kind: "recipe",
  ref: recipeId,
  name: "Chicken and rice",
  servings: 4,
  yieldGrams: 1100,
  effectiveGrams: 1100,
  total: { kcal: 1496.8, protein_g: 126.5, fat_g: 22, carbs_g: 156, fibre_g: 4 },
  quantity: 1,
  unit: "serving",
  resolvedGrams: 275,
  engineVersion: 1,
};

const entry: RecipeLogEntryInsert = {
  local_date: "2026-10-17",
  logged_at: "2026-10-17T12:30:00+01:00",
  item_type: "recipe",
  food_id: null,
  recipe_id: recipeId,
  quantity: 1,
  unit: "serving",
  portion_id: null,
  resolved_grams: 275,
  snapshot,
  nutrients: { kcal: 374.2, protein_g: 31.625, fat_g: 5.5, carbs_g: 39, fibre_g: 1 },
};

const when = { loggedAt: "2026-10-17T12:30:00+01:00", localDate: "2026-10-17" };

describe("recipeSnapshotSchema", () => {
  it("should accept a recipe snapshot", () => {
    expect(recipeSnapshotSchema.parse(snapshot)).toEqual(snapshot);
  });

  it("should accept a recipe with no yield", () => {
    expect(recipeSnapshotSchema.safeParse({ ...snapshot, yieldGrams: null }).success).toBe(true);
  });

  it.each([
    ["cooked weight of 0", { effectiveGrams: 0 }],
    ["servings of 0", { servings: 0 }],
    ["a yield of 0", { yieldGrams: 0 }],
    ["a negative quantity", { quantity: -1 }],
    ["the portion unit", { unit: "portion" }],
    ["the millilitre unit", { unit: "ml" }],
    ["a food kind", { kind: "food" }],
    ["another version", { v: 2 }],
    ["a ref that is not an id", { ref: "not-an-id" }],
  ])("should reject %s", (_, change) => {
    expect(recipeSnapshotSchema.safeParse({ ...snapshot, ...change }).success).toBe(false);
  });

  it("should accept the unit g", () => {
    expect(recipeSnapshotSchema.safeParse({ ...snapshot, unit: "g" }).success).toBe(true);
  });
});

describe("recipeLogEntryInsertSchema", () => {
  it("should accept a recipe entry", () => {
    expect(recipeLogEntryInsertSchema.parse(entry)).toEqual(entry);
  });

  it.each([
    ["a food id", { food_id: recipeId }],
    ["a portion id", { portion_id: recipeId }],
    ["no recipe id", { recipe_id: null }],
    ["a food item type", { item_type: "food" }],
    ["a time without an offset", { logged_at: "2026-10-17T12:30:00" }],
  ])("should reject an entry with %s", (_, change) => {
    expect(recipeLogEntryInsertSchema.safeParse({ ...entry, ...change }).success).toBe(false);
  });

  it("should reject a food entry and a quick add", () => {
    const food = buildLogEntry({ food: buildFood(), quantity: 100, unit: "g", ...when });
    const quick = buildQuickEntry({ kcal: 200, ...when });

    expect(recipeLogEntryInsertSchema.safeParse(food).success).toBe(false);
    expect(recipeLogEntryInsertSchema.safeParse(quick).success).toBe(false);
  });
});

describe("logEntryInsertSchema", () => {
  it("should accept a recipe entry", () => {
    expect(logEntryInsertSchema.parse(entry)).toEqual(entry);
  });

  it("should keep accepting a food entry and a quick add", () => {
    const food = buildLogEntry({ food: buildFood(), quantity: 100, unit: "g", ...when });
    const quick = buildQuickEntry({ kcal: 200, ...when });

    expect(logEntryInsertSchema.parse(food)).toEqual(food);
    expect(logEntryInsertSchema.parse(quick)).toEqual(quick);
  });

  it("should leave the food and quick schemas rejecting a recipe entry", () => {
    expect(foodLogEntryInsertSchema.safeParse(entry).success).toBe(false);
    expect(quickLogEntryInsertSchema.safeParse(entry).success).toBe(false);
  });
});
