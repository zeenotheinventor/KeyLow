import type { RecipeSummary } from "@keylow/api-client";

/** What a recipe's row menu and its restore button do. Each acts at once, with no confirmation. */
export type RecipeActions = {
  /** Saves a copy named "<name> (copy)", then "(copy 2)" and so on. The toast's Undo archives the copy. */
  duplicate: (recipe: RecipeSummary) => void;
  /** Takes the recipe out of the library at once. The toast's Undo brings it back. */
  archive: (recipe: RecipeSummary) => void;
  /** Brings an archived recipe back into the library at once. */
  restore: (recipe: RecipeSummary) => void;
};
