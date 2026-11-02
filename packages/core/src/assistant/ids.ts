import { z } from "zod";

// z.guid() rather than z.uuid(): seed and fixture ids are fixed literals that are not RFC 4122
// variants, as for foods and recipes (`schemas/food.ts`, `recipes/isRecipeId.ts`).
export const assistantIdSchema = z.guid();
