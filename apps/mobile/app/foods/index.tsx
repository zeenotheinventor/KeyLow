import { useLocalSearchParams, useRouter } from "expo-router";
import { usePreventRemove } from "expo-router/react-navigation";
import { useEffect } from "react";

import { FoodSearch } from "../../components/FoodSearch";
import { readLogContext, useCloseFoodsSheet, withLogContext } from "../../lib/navigation";
import { usePlate, usePlateExit } from "../../lib/plate";
import { logRecipePath } from "../../lib/recipeRoutes";

/**
 * The root of the food search sheet. `/foods?scope=own` is the same sheet titled "Your foods", which
 * More, Your foods opens. The sheet is presented over the tabs, so closing it goes back to where it was
 * opened.
 *
 * It also guards the sheet's plate. React Navigation asks a screen's guard when the navigator above removes
 * the screen's whole stack, so this one question covers every way out: the header's Close, the Android back
 * button on the search, and the Close of a screen above it, such as the scanner's or quick add's. Back inside
 * the sheet only removes the screen above, so it never asks. The question itself is drawn by the sheet's
 * layout, because this screen is covered by those above it. A close is let through when the plate is empty,
 * logged, or discarded. While the plate is being logged a close is held back silently: a log that works closes
 * the sheet itself, and one that fails leaves the plate for the next close to ask about.
 */
export default function FoodSearchRoute() {
  const router = useRouter();
  const closeSheet = useCloseFoodsSheet();
  const plate = usePlate();
  const { isDiscarded, ask } = usePlateExit();
  const { scope, day, time } = useLocalSearchParams<{
    scope?: string;
    day?: string;
    time?: string;
  }>();
  const logContext = readLogContext({ day, time });

  usePreventRemove(plate.count > 0 && !plate.isLogged && !isDiscarded, () => {
    if (!plate.isLogging) {
      ask();
    }
  });

  // The close waits for the render that lifts the guard, because the guard would stop it again.
  useEffect(() => {
    if (isDiscarded) {
      closeSheet();
    }
  }, [isDiscarded, closeSheet]);

  return (
    <FoodSearch
      scope={scope === "own" ? "own" : "all"}
      onClose={() => {
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace("/(tabs)/dashboard");
        }
      }}
      onCreateFood={() => {
        router.push("/foods/new");
      }}
      // While food is being logged a result opens the portion picker, not the food, with the day and time carried on.
      logging={
        logContext === undefined
          ? undefined
          : {
              context: logContext,
              onOpenRecent: (foodId) => {
                router.push(withLogContext(`/foods/${foodId}/log`, logContext, { recent: "1" }));
              },
              onOpenRecipe: (recipeId) => {
                router.push(withLogContext(logRecipePath(recipeId), logContext));
              },
              onQuickAdd: () => {
                router.push(withLogContext("/foods/quick-add", logContext));
              },
            }
      }
      onOpenFood={(foodId) => {
        router.push(
          logContext === undefined
            ? `/foods/${foodId}`
            : withLogContext(`/foods/${foodId}/log`, logContext),
        );
      }}
      onScanBarcode={() => {
        // While food is being logged the scanner carries the day and the time on to the portion picker.
        router.push(withLogContext("/foods/scan", logContext));
      }}
    />
  );
}
