import { MEAL_PLAN_BAND_TIMES } from "./constants";
import { scaleNutrients, sumNutrients } from "../nutrition/scale";
import { FIT_NUTRIENTS, fitRecipeToTargets, outOfTolerance, toleranceOf } from "../recipes/fit";

import type { FoodChoice, PreparedPool, RecipeChoice } from "./preparePool";
import type { PlanBand, PlanDay, PlanDayInput, PlanItem, PlanShortfall } from "./types";
import type {
  FitIngredient,
  FitInput,
  FitMiss,
  FitNutrient,
  FitResult,
  FitTolerance,
} from "../recipes/fit";
import type { NullableNutrients } from "../schemas/nutrients";

export type RecipePlanItem = Extract<PlanItem, { kind: "recipe" }>;

export type DayContext = {
  day: PlanDayInput;
  pool: PreparedPool;
  /** How many times each recipe appears on the other days of the plan, leftovers included. */
  appearances: ReadonlyMap<string, number>;
  /** How many times each food is on the other days of the plan. */
  foodUse: ReadonlyMap<string, number>;
  /** Recipe items already on this day: leftovers due today, and cooks that other days eat from. */
  fixed: readonly RecipePlanItem[];
  /** The fits this day may still run: its fair share of the plan's `PLAN_FIT_BUDGET`. */
  budget: { remaining: number };
  /** How many following days have this band free for a leftover. */
  leftoverRoom: (band: PlanBand) => number;
};

/** A recipe cooked on this day for `batch` servings, this day's meal and then `batch - 1` leftovers. */
export type Cook = { key: string; recipeId: string; band: PlanBand; batch: number };

export type DayOutcome = { day: PlanDay; cooks: Cook[] };

/** `fit` is set by the all foods fit: where its amount starts and the least it may be (0 drops it). */
type FoodPick = {
  food: FoodChoice;
  band: PlanBand;
  fit?: { startGrams: number; minGrams: number };
};
type CookPick = { recipe: RecipeChoice; band: PlanBand; batch: number };
type Selection = { cooks: CookPick[]; foods: FoodPick[] };

type Evaluation = {
  selection: Selection;
  day: PlanDay;
  /** 0 when the day is within. Otherwise how far out it is, relative to its targets. */
  distance: number;
};

/** A day never holds more foods than this, so a day that cannot be met stops growing. */
export const MAX_FOODS_PER_DAY = 9;
/**
 * Pure tuning knob: a day is grown until its foods at their usual amounts reach this share of its calories.
 * Any value from about 0.7 to 1 plans well, because the retries and the subset search correct the start.
 * Pinned by a literal test only so a change is deliberate.
 */
export const GROWTH_SHARE = 0.9;
/** Retries of one day after its first try. 10 is more than the 9 foods a day can gain, so growth never starves. */
export const MAX_ATTEMPTS = 10;
/** A food already on other days counts as this many places further down the ranking. */
export const FOOD_REUSE_PENALTY = 2;
/** Pure tuning knob: stands in for a missing figure when comparing how far out two attempts are. Larger than any real distance. */
export const UNKNOWN_DISTANCE = 1000;

/** Pulls the fit toward the calories first: they count for 1 % of the target here, 5 g for protein. */
const CALORIES_FIRST_TOLERANCE: FitTolerance = {
  kcalPercent: 1,
  proteinGrams: 5,
  macroGrams: 5,
};

export const keyOf = (localDate: string, band: PlanBand, id: string): string =>
  `${localDate}/${band}/${id}`;

const bandIndex = (pool: PreparedPool, band: PlanBand): number => pool.slots.indexOf(band);

const foodRank = (ctx: DayContext, food: FoodChoice): number =>
  food.order + FOOD_REUSE_PENALTY * (ctx.foodUse.get(food.id) ?? 0);

const idsOf = (ctx: DayContext, selection: Selection): Set<string> =>
  new Set([
    ...ctx.fixed.map((item) => item.recipeId),
    ...selection.cooks.map(({ recipe }) => recipe.id),
    ...selection.foods.map(({ food }) => food.id),
  ]);

const itemCountIn = (ctx: DayContext, selection: Selection, band: PlanBand): number =>
  ctx.fixed.filter((item) => item.band === band).length +
  selection.cooks.filter((cook) => cook.band === band).length +
  selection.foods.filter((pick) => pick.band === band).length;

const roomForRecipe = (ctx: DayContext, recipe: RecipeChoice): number =>
  ctx.pool.limit - (ctx.appearances.get(recipe.id) ?? 0);

const cookOf = (ctx: DayContext, recipe: RecipeChoice, band: PlanBand): CookPick => {
  const wanted = ctx.pool.leftovers ? Math.floor(recipe.servings) : 1;
  const batch = Math.max(
    1,
    Math.min(wanted, roomForRecipe(ctx, recipe), ctx.leftoverRoom(band) + 1),
  );
  return { recipe, band, batch };
};

/** The band of a food that is least full, the earliest of the day on a tie. */
const bandOfFood = (ctx: DayContext, selection: Selection, food: FoodChoice): PlanBand =>
  [...food.bands].sort(
    (a, b) =>
      itemCountIn(ctx, selection, a) - itemCountIn(ctx, selection, b) ||
      bandIndex(ctx.pool, a) - bandIndex(ctx.pool, b),
  )[0] ??
  food.bands[0] ??
  "morning";

const unusedFoods = (ctx: DayContext, selection: Selection): FoodChoice[] => {
  const used = idsOf(ctx, selection);
  return ctx.pool.foods.filter((food) => !used.has(food.id));
};

const bestFood = (
  ctx: DayContext,
  selection: Selection,
  foods: readonly FoodChoice[],
): FoodChoice | undefined =>
  [...foods].sort((a, b) => foodRank(ctx, a) - foodRank(ctx, b) || a.order - b.order)[0];

const withFood = (ctx: DayContext, selection: Selection, food: FoodChoice): Selection => ({
  ...selection,
  foods: [...selection.foods, { food, band: bandOfFood(ctx, selection, food) }],
});

/** The main of each band that no leftover already holds: the most preferred candidate that can go there. */
const withMains = (ctx: DayContext): Selection => {
  let selection: Selection = { cooks: [], foods: [] };
  for (const band of ctx.pool.slots) {
    if (ctx.fixed.some((item) => item.band === band)) {
      continue;
    }
    const used = idsOf(ctx, selection);
    const recipes = ctx.pool.recipes.filter(
      (recipe) =>
        recipe.bands.includes(band) && !used.has(recipe.id) && roomForRecipe(ctx, recipe) >= 1,
    );
    const foods = ctx.pool.foods.filter((food) => food.bands.includes(band) && !used.has(food.id));
    const recipe = [...recipes].sort((a, b) => a.order - b.order)[0];
    const food = bestFood(ctx, selection, foods);
    if (recipe !== undefined && (food === undefined || recipe.order <= foodRank(ctx, food))) {
      selection = { ...selection, cooks: [...selection.cooks, cookOf(ctx, recipe, band)] };
    } else if (food !== undefined) {
      selection = { ...selection, foods: [...selection.foods, { food, band }] };
    }
  }
  return selection;
};

const typicalKcal = (ctx: DayContext, selection: Selection): number =>
  ctx.fixed.reduce((sum, item) => sum + (item.nutrients.kcal ?? 0), 0) +
  selection.cooks.reduce((sum, { recipe }) => sum + (recipe.perServing.kcal ?? 0), 0) +
  selection.foods.reduce(
    (sum, { food }) => sum + ((food.per100.kcal ?? 0) * food.typicalGrams) / 100,
    0,
  );

/** Adds foods, most preferred first, until the day's usual amounts come close to its calories. */
const grown = (ctx: DayContext, start: Selection): Selection => {
  const wanted = (ctx.day.target.kcal ?? 0) * GROWTH_SHARE;
  let selection = start;
  while (selection.foods.length < MAX_FOODS_PER_DAY && typicalKcal(ctx, selection) < wanted) {
    const food = bestFood(ctx, selection, unusedFoods(ctx, selection));
    if (food === undefined) {
      break;
    }
    selection = withFood(ctx, selection, food);
  }
  return selection;
};

const carrier = (foodId: string, nutrients: NullableNutrients): FitIngredient => ({
  foodId,
  per100: nutrients,
  grams: 100,
  locked: true,
});

const recipeItemOf = (
  localDate: string,
  band: PlanBand,
  recipeId: string,
  nutrients: NullableNutrients,
  leftoverOf: string | null,
): RecipePlanItem => ({
  key: keyOf(localDate, band, recipeId),
  kind: "recipe",
  recipeId,
  servings: 1,
  band,
  time: MEAL_PLAN_BAND_TIMES[band],
  nutrients,
  leftoverOf,
});

/** The leftover of a cooked recipe, as the day it lands on holds it. */
export const leftoverItemOf = (
  localDate: string,
  band: PlanBand,
  recipe: RecipeChoice,
  cookKey: string,
): RecipePlanItem => recipeItemOf(localDate, band, recipe.id, recipe.perServing, cookKey);

const distanceOf = (shortfalls: readonly PlanShortfall[]): number =>
  shortfalls.reduce(
    (sum, { achieved, target }) =>
      sum +
      (achieved === null ? UNKNOWN_DISTANCE : Math.abs(achieved - target) / Math.max(target, 1)),
    0,
  );

/** Double the usual amount, at most 1,000 g, as the fitter's own band. */
const upperBoundOf = (typicalGrams: number): number =>
  Math.max(typicalGrams, Math.min(1000, typicalGrams * 2));

const ingredientsOf = (ctx: DayContext, selection: Selection): FitIngredient[] => {
  const { localDate } = ctx.day;
  return [
    ...ctx.fixed.map((item) => carrier(item.key, item.nutrients)),
    ...selection.cooks.map(({ recipe, band }) =>
      carrier(keyOf(localDate, band, recipe.id), recipe.perServing),
    ),
    ...selection.foods.map(({ food, band, fit }) => ({
      foodId: keyOf(localDate, band, food.id),
      per100: food.per100,
      grams: fit?.startGrams ?? food.typicalGrams,
      locked: false,
      ...(fit === undefined
        ? {}
        : { minGrams: fit.minGrams, maxGrams: upperBoundOf(food.typicalGrams) }),
    })),
  ];
};

/** One fit, counted against the plan's budget. Null when the budget has run out. */
const fitWithinBudget = (ctx: DayContext, input: FitInput): FitResult | null => {
  if (ctx.budget.remaining <= 0) {
    return null;
  }
  ctx.budget.remaining -= 1;
  return fitRecipeToTargets(input);
};

const assemble = (
  ctx: DayContext,
  selection: Selection,
  fitted: FitResult | null,
  unfittedReason: PlanShortfall["reason"] = "no_adjustable_ingredient",
): Evaluation => {
  const { localDate, target } = ctx.day;
  const lockedCount = ctx.fixed.length + selection.cooks.length;

  const items: PlanItem[] = [
    ...ctx.fixed,
    ...selection.cooks.map(({ recipe, band }) =>
      recipeItemOf(localDate, band, recipe.id, recipe.perServing, null),
    ),
    ...selection.foods.map(({ food, band }, at): PlanItem => {
      const grams = fitted?.ingredients[lockedCount + at]?.grams ?? food.typicalGrams;
      return {
        key: keyOf(localDate, band, food.id),
        kind: "food",
        foodId: food.id,
        grams,
        band,
        time: MEAL_PLAN_BAND_TIMES[band],
        nutrients: scaleNutrients(food.per100, grams, "per_100g"),
        leftoverOf: null,
      };
    }),
  ].sort((a, b) => bandIndex(ctx.pool, a.band) - bandIndex(ctx.pool, b.band));

  const totals = sumNutrients(items.map((item) => item.nutrients));
  const misses: readonly FitMiss[] = fitted?.misses ?? [];
  const shortfalls: PlanShortfall[] = outOfTolerance(totals, target).map((shortfall) => ({
    ...shortfall,
    reason:
      misses.find((miss) => miss.nutrient === shortfall.nutrient)?.reason ??
      (fitted === null ? unfittedReason : "targets_conflict"),
  }));

  return {
    selection,
    day: {
      localDate,
      target,
      items,
      totals,
      status: shortfalls.length === 0 ? "within" : "short",
      shortfalls,
    },
    distance: distanceOf(shortfalls),
  };
};

const isCloser = (candidate: Evaluation, than: Evaluation): boolean =>
  candidate.day.shortfalls.length < than.day.shortfalls.length ||
  (candidate.day.shortfalls.length === than.day.shortfalls.length &&
    candidate.distance < than.distance);

/**
 * The foods scaled for the day, judged on core's sum of the items. A day the first fit leaves out is fitted
 * once more with the calories held tight, so a nutrient that cannot be reached costs the least calories
 * possible and the day says "calories within 5 %, protein short" rather than missing both. The closer of the
 * two is kept.
 */
const evaluate = (ctx: DayContext, selection: Selection, isThorough = true): Evaluation => {
  const ingredients = ingredientsOf(ctx, selection);
  if (ingredients.length === 0) {
    return assemble(ctx, selection, null);
  }
  const { target } = ctx.day;
  const fitted = fitWithinBudget(ctx, { ingredients, servings: 1, target });
  if (fitted === null) {
    return assemble(ctx, selection, null, "work_limit");
  }
  const first = assemble(ctx, selection, fitted);
  if (first.day.status === "within" || target.kcal === undefined || !isThorough) {
    return first;
  }
  const second = fitWithinBudget(ctx, {
    ingredients,
    servings: 1,
    target,
    tolerance: CALORIES_FIRST_TOLERANCE,
  });
  if (second === null) {
    return first;
  }
  const calorieFirst = assemble(ctx, selection, second);
  return isCloser(calorieFirst, first) ? calorieFirst : first;
};

const proteinDensity = (food: FoodChoice): number =>
  (food.per100.protein_g ?? 0) / (food.per100.kcal || 1);

const sumOfLargest = (gains: readonly number[], count: number): number =>
  [...gains]
    .sort((a, b) => b - a)
    .slice(0, count)
    .reduce((sum, gain) => sum + gain, 0);

/**
 * True when a named target cannot be met by any day, so no retry or wider fit is worth its fits. For each named
 * nutrient the most the day can hold is the fixed recipes, plus the largest few recipes the free bands could
 * cook, plus the largest `MAX_FOODS_PER_DAY` foods at their upper bound. The least it can hold is the fixed
 * recipes alone. A target above the most or below the least, by more than its tolerance, is out of reach.
 * A missing figure counts as 0, which can only lower the most, never raise it.
 */
const isOutOfReach = (ctx: DayContext): boolean => {
  const fixedIds = new Set(ctx.fixed.map((item) => item.recipeId));
  const freeBands = ctx.pool.slots.filter((band) => !ctx.fixed.some((item) => item.band === band));
  const recipes = ctx.pool.recipes.filter(
    (recipe) => !fixedIds.has(recipe.id) && roomForRecipe(ctx, recipe) >= 1,
  );
  const foods = ctx.pool.foods.filter((food) => !fixedIds.has(food.id));
  return FIT_NUTRIENTS.some((nutrient: FitNutrient) => {
    const wanted = ctx.day.target[nutrient];
    if (wanted === undefined) {
      return false;
    }
    const fixed = ctx.fixed.reduce((sum, item) => sum + (item.nutrients[nutrient] ?? 0), 0);
    const most =
      fixed +
      sumOfLargest(
        recipes.map((recipe) => recipe.perServing[nutrient] ?? 0),
        freeBands.length,
      ) +
      sumOfLargest(
        foods.map((food) => ((food.per100[nutrient] ?? 0) * upperBoundOf(food.typicalGrams)) / 100),
        MAX_FOODS_PER_DAY,
      );
    const slack = toleranceOf(nutrient, wanted) + 1e-6;
    return most < wanted - slack || fixed > wanted + slack;
  });
};

/**
 * What to try next when a day is out: the most protein dense food that is not yet in when protein is low
 * (the fitter then scales the others down), the most protein dense food out when protein is high, more food
 * when only the calories are low, a food less (or a cooked recipe less) when only they are high, and
 * otherwise the last food swapped for the next most preferred. Null when there is nothing left to try.
 */
const nextSelection = (ctx: DayContext, tried: Evaluation): Selection | null => {
  const { selection, day } = tried;
  const kcal = day.shortfalls.find(({ nutrient }) => nutrient === "kcal");
  const protein = day.shortfalls.find(({ nutrient }) => nutrient === "protein_g");
  const spare = unusedFoods(ctx, selection);
  const hasRoom = selection.foods.length < MAX_FOODS_PER_DAY;

  const isProteinLow =
    protein !== undefined && protein.achieved !== null && protein.achieved < protein.target;
  const isProteinHigh =
    protein !== undefined && protein.achieved !== null && protein.achieved > protein.target;
  const isKcalLow = kcal !== undefined && kcal.achieved !== null && kcal.achieved < kcal.target;
  const isKcalHigh = kcal !== undefined && kcal.achieved !== null && kcal.achieved > kcal.target;

  if (isProteinLow && hasRoom) {
    const dense = [...spare].sort(
      (a, b) => proteinDensity(b) - proteinDensity(a) || a.order - b.order,
    )[0];
    if (dense !== undefined) {
      return withFood(ctx, selection, dense);
    }
  }
  if (isKcalLow && hasRoom) {
    const food = bestFood(ctx, selection, spare);
    return food === undefined ? null : withFood(ctx, selection, food);
  }
  if (isProteinHigh && !isKcalLow && selection.foods.length > 0) {
    const densest = [...selection.foods].sort(
      (a, b) => proteinDensity(b.food) - proteinDensity(a.food),
    )[0];
    return { ...selection, foods: selection.foods.filter((pick) => pick !== densest) };
  }
  if (isKcalHigh) {
    if (selection.foods.length > 0) {
      return { ...selection, foods: selection.foods.slice(0, -1) };
    }
    return selection.cooks.length > 0
      ? { ...selection, cooks: selection.cooks.slice(0, -1) }
      : null;
  }
  const last = selection.foods.at(-1);
  const replacement = bestFood(ctx, selection, spare);
  if (last !== undefined && replacement !== undefined) {
    return withFood(ctx, { ...selection, foods: selection.foods.slice(0, -1) }, replacement);
  }
  return null;
};

const signatureOf = (selection: Selection): string =>
  [
    ...selection.cooks.map(({ recipe, band }) => `r:${band}:${recipe.id}`),
    ...selection.foods.map(({ food, band }) => `f:${band}:${food.id}`),
  ].join("|");

/**
 * A limit on the work: the most `fitRecipeToTargets` calls one `planMeals` or `replanDay` call may make. When it
 * runs out, each remaining day keeps its best attempt so far (or its first guess at the usual amounts) and is
 * reported short with the reason `work_limit`. A day may spend its fair share of what is left, so one hard day
 * cannot starve the days after it. Counting calls, not time, keeps the plan deterministic. It
 * bounds the work, it does not say the plan is fast, and a day cut short may have been reachable.
 */
export const PLAN_FIT_BUDGET = 50;

/** The retries of the preferred foods stop when a day has this few fits left, so the all foods fit can still run. */
export const FALLBACK_FIT_RESERVE = 6;

/**
 * A limit on the work, not a guarantee: the all foods fit looks at the most preferred this many unused foods.
 * It also keeps the fit within the fitter's 100 ingredient limit and the cost of one fit down.
 */
export const ALL_FOODS_FIT_LIMIT = 20;

/** The least a kept food may be in the final fit, one step of the 5 g grid. */
const KEPT_FOOD_MINIMUM_GRAMS = 5;

const foodPicks = (
  ctx: DayContext,
  base: Selection,
  foods: readonly FoodChoice[],
  fits: ReadonlyMap<string, { startGrams: number; minGrams: number }>,
): Selection =>
  foods.reduce<Selection>((built, food) => {
    const picked = withFood(ctx, built, food);
    const fit = fits.get(food.id);
    return fit === undefined
      ? picked
      : {
          ...picked,
          foods: picked.foods.map((pick) => (pick.food === food ? { ...pick, fit } : pick)),
        };
  }, base);

/**
 * One fit over every food the day can use, with the cooked recipes kept as they are. Each food may go down to
 * 0 g, so the fitter's bounded least squares sets a food that does not help to nothing, and those are dropped.
 * When more than `MAX_FOODS_PER_DAY` remain, the one carrying the fewest calories is dropped and the day is
 * fitted again, until the cap holds. The foods that stay are fitted a last time on the 5 g grid, each at least
 * one step, and the day is judged as any other.
 */
const allFoodsFit = (ctx: DayContext, cooks: readonly CookPick[]): Evaluation => {
  const base: Selection = { cooks: [...cooks], foods: [] };
  let candidates = [...unusedFoods(ctx, base)]
    .sort((a, b) => foodRank(ctx, a) - foodRank(ctx, b) || a.order - b.order)
    .slice(0, ALL_FOODS_FIT_LIMIT);
  if (ctx.fixed.length + base.cooks.length + candidates.length === 0) {
    return evaluate(ctx, base);
  }
  let kept: FoodChoice[] = [];
  for (let round = 0; round < 3; round += 1) {
    const search = foodPicks(
      ctx,
      base,
      candidates,
      new Map(candidates.map((food) => [food.id, { startGrams: food.typicalGrams, minGrams: 0 }])),
    );
    const fitted = fitWithinBudget(ctx, {
      ingredients: ingredientsOf(ctx, search),
      servings: 1,
      target: ctx.day.target,
    });
    if (fitted === null) {
      return evaluate(ctx, base);
    }
    const lockedCount = ctx.fixed.length + base.cooks.length;
    const grams = new Map(
      candidates.map((food, at) => [food.id, fitted.ingredients[lockedCount + at]?.grams ?? 0]),
    );
    kept = candidates.filter((food) => (grams.get(food.id) ?? 0) > 0);
    if (kept.length <= MAX_FOODS_PER_DAY) {
      break;
    }
    // Keep the foods that carry the most calories and fit again.
    kept = [...kept]
      .sort(
        (a, b) =>
          (grams.get(b.id) ?? 0) * (b.per100.kcal ?? 0) -
          (grams.get(a.id) ?? 0) * (a.per100.kcal ?? 0),
      )
      .slice(0, MAX_FOODS_PER_DAY);
    candidates = kept;
  }
  const final = foodPicks(
    ctx,
    base,
    kept,
    new Map(
      kept.map((food) => [
        food.id,
        { startGrams: food.typicalGrams, minGrams: KEPT_FOOD_MINIMUM_GRAMS },
      ]),
    ),
  );
  return evaluate(ctx, final);
};

/**
 * Builds one day: a main for each band that a leftover does not hold, foods added until the day's usual
 * amounts come near its calories, then the foods are scaled with the fitter and the day is judged with
 * `outOfTolerance` on core's sum of its items. A day that is out is tried again with a food more or less, a
 * few times, and the closest attempt is kept. A day still out gets one fit over every food it can
 * use (`allFoodsFit`) before it is reported short. A day that cannot be met says which nutrient, and why.
 */
const cooksOf = (ctx: DayContext, selection: Selection): Cook[] =>
  selection.cooks.map(({ recipe, band, batch }) => ({
    key: keyOf(ctx.day.localDate, band, recipe.id),
    recipeId: recipe.id,
    band,
    batch,
  }));

export const buildDay = (ctx: DayContext): DayOutcome => {
  let tried = evaluate(ctx, grown(ctx, withMains(ctx)));
  let best = tried;
  if (best.day.status === "short" && isOutOfReach(ctx)) {
    return { day: best.day, cooks: cooksOf(ctx, best.selection) };
  }
  const seen = new Set([signatureOf(tried.selection)]);

  for (
    let attempt = 1;
    attempt < MAX_ATTEMPTS &&
    best.day.status === "short" &&
    ctx.budget.remaining > FALLBACK_FIT_RESERVE;
    attempt += 1
  ) {
    const next = nextSelection(ctx, tried);
    if (next === null || seen.has(signatureOf(next))) {
      break;
    }
    seen.add(signatureOf(next));
    tried = evaluate(ctx, next);
    if (tried.distance < best.distance) {
      best = tried;
    }
  }

  // A day the preferred foods leave out gets one fit over every food it can use, with each cook set tried in
  // turn: all of them, then one fewer, down to none.
  for (let cooks = best.selection.cooks; best.day.status === "short"; cooks = cooks.slice(0, -1)) {
    const wider = allFoodsFit(ctx, cooks);
    if (wider.distance < best.distance || wider.day.status === "within") {
      best = wider;
    }
    if (cooks.length === 0) {
      break;
    }
  }

  return { day: best.day, cooks: cooksOf(ctx, best.selection) };
};
