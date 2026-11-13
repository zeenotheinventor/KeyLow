// Graders for the palate set (KEY-1037). The profile a `get_palate_profile` call answered is compared with what core's
// `buildPalateProfile` makes of the same fixture (`fixtures/palateProfile.ts`), so no expected word or figure is typed
// by hand, and what the assistant says is held to what that result holds.
import { isDeepStrictEqual } from "node:util";

import { summaryLines } from "@keylow/core";

import { fail, isRecord, pass } from "./kitchenGraders.ts";
import { numbersIn } from "../src/case.ts";

import type { Grader } from "../src/case.ts";
import type { TurnResult } from "../src/types.ts";
import type { PalateProfile } from "@keylow/core";

/** The profile as `get_palate_profile` answers it: names, frequency words, typical amounts and the avoid list. */
export const toolShapeOf = (profile: PalateProfile): Record<string, unknown> => ({
  enough_data: profile.hasEnoughToGoOn,
  logged_days: profile.loggedDays,
  summary: summaryLines(profile),
  usual_foods: profile.usualFoods.map(({ name, frequency, typicalGrams }) => ({
    name,
    how_often: frequency,
    typical_grams: typicalGrams,
  })),
  usual_recipes: profile.usualRecipes.map(({ name, typicalServings }) => ({
    name,
    typical_servings: typicalServings,
  })),
  by_time_of_day: {
    morning: profile.byTimeOfDay.morning.map(({ name }) => name),
    midday: profile.byTimeOfDay.midday.map(({ name }) => name),
    evening: profile.byTimeOfDay.evening.map(({ name }) => name),
  },
  rarely_or_never: profile.rarelyOrNever.map(({ group }) => group),
  avoid: profile.avoid.map(({ label, kind }) => ({ label, kind })),
});

/** The last profile the tool answered in a turn, without the recipe ids the real tool adds, or null when it was not read. */
export function profileOfTurn(turn: TurnResult | undefined): Record<string, unknown> | null {
  const result = turn?.toolCalls.filter(({ name }) => name === "get_palate_profile").at(-1)?.result;
  if (result === undefined) {
    return null;
  }
  const recipes = Array.isArray(result["usual_recipes"]) ? result["usual_recipes"] : [];
  return {
    ...result,
    usual_recipes: recipes.map((recipe: unknown) =>
      isRecord(recipe)
        ? { name: recipe["name"], typical_servings: recipe["typical_servings"] }
        : recipe,
    ),
  };
}

const PROFILE_FIELDS = [
  "enough_data",
  "logged_days",
  "summary",
  "usual_foods",
  "usual_recipes",
  "by_time_of_day",
  "rarely_or_never",
  "avoid",
] as const;

/** Passes when `get_palate_profile` was called in the turn, so the answer is a fresh read and not the turn before's. */
export function profileReadInTurn(turnIndex: number): Grader {
  return ({ turns }) =>
    Promise.resolve(
      profileOfTurn(turns[turnIndex]) === null
        ? fail(`turn ${turnIndex + 1} did not read the palate profile`)
        : pass(`turn ${turnIndex + 1} read the palate profile`),
    );
}

/**
 * Passes when the profile the tool answered in the turn is core's profile of the fixture, field by field. A failure
 * names the fields that differ and never a value.
 */
export function profileMatchesCore(turnIndex: number, expected: () => PalateProfile): Grader {
  return ({ turns }) => {
    const seen = profileOfTurn(turns[turnIndex]);
    if (seen === null) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} did not read the palate profile`));
    }
    const wanted = toolShapeOf(expected());
    const differing = PROFILE_FIELDS.filter(
      (field) => !isDeepStrictEqual(seen[field], wanted[field]),
    );
    return Promise.resolve(
      differing.length === 0
        ? pass("the profile is core's profile of the fixture")
        : fail(`the profile differs from core's in ${differing.join(", ")}`),
    );
  };
}

/** Passes when the answer of the turn matches every pattern, each standing for one thing it must name. */
export function answerNamesAll(turnIndex: number, patterns: readonly RegExp[]): Grader {
  return ({ turns }) => {
    const answer = turns[turnIndex]?.answer ?? "";
    const missing = patterns.filter((pattern) => !pattern.test(answer)).length;
    return Promise.resolve(
      missing === 0
        ? pass(`turn ${turnIndex + 1} names all ${patterns.length} things it should`)
        : fail(
            `turn ${turnIndex + 1} leaves out ${missing} of ${patterns.length} things it should name`,
          ),
    );
  };
}

/** Passes when the answer of the turn matches at least `minimum` of the patterns. */
export function answerNamesAtLeast(
  turnIndex: number,
  patterns: readonly RegExp[],
  minimum: number,
): Grader {
  return ({ turns }) => {
    const answer = turns[turnIndex]?.answer ?? "";
    const named = patterns.filter((pattern) => pattern.test(answer)).length;
    return Promise.resolve(
      named >= minimum
        ? pass(`turn ${turnIndex + 1} names ${named} of ${patterns.length}`)
        : fail(`turn ${turnIndex + 1} names ${named} of ${patterns.length}, wanted ${minimum}`),
    );
  };
}

/** Passes when the answer of the turn matches none of the patterns. */
export function answerNamesNone(turnIndex: number, patterns: readonly RegExp[]): Grader {
  return ({ turns }) => {
    const answer = turns[turnIndex]?.answer ?? "";
    const named = patterns.filter((pattern) => pattern.test(answer)).length;
    return Promise.resolve(
      named === 0
        ? pass(`turn ${turnIndex + 1} names none of the foods it should leave out`)
        : fail(`turn ${turnIndex + 1} names ${named} things it should leave out`),
    );
  };
}

// The window the profile is read over is part of the tool's description, so "the last 90 days" is not an invented figure.
const WINDOW_DAYS = 90;

const numbersOfValue = (value: unknown): number[] => {
  if (typeof value === "number") {
    return [value];
  }
  if (typeof value === "string") {
    return numbersIn(value);
  }
  if (Array.isArray(value)) {
    return value.flatMap(numbersOfValue);
  }
  return isRecord(value) ? Object.values(value).flatMap(numbersOfValue) : [];
};

/**
 * Passes when every number in the answer of the turn is one the profile holds (a count of days, a typical amount in
 * grams or servings) or the 90 day window. A number the model made up, such as "6 days a week", fails it.
 */
export function noInventedNumbers(turnIndex: number): Grader {
  return ({ turns }) => {
    const seen = profileOfTurn(turns[turnIndex]);
    if (seen === null) {
      return Promise.resolve(fail(`turn ${turnIndex + 1} did not read the palate profile`));
    }
    const allowed = new Set([WINDOW_DAYS, ...numbersOfValue(seen)]);
    const invented = numbersIn(turns[turnIndex]?.answer ?? "").filter(
      (number) => !allowed.has(number),
    );
    return Promise.resolve(
      invented.length === 0
        ? pass(`every number in turn ${turnIndex + 1} is in the profile`)
        : fail(
            `turn ${turnIndex + 1} states ${invented.length} numbers that are not in the profile`,
          ),
    );
  };
}

/** Passes when the answer says an allergy is matched by the name of a food only, which the rules ask it to say. */
export function saysAllergyIsMatchedByName(turnIndex: number): Grader {
  const BY_NAME = /\b(by (?:the )?name|name only|only (?:by )?(?:the )?names?)\b/i;
  return ({ turns }) =>
    Promise.resolve(
      BY_NAME.test(turns[turnIndex]?.answer ?? "")
        ? pass("the answer says allergies are matched by name")
        : fail("the answer does not say allergies are matched by name"),
    );
}

/** Passes when the answer of the turn names the first thing before the second, so what leads the profile leads the answer. */
export function answerNamesFirst(turnIndex: number, first: RegExp, second: RegExp): Grader {
  return ({ turns }) => {
    const answer = turns[turnIndex]?.answer ?? "";
    const [firstAt, secondAt] = [answer.search(first), answer.search(second)];
    return Promise.resolve(
      firstAt >= 0 && (secondAt < 0 || firstAt < secondAt)
        ? pass("the answer names the leading food first")
        : fail("the answer does not name the leading food first"),
    );
  };
}

/**
 * Passes when the answer of the turn states the typical amount, in grams, of at least `minimum` of the foods core's
 * profile gives one for. This holds the portion habit to the profile's own figures.
 */
export function statesTypicalAmounts(
  turnIndex: number,
  expected: () => PalateProfile,
  minimum: number,
): Grader {
  return ({ turns }) => {
    const stated = new Set(numbersIn(turns[turnIndex]?.answer ?? ""));
    const amounts = expected().usualFoods.flatMap(({ typicalGrams }) =>
      typicalGrams === null ? [] : [typicalGrams],
    );
    const found = amounts.filter((grams) => stated.has(grams)).length;
    return Promise.resolve(
      found >= minimum
        ? pass(`the answer states ${found} typical amounts from the profile`)
        : fail(`the answer states ${found} typical amounts from the profile, wanted ${minimum}`),
    );
  };
}
