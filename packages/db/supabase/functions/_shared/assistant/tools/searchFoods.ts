// The assistant's food search, over the same RPC the app searches with. It answers the model only:
// nothing here is drawn in the app.
import { z } from "zod";

import { listFoodPortions, searchFoods } from "../../repos.ts";
import { foodView } from "./foodView.ts";
import {
  dataNotice,
  estimatedNotice,
  resultLimitSchema,
  searchTextSchema,
  unknownNotice,
} from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

// Each portion list is one read, so only the best matches get theirs. The model asks `get_food` for
// the portions of a lower result.
const resultsWithPortions = 5;

const searchFoodsInput = z.strictObject({ q: searchTextSchema, limit: resultLimitSchema });

export const searchFoodsTool: ReadToolDefinition<z.infer<typeof searchFoodsInput>> = {
  name: "search_foods",
  description:
    "Searches the foods the user can log, best match first. Each result has its id, name, brand, " +
    "source, basis (per 100 g or per 100 ml), kcal, protein, fat, carbs and fibre per 100, and the " +
    `portions of the first ${resultsWithPortions} results, each with its id for logging, its label ` +
    "and its grams or ml. For portions, [] means the food has no portions, so ask the user for " +
    "grams, and null means not looked up, so call get_food. " +
    `${estimatedNotice} ` +
    `${unknownNotice} ${dataNotice}`,
  kind: "read",
  input: searchFoodsInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { q, limit }) {
    const hits = await searchFoods(ctx.caller, q, limit);
    const portions = await Promise.all(
      hits.slice(0, resultsWithPortions).map((hit) => listFoodPortions(ctx.caller, hit.id)),
    );
    return { data: { foods: hits.map((hit, index) => foodView(hit, portions[index] ?? null)) } };
  },
};
