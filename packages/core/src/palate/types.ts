import type { PalateGroup } from "./palateGroups";
import type { FoodSource } from "../schemas/food";

/**
 * What the diary says of one food or one recipe over the last 90 days: a row of the `palate_food_stats`
 * view as the api client's `PalateFoodStat` returns it, in camelCase. The field names and types are the
 * same, so the repo's rows are passed in as they come. A row with a count that is not a finite number of
 * at least 0 is skipped.
 */
export type PalateFoodStat = {
  foodId: string | null;
  recipeId: string | null;
  entryCount: number;
  distinctDays: number;
  firstLocalDate: string;
  lastLocalDate: string;
  medianResolvedGrams: number | null;
  beforeElevenCount: number;
  elevenToSixteenCount: number;
  sixteenOrLaterCount: number;
};

/**
 * A row of `palate_preferences` as the api client's `PalatePreference` returns it. It names the fields the
 * palate reads, and the repo's type, which also carries `createdAt`, is assignable to it.
 */
export type PalatePreference = {
  id: string;
  kind: "dislike" | "allergy" | "not_usual";
  foodId: string | null;
  recipeId: string | null;
  label: string | null;
};

/** What the palate reads of a food: the columns of a `foods` row it needs. */
export type PalateFood = {
  id: string;
  name: string;
  source: FoodSource;
  food_group: string | null;
};

/**
 * What the palate reads of a recipe. `servingGrams` is the cooked weight of one serving (the recipe's
 * `yield_grams` divided by its `servings`), so the median grams of its entries can be said as servings.
 * It is null when the recipe has no weight.
 */
export type PalateRecipe = { id: string; name: string; servingGrams: number | null };

export type PalateFrequency = "most days" | "most weeks" | "less often";

export type PalateTimeBand = "morning" | "midday" | "evening";

/** A food the person logs on most weeks. `rank` is its place in the full ordered list, corrections included. */
export type PalateUsualFood = {
  foodId: string;
  name: string;
  /** The name up to its first comma, lower case: what a sentence calls it. */
  shortName: string;
  group: PalateGroup;
  days: number;
  /** How often it comes up: on at least half of the logged days, in most weeks, or less than that. */
  frequency: PalateFrequency;
  typicalGrams: number | null;
  rank: number;
};

export type PalateUsualRecipe = {
  recipeId: string;
  name: string;
  days: number;
  /** The median amount in servings, to the nearest half, or null when the recipe has no weight. */
  typicalServings: number | null;
  rank: number;
};

export type PalateBandFood = { foodId: string; name: string; shortName: string };

export type PalateRareGroup = { group: PalateGroup; logCount: 0 | 1; rank: number };

export type PalateAvoidKind = "allergy" | "dislike";

export type PalateAvoidItem = { preferenceId: string; label: string; kind: PalateAvoidKind };

/** An item the person said is not usual. It leaves the lists below and stays here for Undo. */
export type PalateCorrectedItem =
  | { preferenceId: string; item: "food"; food: PalateUsualFood }
  | { preferenceId: string; item: "recipe"; recipe: PalateUsualRecipe }
  | { preferenceId: string; item: "group"; group: PalateRareGroup };

export type PalateProfile = {
  /** Days with something logged in the window. */
  loggedDays: number;
  /** False under `PALATE_USUAL_MIN_DAYS` logged days, when every list but `avoid` is empty. */
  hasEnoughToGoOn: boolean;
  usualFoods: PalateUsualFood[];
  usualRecipes: PalateUsualRecipe[];
  byTimeOfDay: Record<PalateTimeBand, PalateBandFood[]>;
  rarelyOrNever: PalateRareGroup[];
  /** Allergies first, then dislikes, each in the order given. They always win over what the diary shows. */
  avoid: PalateAvoidItem[];
  corrected: PalateCorrectedItem[];
};
