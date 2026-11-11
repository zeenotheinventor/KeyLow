// One food, with its portions, by its id (from `search_foods` or an earlier answer) or by the `off_code` of a live
// Open Food Facts result, which `off-product` stores first and so turns into a food with an id (ADR 0006,
// Amendment 3). Exactly one of `id` and `off_code` is given, and the schema enforces it here, because a strict JSON
// Schema cannot.
import { z } from "zod";

import { getFood, listFoodPortions } from "../../repos.ts";
import { foodView } from "./foodView.ts";
import { dataNotice, estimatedNotice, unknownNotice } from "./shared.ts";

import type { ReadToolDefinition, ToolContext, ToolRunOutput } from "../tool.ts";

const getFoodInput = z
  .strictObject({
    id: z.guid().optional().describe("The id of a food."),
    off_code: z
      .string()
      .regex(/^[0-9]{8,14}$/)
      .optional()
      .describe(
        "The off_code of a live result, 8 to 14 digits. Give exactly one of id and off_code.",
      ),
  })
  .refine(({ id, off_code }) => (id === undefined) !== (off_code === undefined), {
    message: "Give exactly one of id and off_code.",
    path: ["off_code"],
  });

export const getFoodTool: ReadToolDefinition<z.infer<typeof getFoodInput>> = {
  name: "get_food",
  description:
    "Gets one food by id: its name, brand, source, basis (per 100 g or per 100 ml), kcal, protein, " +
    "fat, carbs and fibre per 100, and all of its portions, each with its id for logging, its label " +
    "and its grams or ml. An empty portions list means the food has none, so ask the user for grams. " +
    `${estimatedNotice} ` +
    "Answers error not_found for a food that does not exist, was deleted, or is not the user's to " +
    "see. With an off_code and no id it stores that live product and answers it as a food with its " +
    "own id, or error unavailable when it could not be looked up. " +
    `${unknownNotice} ${dataNotice}`,
  kind: "read",
  input: getFoodInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { id, off_code }) {
    if (off_code !== undefined) {
      return await readLiveProduct(ctx, off_code);
    }
    // The input check allows no call with neither, so this is not reached.
    if (id === undefined) {
      return { data: { error: "not_found" } };
    }
    const food = await getFood(ctx.caller, id);
    // The repo returns a deleted food, because a diary entry must keep resolving it. A deleted food
    // is not something to log, so to the model it does not exist.
    if (food === null || food.deleted_at !== null) {
      return { data: { error: "not_found" } };
    }
    return { data: foodView(food, await listFoodPortions(ctx.caller, id)) };
  },
};

async function readLiveProduct(ctx: ToolContext, code: string): Promise<ToolRunOutput> {
  const product = (await ctx.offLookup?.product(code)) ?? { status: "unavailable" };
  switch (product.status) {
    case "ok":
      return { data: foodView(product.food, product.portions) };
    case "not_found":
      return { data: { error: "not_found" } };
    default:
      return { data: { error: "unavailable" } };
  }
}
