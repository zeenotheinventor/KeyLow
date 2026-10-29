import { useRecipes } from "@keylow/api-client";
import { useRouter } from "expo-router";

import { useIsOnline } from "../../lib/connectivity";
import {
  archivedRecipesPath,
  newRecipePath,
  recipePath,
  shoppingListPath,
} from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { useRecipeActions } from "../RecipeActions";
import { RecipeLibraryView } from "../RecipeLibraryView";

/**
 * The recipe library: the user's live recipes, read with one request that also brings the archived ones
 * for the archived screen, which are left out here. The read waits until the account has accepted the
 * current Terms. A failed refetch keeps the recipes already loaded, so only a library that never loaded is
 * an error. Recipes are never written to the persisted offline cache, so a phone that starts offline has
 * none, and one that went offline keeps what it had loaded in memory, readable but not changeable. A row's menu duplicates or archives a recipe through
 * `useRecipeActions`, and the Archived recipes row opens the archived screen with the count it found.
 */
export function RecipeLibrary() {
  const router = useRouter();
  const isOnline = useIsOnline();
  const recipes = useRecipes({ archived: true, enabled: useReadsEnabled() });
  const recipeActions = useRecipeActions();

  const actions = {
    // A cold link to the library has nothing before it, so Back goes to More instead, as Weight's does.
    onBack: () => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace("/(tabs)/more");
      }
    },
    onDuplicateRecipe: recipeActions.duplicate,
    onArchiveRecipe: recipeActions.archive,
    onOpenShoppingList: () => {
      router.push(shoppingListPath());
    },
    onOpenArchived: () => {
      router.push(archivedRecipesPath());
    },
    onOpenRecipe: (id: string) => {
      router.push(recipePath(id));
    },
    onNewRecipe: (name?: string) => {
      router.push(newRecipePath(name));
    },
  };

  if (recipes.data !== undefined) {
    const liveRecipes = recipes.data.filter((recipe) => !recipe.is_archived);
    const archivedCount = recipes.data.length - liveRecipes.length;

    // Offline, a library with no live recipe in memory has nothing to read, as one never loaded.
    if (isOnline || liveRecipes.length > 0) {
      return (
        <RecipeLibraryView
          {...actions}
          archivedCount={archivedCount}
          isOnline={isOnline}
          recipes={liveRecipes}
          status="ready"
        />
      );
    }

    return <RecipeLibraryView {...actions} status="offline" />;
  }

  if (!isOnline) {
    return <RecipeLibraryView {...actions} status="offline" />;
  }

  if (recipes.isError) {
    return (
      <RecipeLibraryView
        {...actions}
        status="error"
        onRetry={() => {
          void recipes.refetch();
        }}
      />
    );
  }

  return <RecipeLibraryView {...actions} status="loading" />;
}
