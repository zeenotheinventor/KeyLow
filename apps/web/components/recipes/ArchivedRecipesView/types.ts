import type { RecipeSummary } from "@keylow/api-client";

/**
 * What the archived page shows: the rows while they load, a failed load with its way to try again, or the
 * recipes the user has put away, which may be none, with what Restore does.
 */
export type ArchivedRecipesViewProps =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "ready";
      recipes: readonly RecipeSummary[];
      onRestore: (recipe: RecipeSummary) => void;
    };
