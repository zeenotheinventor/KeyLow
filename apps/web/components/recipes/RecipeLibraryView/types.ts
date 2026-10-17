import type { RecipeSummary } from "@keylow/api-client";

/**
 * What the library shows: the rows while they load, a failed load with its way to try again, or the
 * user's live recipes, which may be none.
 */
export type RecipeLibraryViewProps =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; recipes: readonly RecipeSummary[] };
