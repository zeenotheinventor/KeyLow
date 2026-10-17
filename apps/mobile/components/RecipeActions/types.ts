import type { RecipeSummary } from "@keylow/api-client";

/** The part of a recipe the actions need, so a screen that has read a whole recipe can pass it as it is. */
export type ActedOnRecipe = Pick<RecipeSummary, "id" | "name">;

/** What a screen does once a Duplicate has gone through, beyond the toast the actions show. */
export type DuplicateFollowUp = {
  /** Called when the copy has been saved, before the toast. */
  onSaved?: ((copy: RecipeSummary) => void) | undefined;
  /** Called when the toast's Undo has archived the copy. It is not called when that fails. */
  onUndone?: ((copy: RecipeSummary) => void) | undefined;
};

/** What a screen does once an Archive has gone through, beyond the toast the actions show. */
export type ArchiveFollowUp = {
  /** Called when the recipe has been archived, before the toast. It is not called when that fails. */
  onArchived?: (() => void) | undefined;
};

/** What a recipe's row menu and its restore button do. Each acts at once, with no confirmation. */
export type RecipeActions = {
  /** Saves a copy named "<name> (copy)", then "(copy 2)" and so on. The toast's Undo archives the copy. */
  duplicate: (recipe: ActedOnRecipe, followUp?: DuplicateFollowUp) => void;
  /** Takes the recipe out of the library at once. The toast's Undo brings it back. */
  archive: (recipe: ActedOnRecipe, followUp?: ArchiveFollowUp) => void;
  /** Brings an archived recipe back into the library at once. */
  restore: (recipe: ActedOnRecipe) => void;
};
