import { z } from "zod";

const recipeIdSchema = z.guid();

/** Whether `value` has the shape of a recipe id, so a link that cannot be one is not looked up. */
export const isRecipeId = (value: string): boolean => recipeIdSchema.safeParse(value).success;
