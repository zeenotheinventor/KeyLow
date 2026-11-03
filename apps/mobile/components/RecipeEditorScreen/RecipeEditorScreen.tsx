import { useRecipe } from "@keylow/api-client";
import { isRecipeId } from "@keylow/core/recipes";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { recipePath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RecipeEditor } from "../RecipeEditor";
import { RecipeLoadState } from "../RecipeLoadState";

import type { RecipeEditorScreenProps } from "./types";

/**
 * `/recipes/<id>/edit`: opens the editor on a saved recipe, which the recipe view beneath it has already
 * read, so the cache serves it. A link opened cold (the assistant's, from the diary) shows the loading
 * state while the recipe loads. When the recipe cannot be shown (a failed read, a recipe that is not there,
 * an id that cannot be one, the terms gate still up) the screen replaces itself with the view, which has
 * the failed and not found states, and draws nothing meanwhile. An `addIngredientQuery` opens the editor
 * with its add-ingredient search open on that word.
 */
export function RecipeEditorScreen({ id, addIngredientQuery }: RecipeEditorScreenProps) {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });
  const recipe = isReadEnabled && state.status === "ready" ? state.recipe : undefined;

  const isLoading = isReadEnabled && !isKnownToBeMissing && state.status === "loading";

  useEffect(() => {
    if (recipe === undefined && !isLoading) {
      router.replace(recipePath(id));
    }
  }, [recipe, isLoading, id, router]);

  if (recipe !== undefined) {
    return (
      <RecipeEditor
        key={recipe.id}
        existing={recipe}
        initialIngredientSearch={addIngredientQuery}
      />
    );
  }

  return isLoading ? (
    <RecipeLoadState
      state="loading"
      onBack={() => {
        router.back();
      }}
      onRetry={() => undefined}
    />
  ) : null;
}
