import { useRecipes } from "@keylow/api-client";
import { useRouter } from "expo-router";

import { useIsOnline } from "../../lib/connectivity";
import { recipesPath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { ArchivedRecipesView } from "../ArchivedRecipesView";
import { useRecipeActions } from "../RecipeActions";

/**
 * The archived recipes, read from the library's one request, which brings them with the live recipes. It is
 * normally opened from the library, so they are already in memory. A failed refetch keeps them. Restore
 * brings a recipe back through `useRecipeActions`, and Back returns to the library.
 */
export function ArchivedRecipesScreen() {
  const router = useRouter();
  const isOnline = useIsOnline();
  const recipes = useRecipes({ archived: true, enabled: useReadsEnabled() });
  const recipeActions = useRecipeActions();

  function goBack() {
    // A cold link to this screen has nothing before it, so Back goes to the library instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(recipesPath());
    }
  }

  if (recipes.data !== undefined) {
    return (
      <ArchivedRecipesView
        isOnline={isOnline}
        recipes={recipes.data.filter((recipe) => recipe.is_archived)}
        status="ready"
        onBack={goBack}
        onRestore={recipeActions.restore}
      />
    );
  }

  if (!isOnline) {
    return <ArchivedRecipesView status="offline" onBack={goBack} />;
  }

  if (recipes.isError) {
    return (
      <ArchivedRecipesView
        status="error"
        onBack={goBack}
        onRetry={() => {
          void recipes.refetch();
        }}
      />
    );
  }

  return <ArchivedRecipesView status="loading" onBack={goBack} />;
}
