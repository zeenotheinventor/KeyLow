import { keys, useRecipe } from "@keylow/api-client";
import { describeAddedToPlate } from "@keylow/core/copy";
import { canLogRecipe, usualQuantityOfUnit } from "@keylow/core/diary";
import { isPlateItemValid, plateItemOfRecipe } from "@keylow/core/plate";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef } from "react";
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
 * send the search back as it was opened. Opened from a plate row's name (`plate` names the row), the page is the
 * plate-edit one: it starts on the row's amount and unit, Save puts the row back in its place and goes back
 * to the sheet, and Back changes nothing. A `plate` that is not a row of this recipe goes back to the search.
 * An archived recipe and one with no weight are not found, as the
 * search never offers them.
 */
export default function RecipeAmountRoute() {
  const router = useRouter();
  const goBack = useGoBackInFoodsSheet();
  const queryClient = useQueryClient();
  const plate = usePlate();
  const {
    id,
    day,
    time,
    plate: plateKey,
  } = useLocalSearchParams<{ id: string; day?: string; time?: string; plate?: string }>();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });
  // Set in the same tick as the press, which a state update is not, so a second press cannot add it twice.
  const hasAddedToPlate = useRef(false);
  // The same for Save on a plate row: going back twice would close the whole sheet.
  const hasSavedPlateRow = useRef(false);
  const logContext = readLogContext({ day, time });
  const plateRow = plate.items.find(
    (item) => item.key === plateKey && item.kind === "recipe" && item.recipe.id === id,
  );
  const isStalePlateRow = plateKey !== undefined && plateRow === undefined;

  // A link to a row that is not on the plate has nothing to change: the search is where it belongs.
  useEffect(() => {
    if (isStalePlateRow) {
      router.dismissTo(withLogContext("/foods", logContext));
    }
  }, [isStalePlateRow, router, logContext]);

  if (isStalePlateRow) {
    return null;
  }

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

  if (plateRow?.kind === "recipe") {
    return (
      <PortionPicker
        // A row with no valid amount keeps its unit and starts at that unit's usual amount (1 serving, or 100 g).
        amount={{
          quantity: isPlateItemValid(plateRow)
            ? plateRow.quantity
            : usualQuantityOfUnit(plateRow.unit),
          unit: plateRow.unit,
        }}
        mode="edit-plate-recipe"
        recipe={recipe}
        onBack={goBack}
        onSubmit={(amount) => {
          if (hasSavedPlateRow.current) {
            return;
          }
          hasSavedPlateRow.current = true;
          // The row keeps its key and its place on the plate, and never merges into another row.
          plate.replace(plateRow.key, (key) => plateItemOfRecipe({ key, recipe, amount }));
          goBack();
        }}
      />
    );
  }

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
