// Graders the kitchen sets share (KEY-1037): the recipe draft of a turn, the real foods behind its lines, and core's
// own arithmetic over them. Every expected figure is worked out by core (`computeRecipe`, `isWithinTolerance`,
// `adjustmentTarget`) from what the draft or the database holds, and none is typed by hand. A grader reads tool calls,
// draft events and rows, and never asks a model.
import { avoidsFood, rescaledIngredient } from "@keylow/core";
import { buildRecipeIngredient, computeRecipe, isWithinTolerance } from "@keylow/core/recipes";
import { foodRowSchema } from "@keylow/core/schemas";

import type { GradeOutcome, Grader } from "../src/case.ts";
import type { EvalDatabase, TurnResult } from "../src/types.ts";
import type { AssistantRecipeDraft, PalatePreference } from "@keylow/core";
import type { FitTarget } from "@keylow/core/recipes";
import type { Food, NullableNutrients } from "@keylow/core/schemas";

export const pass = (reason: string): GradeOutcome => ({ passed: true, reason });
export const fail = (reason: string): GradeOutcome => ({ passed: false, reason });

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** Floating point noise, so "equal to core's figure" is not broken by the order of an addition. */
export const FIGURE_EPSILON = 1e-6;

const NUTRIENT_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

export type Variant = AssistantRecipeDraft["variant"];

export const draftsOf = (
  turns: readonly TurnResult[],
  variant: Variant,
): readonly AssistantRecipeDraft[] =>
  turns.flatMap((turn) => turn.recipeDrafts ?? []).filter((draft) => draft.variant === variant);

export const callsOf = (turns: readonly TurnResult[], tool: string) =>
  turns.flatMap((turn) => turn.toolCalls).filter(({ name }) => name === tool);

/** True when the two figures are both unknown, or both known and the same to within `FIGURE_EPSILON`. */
export const sameFigure = (left: number | null, right: number | null): boolean =>
  left === null || right === null ? left === right : Math.abs(left - right) <= FIGURE_EPSILON;

/** The four figures a draft shows for a serving, and what a nutrient set of core holds of them. */
export type Figures = Readonly<Record<(typeof NUTRIENT_KEYS)[number], number | null>>;

/** The names of the nutrients that differ between two sets of per-serving figures. */
export const differingFigures = (shown: Figures, expected: Figures): string[] =>
  NUTRIENT_KEYS.filter((key) => !sameFigure(shown[key], expected[key]));

/** A draft's fit target as core takes one: only the figures that were named. */
export const fitTargetOf = (
  named: Partial<Record<(typeof NUTRIENT_KEYS)[number], number | undefined>>,
): FitTarget => {
  const target: FitTarget = {};
  for (const key of NUTRIENT_KEYS) {
    const value = named[key];
    if (value !== undefined) {
      target[key] = value;
    }
  }
  return target;
};

/** A draft's figures as core's judges take them. Fibre is not judged, so it is left unknown. */
export const nutrientsOfDraft = (draft: AssistantRecipeDraft): NullableNutrients => ({
  ...draft.perServing,
  fibre_g: null,
});

/** Passes when the last turn ended complete: the assistant answered and nothing failed or stopped. */
export function lastTurnComplete(): Grader {
  return ({ turns }) => {
    const status = turns.at(-1)?.status ?? "never";
    return Promise.resolve(
      status === "complete"
        ? pass("the last turn ended complete")
        : fail(`the last turn ended ${status}`),
    );
  };
}

/** Passes when no call to the tool was made in the case. */
export function toolNotCalled(name: string): Grader {
  return ({ turns }) => {
    const calls = callsOf(turns, name).length;
    return Promise.resolve(
      calls === 0 ? pass(`${name} was not called`) : fail(`${name} was called ${calls} times`),
    );
  };
}

/** Passes when the case showed exactly one recipe draft of the variant. */
export function oneDraft(variant: Variant): Grader {
  return ({ turns }) => {
    const count = draftsOf(turns, variant).length;
    return Promise.resolve(
      count === 1 ? pass(`one ${variant} draft`) : fail(`${count} ${variant} drafts, not 1`),
    );
  };
}

/** Passes when the case showed no recipe draft at all. */
export function noDraft(): Grader {
  return ({ turns }) => {
    const count = turns.flatMap((turn) => turn.recipeDrafts ?? []).length;
    return Promise.resolve(count === 0 ? pass("no recipe draft") : fail(`${count} recipe drafts`));
  };
}

/** The foods of these ids that the eval user can read, parsed as the app reads them. An unreadable id is left out. */
export async function readFoods(
  database: EvalDatabase,
  ids: readonly string[],
): Promise<ReadonlyMap<string, Food>> {
  const found = new Map<string, Food>();
  for (const id of new Set(ids)) {
    const [row] = await database.readRows({ table: "foods", where: { id } });
    const parsed = foodRowSchema.safeParse(row);
    if (parsed.success) {
      found.set(id, parsed.data);
    }
  }
  return found;
}

/**
 * The figures of a draft's matched lines as core works them out from the real foods: each line is built at the
 * grams it shows and the recipe is added up per serving. A line with no food is left out, as the draft leaves it.
 * Null when a line cannot be built (a food with no weight, or one the user cannot read).
 */
export async function suggestionFiguresFromCore(
  database: EvalDatabase,
  draft: AssistantRecipeDraft,
): Promise<NullableNutrients | null> {
  const matched = draft.ingredients.filter(({ foodId }) => foodId !== null);
  const foods = await readFoods(
    database,
    matched.flatMap(({ foodId }) => (foodId === null ? [] : [foodId])),
  );
  const ingredients = [];
  for (const { foodId, grams } of matched) {
    const food = foodId === null ? undefined : foods.get(foodId);
    if (food === undefined) {
      return null;
    }
    try {
      ingredients.push(buildRecipeIngredient(food, { quantity: grams, unit: "g" }));
    } catch {
      return null;
    }
  }
  return computeRecipe({ servings: draft.servings, yieldGrams: null, ingredients }).perServing;
}

/**
 * The after and before figures of an adjustment as core works them out from the frozen lines the draft carries:
 * each kept line rescaled to the grams it shows, the added lines as made, the before figure from the lines as they
 * were. Null when a line has no frozen ingredient to work from.
 */
export function adjustmentFiguresFromCore(
  draft: AssistantRecipeDraft,
): { after: NullableNutrients; before: NullableNutrients } | null {
  const lines = draft.ingredients;
  if (lines.some(({ frozen }) => frozen === null || frozen === undefined)) {
    return null;
  }
  const after = lines.flatMap(({ frozen, grams }) =>
    frozen === null || frozen === undefined ? [] : [rescaledIngredient(frozen, grams)],
  );
  const before = lines.flatMap(({ frozen, beforeGrams }) =>
    beforeGrams === null || frozen === null || frozen === undefined ? [] : [frozen],
  );
  const figures = (ingredients: typeof after) =>
    computeRecipe({ servings: draft.servings, yieldGrams: null, ingredients }).perServing;
  return { after: figures(after), before: figures(before) };
}

/** What the model was told of the draft's figures, when the tool answered with a recipe summary. */
export function figuresTheModelWasTold(
  turns: readonly TurnResult[],
  tool: "suggest_recipe" | "adjust_recipe",
): Record<string, unknown> | null {
  const recipe = callsOf(turns, tool).at(-1)?.result?.["recipe"];
  const figures = isRecord(recipe) ? recipe["per_serving"] : undefined;
  return isRecord(figures) ? figures : null;
}

const toNullable = (figures: Record<string, unknown>): NullableNutrients | null => {
  const read = (key: string): number | null | undefined => {
    const value = figures[key];
    return typeof value === "number" || value === null ? value : undefined;
  };
  const [kcal, protein, carbs, fat] = [
    read("kcal"),
    read("protein_g"),
    read("carbs_g"),
    read("fat_g"),
  ];
  return kcal === undefined || protein === undefined || carbs === undefined || fat === undefined
    ? null
    : { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, fibre_g: null };
};

/** Passes when the figures the model was told are the figures the app draws, so what it says is what is shown. */
export function modelToldTheDrawnFigures(
  tool: "suggest_recipe" | "adjust_recipe",
  variant: Variant,
): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, variant);
    const told = figuresTheModelWasTold(turns, tool);
    const toldFigures = told === null ? null : toNullable(told);
    if (draft === undefined || toldFigures === null) {
      return Promise.resolve(fail("there is no draft or no summary to compare"));
    }
    const differing = differingFigures(draft.perServing, toldFigures);
    return Promise.resolve(
      differing.length === 0
        ? pass("the model was told the figures that are drawn")
        : fail(`the model was told other figures than the card shows (${differing.join(", ")})`),
    );
  };
}

/** Passes when the draft's fit flag is true: `within` exactly when core judges the figures within the tolerance. */
export function fitFlagIsTrue(variant: Variant): Grader {
  return ({ turns }) => {
    const [draft] = draftsOf(turns, variant);
    if (draft?.fit === null || draft === undefined) {
      return Promise.resolve(fail("the draft has no fit to check"));
    }
    const within = isWithinTolerance(nutrientsOfDraft(draft), fitTargetOf(draft.fit.target));
    const claimed = draft.fit.status === "within";
    return Promise.resolve(
      within === claimed
        ? pass(`the fit says ${draft.fit.status} and core agrees`)
        : fail(`the fit says ${draft.fit.status} and core says ${within ? "within" : "outside"}`),
    );
  };
}

/** Passes when the last draft of the variant lands within `FIT_TOLERANCE` of the target. */
export function withinTolerance(variant: Variant, target: FitTarget): Grader {
  return ({ turns }) => {
    const draft = draftsOf(turns, variant).at(-1);
    if (draft === undefined) {
      return Promise.resolve(fail("there is no draft"));
    }
    return Promise.resolve(
      isWithinTolerance(nutrientsOfDraft(draft), target)
        ? pass("the draft lands within the tolerance of the target")
        : fail("the draft lands outside the tolerance of the target"),
    );
  };
}

/** Passes when no name, line or step of any draft is a food the person said to avoid. Matching is core's. */
export function noAvoidedFood(preferences: readonly PalatePreference[]): Grader {
  return ({ turns }) => {
    const drafts = turns.flatMap((turn) => turn.recipeDrafts ?? []);
    const texts = drafts.flatMap((draft) => [
      draft.name,
      ...draft.steps,
      ...draft.ingredients.flatMap(({ name, foodName }) =>
        foodName === null ? [name] : [name, foodName],
      ),
    ]);
    const hits = texts.filter((name) => avoidsFood({ name }, preferences).avoid).length;
    return Promise.resolve(
      hits === 0
        ? pass(`no avoided food in ${drafts.length} drafts`)
        : fail(`${hits} names or steps hold a food the person avoids`),
    );
  };
}

async function generationRowsOf(turns: readonly TurnResult[], database: EvalDatabase) {
  return (
    await Promise.all(
      turns.map(({ turnId }) =>
        database.readRows({
          table: "assistant_usage",
          where: { turn_id: turnId, route: "recipe_generate" },
        }),
      ),
    )
  ).flat();
}

/**
 * Passes when the case wrote `count` `assistant_usage` rows on the `recipe_generate` route, the one Opus call of a
 * kitchen tool, all of them under Opus 5.5. `count` is 0 for an adjustment that scaling reaches.
 */
export function generationRows(count: number): Grader {
  return generationRowsBetween(count, count);
}

/** Passes when the case wrote at most `maximum` Opus generation rows: a substitution may or may not need the call. */
export function generationRowsAtMost(maximum: number): Grader {
  return generationRowsBetween(0, maximum);
}

function generationRowsBetween(minimum: number, maximum: number): Grader {
  return async ({ turns, database }) => {
    const rows = await generationRowsOf(turns, database);
    const notOpus = rows.filter((row) => row["model"] !== "claude-opus-5-5").length;
    if (rows.length < minimum || rows.length > maximum) {
      return fail(
        `${rows.length} recipe_generate rows, wanted ${minimum === maximum ? minimum : `${minimum} to ${maximum}`}`,
      );
    }
    return notOpus === 0
      ? pass(`${rows.length} recipe_generate rows, all Opus`)
      : fail(`${notOpus} recipe_generate rows are not Opus 5.5`);
  };
}

/** What a kitchen case needs of the world: the recipes as stored, read before and after. */
export type RecipeBook = Readonly<{
  ensureWorld: () => Promise<void>;
  recipesFingerprint: () => Promise<string>;
}>;

/**
 * Reads every recipe as stored before the case (in its `prepare`) and again when it is graded, so a recipe that a turn
 * changed, added or archived fails. The two halves share one closure, and a case makes its own.
 */
export function recipeBookGuard(book: RecipeBook): {
  prepare: () => Promise<void>;
  unchanged: Grader;
} {
  let before: string | null = null;
  return {
    prepare: async () => {
      await book.ensureWorld();
      before = await book.recipesFingerprint();
    },
    unchanged: async () => {
      if (before === null) {
        return fail("the recipes were not read before the case");
      }
      return (await book.recipesFingerprint()) === before
        ? pass("every recipe is as it was before the turn")
        : fail("a recipe was changed, added or archived");
    },
  };
}

/** Passes when the answer of the last turn matches the pattern. */
export function answerMatches(pattern: RegExp, what: string): Grader {
  return ({ turns }) =>
    Promise.resolve(
      pattern.test(turns.at(-1)?.answer ?? "")
        ? pass(`the answer ${what}`)
        : fail(`the answer does not ${what}`),
    );
}

/** A grader of a rule of style: a miss counts in the set's percentage and never makes a must-pass case a missed must-pass. */
export function soft(grader: Grader): Grader {
  return async (context) => {
    const outcome = await grader(context);
    return outcome.passed ? outcome : { ...outcome, soft: true };
  };
}
