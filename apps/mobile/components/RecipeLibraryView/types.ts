import type { RecipeSummary } from "@keylow/api-client";

type RecipeLibraryViewActions = {
  /** Opens a recipe's screen. The library never knows where that is: `recipePath` does. */
  onOpenRecipe: (id: string) => void;
  /** Starts a new recipe. A typed word is the name it starts with. */
  onNewRecipe: (name?: string) => void;
  /** What the search field starts with typed in it, such as "chi" for the search board. Defaults to nothing. */
  initialQuery?: string;
};

/**
 * What the library shows: the rows while they load, a failed load with its way to try again, the phone
 * being offline with no recipes in memory, or the user's live recipes, which may be none. A `ready`
 * library with `isOnline` false is the recipes loaded earlier in the session, readable but not changeable.
 */
export type RecipeLibraryViewProps = RecipeLibraryViewActions &
  (
    | { status: "loading" }
    | { status: "error"; onRetry: () => void }
    | { status: "offline" }
    | { status: "ready"; recipes: readonly RecipeSummary[]; isOnline?: boolean }
  );
