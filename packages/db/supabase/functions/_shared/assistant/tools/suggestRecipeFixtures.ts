// The foods, palate, search and services the suggest_recipe tool's tests share. Nothing in production imports this.
import { importContext, importFoodIds, importServices } from "./importFixtures.ts";

import type { GenerationOutcome, GenerationRequest, GenerationServices } from "../generate.ts";
import type { RecipeSuggestion } from "../../core.ts";
import type { FoodPickLine, FoodPickOutcome } from "../recipeParse.ts";
import type { ToolContext, ToolDefinition } from "../tool.ts";
import type { SearchScript } from "./importFixtures.ts";

export const foodIds = importFoodIds;

// Per 100 g: chicken thigh 173 kcal and 19.3 g protein, new potatoes 80 and 1.6, olive oil 899 and 0.
export const dinnerSuggestion: RecipeSuggestion = {
  name: "Lemon chicken traybake",
  servings: 2,
  ingredients: [
    { name: "chicken thigh", grams: 450 },
    { name: "new potatoes", grams: 400 },
    { name: "olive oil", grams: 15 },
  ],
  steps: ["Heat the oven to 200C.", "Roast everything for 40 minutes."],
};

// The words the tool searches for each ingredient name (the phrase, then the head word, then the first word).
export const suggestionSearch: SearchScript = {
  "chicken thigh": [{ foodId: foodIds.chicken, score: 2 }],
  "new potatoes": [{ foodId: foodIds.potatoes, score: 2 }],
  "olive oil": [{ foodId: foodIds.oil, score: 2 }],
  milk: [{ foodId: foodIds.milk, score: 2 }],
  "dairy drink": [{ foodId: foodIds.milk, score: 1 }],
  "chicken broth": [{ foodId: foodIds.broth, score: 2 }],
  "stock cube": [{ foodId: foodIds.stock, score: 1 }],
};

export type GenerationCalls = GenerationRequest<unknown>[];

// The Opus call, answered from a script: a reply that goes through the request's own reader, as the real call does,
// or a failure. A record of what it was asked.
export function fakeGeneration(
  answer: { reply: unknown } | { failure: GenerationOutcome<never> },
): { services: GenerationServices; calls: GenerationCalls } {
  const calls: GenerationCalls = [];
  return {
    calls,
    services: {
      generate<Value>(request: GenerationRequest<Value>): Promise<GenerationOutcome<Value>> {
        calls.push(request);
        if ("failure" in answer) {
          return Promise.resolve(answer.failure);
        }
        const value = request.read(answer.reply);
        return Promise.resolve(
          value === null
            ? { ok: false, code: "generation_failed" }
            : { ok: true, value, model: "claude-opus-5-5" },
        );
      },
    },
  };
}

export const failedGeneration = (
  code: "generation_refused" | "generation_timeout" | "generation_failed",
) => ({ failure: { ok: false, code } }) as const;

let preferenceNumber = 0;
export const preferenceRow = (
  kind: "allergy" | "dislike",
  fields: { label?: string; foodId?: string },
) => {
  preferenceNumber += 1;
  return {
    id: `00000000-0000-4000-8000-0000000b${String(preferenceNumber).padStart(4, "0")}`,
    kind,
    food_id: fields.foodId ?? null,
    recipe_id: null,
    label: fields.label ?? null,
    created_at: "2026-11-01T10:00:00+00:00",
  };
};

// Chicken is eaten on 8 of 10 logged days, so it is a usual food.
const usualChickenRows = {
  palate_logged_days: [{ logged_days: 10 }],
  palate_food_stats: [
    {
      food_id: foodIds.chicken,
      recipe_id: null,
      entry_count: 8,
      distinct_days: 8,
      first_local_date: "2026-10-01",
      last_local_date: "2026-11-02",
      median_resolved_grams: 150,
      before_eleven_count: 0,
      eleven_to_sixteen_count: 0,
      sixteen_or_later_count: 8,
    },
  ],
};

export type SuggestContextOptions = {
  generation?: GenerationServices | null;
  pick?:
    | FoodPickOutcome
    | ((lines: readonly FoodPickLine[]) => FoodPickOutcome | Promise<FoodPickOutcome>);
  search?: SearchScript;
  preferences?: Record<string, unknown>[];
  withoutPickServices?: true;
};

export function suggestContext(
  tools: readonly ToolDefinition[],
  options: SuggestContextOptions = {},
) {
  const imported = importServices({
    ...(options.pick === undefined ? {} : { pick: options.pick }),
  });
  const made = importContext(tools, {
    ...(options.withoutPickServices === true ? {} : { services: imported.services }),
    search: options.search ?? suggestionSearch,
    rows: { ...usualChickenRows, palate_preferences: options.preferences ?? [] },
  });
  const ctx: ToolContext = {
    ...made.ctx,
    ...(options.generation === null || options.generation === undefined
      ? {}
      : { generation: options.generation }),
  };
  return { ...made, ctx, picks: imported.calls.picked };
}
