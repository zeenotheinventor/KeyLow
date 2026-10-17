import { z } from "zod";

import { NUTRITION_ENGINE_VERSION, SNAPSHOT_VERSION } from "./versions";
import { quantityUnitSchema } from "../nutrition/units";
import { nutrientBasisSchema } from "../schemas/food";
import { nutrientsSchema } from "../schemas/nutrients";

const rowIdSchema = z.guid();

/**
 * The portion a food was logged with, as stored in a snapshot (ADR 0003, Amendment 2): a label and
 * exactly one of `grams` and `ml`, with the other key absent.
 */
export const snapshotPortionSchema = z.union([
  z.strictObject({ label: z.string().min(1), grams: z.number().positive() }),
  z.strictObject({ label: z.string().min(1), ml: z.number().positive() }),
]);

const hasPortionExactlyWhenUnitIsPortion = (snapshot: {
  unit: string;
  portion: unknown;
}): boolean => (snapshot.unit === "portion") === (snapshot.portion !== null);

/**
 * What a food looked like when it was logged, so the entry never changes when the food does.
 * `portion` is non-null exactly when `unit` is `portion`. There are no micronutrients.
 *
 * When SNAPSHOT_VERSION moves to 2, this must become a union of the known versions with an upgrade
 * step, so that stored v1 snapshots still parse.
 */
export const foodSnapshotSchema = z
  .object({
    v: z.literal(SNAPSHOT_VERSION),
    kind: z.literal("food"),
    /** The id of the food the snapshot was taken from. */
    ref: rowIdSchema,
    name: z.string(),
    basis: nutrientBasisSchema,
    per100: nutrientsSchema,
    quantity: z.number().nonnegative(),
    unit: quantityUnitSchema,
    portion: snapshotPortionSchema.nullable(),
    density: z.number().positive().nullable(),
    resolvedGrams: z.number().nonnegative(),
    engineVersion: z.number().int().positive().max(NUTRITION_ENGINE_VERSION),
  })
  .refine(hasPortionExactlyWhenUnitIsPortion, {
    message: "The portion must be set exactly when the unit is portion",
    path: ["portion"],
  });

/** A quick add keeps its optional label here, because `food_log_entries` has no label column. */
export const quickSnapshotSchema = z.object({
  v: z.literal(SNAPSHOT_VERSION),
  kind: z.literal("quick"),
  label: z.string().min(1).nullable(),
});

/** The two ways a recipe is logged: a number of its servings, or grams of its cooked weight. */
export const recipeEntryUnitSchema = z.enum(["serving", "g"]);

/**
 * What a recipe looked like when it was logged (ADR 0003, Amendment 8), so the entry never changes when
 * the recipe does. It freezes the totals and not the ingredients, and `effectiveGrams` is the cooked
 * weight the grams are measured against. A recipe has no portion and no density. There are no
 * micronutrients.
 */
export const recipeSnapshotSchema = z.object({
  v: z.literal(SNAPSHOT_VERSION),
  kind: z.literal("recipe"),
  /** The id of the recipe the snapshot was taken from. */
  ref: rowIdSchema,
  name: z.string(),
  servings: z.number().positive(),
  /** Null when the recipe had no measured cooked weight. */
  yieldGrams: z.number().positive().nullable(),
  effectiveGrams: z.number().positive(),
  total: nutrientsSchema,
  quantity: z.number().nonnegative(),
  unit: recipeEntryUnitSchema,
  resolvedGrams: z.number().nonnegative(),
  engineVersion: z.number().int().positive().max(NUTRITION_ENGINE_VERSION),
});

/**
 * When an entry was logged: the instant (`logged_at`, with an offset) and the calendar day it
 * belongs to in the profile's time zone (`local_date`). The diary is a timeline by time.
 */
const entryTimingShape = {
  local_date: z.iso.date(),
  logged_at: z.iso.datetime({ offset: true }),
};

/**
 * A `food_log_entries` row as it is inserted, without the columns the database fills in
 * (`user_id`, `kcal`, `deleted_at`). The quantity columns repeat what the snapshot holds, and
 * `portion_id` may be set only for the `portion` unit (ADR 0003, Amendment 2).
 */
export const foodLogEntryInsertSchema = z
  .object({
    ...entryTimingShape,
    item_type: z.literal("food"),
    food_id: rowIdSchema,
    quantity: z.number().nonnegative(),
    unit: quantityUnitSchema,
    portion_id: rowIdSchema.nullable(),
    resolved_grams: z.number().nonnegative(),
    snapshot: foodSnapshotSchema,
    nutrients: nutrientsSchema,
  })
  .refine((entry) => entry.unit === "portion" || entry.portion_id === null, {
    message: "A portion link is only allowed for the portion unit",
    path: ["portion_id"],
  });

/** A quick add has no food, no quantity and no portion, only nutrients and an optional label. */
export const quickLogEntryInsertSchema = z.object({
  ...entryTimingShape,
  item_type: z.literal("quick"),
  food_id: z.null(),
  quantity: z.null(),
  unit: z.null(),
  portion_id: z.null(),
  resolved_grams: z.null(),
  snapshot: quickSnapshotSchema,
  nutrients: nutrientsSchema,
});

/**
 * A recipe entry names its recipe in `recipe_id` and has no food and no portion. Its quantity columns
 * repeat the snapshot, as a food's do.
 */
export const recipeLogEntryInsertSchema = z.object({
  ...entryTimingShape,
  item_type: z.literal("recipe"),
  food_id: z.null(),
  recipe_id: rowIdSchema,
  quantity: z.number().nonnegative(),
  unit: recipeEntryUnitSchema,
  portion_id: z.null(),
  resolved_grams: z.number().nonnegative(),
  snapshot: recipeSnapshotSchema,
  nutrients: nutrientsSchema,
});

export const logEntryInsertSchema = z.discriminatedUnion("item_type", [
  foodLogEntryInsertSchema,
  quickLogEntryInsertSchema,
  recipeLogEntryInsertSchema,
]);

export type FoodLogEntryInsert = z.infer<typeof foodLogEntryInsertSchema>;
export type QuickLogEntryInsert = z.infer<typeof quickLogEntryInsertSchema>;
export type RecipeLogEntryInsert = z.infer<typeof recipeLogEntryInsertSchema>;
export type LogEntryInsert = z.infer<typeof logEntryInsertSchema>;
export type SnapshotPortion = z.infer<typeof snapshotPortionSchema>;
export type FoodSnapshot = z.infer<typeof foodSnapshotSchema>;
export type QuickSnapshot = z.infer<typeof quickSnapshotSchema>;
export type RecipeSnapshot = z.infer<typeof recipeSnapshotSchema>;
export type RecipeEntryUnit = z.infer<typeof recipeEntryUnitSchema>;
