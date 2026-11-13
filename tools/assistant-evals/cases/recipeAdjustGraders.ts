// Graders for the recipeAdjust set (KEY-1037). The figures a draft shows are core's (`computeRecipe` over the frozen lines the
// draft carries), the target is core's (`adjustmentTarget` over the stored recipe's figures and what the call asked for),
// and "within" is core's `isWithinTolerance`. Every expected figure comes from `fixtures/kitchenFacts.ts`, which core
// works out from the seeded foods, and none is typed by hand.
import { adjustmentTarget, isWithinTolerance, toleranceOf } from "@keylow/core/recipes";

import {
  FIGURE_EPSILON,
  adjustmentFiguresFromCore,
  callsOf,
  differingFigures,
  draftsOf,
  fail,
  isRecord,
  nutrientsOfDraft,
  pass,
  sameFigure,
} from "./kitchenGraders.ts";
import { allKitchenRecipes, perServingOf } from "../fixtures/kitchenFacts.ts";

import type { Grader } from "../src/case.ts";
import type { FitNutrient, FitTarget } from "@keylow/core/recipes";

const NUTRIENTS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;
const MODES = ["add", "multiply", "set"] as const;

type AdjustInput = Readonly<{
  recipeId: string;
  nutrient: FitNutrient;
  mode: (typeof MODES)[number];
  value: number;
}>;

/** The last `adjust_recipe` call of the case, read into its typed form, or null when there is none or it is malformed. */
export function adjustInputOf(turns: Parameters<Grader>[0]["turns"]): AdjustInput | null {
  const input = callsOf(turns, "adjust_recipe").at(-1)?.input;
  if (!isRecord(input)) {
    return null;
  }
  const { recipe_id: recipeId, nutrient, mode, value } = input;
  const knownNutrient = NUTRIENTS.find((candidate) => candidate === nutrient);
  const knownMode = MODES.find((candidate) => candidate === mode);
  return typeof recipeId === "string" &&
    knownNutrient !== undefined &&
    knownMode !== undefined &&
    typeof value === "number"
    ? { recipeId, nutrient: knownNutrient, mode: knownMode, value }
    : null;
}

/** Passes when `adjust_recipe` was called on the recipe of this name (its id, read from the world) for this nutrient. */
export function adjustCalledOn(recipeIdOf: () => Promise<string>, nutrient: FitNutrient): Grader {
  return async ({ turns }) => {
    const input = adjustInputOf(turns);
    if (input === null) {
      return fail("adjust_recipe was not called with a recipe, a nutrient, a mode and a value");
    }
    if (input.recipeId !== (await recipeIdOf())) {
      return fail("adjust_recipe was called on another recipe");
    }
    return input.nutrient === nutrient
      ? pass(`adjust_recipe was called on the recipe for ${nutrient}`)
      : fail(`adjust_recipe was called for ${input.nutrient}, not ${nutrient}`);
  };
}

/**
 * Passes when what the call asked for, worked out by core over the stored recipe, comes to `wanted` for the nutrient to
 * within `allowance`. This holds the assistant to the person's words ("30 g more protein" is protein plus 30) and leaves the
 * choice of mode and value to it.
 */
export function asksFor(
  recipeName: string,
  nutrient: FitNutrient,
  wanted: (before: number) => number,
  allowance: number,
): Grader {
  return ({ turns }) => {
    const input = adjustInputOf(turns);
    const before = perServingOf(recipeName)[nutrient];
    if (input === null || before === null) {
      return Promise.resolve(fail("the call or the recipe's figure is missing"));
    }
    const target = adjustmentTarget(perServingOf(recipeName), input)[nutrient];
    return Promise.resolve(
      target !== undefined && Math.abs(target - wanted(before)) <= allowance
        ? pass(`the call asks for what the person asked for`)
        : fail("the call asks for something other than what the person asked for"),
    );
  };
}

const targetOf = (recipeName: string, input: AdjustInput): FitTarget =>
  adjustmentTarget(perServingOf(recipeName), input);

/** Passes when the draft changes the saved recipe it was asked about, and its before figures are that recipe's own. */
export function draftIsOfTheRecipe(recipeName: string, recipeIdOf: () => Promise<string>): Grader {
  return async ({ turns }) => {
    const [draft] = draftsOf(turns, "adjustment");
    if (draft?.variant !== "adjustment") {
      return fail("there is no adjustment draft");
    }
    if (draft.recipeId !== (await recipeIdOf())) {
      return fail("the draft changes another recipe");
    }
    const differing = differingFigures(draft.before, perServingOf(recipeName));
    return differing.length === 0
      ? pass("the draft's before figures are the stored recipe's")
      : fail(
          `the draft's before figures differ from core's for the stored recipe (${differing.join(", ")})`,
        );
  };
}

/** Passes when the adjusted figures land within `FIT_TOLERANCE` of the target the call asked for, and the fit was made for it. */
export function reachesTheTarget(recipeName: string): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, "adjustment");
    const input = adjustInputOf(turns);
    if (draft === undefined || input === null) {
      return Promise.resolve(fail("there is no draft or no call to judge"));
    }
    const target = targetOf(recipeName, input);
    const fittedTo = draft.fit?.target ?? {};
    const fitted = NUTRIENTS.every((key) => {
      const [left, right] = [fittedTo[key], target[key]];
      return left === undefined || right === undefined ? left === right : sameFigure(left, right);
    });
    if (!fitted) {
      return Promise.resolve(
        fail("the draft was fitted to another target than the call asked for"),
      );
    }
    return Promise.resolve(
      isWithinTolerance(nutrientsOfDraft(draft), target)
        ? pass("the adjusted recipe lands within the tolerance of the target")
        : fail("the adjusted recipe lands outside the tolerance of the target"),
    );
  };
}

/** Passes when the figures the draft shows, before and after, are what core works out from the frozen lines it carries. */
export function adjustedNumbersEqualCore(): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, "adjustment");
    if (draft?.variant !== "adjustment") {
      return Promise.resolve(fail("there is no adjustment draft"));
    }
    const fromCore = adjustmentFiguresFromCore(draft);
    if (fromCore === null) {
      return Promise.resolve(fail("a line of the draft has no frozen ingredient"));
    }
    const differing = [
      ...differingFigures(draft.perServing, fromCore.after).map((key) => `after ${key}`),
      ...differingFigures(draft.before, fromCore.before).map((key) => `before ${key}`),
    ];
    return Promise.resolve(
      differing.length === 0
        ? pass("the shown figures equal core's over the frozen lines")
        : fail(`the shown figures differ from core's (${differing.join(", ")})`),
    );
  };
}

/**
 * Passes when the draft's lines are the saved recipe's own: every kept line carries its frozen ingredient at the grams it
 * had (`beforeGrams`), the kept lines are exactly the recipe's ingredients, and at most 3 foods were added, each with
 * no earlier grams.
 */
export function linesAreFrozenFromTheRecipe(recipeName: string): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, "adjustment");
    const recipe = allKitchenRecipes.find(({ name }) => name === recipeName);
    if (draft === undefined || recipe === undefined) {
      return Promise.resolve(fail("there is no draft or no recipe"));
    }
    const kept = draft.ingredients.filter(({ change }) => change !== "added");
    const added = draft.ingredients.filter(({ change }) => change === "added");
    const frozenAtTheirGrams = kept.every(
      ({ frozen, beforeGrams }) =>
        frozen !== null && frozen !== undefined && frozen.resolved_grams === beforeGrams,
    );
    const sortedGrams = (grams: readonly (number | null)[]) =>
      grams.map((value) => value ?? -1).sort((left, right) => left - right);
    const keptAreTheRecipes = isSameGrams(
      sortedGrams(kept.map(({ beforeGrams }) => beforeGrams)),
      sortedGrams(recipe.ingredients.map(({ grams }) => grams)),
    );
    const addedAreNew = added.length <= 3 && added.every(({ beforeGrams }) => beforeGrams === null);
    return Promise.resolve(
      frozenAtTheirGrams && keptAreTheRecipes && addedAreNew
        ? pass(`${kept.length} kept lines frozen from the recipe and ${added.length} added`)
        : fail("the lines are not the saved recipe's frozen lines plus at most 3 added foods"),
    );
  };
}

const isSameGrams = (left: readonly number[], right: readonly number[]): boolean =>
  left.length === right.length &&
  left.every((grams, index) => sameFigure(grams, right[index] ?? null));

const UNCHANGED_WORDS =
  /\b(unchanged|not changed|nothing (?:was )?(?:saved|changed)|couldn'?t|could not|can'?t|cannot|unable|closest|not (?:possible|reach))\b/i;

/**
 * Passes when the case ended in an honest refusal: no draft, `adjust_recipe` answered `could_not_reach_target` with its
 * misses, each miss is for the target core works out and is outside the tolerance by core's own judgement, and the
 * answer says the recipe was not changed or could not be.
 */
export function honestRefusal(recipeName: string): Grader {
  return ({ turns }) => {
    const input = adjustInputOf(turns);
    const call = callsOf(turns, "adjust_recipe").at(-1);
    if (input === null || call === undefined) {
      return Promise.resolve(fail("adjust_recipe was not called"));
    }
    if (turns.some((turn) => (turn.recipeDrafts ?? []).length > 0)) {
      return Promise.resolve(fail("a draft was shown, so this is not a refusal"));
    }
    if (call.errorCode !== "could_not_reach_target") {
      return Promise.resolve(
        fail(`the tool answered ${call.errorCode ?? "no refusal"}, not could_not_reach_target`),
      );
    }
    const misses = Array.isArray(call.result?.["misses"]) ? call.result["misses"] : [];
    const target = targetOf(recipeName, input);
    const honest = misses.length > 0 && misses.every((miss: unknown) => isHonestMiss(miss, target));
    if (!honest) {
      return Promise.resolve(fail("a miss is not for core's target or is within the tolerance"));
    }
    return Promise.resolve(
      UNCHANGED_WORDS.test(turns.at(-1)?.answer ?? "")
        ? pass(`refused honestly with ${misses.length} misses`)
        : fail("the answer does not say the recipe was not changed"),
    );
  };
}

function isHonestMiss(miss: unknown, target: FitTarget): boolean {
  if (!isRecord(miss)) {
    return false;
  }
  const nutrient = NUTRIENTS.find((candidate) => candidate === miss["nutrient"]);
  const [missTarget, achieved] = [miss["target"], miss["achieved"]];
  const wanted = nutrient === undefined ? undefined : target[nutrient];
  if (nutrient === undefined || wanted === undefined || typeof missTarget !== "number") {
    return false;
  }
  return (
    Math.abs(missTarget - wanted) <= FIGURE_EPSILON &&
    (achieved === null ||
      (typeof achieved === "number" && Math.abs(achieved - wanted) > toleranceOf(nutrient, wanted)))
  );
}

/** Passes when every `adjust_recipe` call of the case was refused, so nothing was drafted for a recipe that is not there. */
export function everyAdjustCallRefused(): Grader {
  return ({ turns }) => {
    const calls = callsOf(turns, "adjust_recipe");
    const accepted = calls.filter(({ errorCode }) => errorCode === undefined).length;
    return Promise.resolve(
      accepted === 0
        ? pass(`${calls.length} adjust_recipe calls, none accepted`)
        : fail(`${accepted} adjust_recipe calls were accepted`),
    );
  };
}
