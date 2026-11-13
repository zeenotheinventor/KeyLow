import { FIT_TOLERANCE } from "./fitTolerance";
import { FIT_NUTRIENTS, TOLERANCE_EPSILON, outOfTolerance, toleranceOf } from "./judgeTargets";
import { withQuantity } from "../../diary/snapshotQuantity";
import { SNAPSHOT_VERSION } from "../../diary/versions";
import { MAX_RECIPE_INGREDIENTS } from "../bounds";
import { computeRecipe } from "../computeRecipe";

import type {
  FitIngredient,
  FitInput,
  FitMiss,
  FitNutrient,
  FitResult,
  FitTarget,
  FitTolerance,
} from "./types";
import type { NullableNutrients } from "../../schemas/nutrients";

/** The default band of an unlocked ingredient: half to double its proposed grams, within 5 g to 1,000 g. */
const BAND_FLOOR_GRAMS = 5;
const BAND_CEILING_GRAMS = 1000;
/** Amounts are offered in whole steps of this many grams. */
const GRAM_STEP = 5;
const EPSILON = TOLERANCE_EPSILON;
/** How strongly the search prefers to stay near the proposed amounts. Only breaks ties. */
const STAY_NEAR_WEIGHT = 1e-4;
const REWEIGHT_ROUNDS = 40;
const SWEEPS_PER_ROUND = 400;
const GRID_SEARCH_LIMIT = 500;

type Band = { low: number; high: number };

type Problem = {
  ingredients: readonly FitIngredient[];
  servings: number;
  /** What the person named, as given. */
  named: FitTarget;
  tolerance: FitTolerance;
  targets: { nutrient: FitNutrient; target: number; tolerance: number }[];
  bands: (Band | null)[];
  /** The proposed amounts, pulled inside their bands. */
  start: number[];
  /** Per serving contribution of one gram of ingredient i to each target. */
  perGram: number[][];
  /** Per serving contribution of the locked ingredients to each target. */
  lockedPart: number[];
};

const clamp = (value: number, band: Band): number => Math.min(band.high, Math.max(band.low, value));

/** The band narrowed to whole steps, so a moved amount stays on the grid. A band too narrow for one keeps its own edges. */
const gridBandOf = (band: Band): Band => {
  const low = Math.ceil(band.low / GRAM_STEP) * GRAM_STEP;
  const high = Math.floor(band.high / GRAM_STEP) * GRAM_STEP;
  return low <= high ? { low, high } : band;
};

const bandOf = (ingredient: FitIngredient): Band | null => {
  if (ingredient.locked) {
    return null;
  }
  const { grams, minGrams, maxGrams } = ingredient;
  const defaultLow = Math.min(grams, Math.max(BAND_FLOOR_GRAMS, grams / 2));
  const defaultHigh = Math.max(grams, Math.min(BAND_CEILING_GRAMS, grams * 2));
  const high = maxGrams ?? (minGrams === undefined ? defaultHigh : Math.max(defaultHigh, minGrams));
  const low = minGrams ?? Math.min(defaultLow, high);
  return { low, high };
};

const validate = (input: FitInput): void => {
  const { ingredients, servings, target } = input;
  if (!Number.isFinite(servings) || servings <= 0) {
    throw new RangeError("Servings must be a finite number above 0");
  }
  if (ingredients.length === 0 || ingredients.length > MAX_RECIPE_INGREDIENTS) {
    throw new RangeError(`A recipe has from 1 to ${MAX_RECIPE_INGREDIENTS} ingredients`);
  }
  for (const ingredient of ingredients) {
    const { grams, minGrams, maxGrams } = ingredient;
    if (!Number.isFinite(grams) || grams <= 0) {
      throw new RangeError("Every ingredient needs a finite amount above 0 g");
    }
    const edges = [minGrams, maxGrams].filter((edge) => edge !== undefined);
    if (edges.some((edge) => !Number.isFinite(edge) || edge <= 0)) {
      throw new RangeError("A minimum or maximum must be a finite amount above 0 g");
    }
    if (minGrams !== undefined && maxGrams !== undefined && minGrams > maxGrams) {
      throw new RangeError("A minimum cannot be above its maximum");
    }
  }
  const { tolerance } = input;
  if (
    tolerance !== undefined &&
    Object.values(tolerance).some((field) => !Number.isFinite(field) || field < 0)
  ) {
    throw new RangeError("Every tolerance must be a finite number of at least 0");
  }
  for (const nutrient of FIT_NUTRIENTS) {
    const wanted = target[nutrient];
    if (wanted !== undefined && (!Number.isFinite(wanted) || wanted < 0)) {
      throw new RangeError("A target must be a finite number of at least 0");
    }
  }
};

/** Core's own figures for these amounts. Nothing else in this file decides what a recipe contains. */
const perServingOf = (
  ingredients: readonly FitIngredient[],
  grams: readonly number[],
  servings: number,
): NullableNutrients =>
  computeRecipe({
    servings,
    yieldGrams: null,
    ingredients: ingredients.map((ingredient, index) => ({
      resolved_grams: grams[index] ?? ingredient.grams,
      snapshot: withQuantity(
        {
          v: SNAPSHOT_VERSION,
          kind: "food",
          ref: ingredient.foodId,
          name: "",
          basis: "per_100g",
          per100: ingredient.per100,
          density: null,
        },
        { quantity: grams[index] ?? ingredient.grams, unit: "g" },
      ),
    })),
  }).perServing;

const buildProblem = (input: FitInput): Problem => {
  const tolerance = input.tolerance ?? FIT_TOLERANCE;
  const targets = FIT_NUTRIENTS.flatMap((nutrient) => {
    const target = input.target[nutrient];
    return target === undefined
      ? []
      : [
          {
            nutrient,
            target,
            tolerance: Math.max(toleranceOf(nutrient, target, tolerance), EPSILON),
          },
        ];
  });
  const perGram = input.ingredients.map((ingredient) =>
    targets.map(({ nutrient }) => (ingredient.per100[nutrient] ?? 0) / 100 / input.servings),
  );
  const lockedPart = targets.map((_, index) =>
    input.ingredients.reduce(
      (sum, ingredient, at) =>
        sum + (ingredient.locked ? ingredient.grams * (perGram[at]?.[index] ?? 0) : 0),
      0,
    ),
  );
  const bands = input.ingredients.map(bandOf);
  return {
    ingredients: input.ingredients,
    servings: input.servings,
    named: input.target,
    tolerance,
    targets,
    bands,
    start: input.ingredients.map((ingredient, at) => {
      const band = bands[at];
      return band === null || band === undefined ? ingredient.grams : clamp(ingredient.grams, band);
    }),
    perGram,
    lockedPart,
  };
};

/** The tolerance-scaled distance of each target from where these amounts land. 1 is the edge of tolerance. */
const distances = (problem: Problem, grams: readonly number[]): number[] =>
  problem.targets.map(({ target, tolerance }, index) => {
    const achieved = grams.reduce(
      (sum, amount, at) =>
        sum + (problem.bands[at] === null ? 0 : amount * (problem.perGram[at]?.[index] ?? 0)),
      problem.lockedPart[index] ?? 0,
    );
    return Math.abs(achieved - target) / tolerance;
  });

const worstOf = (values: readonly number[]): number => Math.max(0, ...values);

/**
 * Weighted, bounded least squares by cyclic coordinate descent: deterministic, and exact per step because
 * each step minimises a one variable quadratic. The small stay-near term makes the answer unique.
 */
const leastSquares = (
  problem: Problem,
  weights: readonly number[],
  start: readonly number[],
): number[] => {
  const grams = [...start];
  const scale = problem.targets.map(
    ({ tolerance }, index) => (weights[index] ?? 1) ** 2 / tolerance ** 2,
  );
  const residual = problem.targets.map(({ target }, index) => {
    const achieved = grams.reduce(
      (sum, amount, at) =>
        sum + (problem.bands[at] === null ? 0 : amount * (problem.perGram[at]?.[index] ?? 0)),
      problem.lockedPart[index] ?? 0,
    );
    return achieved - target;
  });
  for (let sweep = 0; sweep < SWEEPS_PER_ROUND; sweep += 1) {
    let largestMove = 0;
    grams.forEach((amount, at) => {
      const band = problem.bands[at];
      const proposed = problem.ingredients[at]?.grams ?? amount;
      if (band === null || band === undefined) {
        return;
      }
      let slope = (STAY_NEAR_WEIGHT * (amount - proposed)) / proposed ** 2;
      let curvature = STAY_NEAR_WEIGHT / proposed ** 2;
      residual.forEach((error, index) => {
        const perGram = problem.perGram[at]?.[index] ?? 0;
        slope += (scale[index] ?? 0) * perGram * error;
        curvature += (scale[index] ?? 0) * perGram ** 2;
      });
      const next = clamp(amount - slope / curvature, band);
      const move = next - amount;
      residual.forEach((_, index) => {
        residual[index] = (residual[index] ?? 0) + move * (problem.perGram[at]?.[index] ?? 0);
      });
      grams[at] = next;
      largestMove = Math.max(largestMove, Math.abs(move));
    });
    if (largestMove < 1e-7) {
      break;
    }
  }
  return grams;
};

/** Raises the weight of the nutrients that are furthest out, so the search ends with the worst one small. */
const searchContinuous = (problem: Problem): number[] => {
  let weights = problem.targets.map(() => 1);
  let best = problem.start;
  let bestWorst = worstOf(distances(problem, best));
  let current = problem.start;
  for (let round = 0; round < REWEIGHT_ROUNDS && bestWorst > 0.01; round += 1) {
    current = leastSquares(problem, weights, current);
    const away = distances(problem, current);
    const worst = worstOf(away);
    if (worst < bestWorst) {
      best = current;
      bestWorst = worst;
    }
    const peak = Math.max(worst, EPSILON);
    const raised = weights.map((weight, index) => weight * (1 + (away[index] ?? 0) / peak));
    const biggest = Math.max(...raised);
    weights = raised.map((weight) => weight / biggest);
  }
  return best;
};

const roundToStep = (amount: number): number => Math.round(amount / GRAM_STEP) * GRAM_STEP;

/** Whole 5 g steps for what moved, then single step moves while that brings the worst nutrient closer. */
const searchOnGrid = (problem: Problem, continuous: readonly number[]): number[] => {
  const grams = continuous.map((amount, at) => {
    const band = problem.bands[at];
    const started = problem.start[at] ?? amount;
    if (band === null || band === undefined || Math.abs(amount - started) < EPSILON) {
      return started;
    }
    return clamp(roundToStep(amount), gridBandOf(band));
  });
  const score = (candidate: readonly number[]): [number, number] => {
    const away = distances(problem, candidate);
    return [worstOf(away), away.reduce((sum, value) => sum + value, 0)];
  };
  const isBetter = (a: [number, number], b: [number, number]) =>
    a[0] < b[0] - EPSILON || (Math.abs(a[0] - b[0]) <= EPSILON && a[1] < b[1] - EPSILON);

  let currentScore = score(grams);
  for (let step = 0; step < GRID_SEARCH_LIMIT && currentScore[0] > 1 - EPSILON; step += 1) {
    let bestMove: { at: number; amount: number; score: [number, number] } | null = null;
    for (const [at, amount] of grams.entries()) {
      const band = problem.bands[at];
      if (band === null || band === undefined) {
        continue;
      }
      for (const direction of [-1, 1]) {
        const moved = clamp(amount + direction * GRAM_STEP, gridBandOf(band));
        if (moved === amount) {
          continue;
        }
        const candidate = grams.map((value, index) => (index === at ? moved : value));
        const candidateScore = score(candidate);
        if (isBetter(candidateScore, bestMove?.score ?? currentScore)) {
          bestMove = { at, amount: moved, score: candidateScore };
        }
      }
    }
    if (bestMove === null) {
      break;
    }
    const { at, amount, score: movedScore } = bestMove;
    grams[at] = amount;
    currentScore = movedScore;
  }
  return grams;
};

const missesOf = (
  problem: Problem,
  grams: readonly number[],
  perServing: NullableNutrients,
  tolerance: FitTolerance,
): FitMiss[] =>
  outOfTolerance(perServing, problem.named, tolerance).map(({ nutrient, target, achieved }) => {
    if (achieved === null) {
      return { nutrient, target, achieved, reason: "no_data", limitedBy: [] };
    }
    const index = problem.targets.findIndex((named) => named.nutrient === nutrient);
    const carriers = problem.ingredients.flatMap((_, at) =>
      problem.bands[at] !== null && (problem.perGram[at]?.[index] ?? 0) > 0 ? [at] : [],
    );
    const limitedBy = carriers.filter((at) => {
      const band = problem.bands[at];
      const amount = grams[at] ?? 0;
      return (
        band !== null &&
        band !== undefined &&
        (achieved < target ? band.high - amount : amount - band.low) < GRAM_STEP
      );
    });
    const reason =
      carriers.length === 0
        ? "no_adjustable_ingredient"
        : limitedBy.length === carriers.length
          ? "ingredient_bounds"
          : "targets_conflict";
    return {
      nutrient,
      target,
      achieved,
      reason,
      limitedBy: limitedBy.map((at) => problem.ingredients[at]?.foodId ?? ""),
    };
  });

const resultOf = (problem: Problem, grams: readonly number[]): FitResult => {
  const perServing = perServingOf(problem.ingredients, grams, problem.servings);
  const misses = missesOf(problem, grams, perServing, problem.tolerance);
  return {
    status: misses.length === 0 ? "within" : "unreachable",
    ingredients: problem.ingredients.map(({ foodId }, at) => ({ foodId, grams: grams[at] ?? 0 })),
    perServing,
    misses,
  };
};

/**
 * Scales the unlocked ingredients of a recipe so one serving lands within `FIT_TOLERANCE` (or the given
 * tolerance) of every named target, and says so honestly when it cannot. Unlocked ingredients move between
 * half and double their proposed grams (at least 5 g, at most 1,000 g, or the ingredient's own minimum and
 * maximum when it has them), in whole steps of 5 g. Locked ingredients never change. A recipe already within
 * tolerance comes back unchanged.
 *
 * The search is a deterministic bounded least squares over a linear model of the nutrients, then a short
 * walk on the 5 g grid. The linear model only steers. The status and `perServing` always come from
 * `computeRecipe` on the amounts returned, and the judging is `outOfTolerance`, so the figures shown are
 * exactly core's.
 *
 * `unreachable` means the closest amounts found, not a proof that no fit exists. It carries one miss per
 * named nutrient still out of tolerance. A named nutrient that no ingredient has data for is a miss with
 * reason `no_data`, never a hit. Otherwise a nutrient an ingredient has no figure for counts as 0 in the
 * search, as `computeRecipe` sums it.
 *
 * Callers:
 * - `limitedBy` holds food ids, so pass distinct `foodId`s if the answer is to be read by id.
 * - A planner day passes each fixed recipe as one locked ingredient (its per serving figures as `per100` and
 *   100 g per serving, or any consistent pair) with `servings` 1, and the filler foods unlocked.
 * - A `minGrams` or `maxGrams` outside the proposed amount moves the start inside it, so an input that
 *   already fits can change when its own bound excludes its proposed amount.
 *
 * Throws a `RangeError` for servings that are not above 0, no ingredients or more than 100, an amount,
 * minimum or maximum that is not above 0, a minimum above its maximum, a target below 0, and a tolerance field
 * that is not a finite number of at least 0. The messages state the rule and never the figures.
 */
export const fitRecipeToTargets = (input: FitInput): FitResult => {
  validate(input);
  const problem = buildProblem(input);
  const proposed = input.ingredients.map((ingredient) => ingredient.grams);
  const unchanged = resultOf(problem, proposed);
  if (
    unchanged.status === "within" &&
    problem.start.every((amount, at) => amount === proposed[at])
  ) {
    return unchanged;
  }
  return resultOf(problem, searchOnGrid(problem, searchContinuous(problem)));
};
