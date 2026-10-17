import type { RecipeSummary } from "@keylow/api-client";

/**
 * What the archived recipes screen shows: the archived recipes, which may be none, or, for a screen opened
 * with nothing in memory (a link, or the phone offline), the library's own loading, failed and offline
 * states. A `ready` screen with `isOnline` false keeps the recipes readable and turns Restore off.
 */
export type ArchivedRecipesViewProps = {
  onBack: () => void;
} & (
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "offline" }
  | {
      status: "ready";
      recipes: readonly RecipeSummary[];
      isOnline?: boolean;
      /** Brings the recipe back into the library. */
      onRestore: (recipe: RecipeSummary) => void;
    }
);
