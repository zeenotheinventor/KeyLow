// One food by id, with its portions. The id comes from `search_foods` or from an earlier answer.
import { z } from "zod";

import { getFood, listFoodPortions } from "../../repos.ts";
import { foodView } from "./foodView.ts";
import { dataNotice, estimatedNotice, unknownNotice } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getFoodInput = z.strictObject({ id: z.guid().describe("The id of a food.") });

export const getFoodTool: ReadToolDefinition<z.infer<typeof getFoodInput>> = {
  name: "get_food",
  description:
    "Gets one food by id: its name, brand, source, basis (per 100 g or per 100 ml), kcal, protein, " +
    "fat, carbs and fibre per 100, and all of its portions, each with its id for logging, its label " +
    "and its grams or ml. An empty portions list means the food has none, so ask the user for grams. " +
    `${estimatedNotice} ` +
    "Answers error not_found for a food that does not exist, was deleted, or is not the user's to " +
    `see. ${unknownNotice} ${dataNotice}`,
  kind: "read",
  input: getFoodInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { id }) {
    const food = await getFood(ctx.caller, id);
    // The repo returns a deleted food, because a diary entry must keep resolving it. A deleted food
    // is not something to log, so to the model it does not exist.
    if (food === null || food.deleted_at !== null) {
      return { data: { error: "not_found" } };
    }
    return { data: foodView(food, await listFoodPortions(ctx.caller, id)) };
  },
};
