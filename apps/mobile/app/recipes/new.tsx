import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";

import { RecipeEditor } from "../../components/RecipeEditor";
import {
  consumeRecipePrefill,
  markRecipePrefillSaved,
  peekRecipePrefill,
} from "../../lib/recipePrefill";
import { NEW_RECIPE_NAME_PARAMETER, RECIPE_PREFILL_PARAMETER } from "../../lib/recipeRoutes";

// A standard stack push over the tabs, opened from the library's New recipe or from the assistant's Save to
// recipes. The root layout's AuthGate covers it and the root stack gives it no header. A word typed into the
// library's search arrives as the name, and a recipe the assistant drafted arrives as the id it was left
// under: the draft is read once when the screen opens and then taken out of the store, so the id opens
// nothing again. A repeated parameter arrives as an array, so the first value is used.
const firstOf = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default function NewRecipeRoute() {
  const parameters = useLocalSearchParams<{
    [NEW_RECIPE_NAME_PARAMETER]?: string | string[];
    [RECIPE_PREFILL_PARAMETER]?: string | string[];
  }>();
  const initialName = firstOf(parameters[NEW_RECIPE_NAME_PARAMETER]);
  const prefillId = firstOf(parameters[RECIPE_PREFILL_PARAMETER]);
  // Read without taking, so a render that runs twice reads the same draft, then taken once the screen is up.
  const [prefill] = useState(() =>
    prefillId === undefined ? undefined : peekRecipePrefill(prefillId),
  );

  useEffect(() => {
    if (prefillId !== undefined) {
      consumeRecipePrefill(prefillId);
    }
  }, [prefillId]);

  return (
    <RecipeEditor
      initialDraft={prefill?.draft}
      initialIngredientSearch={prefill?.searchWord ?? undefined}
      initialName={initialName}
      onSaved={
        prefill === undefined
          ? undefined
          : (recipeId) => {
              markRecipePrefillSaved(prefill.draftKey, recipeId);
            }
      }
    />
  );
}
