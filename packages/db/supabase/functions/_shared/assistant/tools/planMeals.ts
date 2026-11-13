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
  buildPalateProfile,
  buildPlanCreatedCard,
  buildPlanPool,
  planDatesOf,
  planMeals,
  planRankingSchema,
  planSaveInput,
  planTargetOf,
  rankedIdsOfReply,
  resolveRepeatLimit,
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
  saveMealPlan,
} from "../../repos.ts";
import { PLAN_SYSTEM_PROMPT, planPromptContent } from "../planPrompt.ts";
import { targetsOfDay } from "./diaryView.ts";
import { invalidInput } from "./entryWrite.ts";
import { localDateSchema } from "./shared.ts";

import type { Food, PalateRecipe, Plan } from "../../core.ts";
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
    .describe("Carbs or fat, only if the user named them as a goal. Else an empty list."),
  request: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .describe("The user's wishes in their own words, such as what they like. Else null."),
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

export const planMealsTool: WriteToolDefinition<PlanMealsInput> = {
  name: "plan_meals",
  description:
    "Plans the user's meals for up to 7 days from their own recipes and usual foods, to their calorie and " +
    "protein targets, and saves it with a card and Undo. Pass only their words. The tool works out every " +
    "amount. Say which days are short and that nothing was saved if planned is false.",
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
    const dates = planDatesOf(startDate, input.days);

    const [targets, profileLimit, kitchen] = await Promise.all([
      getMyTargets(ctx.caller),
      getMealPlanRepeatLimit(ctx.caller),
      readKitchen(ctx),
    ]);
    const days = dates.flatMap((localDate) => {
      const target = planTargetOf(targetsOfDay(targets, localDate), input.named_macros);
      return target === null ? [] : [{ localDate, target }];
    });
    if (days.length !== dates.length) {
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
    const plan = planMeals({
      recipes: pool.recipes,
      foods: pool.foods,
      ranking: ranked.value,
      rules,
      days,
    });
    if (plan.days.every(({ items }) => items.length === 0)) {
      return refusal("nothing_to_plan_from");
    }

    const foodsById = new Map<string, Food>(kitchen.foods.map((food) => [food.id, food]));
    const recipesById = new Map(kitchen.recipes.map((recipe) => [recipe.id, recipe]));
    const card = buildPlanCreatedCard({
      plan,
      repeatLimit: limit,
      recipeNames: new Map(kitchen.recipes.map(({ id, name }) => [id, name])),
      foodNames: new Map(kitchen.foods.map(({ id, name }) => [id, name])),
      recipeServingGrams: new Map(
        kitchen.recipes.flatMap(({ id, servings, computed }) =>
          computed.effectiveGrams > 0 && servings > 0
            ? [[id, computed.effectiveGrams / servings]]
            : [],
        ),
      ),
    });
    const saved = planSaveInput({
      plan,
      rules: { ...rules, ranking: ranked.value },
      foods: foodsById,
      recipes: recipesById,
    });

    // The write is last. Everything the answer holds is built already, so nothing after it can throw.
    const planId = await saveMealPlan(ctx.caller, saved);
    return {
      data: {
        planned: true,
        repeat_limit: { max_repeats: limit.maxRepeats, chosen_by: limit.source },
        days: plan.days.map(caloriesAndProtein),
      },
      structured: { card },
      target: { targetId: planId },
    };
  },
  // Archives the plan, unless it is archived already or a day of it was confirmed into the diary, which then
  // holds entries the plan wrote.
  async inverse(ctx, action) {
    const { targetId } = action;
    if (targetId === null) {
      return "unavailable";
    }
    const plan = (await listMealPlans(ctx.caller)).find(({ id }) => id === targetId);
    if (plan === undefined || plan.days.some(({ confirmedAt }) => confirmedAt !== null)) {
      return "unavailable";
    }
    await archiveMealPlan(ctx.caller, targetId);
    return "undone";
  },
};
