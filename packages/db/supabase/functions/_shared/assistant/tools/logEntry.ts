// The assistant's first write: log one thing the person ate. The model picks one of the food's own
// portions and a count, or the grams or millilitres the person said, and the repos build the entry:
// the snapshot, the portion link and the nutrients come from the food as the database holds it, never
// from a number the model sent. The input is one flat shape and not a union, because a strict tool
// schema holds none. `kind` says which fields go with it, and the rest are null.
import { z } from "zod";

import { buildLoggedCard, cardEntryOfRow } from "../../core.ts";
import {
  getFood,
  getMyTimeZone,
  getRecipe,
  listFoodPortions,
  logFood,
  logQuickEntry,
  logRecipe,
  readLogEntryStamps,
  softDeleteLogEntries,
} from "../../repos.ts";
import { entryView, zoneOrUtc } from "./diaryView.ts";
import { invalidInput, leftAsWritten, momentOf, notFound, targetIdsOf } from "./entryWrite.ts";
import { clockTimeSchema, localDateSchema } from "./shared.ts";

import type { LogEntry } from "../../repos.ts";
import type { WriteToolDefinition } from "../tool.ts";

const kinds = ["portion", "grams", "ml", "recipe", "quick"] as const;
type Kind = (typeof kinds)[number];

// The fields each kind takes. Every other amount field must be null, so a mixed-up call is refused
// with the name of the field that does not belong.
const fieldsOf: Record<Kind, readonly string[]> = {
  portion: ["food_id", "portion_id", "count"],
  grams: ["food_id", "grams"],
  ml: ["food_id", "ml"],
  recipe: ["recipe_id", "servings"],
  quick: ["kcal", "protein_g", "carbs_g", "fat_g", "label"],
};
const requiredOf: Record<Kind, readonly string[]> = {
  portion: ["food_id", "portion_id", "count"],
  grams: ["food_id", "grams"],
  ml: ["food_id", "ml"],
  recipe: ["recipe_id", "servings"],
  quick: ["kcal"],
};
const amountFields = [
  "food_id",
  "portion_id",
  "count",
  "grams",
  "ml",
  "recipe_id",
  "servings",
  "kcal",
  "protein_g",
  "carbs_g",
  "fat_g",
  "label",
] as const;

const amount = (max: number) => z.number().positive().max(max).nullable();
const macro = z.number().min(0).max(1000).nullable();

const logEntryInput = z
  .strictObject({
    kind: z
      .enum(kinds)
      .describe(
        "portion: a count of one of the food's own portions. grams or ml: an amount the person said. recipe: servings of one of their recipes. quick: calories the person gave.",
      ),
    food_id: z
      .guid()
      .nullable()
      .describe("The food's id from search_foods or get_food. For portion, grams and ml."),
    portion_id: z.guid().nullable().describe("The id of one of that food's portions. For portion."),
    count: amount(50).describe(
      "How many of the portion, such as 2 for two large eggs. For portion.",
    ),
    grams: amount(5000).describe("Grams the person said. For grams."),
    ml: amount(5000).describe("Millilitres the person said. For ml."),
    recipe_id: z.guid().nullable().describe("The recipe's id from get_recipes. For recipe."),
    servings: amount(50).describe("How many servings of the recipe. For recipe."),
    kcal: z.number().min(0).max(10000).nullable().describe("Calories the person gave. For quick."),
    protein_g: macro.describe("Grams of protein the person gave, or null. For quick."),
    carbs_g: macro.describe("Grams of carbohydrate the person gave, or null. For quick."),
    fat_g: macro.describe("Grams of fat the person gave, or null. For quick."),
    label: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .nullable()
      .describe("A short name for the quick add, or null. For quick."),
    local_date: localDateSchema
      .nullable()
      .describe("The day, only when the person named another day than today. Otherwise null."),
    time: clockTimeSchema
      .nullable()
      .describe("The clock time, only when the person named one. Otherwise null."),
  })
  .superRefine((input, context) => {
    const allowed = new Set(fieldsOf[input.kind]);
    for (const field of amountFields) {
      const given = input[field] !== null;
      const missing = requiredOf[input.kind].includes(field) && !given;
      if ((given && !allowed.has(field)) || missing) {
        context.addIssue({ code: "custom", path: [field], message: "Wrong field for this kind" });
      }
    }
  });

type LogEntryInput = z.infer<typeof logEntryInput>;

type Written = { entry: LogEntry } | { invalid: string[] } | { missing: true };

async function write(
  ctx: Parameters<WriteToolDefinition<LogEntryInput>["run"]>[0],
  input: LogEntryInput,
  moment: { loggedAt: Date; localDate: string },
): Promise<Written> {
  const timing = { loggedAt: moment.loggedAt.toISOString(), localDate: moment.localDate };
  switch (input.kind) {
    case "quick":
      return {
        entry: await logQuickEntry(ctx.caller, {
          kcal: input.kcal ?? 0,
          ...(input.protein_g === null ? {} : { protein_g: input.protein_g }),
          ...(input.carbs_g === null ? {} : { carbs_g: input.carbs_g }),
          ...(input.fat_g === null ? {} : { fat_g: input.fat_g }),
          ...(input.label === null ? {} : { label: input.label }),
          ...timing,
        }),
      };
    case "recipe": {
      const recipe = input.recipe_id === null ? null : await getRecipe(ctx.caller, input.recipe_id);
      if (recipe === null || recipe.is_archived) {
        return { missing: true };
      }
      return {
        entry: await logRecipe(ctx.caller, {
          recipe,
          quantity: input.servings ?? 0,
          unit: "serving",
          ...timing,
        }),
      };
    }
    default: {
      const food = input.food_id === null ? null : await getFood(ctx.caller, input.food_id);
      // The repo returns a deleted food, because an old entry must keep resolving it. A deleted food is
      // not something to log, whether or not the model looked it up first.
      if (food === null || food.deleted_at !== null) {
        return { missing: true };
      }
      const portions = await listFoodPortions(ctx.caller, food.id);
      const portion = portions.find(({ id }) => id === input.portion_id);
      if (input.kind === "portion" && portion === undefined) {
        return { invalid: ["portion_id"] };
      }
      const quantity = input.count ?? input.grams ?? input.ml ?? 0;
      return {
        entry: await logFood(ctx.caller, {
          food,
          quantity,
          unit: input.kind === "portion" ? "portion" : input.kind === "grams" ? "g" : "ml",
          ...(portion === undefined ? {} : { portion }),
          foodPortions: portions,
          ...timing,
        }),
      };
    }
  }
}

export const logEntryTool: WriteToolDefinition<LogEntryInput> = {
  name: "log_entry",
  description:
    "Logs one thing the user ate to their diary and shows them a card with Undo. Call it once for each food. " +
    "Pick the food or recipe from search_foods, get_food or get_recipes, never an id you have not seen. " +
    "For a food, use kind portion with one of that food's own portion ids and a count, such as 2 of the " +
    "large egg portion. Use kind grams or ml only for an amount the user said, such as 150 g of rice or " +
    "200 ml of milk, and never as a guess for a portion. If no portion fits and the user gave no amount, " +
    "ask them with ask_user instead of guessing. Do not describe an amount in hand measures. Use kind " +
    "recipe for servings of one of their recipes, and kind quick only when the user gave the calories " +
    "themselves. Set every field that does not belong to the kind to null. Leave local_date and time null " +
    "unless the user named another day or time: they then default to the day and time of this message. " +
    "The card and the numbers come from the saved entry, not from anything you send.",
  kind: "write",
  // Fourteen nullable fields would use most of the 16 union parameters a request may hold across its
  // strict tools, so this tool opts out. The executor checks every input with the same schema.
  strict: false,
  input: logEntryInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "food_log_entries",
  async run(ctx, input) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const moment = momentOf(ctx, input, timeZone);
    let written: Written;
    try {
      written = await write(ctx, input, moment);
    } catch (caught) {
      // A RangeError from the builders is a call the entry cannot be built from. It quotes no value.
      if (caught instanceof RangeError) {
        return invalidInput([input.kind]);
      }
      throw caught;
    }
    if ("missing" in written) {
      return notFound;
    }
    if ("invalid" in written) {
      return invalidInput(written.invalid);
    }
    // The write has landed. Nothing below may throw, or the model would log the food a second time.
    const { entry } = written;
    let targetUpdatedAt: string | undefined;
    try {
      const [stamp] = await readLogEntryStamps(ctx.caller, [entry.id]);
      targetUpdatedAt = stamp?.updatedAt;
    } catch (caught) {
      ctx.reportError("assistant tool log_entry", "internal_error", caught);
    }
    const cardEntry = cardEntryOfRow(entry, timeZone);
    // Without the stamp Undo would refuse, so the card does not offer it.
    const card =
      cardEntry === null
        ? null
        : targetUpdatedAt === undefined
          ? { ...buildLoggedCard([cardEntry]), undo: "unavailable" as const, undoneSub: null }
          : buildLoggedCard([cardEntry]);
    return {
      data: { logged: entryView(entry, timeZone) },
      ...(card === null ? {} : { structured: { card } }),
      target: {
        targetId: entry.id,
        ...(targetUpdatedAt === undefined ? {} : { targetUpdatedAt }),
      },
    };
  },
  // Removes what the call logged, unless the person has changed it since.
  async inverse(ctx, action) {
    const ids = targetIdsOf(action);
    const states = await readLogEntryStamps(ctx.caller, ids);
    const stamp = action.targetUpdatedAt;
    if (stamp === null || !leftAsWritten(states, action, { count: ids.length, deleted: false })) {
      return "unavailable";
    }
    // Deleted only while the stamp is still the recorded one, so an edit made after the read above is
    // not deleted over.
    const removed = await softDeleteLogEntries(ctx.caller, ids, {
      onlyIfUpdatedAt: stamp,
    });
    return removed.length === ids.length ? "undone" : "unavailable";
  },
};
