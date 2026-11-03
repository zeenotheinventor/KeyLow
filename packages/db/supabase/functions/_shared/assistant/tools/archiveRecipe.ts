// Archives a recipe on the user's word: it leaves the recipe list, and the diary entries logged from it
// stay. The recipe is kept, so Undo can bring it back. The call always asks first when there is a recipe to
// archive, and the question and the buttons are the board's (Amendment 1 A).
import { z } from "zod";

import { buildRecipeArchivedCard } from "../../core.ts";
import { getRecipe, setRecipeArchived } from "../../repos.ts";
import { notFound } from "./entryWrite.ts";

import type { WriteToolDefinition } from "../tool.ts";

const archiveRecipeInput = z.strictObject({
  id: z.guid().describe("The id of the recipe, from get_recipes."),
});

type ArchiveRecipeInput = z.infer<typeof archiveRecipeInput>;

export const archiveRecipeTool: WriteToolDefinition<ArchiveRecipeInput> = {
  name: "archive_recipe",
  description:
    "Archives one of the user's recipes, with Undo. Take the id from get_recipes, never from memory. The " +
    "call first answers needs_confirmation with a confirmation_id: ask the user in your own words, naming " +
    "the recipe, that it leaves their recipe list and that entries already logged from it stay in their " +
    "diary, and when they say yes call again with the same id and that confirmation_id. A recipe that is " +
    "not the user's is reported as not found.",
  kind: "write",
  input: archiveRecipeInput,
  annotations: { readOnlyHint: false, destructiveHint: true },
  targetTable: "recipes",
  // Asks only about a recipe that is there to archive: a recipe the user cannot see is answered `not_found`
  // by `run` without a question or a button for something that cannot happen.
  async needsConfirmation({ id }, ctx) {
    return (await getRecipe(ctx.caller, id)) !== null;
  },
  async run(ctx, { id }) {
    const recipe = await getRecipe(ctx.caller, id);
    if (recipe === null) {
      return notFound;
    }
    if (recipe.is_archived) {
      return { data: { id, archived: true, changed: false }, target: null };
    }
    await setRecipeArchived(ctx.caller, id, true);
    return {
      data: { id, archived: true, changed: true },
      structured: { card: buildRecipeArchivedCard({ name: recipe.name }) },
      target: { targetId: id },
    };
  },
  // Brings the recipe back, unless the person has restored or deleted it since. `recipes` has no change
  // time to compare, so an edit made since is not noticed, and restoring loses nothing.
  async inverse(ctx, action) {
    const { targetId } = action;
    const recipe = targetId === null ? null : await getRecipe(ctx.caller, targetId);
    if (targetId === null || recipe === null || !recipe.is_archived) {
      return "unavailable";
    }
    await setRecipeArchived(ctx.caller, targetId, false);
    return "undone";
  },
};
