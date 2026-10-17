import { useRecipe } from "@keylow/api-client";
import { isRecipeId } from "@keylow/core/recipes";
import { useRouter } from "expo-router";
import { useEffect } from "react";

import { recipePath } from "../../lib/recipeRoutes";
import { useReadsEnabled } from "../../lib/useReadsEnabled";
import { RecipeEditor } from "../RecipeEditor";

import type { RecipeEditorScreenProps } from "./types";

/**
 * `/recipes/<id>/edit`: opens the editor on a saved recipe, which the recipe view beneath it has already
 * read, so the cache serves it. When the recipe is not ready (a link opened cold, a recipe that is not
 * there, an id that cannot be one, the terms gate still up) the screen replaces itself with the view, which
 * has the loading, failed and not found states, and draws nothing meanwhile.
 */
export function RecipeEditorScreen({ id }: RecipeEditorScreenProps) {
  const router = useRouter();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });
  const recipe = isReadEnabled && state.status === "ready" ? state.recipe : undefined;

  useEffect(() => {
    if (recipe === undefined) {
      router.replace(recipePath(id));
    }
  }, [recipe, id, router]);

  return recipe === undefined ? null : <RecipeEditor key={recipe.id} existing={recipe} />;
}
