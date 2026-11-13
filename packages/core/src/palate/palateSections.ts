import {
  PALATE_WORDS,
  describeBandFoods,
  describeFoodDetail,
  describeGroupTitle,
  describeRareGroupDetail,
  describeRecipeDetail,
} from "../copy/palate";

import type { PalateProfile, PalateTimeBand } from "./types";

/** What a "Not true" on a row is about: one food, one recipe or one group, named by its label. */
export type PalateItemTarget = { foodId: string } | { recipeId: string } | { label: string };

/**
 * One row of the usual foods, usual recipes or rarely or never lists. A corrected row has the id of its
 * correction, which Undo removes, and says so in its detail, and it keeps the place it had.
 */
export type PalateRow = {
  key: string;
  title: string;
  detail: string;
  target: PalateItemTarget;
  correctionId: string | null;
};

export type PalateTimeOfDayRow = { key: PalateTimeBand; title: string; detail: string };

export type PalateSections = {
  foods: PalateRow[];
  recipes: PalateRow[];
  timesOfDay: PalateTimeOfDayRow[];
  rare: PalateRow[];
};

type Ranked = { rank: number; row: PalateRow };

const inPlace = (items: Ranked[]): PalateRow[] =>
  items.sort((left, right) => left.rank - right.rank).map(({ row }) => row);

const TIMES_OF_DAY: readonly { key: PalateTimeBand; title: string }[] = [
  { key: "morning", title: PALATE_WORDS.morning },
  { key: "midday", title: PALATE_WORDS.midday },
  { key: "evening", title: PALATE_WORDS.evening },
];

/**
 * The rows the palate screen draws, in the order the screen draws them. A corrected item is put back at
 * the rank it had, muted by its detail, so it stays where the person pressed Not true until they press
 * Undo. A time of day with no foods is left out.
 */
export function palateSections(profile: PalateProfile): PalateSections {
  const foods: Ranked[] = profile.usualFoods.map((food) => ({
    rank: food.rank,
    row: {
      key: `food:${food.foodId}`,
      title: food.name,
      detail: describeFoodDetail(food.days, food.typicalGrams),
      target: { foodId: food.foodId },
      correctionId: null,
    },
  }));
  const recipes: Ranked[] = profile.usualRecipes.map((recipe) => ({
    rank: recipe.rank,
    row: {
      key: `recipe:${recipe.recipeId}`,
      title: recipe.name,
      detail: describeRecipeDetail(recipe.days, recipe.typicalServings),
      target: { recipeId: recipe.recipeId },
      correctionId: null,
    },
  }));
  const rare: Ranked[] = profile.rarelyOrNever.map(({ group, logCount, rank }) => ({
    rank,
    row: {
      key: `group:${group}`,
      title: describeGroupTitle(group),
      detail: describeRareGroupDetail(logCount),
      target: { label: group },
      correctionId: null,
    },
  }));

  for (const corrected of profile.corrected) {
    const correctedRow = (
      rank: number,
      key: string,
      title: string,
      target: PalateItemTarget,
    ): Ranked => ({
      rank,
      row: {
        key,
        title,
        detail: PALATE_WORDS.correctedDetail,
        target,
        correctionId: corrected.preferenceId,
      },
    });
    if (corrected.item === "food") {
      const { foodId, name, rank } = corrected.food;
      foods.push(correctedRow(rank, `food:${foodId}`, name, { foodId }));
    } else if (corrected.item === "recipe") {
      const { recipeId, name, rank } = corrected.recipe;
      recipes.push(correctedRow(rank, `recipe:${recipeId}`, name, { recipeId }));
    } else {
      const { group, rank } = corrected.group;
      rare.push(correctedRow(rank, `group:${group}`, describeGroupTitle(group), { label: group }));
    }
  }

  return {
    foods: inPlace(foods),
    recipes: inPlace(recipes),
    timesOfDay: TIMES_OF_DAY.flatMap(({ key, title }) => {
      const names = profile.byTimeOfDay[key].map(({ shortName }) => shortName);
      return names.length === 0 ? [] : [{ key, title, detail: describeBandFoods(names) }];
    }),
    rare: inPlace(rare),
  };
}
