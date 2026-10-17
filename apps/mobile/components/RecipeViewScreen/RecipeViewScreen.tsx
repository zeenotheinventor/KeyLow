import { keys, useRecipe } from "@keylow/api-client";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";

import { useIsOnline } from "../../lib/connectivity";
import { recipesPath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RecipeLoadState } from "../RecipeLoadState";
import { RecipeView } from "../RecipeView";

import type { RecipeViewScreenProps } from "./types";

/**
 * `/recipes/<id>`: reads the recipe and opens the view on it, with the loading, failed and not found
 * states of the screen around it. A link that cannot be a recipe is not asked about, and nothing is read
 * while the terms gate is up. Offline with nothing in memory is the failed state, since a read that cannot
 * be made never finishes. The text of a failure is never shown, and an archived recipe opens like a live one.
 */
export function RecipeViewScreen({ id }: RecipeViewScreenProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });

  function goBack() {
    // A cold link to this screen has nothing before it, so the user goes to the library instead.
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace(recipesPath());
    }
  }

  function renderState(loadState: "loading" | "error" | "notFound") {
    return (
      <RecipeLoadState
        state={loadState}
        onBack={goBack}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: keys.recipes.detail(id) });
        }}
      />
    );
  }

  if (isKnownToBeMissing) {
    return renderState("notFound");
  }
  if (state.status === "error" || (state.status === "loading" && !isOnline)) {
    return renderState("error");
  }
  // A recipe the cache already holds is not drawn while the terms gate is up: nothing of the account is.
  if (state.status === "loading" || !isReadEnabled) {
    return renderState("loading");
  }
  if (state.status === "notFound") {
    return renderState("notFound");
  }

  // Keyed by the recipe, so another recipe starts at its own servings.
  return <RecipeView key={state.recipe.id} recipe={state.recipe} onBack={goBack} />;
}
