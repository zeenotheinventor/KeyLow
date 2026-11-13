// Graders for the recipeSuggest set (KEY-1037). A draft is checked against core and against the rows of the foods, and
// a case that must be honest about a miss is checked against core's own judgement of the figures.
//
// What the real-food checks enforce: a line the draft matched to a food (a `foodId`) must be a food the eval user can
// read, under the name the draft shows, and every line the draft shows with no `foodId` must carry no food name and so
// is "unmatched", which the numbers check then holds out of the figures. That is the tool's contract (a line that
// matches no food is shown unmatched and never invented). `allLinesMatched` is the stricter reading, "100 % of
// ingredients resolve", and only the case built around that reading uses it.
import { isWithinTolerance } from "@keylow/core/recipes";

import {
  callsOf,
  differingFigures,
  draftsOf,
  fail,
  isRecord,
  nutrientsOfDraft,
  pass,
  readFoods,
  suggestionFiguresFromCore,
} from "./kitchenGraders.ts";

import type { Grader } from "../src/case.ts";
import type { FitTarget } from "@keylow/core/recipes";

/** Passes when `suggest_recipe` was called with these figures for one serving, and carbs or fat only when named. */
export function suggestCalledWith(figures: Readonly<Record<string, number>>): Grader {
  return ({ turns }) => {
    const calls = callsOf(turns, "suggest_recipe");
    const matching = calls.some(
      ({ input }) =>
        isRecord(input) && Object.entries(figures).every(([key, value]) => input[key] === value),
    );
    if (calls.length === 0) {
      return Promise.resolve(fail("suggest_recipe was not called"));
    }
    return Promise.resolve(
      matching
        ? pass("suggest_recipe was called with the figures asked for")
        : fail("suggest_recipe was called with other figures than the person asked for"),
    );
  };
}

/**
 * Passes when every line the draft matched to a food names a food the eval user can read, and every line with no food
 * is shown unmatched, with no food name. All or nothing: one line that points at a food that does not exist fails it.
 */
export function matchedLinesAreRealFoods(): Grader {
  return async ({ turns, database }) => {
    const [draft] = draftsOf(turns, "suggestion");
    if (draft === undefined) {
      return fail("there is no suggestion draft");
    }
    const matched = draft.ingredients.flatMap(({ foodId, foodName }) =>
      foodId === null ? [] : [{ foodId, foodName }],
    );
    const foods = await readFoods(
      database,
      matched.map(({ foodId }) => foodId),
    );
    const unreal = matched.filter(
      ({ foodId, foodName }) => foods.get(foodId)?.name !== foodName,
    ).length;
    const dishonest = draft.ingredients.filter(
      ({ foodId, foodName }) => foodId === null && foodName !== null,
    ).length;
    const unmatched = draft.ingredients.length - matched.length;
    if (unreal > 0 || dishonest > 0) {
      return fail(
        `${unreal} matched lines are not real foods and ${dishonest} unmatched lines name a food`,
      );
    }
    return pass(
      `${matched.length} matched lines are real foods and ${unmatched} lines are shown unmatched`,
    );
  };
}

/** Passes when no line of the draft is unmatched: every ingredient resolved to a real food. */
export function allLinesMatched(): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, "suggestion");
    if (draft === undefined) {
      return Promise.resolve(fail("there is no suggestion draft"));
    }
    const unmatched = draft.ingredients.filter(({ foodId }) => foodId === null).length;
    return Promise.resolve(
      unmatched === 0
        ? pass(`all ${draft.ingredients.length} ingredients resolved to a food`)
        : fail(`${unmatched} of ${draft.ingredients.length} ingredients matched no food`),
    );
  };
}

/** Passes when the figures the draft shows equal what core's `computeRecipe` works out from the real foods and the grams shown. */
export function shownNumbersEqualCore(): Grader {
  return async ({ turns, database }) => {
    const [draft] = draftsOf(turns, "suggestion");
    if (draft === undefined) {
      return fail("there is no suggestion draft");
    }
    const fromCore = await suggestionFiguresFromCore(database, draft);
    if (fromCore === null) {
      return fail("a line of the draft could not be rebuilt from its food");
    }
    const differing = differingFigures(draft.perServing, fromCore);
    return differing.length === 0
      ? pass("the shown figures equal core's over the matched lines")
      : fail(`the shown figures differ from core's (${differing.join(", ")})`);
  };
}

/** Passes when the fit of the draft was made for the figures the person asked for. */
export function fitTargetIs(target: FitTarget): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, "suggestion");
    const fitted = draft?.fit?.target;
    if (fitted === undefined) {
      return Promise.resolve(fail("the draft has no fit"));
    }
    const same = (["kcal", "protein_g", "carbs_g", "fat_g"] as const).every(
      (key) => fitted[key] === target[key],
    );
    return Promise.resolve(
      same
        ? pass("the draft was fitted to the figures asked for")
        : fail("the draft was fitted to other figures"),
    );
  };
}

/** Passes when the draft is an honest miss: the fit says unreachable, it names its misses, and core agrees the figures are outside. */
export function honestMiss(target: FitTarget): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, "suggestion");
    if (draft?.fit === null || draft === undefined) {
      return Promise.resolve(fail("there is no fitted draft"));
    }
    if (draft.fit.status !== "unreachable" || draft.fit.misses.length === 0) {
      return Promise.resolve(fail("the fit does not say it missed"));
    }
    return Promise.resolve(
      isWithinTolerance(nutrientsOfDraft(draft), target)
        ? fail("the fit says it missed and core says the figures are within")
        : pass(`the fit says it missed by ${draft.fit.misses.length} figures and core agrees`),
    );
  };
}

/** Passes when no matched line is meat or fish, by the CoFID group code of its food (M for meat, J for fish). */
export function noMeatOrFish(): Grader {
  return async ({ turns, database }) => {
    const [draft] = draftsOf(turns, "suggestion");
    if (draft === undefined) {
      return fail("there is no suggestion draft");
    }
    const foods = await readFoods(
      database,
      draft.ingredients.flatMap(({ foodId }) => (foodId === null ? [] : [foodId])),
    );
    const meaty = [...foods.values()].filter(({ food_group: group }) => /^[MJ]/.test(group ?? ""));
    return meaty.length === 0
      ? pass(`none of ${foods.size} matched foods is meat or fish`)
      : fail(`${meaty.length} matched foods are meat or fish`);
  };
}

/**
 * Passes when at least `minimum` distinct foods of the draft are foods the person usually eats. A food is the same food
 * when its name is the one core's profile gives, because the profile of the fixture carries names the seed also holds.
 */
export function usesUsualFoods(usualFoodNames: () => ReadonlySet<string>, minimum: number): Grader {
  return async ({ turns, database }) => {
    const [draft] = draftsOf(turns, "suggestion");
    if (draft === undefined) {
      return fail("there is no suggestion draft");
    }
    const foods = await readFoods(
      database,
      draft.ingredients.flatMap(({ foodId }) => (foodId === null ? [] : [foodId])),
    );
    const usualNames = usualFoodNames();
    const usual = new Set(
      [...foods.values()].filter(({ name }) => usualNames.has(name)).map(({ name }) => name),
    ).size;
    return usual >= minimum
      ? pass(`${usual} distinct usual foods in the draft`)
      : fail(`${usual} distinct usual foods in the draft, wanted ${minimum}`);
  };
}

/** Passes when the words passed to `suggest_recipe` match the pattern, so the person's own wishes reach the tool. */
export function suggestWordsMatch(pattern: RegExp): Grader {
  return ({ turns }) => {
    const matched = callsOf(turns, "suggest_recipe").some(
      ({ input }) =>
        isRecord(input) && typeof input["words"] === "string" && pattern.test(input["words"]),
    );
    return Promise.resolve(
      matched
        ? pass("the person's words reached the tool")
        : fail("the person's words did not reach the tool"),
    );
  };
}

/**
 * Passes when `suggest_recipe` was called and refused with one of these codes. The Opus call has already been made when
 * the tool refuses a recipe that mentions an avoided food or matched nothing, so a refusal is a good answer to an ask for
 * an avoided food, and it leaves one `recipe_generate` row.
 */
export function suggestRefusedWith(codes: readonly string[]): Grader {
  return ({ turns }) => {
    const code = callsOf(turns, "suggest_recipe").at(-1)?.errorCode;
    return Promise.resolve(
      code !== undefined && codes.includes(code)
        ? pass(`suggest_recipe refused with ${code}`)
        : fail(`suggest_recipe ${code === undefined ? "did not refuse" : `refused with ${code}`}`),
    );
  };
}
