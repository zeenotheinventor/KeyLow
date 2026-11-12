// Saves a food the person read off a label as one of their own foods, with one natural portion when the
// label is per bar, slice or cup: "My protein bar, 210 kcal, 20 g protein, 19 g carbs, 6 g fat per bar".
// Nothing is logged, because the person has not said when they had it. Undo removes the food from their
// foods and leaves any diary entry logged from it alone, because an entry keeps its own snapshot.
import { z } from "zod";

import {
  buildFoodCreatedCard,
  isGeneratedEstimate,
  labelFoodInput,
  roundCalories,
} from "../../core.ts";
import { createFood, getFood, softDeleteFood } from "../../repos.ts";

import type { WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const gramsOfLabel = z.number().min(0).max(1000);

const createCustomFoodInput = z.strictObject({
  name: z.string().trim().min(1).max(200).describe("The food's name, as the user said it."),
  brand: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .nullable()
    .describe("The brand, only when the user gave one. Otherwise null."),
  per: z
    .enum(["per_portion", "per_100g"])
    .describe(
      "per_portion when the label's figures are for one bar, slice or cup, per_100g when they are for 100 g.",
    ),
  portion_label: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .nullable()
    .describe(
      "The portion in the user's words with its count, such as 1 bar. Only for per_portion. Otherwise null.",
    ),
  portion_grams: z
    .number()
    .positive()
    .max(5000)
    .nullable()
    .describe(
      "What that portion weighs in grams. Only for per_portion. Otherwise null. If the user did not say, ask with ask_user.",
    ),
  kcal: z
    .number()
    .min(0)
    .max(5000)
    .describe("The label's energy in kcal, for the portion or the 100 g."),
  protein_g: gramsOfLabel.describe("The label's protein in grams."),
  carbs_g: gramsOfLabel.describe("The label's carbs in grams."),
  fat_g: gramsOfLabel.describe("The label's fat in grams."),
});

type CreateCustomFoodInput = z.infer<typeof createCustomFoodInput>;

export const createCustomFoodTool: WriteToolDefinition<CreateCustomFoodInput> = {
  name: "create_custom_food",
  description:
    "Saves a food that is not in the database as one of the user's own foods, with Undo and a link to the " +
    "food. Search first with search_foods and use this only when the food is not there. For a label per " +
    "bar, slice or cup use per portion with the portion's label such as 1 bar and its weight in grams, and " +
    "the figures as printed for that one portion. For a label per 100 g use per_100g and leave the portion " +
    "fields null. Use the user's numbers as given, never your own. The call refuses a label whose kcal is " +
    "more than 15 percent away from 4 per gram of protein and carbs and 9 per gram of fat, and answers " +
    "with the kcal the macros make: ask the user which number is right instead of saving either. It does " +
    "not log the food, so tell the user it is saved and offer to log it. To log it, take the portion id " +
    "from the answer.",
  kind: "write",
  input: createCustomFoodInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  // Eleven parameters, three of them nullable, would use more of the strict budget than the tools after it.
  strict: false,
  targetTable: "foods",
  async run(ctx, input): Promise<WriteRunOutput> {
    const label = labelFoodInput(input);
    if (!label.ok) {
      return {
        data: {
          error: "invalid_input",
          fields: label.fields,
          ...(label.macroKcal === null ? {} : { macro_kcal: roundCalories(label.macroKcal) }),
        },
        target: null,
      };
    }

    let created;
    try {
      created = await createFood(ctx.caller, ctx.userId, label.food);
    } catch {
      // The food and its portions are written in one transaction, so a failure leaves nothing to clean up, and
      // the model may try again. The repo's message can quote the row, so it is not passed on.
      throw new Error("create_custom_food could not save the food");
    }

    // The write has landed. Nothing below may throw, or the model would save the food a second time.
    // The estimate the app generated is not a portion the person gave, so the model is not handed its id to
    // log. A portion the person gave stays, even one they worded like an estimate.
    const [portion] = isGeneratedEstimate(created.food, created.portions) ? [] : created.portions;
    return {
      data: {
        created: {
          id: created.food.id,
          name: created.food.name,
          portion_id: portion?.id ?? null,
          per_100g: {
            kcal: created.food.kcal,
            protein_g: created.food.protein_g,
            carbs_g: created.food.carbs_g,
            fat_g: created.food.fat_g,
          },
        },
        logged: false,
      },
      structured: {
        card: buildFoodCreatedCard({
          id: created.food.id,
          name: created.food.name,
          portionLabel: input.per === "per_portion" ? input.portion_label : null,
          kcal: input.kcal,
          protein_g: input.protein_g,
          carbs_g: input.carbs_g,
          fat_g: input.fat_g,
        }),
      },
      target: { targetId: created.food.id },
    };
  },
  // Hides the food, unless the person has deleted it already. `foods` has no change time to compare, so an
  // edit made since is not noticed, and hiding the food loses nothing: its entries keep their snapshots.
  async inverse(ctx, action) {
    const { targetId } = action;
    const food = targetId === null ? null : await getFood(ctx.caller, targetId);
    if (
      targetId === null ||
      food === null ||
      food.owner_id !== ctx.userId ||
      food.deleted_at !== null
    ) {
      return "unavailable";
    }
    await softDeleteFood(ctx.caller, targetId);
    return "undone";
  },
};
