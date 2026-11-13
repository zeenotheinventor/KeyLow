// Plans one day of the person's existing plan again, and leaves every other day as it is (ADR 0006, Amendment 6).
// With no new words the plan's stored ranking is reused and there is no Opus call. With new words one Opus call
// ranks what is offered, by short code, and never places an amount, as `plan_meals` does. Core's planner then
// chooses every quantity, and the card is built from core's sums before anything is written, so nothing that can
// fail runs after the write. The day is replaced in one database call under the person's own JWT, which refuses a
// confirmed day. Replacing a cook's day clears the link on the leftovers of other days, so core also returns those
// days to be written again with the link restored. Undo puts the day and those days back as they were, unless the
// day changed or was confirmed since. Nothing here logs or reports a food, a recipe, a plan or a reason.
import { z } from "zod";

import {
  REPLAN_NOT_CHANGED_WORDS,
  REPLAN_RESULT_NOTES,
  buildPlanDayReplannedCard,
  dayToReplan,
  planRankingSchema,
  rankedIdsOfReply,
  relinkedDaysToRestore,
  replanStoredDay,
  replanUndoState,
  resolveRepeatLimit,
} from "../../core.ts";
import { getMealPlanRepeatLimit, listMealPlans, replaceMealPlanDay } from "../../repos.ts";
import { PLAN_SYSTEM_PROMPT, planPromptContent } from "../planPrompt.ts";
import { caloriesAndProtein, livePlansOf, planPoolOf, readKitchen } from "./planKitchen.ts";
import { localDateSchema } from "./shared.ts";

import type { MealPlanItemInput } from "../../repos.ts";
import type { ToolContext, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const replanDayInput = z.strictObject({
  local_date: localDateSchema.describe("The planned day to replan."),
  request: z
    .string()
    .trim()
    .min(1)
    .max(300)
    .nullable()
    .describe("The user's new wishes for the day, in their words. Null for none."),
});

type ReplanDayInput = z.infer<typeof replanDayInput>;

const refusal = (reason: keyof typeof REPLAN_NOT_CHANGED_WORDS): WriteRunOutput => ({
  data: { replanned: false, reason, message: REPLAN_NOT_CHANGED_WORDS[reason] },
  target: null,
});

const reportQuietly = (ctx: ToolContext, caught: unknown) => {
  try {
    ctx.reportError("assistant tool replan_day", "internal_error", caught);
  } catch {
    // Reporting is a side channel.
  }
};

// `replaceMealPlanDay` checks every item against its own schema before sending anything.
const itemsSchema = z.array(z.custom<MealPlanItemInput>());

const previousSchema = z.object({
  items: itemsSchema,
  relinked: z.array(z.object({ dayId: z.guid(), localDate: z.iso.date(), items: itemsSchema })),
});

export const replanDayTool: WriteToolDefinition<ReplanDayInput> = {
  name: "replan_day",
  description:
    "Plans one day of the user's saved plan again, with a card and Undo. Pass only their words. " +
    "A confirmed day is refused.",
  kind: "write",
  group: "kitchen",
  // The flag is static, so a replan with no new words also takes the turn's one generation slot. That is the
  // safe side: the planner's work is bounded the same way, and it never lets two plans run in one turn.
  generation: true,
  // The kitchen group is outside the strict budget, and zod holds the input to its schema (Amendment 5).
  strict: false,
  input: replanDayInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "meal_plan_days",
  async run(ctx, input) {
    const [stored, profileLimit] = await Promise.all([
      listMealPlans(ctx.caller),
      getMealPlanRepeatLimit(ctx.caller),
    ]);
    const target = dayToReplan(livePlansOf(stored), input.local_date);
    const plan =
      target.status === "found" ? stored.find(({ id }) => id === target.planId) : undefined;
    if (target.status !== "found" || plan === undefined) {
      return refusal(target.status === "confirmed" ? "day_confirmed" : "day_not_planned");
    }

    const kitchen = await readKitchen(ctx);
    const pool = planPoolOf(kitchen);
    if (pool.offers.length === 0) {
      return refusal("nothing_to_plan_from");
    }

    let ranking: string[] | null = null;
    if (input.request !== null) {
      const generation = ctx.generation;
      if (generation === undefined) {
        throw new Error("The generation call is not configured");
      }
      const ranked = await generation.generate({
        route: "plan_generate",
        userId: ctx.userId,
        turnId: ctx.turn.id,
        system: PLAN_SYSTEM_PROMPT,
        userContent: planPromptContent({
          offers: pool.offers,
          dayCount: 1,
          wishes: input.request,
        }),
        format: planRankingSchema,
        read: (reply) => rankedIdsOfReply(reply, pool.offers),
      });
      if (!ranked.ok) {
        return refusal(ranked.code);
      }
      ranking = ranked.value;
    }

    const replanned = replanStoredDay({
      plan,
      dayId: target.dayId,
      recipes: pool.recipes,
      foods: pool.foods,
      maxRepeats: resolveRepeatLimit(null, profileLimit).maxRepeats,
      ranking,
      foodRows: new Map(kitchen.foods.map((food) => [food.id, food])),
      recipeRows: new Map(kitchen.recipes.map((recipe) => [recipe.id, recipe])),
    });
    if (replanned.status === "unreadable_day") {
      return refusal("day_unreadable");
    }
    if (replanned.status === "no_items") {
      return refusal("nothing_to_plan_from");
    }

    const card = buildPlanDayReplannedCard({
      day: replanned.day,
      kept: replanned.kept,
      recipeNames: new Map(kitchen.recipes.map(({ id, name }) => [id, name])),
      foodNames: new Map(kitchen.foods.map(({ id, name }) => [id, name])),
    });

    // The day is written first. Everything below it is caught, so the write that landed is never undone by a
    // throw, which the model would retry.
    await replaceMealPlanDay(ctx.caller, target.dayId, replanned.items);
    let failures = 0;
    for (const day of replanned.relinks) {
      try {
        await replaceMealPlanDay(ctx.caller, day.dayId, day.items);
      } catch (caught) {
        failures += 1;
        reportQuietly(ctx, caught);
      }
    }
    const notes = [
      ...(replanned.kept.length > 0 ? [REPLAN_RESULT_NOTES.kept_cook] : []),
      ...(failures + replanned.skippedRelinks > 0 ? [REPLAN_RESULT_NOTES.relink_failed] : []),
    ];
    return {
      data: {
        replanned: true,
        day: caloriesAndProtein(replanned.day),
        ...(replanned.wishesKept ? {} : { wishes_not_fully_kept: true }),
        ...(notes.length === 0 ? {} : { notes }),
      },
      structured: {
        card,
        undo: { previous: replanned.previous, fingerprint: replanned.fingerprint },
      },
      target: { targetId: target.dayId },
    };
  },
  // Puts the day back as it was, and the days that were rewritten only to keep a leftover link. Unavailable when
  // the day is gone, was confirmed, or holds anything but what the replan left, because Undo never writes over a
  // change. A relinked day that changed or was confirmed since is left alone and the rest carries on.
  async inverse(ctx, action) {
    const stored = await ctx.previousValueOf(action);
    const previous = previousSchema.safeParse(stored?.previous);
    const { targetId } = action;
    if (
      targetId === null ||
      stored === null ||
      typeof stored.fingerprint !== "string" ||
      !previous.success
    ) {
      return "unavailable";
    }
    const days = (await listMealPlans(ctx.caller)).flatMap(({ days: planDays }) =>
      planDays.map(({ id, confirmedAt, items }) => ({
        id,
        isConfirmed: confirmedAt !== null,
        items,
      })),
    );
    const state = replanUndoState(
      days.find(({ id }) => id === targetId),
      stored.fingerprint,
    );
    if (state === "changed") {
      return { status: "unavailable", reason: "changed" };
    }
    if (state !== "ready") {
      return "unavailable";
    }
    await replaceMealPlanDay(ctx.caller, targetId, previous.data.items);
    for (const day of relinkedDaysToRestore(previous.data.relinked, days)) {
      try {
        await replaceMealPlanDay(ctx.caller, day.dayId, day.items);
      } catch (caught) {
        reportQuietly(ctx, caught);
      }
    }
    return "undone";
  },
};
