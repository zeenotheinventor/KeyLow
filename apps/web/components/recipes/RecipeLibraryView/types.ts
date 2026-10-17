import type { RecipeSummary } from "@keylow/api-client";

/**
 * What the library shows: the rows while they load, a failed load with its way to try again, or the
 * user's live recipes, which may be none, with what its row buttons do.
 */
export type RecipeLibraryViewProps =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "ready";
      recipes: readonly RecipeSummary[];
      /** How many recipes the user has put away, for the link to them. None, and there is no link. */
      archivedCount: number;
      /** Whether a copy of the recipe is being saved, which is when its Duplicate button is busy. */
      isDuplicating: (recipeId: string) => boolean;
      onDuplicate: (recipe: RecipeSummary) => void;
      onArchive: (recipe: RecipeSummary) => void;
    };
