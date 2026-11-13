import { z } from "zod";

import { idOfRow, parseRow } from "./diaryRows";
import { entriesOfItems } from "./diaryWrites";
import { repoError } from "./repoError";

import type { LogEntriesItem } from "./diaryWrites";
import type { Database } from "../database.types";
import type { SupabaseClient } from "@supabase/supabase-js";

// A meal plan says what a person intends to eat, so it is health data (ADR 0003, Amendment 22). The
// database's own message and details can quote a failing row, so a failure here names the action and the
// error code only, and the cause holds the code and nothing else. A row or an input that does not parse is
// reported by its id and the paths of the fields that failed, never by a value.

const PLAN_COLUMNS = [
  "id",
  "start_date",
  "day_count",
  "rules",
  "source",
  "archived_at",
  "created_at",
  "meal_plan_days(id,local_date,target,confirmed_at,confirmed_entry_ids,meal_plan_items(id,position,slot_time,item_type,food_id,recipe_id,servings,grams,portion_id,nutrients,leftover_of,snapshot))",
].join(",");

/** A JSON object, which is all the database checks of `rules`, `target`, `nutrients` and `snapshot`. Their shape is core's. */
const jsonObjectSchema = z.record(z.string(), z.json());

const itemRowBase = {
  id: z.guid(),
  position: z.number().int(),
  slot_time: z.string().nullable(),
  nutrients: jsonObjectSchema,
  leftover_of: z.guid().nullable(),
  snapshot: jsonObjectSchema,
};

const itemRowSchema = z.discriminatedUnion("item_type", [
  z
    .object({
      ...itemRowBase,
      item_type: z.literal("recipe"),
      recipe_id: z.guid().nullable(),
      servings: z.number(),
    })
    .transform((row): MealPlanItem => ({
      kind: "recipe",
      id: row.id,
      position: row.position,
      slotTime: row.slot_time,
      recipeId: row.recipe_id,
      servings: row.servings,
      nutrients: row.nutrients,
      leftoverOf: row.leftover_of,
      snapshot: row.snapshot,
    })),
  z
    .object({
      ...itemRowBase,
      item_type: z.literal("food"),
      food_id: z.guid().nullable(),
      grams: z.number(),
      portion_id: z.guid().nullable(),
    })
    .transform((row): MealPlanItem => ({
      kind: "food",
      id: row.id,
      position: row.position,
      slotTime: row.slot_time,
      foodId: row.food_id,
      grams: row.grams,
      portionId: row.portion_id,
      nutrients: row.nutrients,
      leftoverOf: row.leftover_of,
      snapshot: row.snapshot,
    })),
]);

const dayRowSchema = z
  .object({
    id: z.guid(),
    local_date: z.iso.date(),
    target: jsonObjectSchema,
    confirmed_at: z.string().nullable(),
    confirmed_entry_ids: z.array(z.guid()).nullable(),
    meal_plan_items: z.array(itemRowSchema),
  })
  .transform((row): MealPlanDay => ({
    id: row.id,
    localDate: row.local_date,
    target: row.target,
    confirmedAt: row.confirmed_at,
    confirmedEntryIds: row.confirmed_entry_ids,
    items: [...row.meal_plan_items].sort(
      (first, second) => first.position - second.position || first.id.localeCompare(second.id),
    ),
  }));

const planRowSchema = z
  .object({
    id: z.guid(),
    start_date: z.iso.date(),
    day_count: z.number().int(),
    rules: jsonObjectSchema,
    source: z.enum(["assistant", "app"]),
    archived_at: z.string().nullable(),
    created_at: z.string(),
    meal_plan_days: z.array(dayRowSchema),
  })
  .transform((row): MealPlan => ({
    id: row.id,
    startDate: row.start_date,
    dayCount: row.day_count,
    rules: row.rules,
    source: row.source,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    days: [...row.meal_plan_days].sort((first, second) =>
      first.localDate.localeCompare(second.localDate),
    ),
  }));

type JsonObject = z.infer<typeof jsonObjectSchema>;

/** One planned food or recipe of a day. What it holds was frozen by core when the plan was made. */
export type MealPlanItem = {
  id: string;
  position: number;
  /** `HH:MM:SS` as the database stores it, or null. */
  slotTime: string | null;
  nutrients: JsonObject;
  /** The item that cooked this serving, when this item is a leftover of it. */
  leftoverOf: string | null;
  snapshot: JsonObject;
} & (
  | { kind: "recipe"; recipeId: string | null; servings: number }
  | { kind: "food"; foodId: string | null; grams: number; portionId: string | null }
);

/**
 * One day of a plan. `confirmedAt` and `confirmedEntryIds` are both null until the day is confirmed, and
 * then the ids are those of the diary entries confirming it wrote.
 */
export type MealPlanDay = {
  id: string;
  localDate: string;
  target: JsonObject;
  confirmedAt: string | null;
  confirmedEntryIds: string[] | null;
  items: MealPlanItem[];
};

/** A plan as stored: its rules are core's, and its days run in date order. */
export type MealPlan = {
  id: string;
  startDate: string;
  dayCount: number;
  rules: JsonObject;
  source: "assistant" | "app";
  /** Null while the plan is live. A plan is archived, never deleted. */
  archivedAt: string | null;
  createdAt: string;
  days: MealPlanDay[];
};

/**
 * The signed in user's plans that are not archived, with their days and items, the earliest start
 * first. Row level security shows a user their own rows only, so no owner is passed. Days run in date
 * order and items in position order.
 */
export async function listMealPlans(client: SupabaseClient<Database>): Promise<MealPlan[]> {
  const action = "load your meal plans";
  const { data, error } = await client
    .from("meal_plans")
    .select(PLAN_COLUMNS)
    .is("archived_at", null)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw repoError(action, error);
  }

  return data.map((row) => parseRow(planRowSchema, row, action, idOfRow));
}

const itemInputBase = {
  position: z.number().int().min(0),
  slotTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/)
    .nullable(),
  nutrients: jsonObjectSchema,
  snapshot: jsonObjectSchema,
  /**
   * The item that cooked this one, named by its position and by its day when that is another day of the
   * plan (this item's own day when absent). The database gives items their ids, so a new item names the
   * cooking item this way, and the cooking item must already be in the plan.
   */
  leftoverOf: z
    .object({ localDate: z.iso.date().optional(), position: z.number().int().min(0) })
    .optional(),
};

const recipeItemInput = {
  ...itemInputBase,
  kind: z.literal("recipe"),
  recipeId: z.guid(),
  servings: z.number().positive(),
};

const foodItemInput = {
  ...itemInputBase,
  kind: z.literal("food"),
  foodId: z.guid(),
  grams: z.number().positive(),
  portionId: z.guid().nullable(),
};

const dayItemInputSchema = z.discriminatedUnion("kind", [
  z.object(recipeItemInput),
  z.object(foodItemInput),
]);

const planItemInputSchema = z.discriminatedUnion("kind", [
  z.object({ ...recipeItemInput, localDate: z.iso.date() }),
  z.object({ ...foodItemInput, localDate: z.iso.date() }),
]);

/** A planned food or recipe as core built it, for one day of a plan. */
export type MealPlanItemInput = z.input<typeof dayItemInputSchema>;

const saveInputSchema = z
  .object({
    startDate: z.iso.date(),
    source: z.enum(["assistant", "app"]),
    rules: jsonObjectSchema,
    days: z
      .array(z.object({ localDate: z.iso.date(), target: jsonObjectSchema }))
      .min(1)
      .max(7),
    items: z.array(planItemInputSchema),
  })
  .superRefine((input, context) => {
    const dates = new Set(input.days.map(({ localDate }) => localDate));
    input.items.forEach(({ localDate }, index) => {
      if (!dates.has(localDate)) {
        context.addIssue({
          code: "custom",
          path: ["items", index, "localDate"],
          message: "not a day",
        });
      }
    });
  });

/** What `saveMealPlan` takes: the plan, its days and its items, each item with the date of its day. */
export type SaveMealPlanInput = z.input<typeof saveInputSchema>;

type ItemPayload = z.output<typeof dayItemInputSchema>;

/** One item as the functions read it. Only the keys of its kind are sent. */
function itemPayload(item: ItemPayload) {
  const shared = {
    position: item.position,
    slot_time: item.slotTime,
    nutrients: item.nutrients,
    snapshot: item.snapshot,
    ...(item.leftoverOf === undefined
      ? {}
      : {
          leftover_of_position: item.leftoverOf.position,
          ...(item.leftoverOf.localDate === undefined
            ? {}
            : { leftover_of_day: item.leftoverOf.localDate }),
        }),
  };
  return item.kind === "recipe"
    ? { item_type: item.kind, recipe_id: item.recipeId, servings: item.servings, ...shared }
    : {
        item_type: item.kind,
        food_id: item.foodId,
        grams: item.grams,
        portion_id: item.portionId,
        ...shared,
      };
}

/**
 * Writes a plan, its days and its items in one `save_meal_plan` call (ADR 0003, Amendment 22). It is
 * all or nothing, so a failure leaves no plan behind. Resolves to the new plan's id. The input is
 * checked first and nothing is sent when it is wrong, with the paths that failed in the error and never a
 * value. `day_count` is the number of days given.
 */
export async function saveMealPlan(
  client: SupabaseClient<Database>,
  input: SaveMealPlanInput,
): Promise<string> {
  const action = "save your meal plan";
  const plan = parseRow(saveInputSchema, input, action, () => "(new)");

  const { data, error } = await client.rpc("save_meal_plan", {
    p_plan: {
      start_date: plan.startDate,
      day_count: plan.days.length,
      rules: plan.rules,
      source: plan.source,
    },
    p_days: plan.days.map((day) => ({ local_date: day.localDate, target: day.target })),
    p_items: plan.items.map(({ localDate, ...item }) => ({
      local_date: localDate,
      ...itemPayload(item),
    })),
  });

  if (error) {
    throw repoError(action, error);
  }

  return parseRow(z.guid(), data, action, () => "(new)");
}

/**
 * Replaces the items of one day with `items` in one `replace_meal_plan_day` call, all or nothing. The
 * database refuses a day that is confirmed, with the code `22023`.
 */
export async function replaceMealPlanDay(
  client: SupabaseClient<Database>,
  dayId: string,
  items: readonly MealPlanItemInput[],
): Promise<void> {
  const action = "replace this day of your meal plan";
  const checked = parseRow(z.array(dayItemInputSchema), items, action, () => dayId);

  const { error } = await client.rpc("replace_meal_plan_day", {
    p_day_id: dayId,
    p_items: checked.map(itemPayload),
  });

  if (error) {
    throw repoError(action, error);
  }
}

/**
 * Confirms a day: builds the diary entries with core's `buildLogEntry` and `buildRecipeLogEntry` from
 * the foods and recipes as they are now, so every snapshot is fresh, and sends them to
 * `confirm_meal_plan_day`, which writes them and stamps the day in one transaction. Resolves to the new
 * entry ids in the order given. The database refuses a day that is already confirmed, with the code
 * `22023`, and writes nothing then.
 *
 * Throws a `RangeError` before any request for an empty list, or for an entry with a negative or too
 * large amount, a portion unit without a portion, or a time or day that is malformed.
 */
export async function confirmMealPlanDay(
  client: SupabaseClient<Database>,
  dayId: string,
  items: readonly LogEntriesItem[],
): Promise<string[]> {
  const action = "confirm this day";
  if (items.length === 0) {
    throw new RangeError(`Could not ${action}: there is nothing to log`);
  }
  const entries = entriesOfItems(items, action);

  const { data, error } = await client.rpc("confirm_meal_plan_day", {
    p_day_id: dayId,
    p_entries: entries,
  });

  if (error) {
    throw repoError(action, error);
  }
  if (data.length !== entries.length) {
    throw new Error(`Could not ${action}: the database stored a different number of entries`);
  }

  return data;
}

/**
 * Archives a plan by setting `archived_at` to now, which is what the Undo of a plan does. A plan is never
 * deleted. An update that reaches no row (another user's plan, or none) throws rather than reporting a
 * success.
 */
export async function archiveMealPlan(
  client: SupabaseClient<Database>,
  planId: string,
): Promise<void> {
  const action = "remove your meal plan";
  const { data, error } = await client
    .from("meal_plans")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", planId)
    .select("id");

  if (error) {
    throw repoError(action, error);
  }
  if (data.length === 0) {
    throw new Error(`Could not ${action}: no plan was changed`);
  }
}
