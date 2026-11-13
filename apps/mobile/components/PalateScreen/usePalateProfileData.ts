import {
  useProfileTimeZone,
  usePalateFoods,
  usePalateLoggedDays,
  usePalatePreferences,
  usePalateStats,
  useRecipes,
} from "@keylow/api-client";
import { buildPalateProfile, palateRecipeOf } from "@keylow/core";
import { isValidTimeZone, toLocalDate } from "@keylow/core/dates";
import { useMemo } from "react";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { PalateFood } from "@keylow/core";

const NO_FOODS: PalateFood[] = [];

const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/**
 * Reads what the palate screen is built from, the diary's stats and logged days, the person's statements
 * and corrections, the foods and the recipes the stats are about, and gives core's profile once all are
 * read. `profile` is undefined until then. `isError` is true when a read failed and there is nothing to draw
 * from, and `refetch` reads again the ones that failed. A refresh that fails behind what was read leaves the
 * profile as it is.
 */
export function usePalateProfileData() {
  const enabled = useReadsEnabled();
  const stats = usePalateStats({ enabled });
  const loggedDays = usePalateLoggedDays({ enabled });
  const preferences = usePalatePreferences({ enabled });
  const recipes = useRecipes({ archived: true, enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const foodIds = useMemo(
    () => [
      ...new Set((stats.data ?? []).flatMap(({ foodId }) => (foodId === null ? [] : [foodId]))),
    ],
    [stats.data],
  );
  const foods = usePalateFoods(foodIds, { enabled });
  const zone =
    timeZone.data !== undefined && timeZone.data !== null && isValidTimeZone(timeZone.data)
      ? timeZone.data
      : deviceTimeZone();
  const today = toLocalDate(useNow(), zone);

  const queries = [stats, loggedDays, preferences, recipes, foods];
  // With no food in the stats there is nothing to ask for, and the foods query stays idle.
  const foodsRead = foodIds.length === 0 ? NO_FOODS : foods.data;
  const isRead =
    stats.data !== undefined &&
    loggedDays.data !== undefined &&
    preferences.data !== undefined &&
    recipes.data !== undefined &&
    foodsRead !== undefined;

  const profile = useMemo(
    () =>
      isRead
        ? buildPalateProfile(stats.data, preferences.data, {
            today,
            loggedDays: loggedDays.data,
            foods: foodsRead,
            recipes: recipes.data.map(palateRecipeOf),
          })
        : undefined,
    [isRead, stats.data, preferences.data, loggedDays.data, foodsRead, recipes.data, today],
  );

  return {
    profile,
    isError: profile === undefined && queries.some(({ isError }) => isError),
    refetch: () => {
      for (const query of queries) {
        if (query.isError) {
          void query.refetch();
        }
      }
    },
  };
}
