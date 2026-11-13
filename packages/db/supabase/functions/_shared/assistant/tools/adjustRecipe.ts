// "Make this 30 g higher in protein" on a saved recipe (ADR 0006, Amendment 6). Core turns the change into a target
// per serving, holding the calories (`adjustmentTarget`), and the fitter scales the recipe's own amounts first
// (`buildAdjustmentDraft`). Only when scaling cannot reach the target is there one Opus call, which chooses at
// most 3 of the person's own foods to add, by position. Core fits again and works out every figure. The model gets
// a short summary. The app draws the draft from `structured`, which the model never sees. Nothing is written: the
// person saves the draft as a new recipe, and the recipe it came from is never changed.
//
// Things to know when changing this file:
// - A scaling answer makes no Opus call and so writes no usage row. A substitution makes one, on the
//   `recipe_generate` route (the check of `assistant_usage.route` has no route of its own for an adjustment).
// - One deadline of `totalMilliseconds` runs from the start of the tool and covers the reads and the Opus call, so
//   the tool ends inside the 55 s the loop gives a generation tool. A step that runs past it is `timed_out`.
// - Foods the person avoids are taken out of the candidates before the call. Core drops what remains from the
//   draft, and refuses a recipe whose name or steps mention an avoided food.
// - Nothing here logs a word, a name or a figure of the person's.
import { z } from "zod";

import {
  adjustmentCandidatesOf,
  adjustmentSummaryOf,
  adjustmentTarget,
  assistantRecipeDraftSchema,
  buildAdjustmentDraft,
  computeRecipe,
  readSubstitution,
  substitutionSchema,
} from "../../core.ts";
import { getRecipe } from "../../repos.ts";
import { GENERATION_TIMEOUT_MILLISECONDS } from "../generate.ts";
import { adjustRequestOf } from "../kitchenPrompts.ts";
import { BudgetExceeded, deadlineOf } from "./deadline.ts";
import { readFoodAndPortions } from "./foodMatching.ts";
import { readPalate } from "./readPalate.ts";
import { dataNotice } from "./shared.ts";

import type { AdjustmentOutcome, FitMiss } from "../../core.ts";
import type { FoodAndPortions } from "./foodMatching.ts";
import type { ReadToolDefinition } from "../tool.ts";

const adjustRecipeInput = z
  .strictObject({
    recipe_id: z.guid().describe("From get_recipes."),
    nutrient: z.enum(["kcal", "protein_g", "carbs_g", "fat_g"]).describe("What to change."),
    mode: z.enum(["add", "multiply", "set"]),
    value: z
      .number()
      .min(-5000)
      .max(5000)
      .describe("30 for 30 g more, -20 for 20 g less, 0.67 to multiply by two thirds."),
    words: z.string().trim().max(300).optional().describe("Their other wishes."),
  })
  .refine(({ mode, value }) => mode === "add" || value >= 0, {
    path: ["value"],
  });

type AdjustRecipeInput = z.infer<typeof adjustRecipeInput>;

export type AdjustLimits = {
  /** The one deadline, counted from the start of the tool: the reads and the Opus call. */
  totalMilliseconds: number;
  /** The most the Opus call may take, inside the deadline. */
  generationMilliseconds: number;
};

export const defaultAdjustLimits: AdjustLimits = {
  totalMilliseconds: 50_000,
  generationMilliseconds: GENERATION_TIMEOUT_MILLISECONDS,
};

const refuse = (error: string, extra: Record<string, unknown> = {}) => ({
  data: { error, ...extra },
});

const missesOf = (misses: readonly FitMiss[]) =>
  misses.map(({ nutrient, target, achieved, reason, limitedBy }) => ({
    nutrient,
    target,
    achieved,
    reason,
    limited_by: limitedBy,
  }));

export function createAdjustRecipeTool(
  limits: AdjustLimits,
): ReadToolDefinition<AdjustRecipeInput> {
  return {
    name: "adjust_recipe",
    description:
      "Changes a saved recipe by one nutrient in a serving, such as 30 g more protein, and shows a card to " +
      "save as a new recipe. Ki-Lo works out every figure. If could_not_reach_target, give the closest " +
      "figure from misses. If recipe_has_avoided_ingredient, they can remove that food and ask again. Nothing is saved. " +
      dataNotice,
    kind: "read",
    group: "kitchen",
    generation: true,
    input: adjustRecipeInput,
    annotations: { readOnlyHint: true },
    strict: false,
    async run(ctx, input) {
      const { millisecondsLeft, within } = deadlineOf(limits.totalMilliseconds);

      try {
        const [recipe, { profile, preferences }] = await within(
          Promise.all([getRecipe(ctx.caller, input.recipe_id), readPalate(ctx)]),
        );
        if (recipe === null) {
          return refuse("recipe_not_found");
        }
        const adjustment = {
          recipe: {
            id: recipe.id,
            name: recipe.name,
            servings: recipe.servings,
            steps: recipe.instructions,
            ingredients: recipe.ingredients,
          },
          preferences,
        };
        const now = computeRecipe({
          servings: recipe.servings,
          yieldGrams: null,
          ingredients: recipe.ingredients,
        }).perServing;
        let target;
        try {
          target = adjustmentTarget(now, {
            nutrient: input.nutrient,
            mode: input.mode,
            value: input.value,
          });
        } catch (caught) {
          // The recipe has no figure for that nutrient. The message holds no figure.
          if (caught instanceof RangeError) {
            return refuse("no_figure_for_that_nutrient");
          }
          throw caught;
        }

        const scaled = buildAdjustmentDraft({
          ...adjustment,
          target,
          additions: [],
        });
        let outcome: AdjustmentOutcome = scaled;
        let tried: string[] = [];
        let chooserUnavailable = false;
        if (scaled.status === "unreachable") {
          // Scaling cannot reach it, so one Opus call may add foods of the person's own.
          const cache = new Map<string, Promise<FoodAndPortions | null>>();
          const read = await within(
            Promise.all(
              profile.usualFoods.map(({ foodId }) => readFoodAndPortions(ctx, foodId, cache)),
            ),
          );
          const candidates = adjustmentCandidatesOf({
            foods: read.filter((found): found is FoodAndPortions => found !== null),
            recipe: adjustment.recipe,
            preferences,
          });
          if (candidates.length > 0) {
            const { generation } = ctx;
            if (generation === undefined) {
              throw new Error("The recipe generation is not configured");
            }
            const { system, userContent } = adjustRequestOf(
              {
                recipeName: recipe.name,
                ingredients: recipe.ingredients.map(({ snapshot }) => snapshot.name),
                target,
                now: scaled.reached,
                words: input.words === undefined || input.words === "" ? null : input.words,
                candidates: candidates.map(({ food, per100 }) => ({
                  name: food.name,
                  per100,
                })),
              },
              ctx.userId,
            );
            const generated = await within(
              generation.generate({
                route: "recipe_generate",
                userId: ctx.userId,
                turnId: ctx.turn.id,
                system,
                userContent,
                format: substitutionSchema,
                read: (reply) =>
                  readSubstitution(reply, {
                    candidateCount: candidates.length,
                  }),
                timeoutMilliseconds: Math.max(
                  1,
                  Math.min(limits.generationMilliseconds, millisecondsLeft()),
                ),
              }),
            );
            if (!generated.ok && generated.code === "generation_timeout") {
              return refuse(generated.code);
            }
            // A refused or failed choice leaves what scaling reached, which the model can still report.
            chooserUnavailable = !generated.ok;
            const additions = (generated.ok ? generated.value.positions : []).flatMap(
              (position) => {
                const candidate = candidates[position];
                return candidate === undefined ? [] : [candidate];
              },
            );
            tried = additions.map(({ food }) => food.name);
            if (additions.length > 0) {
              outcome = buildAdjustmentDraft({
                ...adjustment,
                target,
                additions,
              });
            }
          }
        }

        if (outcome.status === "mentions_avoided") {
          return refuse("recipe_mentions_avoided");
        }
        if (outcome.status === "has_avoided_ingredient") {
          return refuse("recipe_has_avoided_ingredient", { foods: outcome.foods });
        }
        if (outcome.status === "unreachable") {
          return refuse("could_not_reach_target", {
            misses: missesOf(outcome.misses),
            tried_foods: tried,
            ...(chooserUnavailable ? { chooser: "unavailable" } : {}),
          });
        }
        // The model is never told a recipe was adjusted without a card the app can draw. The turn loop checks the
        // same schema again.
        const drawable = assistantRecipeDraftSchema.safeParse(outcome.draft);
        if (!drawable.success || drawable.data.variant !== "adjustment") {
          return refuse("generation_failed");
        }
        return {
          data: { recipe: adjustmentSummaryOf(drawable.data) },
          structured: { recipeDraft: drawable.data },
        };
      } catch (caught) {
        if (caught instanceof BudgetExceeded) {
          return refuse("timed_out");
        }
        throw caught;
      }
    },
  };
}

export const adjustRecipeTool = createAdjustRecipeTool(defaultAdjustLimits);
