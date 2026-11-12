// The assistant's food search, over the same RPC the app searches with. It answers the model only:
// nothing here is drawn in the app.
import { z } from "zod";

import { hasStrongFoodMatch } from "../../core.ts";
import { listFoodPortions, searchFoods } from "../../repos.ts";
import { foodView, liveView } from "./foodView.ts";
import {
  dataNotice,
  estimatedNotice,
  resultLimitSchema,
  searchTextSchema,
  unknownNotice,
} from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";
import type { JsonValue } from "../untrusted.ts";

// Each portion list is one read, so only the best matches get theirs. The model asks `get_food` for
// the portions of a lower result.
const resultsWithPortions = 5;

// The most live candidates passed on. Each is a product the model may read with `get_food`.
const maxLiveCandidates = 5;

const liveUnavailableNotice =
  "Open Food Facts could not be searched just now, so only the catalogue is shown.";

const searchFoodsInput = z.strictObject({ q: searchTextSchema, limit: resultLimitSchema });

export const searchFoodsTool: ReadToolDefinition<z.infer<typeof searchFoodsInput>> = {
  name: "search_foods",
  description:
    "Searches the foods the user can log, best match first. Each result has its id, name, brand, " +
    "source, basis (per 100 g or per 100 ml), kcal, protein, fat, carbs and fibre per 100, and the " +
    `portions of the first ${resultsWithPortions} results, each with its id for logging, its label ` +
    "and its grams or ml. For portions, [] means the food has no portions, so ask the user for " +
    "grams, and null means not looked up, so call get_food. " +
    "When no catalogue food holds every word searched, live lists up to 5 Open Food Facts products " +
    "with an off_code, name, brand, basis, kcal and macros per 100 and no id and no portions. " +
    "Read one with get_food by off_code before logging it. A live of null means they could not be reached. " +
    `${estimatedNotice} ` +
    `${unknownNotice} ${dataNotice}`,
  kind: "read",
  input: searchFoodsInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { q, limit }) {
    const hits = await searchFoods(ctx.caller, q, limit);
    // The live search is for a catalogue answer that names the dish in none of its foods, so a search the
    // catalogue answers costs nothing new. It runs beside the portion reads.
    const needsLive =
      ctx.offLookup !== undefined &&
      !hasStrongFoodMatch(
        q,
        hits.map((hit) => hit.name),
      );
    const [portions, live] = await Promise.all([
      Promise.all(
        hits.slice(0, resultsWithPortions).map((hit) => listFoodPortions(ctx.caller, hit.id)),
      ),
      needsLive ? ctx.offLookup?.search(q) : undefined,
    ]);
    const data: { [key: string]: JsonValue } = {
      foods: hits.map((hit, index) => foodView(hit, portions[index] ?? null)),
    };
    if (live?.status === "ok") {
      data["live"] = live.candidates.slice(0, maxLiveCandidates).map(liveView);
    } else if (live !== undefined) {
      data["live"] = null;
      data["live_notice"] = liveUnavailableNotice;
    }
    return { data };
  },
};
