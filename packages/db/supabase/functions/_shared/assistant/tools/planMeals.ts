// Plans the person's meals for up to seven days from their own recipes and usual foods (ADR 0006, Amendment 6).
// One Opus call ranks what is offered, by short code, and never places an amount. Core's planner then chooses
// every quantity and checks every figure, so nothing on the card or in the answer is a model's number. The plan
// is saved in one database call under the person's own JWT with the ranking, which `replan_day` reuses, and the
// card is built before the write, so nothing that can fail runs after it. Undo archives the plan, as the
// recipe list does for a recipe. It asks nothing first, as `create_routine` does, because nothing is lost.
// Nothing here logs or reports a food, a recipe, a plan or a reason.
import { z } from "zod";

import {
  PLAN_NOT_SAVED_WORDS,
  PLAN_RESULT_NOTES,
  buildPalateProfile,
  buildPlanCreatedCard,
  buildPlanPool,
  daysToClear,
  daysToRestore,
  isPlanUndoable,
  planDatesAround,
  planDatesOf,
  planDaysOf,
  planHasNoItems,
  planRankingSchema,
  planSaveInput,
  planWeek,
  plansToArchive,
  rankedIdsOfReply,
  resolveRepeatLimit,
  restorableItemsOfDay,
  roundCalories,
  roundGrams,
} from "../../core.ts";
import {
  archiveMealPlan,
  getFood,
  getMealPlanRepeatLimit,
  getMyTargets,
  getPalateLoggedDays,
  listMealPlans,
  listPalateFoods,
  listPalatePreferences,
  listPalateStats,
  listRecipes,
  replaceMealPlanDay,
  restoreMealPlan,
  saveMealPlan,
} from "../../repos.ts";
import { PLAN_SYSTEM_PROMPT, planPromptContent } from "../planPrompt.ts";
import { targetsOfDay } from "./diaryView.ts";
import { invalidInput } from "./entryWrite.ts";
import { localDateSchema } from "./shared.ts";

import type { Food, LivePlan, PalateRecipe, Plan } from "../../core.ts";
import type { MealPlanItemInput } from "../../repos.ts";
import type { ToolContext, WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const planMealsInput = z.strictObject({
  start_date: localDateSchema.nullable().describe("The first day. Null for today."),
  days: z
    .number()
    .int()
    .min(1)
    .max(7)
    .nullable()
    .describe("How many days, 1 to 7. Null for until Sunday."),
  max_repeats: z
    .number()
    .int()
    .min(0)
    .max(7)
    .nullable()
    .describe(
      "Most times a recipe may repeat in a week, 0 for no limit. Only if the user said. Else null.",
    ),
  named_macros: z
    .array(z.enum(["carbs_g", "fat_g"]))
    .max(2)
    .describe("Carbs or fat, only if the user named them as a goal."),
  request: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .describe("The user's wishes in their own words, such as what they like."),
});

type PlanMealsInput = z.infer<typeof planMealsInput>;

const refusal = (reason: keyof typeof PLAN_NOT_SAVED_WORDS): WriteRunOutput => ({
  data: { planned: false, reason, message: PLAN_NOT_SAVED_WORDS[reason] },
  target: null,
});

// What the person's diary and recipes offer to plan from, read under their JWT.
async function readKitchen(ctx: ToolContext) {
  const [stats, loggedDays, preferences, recipes] = await Promise.all([
    listPalateStats(ctx.caller),
    getPalateLoggedDays(ctx.caller),
    listPalatePreferences(ctx.caller),
    listRecipes(ctx.caller),
  ]);
  const foodIds = [...new Set(stats.flatMap(({ foodId }) => (foodId === null ? [] : [foodId])))];
  const palateFoods = await listPalateFoods(ctx.caller, foodIds);
  const palateRecipes = recipes.map((recipe): PalateRecipe => ({
    id: recipe.id,
    name: recipe.name,
    servingGrams:
      recipe.yield_grams === null || recipe.servings <= 0
        ? null
        : recipe.yield_grams / recipe.servings,
  }));
  const profile = buildPalateProfile(stats, preferences, {
    today: ctx.turn.localDate,
    loggedDays,
    foods: palateFoods,
    recipes: palateRecipes,
  });
  const usualFoods = await Promise.all(
    profile.usualFoods.map(async ({ foodId, typicalGrams }) => ({
      foodId,
      typicalGrams,
      food: await getFood(ctx.caller, foodId),
    })),
  );
  const foods = usualFoods.flatMap(({ food }) => (food === null ? [] : [food]));
  return { stats, preferences, recipes, profile, usualFoods, foods };
}

const caloriesAndProtein = (day: Plan["days"][number]) => ({
  local_date: day.localDate,
  status: day.status,
  kcal: day.totals.kcal === null ? null : roundCalories(day.totals.kcal),
  protein_g: day.totals.protein_g === null ? null : roundGrams(day.totals.protein_g),
  target_kcal: day.target.kcal ?? null,
  target_protein_g: day.target.protein_g ?? null,
  short_of: day.shortfalls.map(({ nutrient, reason }) => ({
    nutrient,
    // A work limit means the planner stopped before it knew the day was out of reach.
    not_fully_worked_out: reason === "work_limit",
  })),
});

// The live plans as core picks days from them, and as the cleanup reads what to put back.
const livePlansOf = (plans: Awaited<ReturnType<typeof listMealPlans>>): LivePlan[] =>
  plans.map(({ id, days }) => ({
    id,
    days: days.map((day) => ({
      id: day.id,
      localDate: day.localDate,
      isConfirmed: day.confirmedAt !== null,
      itemCount: day.items.length,
    })),
  }));

// What Undo needs to put the older plans back: the cleared days with their items, and the plans archived.
type ClearedDay = { dayId: string; localDate: string; items: MealPlanItemInput[] };
type PreviousPlans = { days: ClearedDay[]; archivedPlanIds: string[] };

// One older plan's day is cleared with `replaceMealPlanDay(dayId, [])`. Clearing a cook day nulls `leftover_of` on
// later leftovers outside the new plan, which the database does when a cooking item goes, and is accepted.
// Nothing here throws: the new plan is saved already, so a failure is reported and counted and the rest carries on.
async function clearOlderPlans(
  ctx: ToolContext,
  stored: Awaited<ReturnType<typeof listMealPlans>>,
  live: readonly LivePlan[],
  dates: readonly string[],
): Promise<{ previous: PreviousPlans; failures: number }> {
  const previous: PreviousPlans = { days: [], archivedPlanIds: [] };
  let failures = 0;
  const reportFailure = (caught: unknown) => {
    failures += 1;
    try {
      ctx.reportError("assistant tool plan_meals", "internal_error", caught);
    } catch {
      // Reporting is a side channel.
    }
  };
  const cleared = new Set<string>();
  for (const { planId, dayId, localDate } of daysToClear(live, dates)) {
    const plan = stored.find(({ id }) => id === planId);
    try {
      const items = plan === undefined ? [] : restorableItemsOfDay(plan, dayId);
      await replaceMealPlanDay(ctx.caller, dayId, []);
      cleared.add(dayId);
      previous.days.push({ dayId, localDate, items });
    } catch (caught) {
      reportFailure(caught);
    }
  }
  for (const planId of plansToArchive(live, cleared)) {
    try {
      await archiveMealPlan(ctx.caller, planId);
      previous.archivedPlanIds.push(planId);
    } catch (caught) {
      reportFailure(caught);
    }
  }
  return { previous, failures };
}

const previousPlansSchema = z.object({
  days: z.array(
    z.object({
      dayId: z.guid(),
      localDate: z.iso.date(),
      // `replaceMealPlanDay` checks every item against its own schema before sending anything.
      items: z.array(z.custom<MealPlanItemInput>()),
    }),
  ),
  archivedPlanIds: z.array(z.guid()),
});

export const planMealsTool: WriteToolDefinition<PlanMealsInput> = {
  name: "plan_meals",
  description:
    "Plans the user's meals for up to 7 days from their own recipes and usual foods, to their calorie and " +
    "protein targets, and saves it with a card and Undo. Pass only their words. The tool works out every " +
    "amount.",
  kind: "write",
  group: "kitchen",
  generation: true,
  // The kitchen group is outside the strict budget, and zod holds the input to its schema (Amendment 5).
  strict: false,
  input: planMealsInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "meal_plans",
  async run(ctx, input) {
    const generation = ctx.generation;
    if (generation === undefined) {
      throw new Error("The generation call is not configured");
    }
    const startDate = input.start_date ?? ctx.turn.localDate;
    if (startDate < ctx.turn.localDate) {
      return invalidInput(["start_date"]);
    }

    const [targets, profileLimit, kitchen, stored] = await Promise.all([
      getMyTargets(ctx.caller),
      getMealPlanRepeatLimit(ctx.caller),
      readKitchen(ctx),
      listMealPlans(ctx.caller),
    ]);
    // A date that is confirmed in any live plan is never planned again.
    const live = livePlansOf(stored);
    const { dates, leftOut } = planDatesAround(planDatesOf(startDate, input.days), live);
    if (dates.length === 0) {
      return refusal("all_days_confirmed");
    }
    const days = planDaysOf(
      dates,
      (localDate) => targetsOfDay(targets, localDate),
      input.named_macros,
    );
    if (days === null) {
      return refusal("no_calorie_target");
    }

    const pool = buildPlanPool({
      recipes: kitchen.recipes,
      usualRecipeIds: kitchen.profile.usualRecipes.map(({ recipeId }) => recipeId),
      usualFoods: kitchen.usualFoods,
      foods: kitchen.foods,
      stats: kitchen.stats,
      preferences: kitchen.preferences,
    });
    if (pool.offers.length === 0) {
      return refusal("nothing_to_plan_from");
    }

    const ranked = await generation.generate({
      route: "plan_generate",
      userId: ctx.userId,
      turnId: ctx.turn.id,
      system: PLAN_SYSTEM_PROMPT,
      userContent: planPromptContent({
        offers: pool.offers,
        dayCount: days.length,
        wishes: input.request,
      }),
      format: planRankingSchema,
      read: (reply) => rankedIdsOfReply(reply, pool.offers),
    });
    if (!ranked.ok) {
      return refusal(ranked.code);
    }

    const limit = resolveRepeatLimit(input.max_repeats, profileLimit);
    const rules = {
      maxRepeats: limit.maxRepeats,
      leftovers: true,
      slots: ["morning", "midday", "evening"] as const,
    };
    const { plan, wishesKept } = planWeek({
      recipes: pool.recipes,
      foods: pool.foods,
      ranking: ranked.value,
      rules,
      days,
      hasWishes: input.request !== null,
    });
    if (planHasNoItems(plan)) {
      return refusal("nothing_to_plan_from");
    }

    const foodsById = new Map<string, Food>(kitchen.foods.map((food) => [food.id, food]));
    const recipesById = new Map(kitchen.recipes.map((recipe) => [recipe.id, recipe]));
    const card = buildPlanCreatedCard({
      plan,
      repeatLimit: limit,
      recipes: new Map(
        kitchen.recipes.map(({ id, name, servings, computed }) => [
          id,
          { name, servings, effectiveGrams: computed.effectiveGrams },
        ]),
      ),
      foodNames: new Map(kitchen.foods.map(({ id, name }) => [id, name])),
    });
    const saved = planSaveInput({
      plan,
      rules: { ...rules, ranking: ranked.value },
      foods: foodsById,
      recipes: recipesById,
    });

    // The new plan is saved first. Everything below it is caught, so the write that landed is never undone by a
    // throw, which the model would retry.
    const planId = await saveMealPlan(ctx.caller, saved);
    const cleanup = await clearOlderPlans(ctx, stored, live, dates);
    const notes = [
      ...(leftOut.length > 0 ? [PLAN_RESULT_NOTES.left_out_confirmed] : []),
      ...(cleanup.failures > 0 ? [PLAN_RESULT_NOTES.cleanup_failed] : []),
    ];
    return {
      data: {
        planned: true,
        repeat_limit: { max_repeats: limit.maxRepeats, chosen_by: limit.source },
        days: plan.days.map(caloriesAndProtein),
        ...(wishesKept ? {} : { wishes_not_fully_kept: true }),
        ...(notes.length === 0 ? {} : { notes }),
      },
      structured: {
        card,
        undo: { previous: cleanup.previous, fingerprint: planId },
      },
      target: { targetId: planId },
    };
  },
  // Archives the plan and puts back the older plans' days that it cleared, unless the plan is gone or a day of it
  // was confirmed into the diary, which then holds entries the plan wrote. A day that cannot be put back is
  // reported and left, and the rest carries on.
  async inverse(ctx, action) {
    const { targetId } = action;
    if (targetId === null) {
      return "unavailable";
    }
    const stored = await listMealPlans(ctx.caller);
    const found = stored.find(({ id }) => id === targetId);
    const live = livePlansOf(stored);
    if (!isPlanUndoable(live.find(({ id }) => id === targetId))) {
      return "unavailable";
    }
    await archiveMealPlan(ctx.caller, targetId);

    const previous = previousPlansSchema.safeParse((await ctx.previousValueOf(action))?.previous);
    if (!previous.success || found === undefined) {
      return "undone";
    }
    // A day is not put back when a later plan owns its date or it has items again. Undo has no channel for notes,
    // so each skipped day and each failed day is reported with fixed words and no data, and the rest carries on.
    const { restore, skipped } = daysToRestore(previous.data.days, live, targetId);
    skipped.forEach(() =>
      ctx.reportError(
        "assistant tool plan_meals",
        "internal_error",
        new Error("a cleared day was not put back"),
      ),
    );
    const restoring = new Set(restore.map(({ dayId }) => dayId));
    for (const day of previous.data.days
      .filter(({ dayId }) => restoring.has(dayId))
      .sort((a, b) => a.localDate.localeCompare(b.localDate))) {
      try {
        await replaceMealPlanDay(ctx.caller, day.dayId, day.items);
      } catch (caught) {
        ctx.reportError("assistant tool plan_meals", "internal_error", caught);
      }
    }
    for (const planId of previous.data.archivedPlanIds) {
      try {
        await restoreMealPlan(ctx.caller, planId);
      } catch (caught) {
        ctx.reportError("assistant tool plan_meals", "internal_error", caught);
      }
    }
    return "undone";
  },
};
