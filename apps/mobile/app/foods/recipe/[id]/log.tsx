import { keys, useRecipe } from "@keylow/api-client";
import { describeAddedToPlate } from "@keylow/core/copy";
import { canLogRecipe } from "@keylow/core/diary";
import { plateItemOfRecipe } from "@keylow/core/plate";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRef } from "react";
import { AccessibilityInfo } from "react-native";

import { PortionPicker } from "../../../../components/PortionPicker";
import { RecipeLoadState } from "../../../../components/RecipeLoadState";
import { readLogContext, useGoBackInFoodsSheet, withLogContext } from "../../../../lib/navigation";
import { usePlate } from "../../../../lib/plate";
import { useReadsEnabled } from "../../../../lib/useReadsEnabled";

import type { RecipeAmount } from "@keylow/core/diary";

/**
 * The amount step of a recipe: the portion picker in its recipe-to-plate mode, opened from a recipe row of
 * the log search. Add to plate puts the amount on the plate, writes nothing and goes back to the search, which
 * clears its field. The plate has the time, so the page has no Time row. `day` and `time` are read only to
 * send the search back as it was opened. An archived recipe and one with no weight are not found, as the
 * search never offers them.
 */
export default function RecipeAmountRoute() {
  const router = useRouter();
  const goBack = useGoBackInFoodsSheet();
  const queryClient = useQueryClient();
  const plate = usePlate();
  const { id, day, time } = useLocalSearchParams<{ id: string; day?: string; time?: string }>();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });
  // Set in the same tick as the press, which a state update is not, so a second press cannot add it twice.
  const hasAddedToPlate = useRef(false);
  const logContext = readLogContext({ day, time });

  function renderLoadState(loadState: "loading" | "error" | "notFound") {
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
    return renderLoadState("notFound");
  }
  if (state.status === "error") {
    return renderLoadState("error");
  }
  if (state.status === "loading") {
    return renderLoadState("loading");
  }
  if (state.status === "notFound") {
    return renderLoadState("notFound");
  }
  const { recipe } = state;
  // The search offers only a recipe the diary can log, so a link to any other is not found.
  if (recipe.is_archived || !canLogRecipe(recipe)) {
    return renderLoadState("notFound");
  }

  const handleAddToPlate = (amount: RecipeAmount) => {
    if (hasAddedToPlate.current) {
      return;
    }
    hasAddedToPlate.current = true;
    plate.add((key) => plateItemOfRecipe({ key, recipe, amount }));
    // No toast is drawn after Add to plate, so a screen reader is told instead.
    AccessibilityInfo.announceForAccessibility(describeAddedToPlate(recipe.name));
    // Back to the search it was opened from, with the day and the hour it had.
    router.dismissTo(withLogContext("/foods", logContext));
  };

  return (
    <PortionPicker
      isPlateLogging={plate.isLogging}
      mode="recipe-to-plate"
      recipe={recipe}
      onBack={goBack}
      onSubmit={handleAddToPlate}
    />
  );
}
