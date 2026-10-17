import { keys, useLogRecipeServing, useProfileTimeZone, useRecipe } from "@keylow/api-client";
import { ADDED_TOAST } from "@keylow/core/copy";
import { clockTimeOn, openingLoggedAt } from "@keylow/core/diary";
import { isRecipeId } from "@keylow/core/recipes";
import { useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";

import { PortionPicker } from "../../../../components/PortionPicker";
import { RecipeLoadState } from "../../../../components/RecipeLoadState";
import { useToast } from "../../../../components/ui";
import { canLogRecipe } from "../../../../lib/canLogRecipe";
import { useIsOnline } from "../../../../lib/connectivity";
import {
  readLogContext,
  useCloseFoodsSheet,
  useGoBackInFoodsSheet,
} from "../../../../lib/navigation";
import { useReadsEnabled } from "../../../../lib/useReadsEnabled";

import type { RecipeSelection } from "../../../../components/PortionPicker";

/**
 * The amount step of a recipe: the portion picker in its recipe mode, opened from a recipe row of the log
 * search. It reads `day` and `time` as the food sheet carries them, so the Time row shows the hour an hour's
 * plus was pressed on or "Now" with the current time. Add logs the amount at the time the row shows, closes
 * the sheet to the diary and shows the toast. An archived recipe and one with no weight are not found, as
 * the search never offers them, and the failure of a save is the fixed sentence and never the amount.
 */
export default function RecipeAmountRoute() {
  const goBack = useGoBackInFoodsSheet();
  const closeSheet = useCloseFoodsSheet();
  const toast = useToast();
  const queryClient = useQueryClient();
  const logRecipe = useLogRecipeServing();
  const isOnline = useIsOnline();
  const { id, day, time } = useLocalSearchParams<{ id: string; day?: string; time?: string }>();
  const isReadEnabled = useReadsEnabled();
  const isKnownToBeMissing = !isRecipeId(id);
  const state = useRecipe(isKnownToBeMissing ? undefined : id, { enabled: isReadEnabled });
  // The diary reads its days and hours in the profile's zone, so the time logged here is read in it too.
  const profileTimeZone = useProfileTimeZone({ enabled: isReadEnabled });
  const [isSaving, setIsSaving] = useState(false);
  // Set in the same tick as the press, which a state update is not, so a second press cannot get past it.
  const isSavingNow = useRef(false);
  const [hasSaveError, setHasSaveError] = useState(false);
  // The moment the screen opened, so "Now" does not move while the picker is open.
  const [openedAt] = useState(() => new Date());
  const logContext = readLogContext({ day, time });

  function renderLoadState(loadState: "loading" | "error" | "notFound") {
    return (
      <RecipeLoadState
        state={loadState}
        onBack={goBack}
        onRetry={() => {
          void queryClient.invalidateQueries({ queryKey: keys.recipes.detail(id) });
          if (profileTimeZone.isError) {
            void queryClient.invalidateQueries({ queryKey: keys.profiles.timeZone });
          }
        }}
      />
    );
  }

  if (isKnownToBeMissing) {
    return renderLoadState("notFound");
  }
  if (state.status === "error" || profileTimeZone.isError) {
    return renderLoadState("error");
  }
  if (state.status === "loading" || profileTimeZone.data === undefined) {
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

  // A signed in user always has a profile row, which the database creates. If it is missing the day is UTC.
  const timeZone = profileTimeZone.data ?? "UTC";
  const initial = openingLoggedAt(openedAt, logContext, timeZone);

  async function handleSubmit(selection: RecipeSelection) {
    if (isSavingNow.current) {
      return;
    }
    isSavingNow.current = true;
    setIsSaving(true);
    setHasSaveError(false);
    try {
      const { loggedAt, localDate } = selection.isNow
        ? initial
        : clockTimeOn(initial.localDate, selection.time, timeZone);
      await logRecipe.mutateAsync({
        recipe,
        quantity: selection.quantity,
        unit: selection.unit,
        loggedAt: loggedAt.toISOString(),
        localDate,
      });
      toast.show({ message: ADDED_TOAST, tone: "success", icon: "Check" });
      closeSheet();
    } catch {
      // The failure is not kept: it can quote the amount, which is health data. The banner says what to do.
      setHasSaveError(true);
    } finally {
      isSavingNow.current = false;
      setIsSaving(false);
    }
  }

  return (
    <PortionPicker
      hasSaveError={hasSaveError}
      isNow={logContext?.time === undefined}
      isOnline={isOnline}
      isSaving={isSaving}
      mode="recipe"
      recipe={recipe}
      time={initial.clockTime}
      onBack={goBack}
      onSubmit={(selection) => {
        void handleSubmit(selection);
      }}
    />
  );
}
