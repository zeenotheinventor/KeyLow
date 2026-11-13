import { listAvoidedFoods } from "./avoidedFoods";
import { avoidsFood } from "./avoidsFood";
import {
  PALATE_FOODS_PER_TIME_BAND,
  PALATE_FREQUENCY_MAX_DAYS_SINCE_LAST_LOG,
  PALATE_MAX_USUAL_FOODS,
  PALATE_MAX_USUAL_RECIPES,
  PALATE_MOST_DAYS_SHARE,
  PALATE_MOST_WEEKS_SHARE,
  PALATE_RARE_MAX_LOGS,
  PALATE_RARE_MAX_RECIPE_ENTRY_SHARE,
  PALATE_USUAL_MIN_DAYS,
  PALATE_WINDOW_DAYS,
} from "./constants";
import { palateGroupOf } from "./palateGroupOf";
import { PALATE_GROUPS, PALATE_RARE_CANDIDATE_GROUPS } from "./palateGroups";
import { shortFoodName } from "./shortFoodName";
import { dayNumber } from "../dates/calendarDay";

import type { PalateGroup } from "./palateGroups";
import type {
  PalateBandFood,
  PalateCorrectedItem,
  PalateFood,
  PalateFrequency,
  PalatePreference,
  PalateProfile,
  PalateRareGroup,
  PalateRecipe,
  PalateFoodStat,
  PalateTimeBand,
  PalateUsualFood,
  PalateUsualRecipe,
} from "./types";

export type PalateOptions = {
  /** The person's local date today, `YYYY-MM-DD`. */
  today: string;
  /**
   * The days with anything logged in the window. The view has one row per food, so it cannot say, and
   * "most days" and the empty state both need it: a count of the distinct `local_date` of the same entries.
   */
  loggedDays: number;
  /** The foods the stats rows are about. A row for a food not listed here is skipped. */
  foods: readonly PalateFood[];
  /** The recipes the stats rows are about. A row for a recipe not listed here is skipped. */
  recipes: readonly PalateRecipe[];
};

type CountedRow = {
  id: string;
  days: number;
  entries: number;
  firstDate: string | null;
  lastDate: string | null;
  grams: number | null;
  bands: Record<PalateTimeBand, number>;
};

const DAYS_PER_WEEK = 7;

const isCount = (value: number | null): value is number =>
  value !== null && Number.isFinite(value) && value >= 0;

function countedRow(id: string, row: PalateFoodStat): CountedRow | null {
  if (!isCount(row.distinctDays) || !isCount(row.entryCount)) {
    return null;
  }
  const bandCount = (
    column: "beforeElevenCount" | "elevenToSixteenCount" | "sixteenOrLaterCount",
  ): number => {
    const value = row[column];
    return isCount(value) ? value : 0;
  };
  return {
    id,
    days: row.distinctDays,
    entries: row.entryCount,
    firstDate: row.firstLocalDate,
    lastDate: row.lastLocalDate,
    grams: isCount(row.medianResolvedGrams) ? row.medianResolvedGrams : null,
    bands: {
      morning: bandCount("beforeElevenCount"),
      midday: bandCount("elevenToSixteenCount"),
      evening: bandCount("sixteenOrLaterCount"),
    },
  };
}

// The order of everything usual: the most days, then the latest day logged, then the name, so the answer
// never depends on the order the rows came in.
const byUsualOrder = (
  left: { days: number; lastDate: string | null; name: string; id: string },
  right: { days: number; lastDate: string | null; name: string; id: string },
): number =>
  right.days - left.days ||
  (right.lastDate ?? "").localeCompare(left.lastDate ?? "") ||
  left.name.localeCompare(right.name) ||
  left.id.localeCompare(right.id);

function weeksCovered(rows: readonly CountedRow[], today: string): number {
  const firstDates = rows.flatMap(({ firstDate }) => (firstDate === null ? [] : [firstDate]));
  const earliest = firstDates.reduce<string | null>(
    (soonest, date) => (soonest === null || date < soonest ? date : soonest),
    null,
  );
  const observedDays =
    earliest === null ? 1 : Math.max(1, dayNumber(today) - dayNumber(earliest) + 1);
  return Math.ceil(Math.min(observedDays, PALATE_WINDOW_DAYS) / DAYS_PER_WEEK);
}

type Corrections = {
  foods: Map<string, string>;
  recipes: Map<string, string>;
  groups: Map<PalateGroup, string>;
};

function listCorrections(preferences: readonly PalatePreference[]): Corrections {
  const corrections: Corrections = { foods: new Map(), recipes: new Map(), groups: new Map() };
  for (const preference of preferences) {
    if (preference.kind !== "not_usual") {
      continue;
    }
    const label = (preference.label ?? "").trim().toLowerCase();
    const group = PALATE_GROUPS.find((candidate) => candidate === label);
    if (preference.foodId !== null) {
      corrections.foods.set(preference.foodId, preference.id);
    } else if (preference.recipeId !== null) {
      corrections.recipes.set(preference.recipeId, preference.id);
    } else if (group !== undefined && group !== "other") {
      corrections.groups.set(group, preference.id);
    }
  }
  return corrections;
}

// Half the servings is as fine as a person counts a portion, and a recipe is never "usually 0 servings".
function typicalServingsOf(grams: number | null, servingGrams: number | null): number | null {
  if (grams === null || servingGrams === null || servingGrams <= 0) {
    return null;
  }
  return Math.max(0.5, Math.round((grams / servingGrams) * 2) / 2);
}

/**
 * What the person usually eats, worked out from the rows of `palate_food_stats` and the person's own
 * statements, with no I/O. The rules:
 *
 * - Usual is logged on at least 4 days. Foods and recipes are listed apart, at most 12 and 6, by days and
 *   then the last day logged. Fats and oils are never listed as usual, because oil is in every dish.
 * - A time of day lists the top 3 usual foods logged in it, by their count there.
 * - Rarely or never is a group, out of the fixed list and never "other", with none or one log.
 * - An allergy or a dislike always wins over the diary: a food or recipe it matches is in no list.
 * - A "not true" correction takes an item out of every list and keeps it in `corrected`, with the rank it
 *   had, so a screen can show it in place. The counts of a group do not change with a correction.
 * - With fewer than 4 logged days nothing is usual yet and only `avoid` is filled.
 */
export function buildPalateProfile(
  stats: readonly PalateFoodStat[],
  preferences: readonly PalatePreference[],
  options: PalateOptions,
): PalateProfile {
  const avoid = listAvoidedFoods(preferences);
  const hasEnoughToGoOn = options.loggedDays >= PALATE_USUAL_MIN_DAYS;
  const profile: PalateProfile = {
    loggedDays: options.loggedDays,
    hasEnoughToGoOn,
    usualFoods: [],
    usualRecipes: [],
    byTimeOfDay: { morning: [], midday: [], evening: [] },
    rarelyOrNever: [],
    avoid,
    corrected: [],
  };
  if (!hasEnoughToGoOn) {
    return profile;
  }

  const foodById = new Map(options.foods.map((food) => [food.id, food]));
  const recipeById = new Map(options.recipes.map((recipe) => [recipe.id, recipe]));
  const foodRows = stats.flatMap((row) => {
    const food = row.foodId === null ? undefined : foodById.get(row.foodId);
    const counted = food === undefined ? null : countedRow(food.id, row);
    return food === undefined || counted === null
      ? []
      : [{ ...counted, food, group: palateGroupOf(food.source, food.food_group, food.name) }];
  });
  const recipeRows = stats.flatMap((row) => {
    const recipe = row.recipeId === null ? undefined : recipeById.get(row.recipeId);
    const counted = recipe === undefined ? null : countedRow(recipe.id, row);
    return recipe === undefined || counted === null ? [] : [{ ...counted, recipe }];
  });

  const weeks = weeksCovered([...foodRows, ...recipeRows], options.today);
  const frequencyOf = (days: number, lastDate: string | null): PalateFrequency =>
    lastDate !== null &&
    dayNumber(options.today) - dayNumber(lastDate) > PALATE_FREQUENCY_MAX_DAYS_SINCE_LAST_LOG
      ? "less often"
      : days >= options.loggedDays * PALATE_MOST_DAYS_SHARE
        ? "most days"
        : days >= Math.ceil(weeks * PALATE_MOST_WEEKS_SHARE)
          ? "most weeks"
          : "less often";

  const corrections = listCorrections(preferences);
  const corrected: PalateCorrectedItem[] = [];

  const usualFoodRows = foodRows
    .filter(
      ({ days, food, group }) =>
        days >= PALATE_USUAL_MIN_DAYS &&
        group !== "fats and oils" &&
        !avoidsFood(food, preferences).avoid,
    )
    .map((row) => ({ ...row, name: row.food.name }))
    .sort(byUsualOrder);
  const keptFoodRows: typeof usualFoodRows = [];
  usualFoodRows.forEach((row, rank) => {
    const usual: PalateUsualFood = {
      foodId: row.food.id,
      name: row.food.name,
      shortName: shortFoodName(row.food.name),
      group: row.group,
      days: row.days,
      frequency: frequencyOf(row.days, row.lastDate),
      typicalGrams: row.grams,
      rank,
    };
    const preferenceId = corrections.foods.get(row.food.id);
    if (preferenceId === undefined) {
      keptFoodRows.push(row);
      profile.usualFoods.push(usual);
    } else {
      corrected.push({ preferenceId, item: "food", food: usual });
    }
  });
  profile.usualFoods = profile.usualFoods.slice(0, PALATE_MAX_USUAL_FOODS);

  const usualRecipeRows = recipeRows
    .filter(
      ({ days, recipe }) =>
        days >= PALATE_USUAL_MIN_DAYS && !avoidsFood({ name: recipe.name }, preferences).avoid,
    )
    .map((row) => ({ ...row, name: row.recipe.name }))
    .sort(byUsualOrder);
  usualRecipeRows.forEach((row, rank) => {
    const usual: PalateUsualRecipe = {
      recipeId: row.recipe.id,
      name: row.recipe.name,
      days: row.days,
      typicalServings: typicalServingsOf(row.grams, row.recipe.servingGrams),
      rank,
    };
    const preferenceId = corrections.recipes.get(row.recipe.id);
    if (preferenceId === undefined) {
      profile.usualRecipes.push(usual);
    } else {
      corrected.push({ preferenceId, item: "recipe", recipe: usual });
    }
  });
  profile.usualRecipes = profile.usualRecipes.slice(0, PALATE_MAX_USUAL_RECIPES);

  for (const band of ["morning", "midday", "evening"] as const) {
    profile.byTimeOfDay[band] = keptFoodRows
      .filter((row) => row.bands[band] > 0)
      .sort(
        (left, right) =>
          right.bands[band] - left.bands[band] ||
          (right.lastDate ?? "").localeCompare(left.lastDate ?? "") ||
          left.name.localeCompare(right.name) ||
          left.id.localeCompare(right.id),
      )
      .slice(0, PALATE_FOODS_PER_TIME_BAND)
      .map((row): PalateBandFood => ({
        foodId: row.food.id,
        name: row.food.name,
        shortName: shortFoodName(row.food.name),
      }));
  }

  const foodEntries = foodRows.reduce((total, { entries }) => total + entries, 0);
  const recipeEntries = recipeRows.reduce((total, { entries }) => total + entries, 0);
  const recipesDominate =
    recipeEntries > (foodEntries + recipeEntries) * PALATE_RARE_MAX_RECIPE_ENTRY_SHARE;
  const logsByGroup = new Map<PalateGroup, number>();
  for (const { group, entries } of foodRows) {
    logsByGroup.set(group, (logsByGroup.get(group) ?? 0) + entries);
  }
  PALATE_RARE_CANDIDATE_GROUPS.forEach((group, rank) => {
    const logCount = logsByGroup.get(group) ?? 0;
    if (recipesDominate || logCount > PALATE_RARE_MAX_LOGS) {
      return;
    }
    const rare: PalateRareGroup = { group, logCount: logCount === 0 ? 0 : 1, rank };
    const preferenceId = corrections.groups.get(group);
    if (preferenceId === undefined) {
      profile.rarelyOrNever.push(rare);
    } else {
      corrected.push({ preferenceId, item: "group", group: rare });
    }
  });

  profile.corrected = corrected;
  return profile;
}
