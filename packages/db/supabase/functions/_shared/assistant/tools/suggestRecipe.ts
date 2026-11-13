// "Suggest a dinner around 650 kcal with 45 g protein" (ADR 0006, Amendment 6). Opus proposes a name, the servings,
// ingredient names with grams and the steps. The tool finds a real food for each ingredient exactly as
// `import_recipe_from_url` does (the food search, then a tool-less pick by position), and core drops what the person
// avoids, fits the amounts to the figures and works out every number (`buildSuggestionDraft`). The model gets a
// short summary. The app draws the whole draft from `structured`, which the model never sees, and nothing is
// saved until the person presses Save to recipes.
//
// Things to know when changing this file:
// - It makes one Opus call (the loop gives a generation tool 55 s, never repeats it and allows one a turn). One
//   deadline of `totalMilliseconds` runs from the start of the tool and covers the palate read, the Opus call, its
//   usage row and the matching, so the tool ends inside the 55 s. A step that runs past it ends the tool with
//   `timed_out`, and the Opus call's own cap sits inside it.
// - An ingredient that names a food the person avoids is not searched for, and an avoided food is taken out of the
//   candidates before the pick, so a safe candidate is never lost to it. Core drops what remains, and refuses a
//   recipe whose name or steps mention an avoided food.
// - The prompt carries food names, and never says why a food is avoided. Nothing here logs a word, a name or a
//   figure of the person's.
import { z } from "zod";

import {
  avoidsFood,
  buildSuggestionDraft,
  importCandidate,
  readRecipeSuggestion,
  assistantRecipeDraftSchema,
  recipeDraftSummaryOf,
  recipeSuggestionSchema,
  summaryLines,
} from "../../core.ts";
import { GENERATION_TIMEOUT_MILLISECONDS } from "../generate.ts";
import { recipeRequestOf } from "../kitchenPrompts.ts";
import { picksFitLines } from "../recipeParse.ts";
import {
  candidatesOfWords,
  readFoodAndPortions,
  SEARCH_TEXT_MAX_CHARACTERS,
} from "./foodMatching.ts";
import { readPalate } from "./readPalate.ts";
import { dataNotice } from "./shared.ts";

import type { PalatePreference, SuggestionLine } from "../../core.ts";
import type { FoodPickLine, RecipeImportServices } from "../recipeParse.ts";
import type { FoodAndPortions } from "./foodMatching.ts";
import type { ReadToolDefinition, ToolContext } from "../tool.ts";

const suggestRecipeInput = z.strictObject({
  kcal: z.number().positive().max(5000).describe("The calories wanted in one serving."),
  protein_g: z.number().min(0).max(500).describe("The grams of protein wanted in one serving."),
  carbs_g: z
    .number()
    .min(0)
    .max(1000)
    .optional()
    .describe("Grams of carbs in a serving, only if the person named it."),
  fat_g: z
    .number()
    .min(0)
    .max(500)
    .optional()
    .describe("Grams of fat in a serving, only if the person named it."),
  words: z
    .string()
    .trim()
    .max(300)
    .optional()
    .describe(
      "What else the person asked for, in their own words, such as 'a quick chicken dinner'.",
    ),
});

type SuggestRecipeInput = z.infer<typeof suggestRecipeInput>;

export type SuggestLimits = {
  /** The one deadline, counted from the start of the tool: the palate read, the Opus call and the matching. */
  totalMilliseconds: number;
  /** The most the Opus call may take, inside the deadline. */
  generationMilliseconds: number;
  /** The most the call that chooses each line's food may take. */
  pickMilliseconds: number;
};

export const defaultSuggestLimits: SuggestLimits = {
  totalMilliseconds: 50_000,
  generationMilliseconds: GENERATION_TIMEOUT_MILLISECONDS,
  pickMilliseconds: 4_000,
};

// The ingredient's own words, cut for the pick call.
const PICK_LINE_MAX_CHARACTERS = 300;

class BudgetExceeded extends Error {}

const refuse = (error: string, extra: Record<string, string[]> = {}) => ({
  data: { error, ...extra },
});

// The food chosen for each ingredient, or null for one with no food. Only a line with candidates is offered to the
// model, so with none there is no call. A reply the pick call did not keep to the offered lists is not trusted.
type Foods = { ok: true; foods: (FoodAndPortions | null)[] } | { ok: false };

async function foodsOf(
  ctx: ToolContext,
  services: RecipeImportServices,
  preferences: readonly PalatePreference[],
  names: readonly (string | null)[],
  grams: readonly number[],
  within: <T>(work: Promise<T>) => Promise<T>,
  pickMilliseconds: () => number,
): Promise<Foods> {
  const candidates = await within(candidatesOfWords(ctx, names));
  const offered = names.flatMap((name, index) => {
    // A food the person avoids is not offered, so the pick can choose a safe one instead of losing the line.
    const found = (candidates[index] ?? []).filter((food) => !avoidsFood(food, preferences).avoid);
    return name === null || found.length === 0 ? [] : [{ index, name, found }];
  });
  if (offered.length === 0) {
    return { ok: true, foods: names.map(() => null) };
  }
  const pickLines: FoodPickLine[] = offered.map(({ index, name, found }) => ({
    line: `${grams[index] ?? 0} g ${name}`.slice(0, PICK_LINE_MAX_CHARACTERS),
    foodWord: name.slice(0, SEARCH_TEXT_MAX_CHARACTERS),
    candidates: found.map(importCandidate),
  }));
  const picked = await within(
    services.pickFoods(pickLines, {
      userId: ctx.userId,
      turnId: ctx.turn.id,
      timeoutMilliseconds: pickMilliseconds(),
    }),
  );
  if (!picked.ok || !picksFitLines(pickLines, picked.picks)) {
    return { ok: false };
  }
  const chosen: (string | null)[] = names.map(() => null);
  offered.forEach(({ index, found }, offeredIndex) => {
    const position = picked.picks[offeredIndex]?.position ?? null;
    chosen[index] = position === null ? null : (found[position]?.id ?? null);
  });
  const cache = new Map<string, Promise<FoodAndPortions | null>>();
  return {
    ok: true,
    foods: await within(
      Promise.all(
        chosen.map((foodId) => (foodId === null ? null : readFoodAndPortions(ctx, foodId, cache))),
      ),
    ),
  };
}

export function createSuggestRecipeTool(
  limits: SuggestLimits,
): ReadToolDefinition<SuggestRecipeInput> {
  return {
    name: "suggest_recipe",
    description:
      "Writes a new recipe from the person's words and what they usually eat, and shows it as a card they " +
      "can save. Pass the figures they asked for in one serving: kcal and protein_g, plus carbs_g or fat_g " +
      "only if named, and words for anything else. If they gave no kcal and protein, ask with ask_user and " +
      "never choose figures. Ki-Lo works out every amount and figure from real foods, and the card shows " +
      "the recipe, so do not list it. The answer holds name, servings, per_serving, fit (within, or " +
      "unreachable with misses), not_matched and left_out_avoided. If it is generation_refused, " +
      "generation_failed, say the recipe could not be written. If it is recipe_mentions_avoided, say it " +
      "could not be written without a food they avoid. If it is generation_timeout, timed_out or could_not_match_foods, say it took too long. If it is " +
      "nothing_matched, say no foods matched, and why from left_out_avoided. Nothing is saved. " +
      dataNotice,
    kind: "read",
    group: "kitchen",
    generation: true,
    input: suggestRecipeInput,
    annotations: { readOnlyHint: true },
    strict: false,
    async run(ctx, input) {
      const { generation, recipeImport } = ctx;
      if (generation === undefined || recipeImport === undefined) {
        throw new Error("The recipe generation is not configured");
      }
      const startedAt = performance.now();
      const millisecondsLeft = () => limits.totalMilliseconds - (performance.now() - startedAt);
      // Races a step against the deadline, so a slow step ends the tool and not the turn.
      const within = <T>(work: Promise<T>): Promise<T> => {
        // The step may still end after the deadline. Its failure then has nobody to tell.
        work.catch(() => {});
        let timer: ReturnType<typeof setTimeout> | undefined;
        const cutoff = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new BudgetExceeded()), Math.max(0, millisecondsLeft()));
        });
        return Promise.race([work, cutoff]).finally(() => clearTimeout(timer));
      };

      try {
        const { profile, preferences } = await within(readPalate(ctx));
        const { system, userContent } = recipeRequestOf(
          {
            target: {
              kcal: input.kcal,
              protein_g: input.protein_g,
              carbs_g: input.carbs_g ?? null,
              fat_g: input.fat_g ?? null,
            },
            words: input.words === undefined || input.words === "" ? null : input.words,
            // The avoid line says why, so it is left to `avoid` below, which names the foods only.
            palateSummary: summaryLines({ ...profile, avoid: [] }),
            usualFoods: [...new Set(profile.usualFoods.map(({ shortName }) => shortName))],
            avoidedFoods: profile.avoid.map(({ label }) => label),
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
            format: recipeSuggestionSchema,
            read: readRecipeSuggestion,
            timeoutMilliseconds: Math.max(
              1,
              Math.min(limits.generationMilliseconds, millisecondsLeft()),
            ),
          }),
        );
        if (!generated.ok) {
          return refuse(generated.code);
        }
        const suggestion = generated.value;

        // An ingredient that names an avoided food is not searched for: core drops it.
        const names = suggestion.ingredients.map(({ name }) =>
          avoidsFood({ name }, preferences).avoid ? null : name,
        );
        const found = await foodsOf(
          ctx,
          recipeImport,
          preferences,
          names,
          suggestion.ingredients.map(({ grams }) => grams),
          within,
          () => Math.max(1, Math.min(limits.pickMilliseconds, millisecondsLeft())),
        );
        if (!found.ok) {
          return refuse("could_not_match_foods");
        }
        const lines = suggestion.ingredients.map(({ name, grams }, index): SuggestionLine => ({
          name,
          grams,
          food: found.foods[index]?.food ?? null,
          portions: found.foods[index]?.portions ?? [],
        }));
        const outcome = buildSuggestionDraft({
          name: suggestion.name,
          servings: suggestion.servings,
          steps: suggestion.steps,
          lines,
          target: {
            kcal: input.kcal,
            protein_g: input.protein_g,
            ...(input.carbs_g === undefined ? {} : { carbs_g: input.carbs_g }),
            ...(input.fat_g === undefined ? {} : { fat_g: input.fat_g }),
          },
          preferences,
        });
        if (outcome.status === "mentions_avoided") {
          return refuse("recipe_mentions_avoided");
        }
        if (outcome.status === "nothing_matched") {
          return refuse("nothing_matched", { left_out_avoided: outcome.leftOutAvoided });
        }
        // The model is never told a recipe was drafted without a card the app can draw. The turn loop checks the
        // same schema again.
        const drawable = assistantRecipeDraftSchema.safeParse(outcome.draft);
        if (!drawable.success) {
          return refuse("generation_failed");
        }
        return {
          data: { recipe: recipeDraftSummaryOf(drawable.data) },
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

export const suggestRecipeTool = createSuggestRecipeTool(defaultSuggestLimits);
