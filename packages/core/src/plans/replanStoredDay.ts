import { z } from "zod";

import { keyOf } from "./buildDay";
import { MEAL_PLAN_BANDS, MEAL_PLAN_BAND_TIMES } from "./constants";
import { restorableEntriesOfDay } from "./planOverlap";
import { plannedDayItems } from "./planSaveInput";
import { replanDay } from "./replanDay";
import { dayFingerprint } from "./storedDay";
import { nutrientsSchema } from "../schemas/nutrients";

import type { RestoredItem, StoredPlanItem } from "./planOverlap";
import type {
  Plan,
  PlanBand,
  PlanDay,
  PlanFoodCandidate,
  PlanItem,
  PlanRecipeCandidate,
} from "./types";
import type { LoggableRecipe } from "../diary/recipeSnapshotQuantity";
import type { FitTarget } from "../recipes/fit";
import type { Food } from "../schemas/food";

/** A plan as the database holds it, which is all `replanStoredDay` reads. A `MealPlan` of the api client is one. */
export type StoredReplanPlan = {
  rules: Readonly<Record<string, unknown>>;
  days: readonly {
    id: string;
    localDate: string;
    target: Readonly<Record<string, unknown>>;
    items: readonly StoredPlanItem[];
    confirmedAt: string | null;
  }[];
};

/** The ranking a plan was stored with, most preferred first. Empty when it holds none that can be read. */
export const storedRankingOf = (rules: Readonly<Record<string, unknown>>): string[] => {
  const read = z.array(z.string()).safeParse(rules["ranking"]);
  return read.success ? read.data : [];
};

const storedSlotsOf = (rules: Readonly<Record<string, unknown>>): PlanBand[] => {
  const read = z.array(z.enum(MEAL_PLAN_BANDS)).min(1).safeParse(rules["slots"]);
  return read.success ? read.data : [...MEAL_PLAN_BANDS];
};

const NUTRIENT_KEYS = ["protein_g", "carbs_g", "fat_g"] as const;

const targetOfStored = (target: Readonly<Record<string, unknown>>): FitTarget | null => {
  const kcal = target["kcal"];
  if (typeof kcal !== "number" || !Number.isFinite(kcal) || kcal < 0) {
    return null;
  }
  const read: FitTarget = { kcal };
  for (const key of NUTRIENT_KEYS) {
    const figure = target[key];
    if (typeof figure === "number" && Number.isFinite(figure) && figure >= 0) {
      read[key] = figure;
    }
  }
  return read;
};

const bandOfSlotTime = (slotTime: string | null): PlanBand | null =>
  MEAL_PLAN_BANDS.find((band) => MEAL_PLAN_BAND_TIMES[band] === slotTime?.slice(0, 5)) ?? null;

type ConvertedDay = { items: PlanItem[]; keyOfId: Map<string, string> };

/** The items of a stored day as the planner reads them. An item that lost its food or recipe, or has no band time, is left out. */
const itemsOfStoredDay = (
  localDate: string,
  stored: readonly StoredPlanItem[],
  keyOfAnyId: ReadonlyMap<string, string>,
): ConvertedDay => {
  const items: PlanItem[] = [];
  const keyOfId = new Map<string, string>();
  for (const item of stored) {
    const band = bandOfSlotTime(item.slotTime);
    const nutrients = nutrientsSchema.safeParse(item.nutrients);
    const id = item.kind === "recipe" ? item.recipeId : item.foodId;
    if (band === null || !nutrients.success || id === null) {
      continue;
    }
    const key = keyOf(localDate, band, id);
    keyOfId.set(item.id, key);
    const base = {
      key,
      band,
      time: MEAL_PLAN_BAND_TIMES[band],
      nutrients: nutrients.data,
      leftoverOf: item.leftoverOf === null ? null : (keyOfAnyId.get(item.leftoverOf) ?? null),
    };
    items.push(
      item.kind === "recipe"
        ? { ...base, kind: "recipe", recipeId: id, servings: 1 }
        : { ...base, kind: "food", foodId: id, grams: item.grams },
    );
  }
  return { items, keyOfId };
};

const sumOf = (
  items: readonly PlanItem[],
  nutrient: "kcal" | "protein_g" | "fat_g" | "carbs_g" | "fibre_g",
) => items.reduce((sum, item) => sum + (item.nutrients[nutrient] ?? 0), 0);

/**
 * The stored plan as the planner reads it. Only the items of every day and the target of the replaced day are
 * ever read by `replanDay`, so the other days carry their sums and no verdict.
 */
const planOfStored = (stored: StoredReplanPlan): { plan: Plan; keyOfId: Map<string, string> } => {
  const keyOfId = new Map<string, string>();
  for (const day of stored.days) {
    for (const [id, key] of itemsOfStoredDay(day.localDate, day.items, new Map()).keyOfId) {
      keyOfId.set(id, key);
    }
  }
  const days = stored.days.map((day): PlanDay => {
    const { items } = itemsOfStoredDay(day.localDate, day.items, keyOfId);
    return {
      localDate: day.localDate,
      target: targetOfStored(day.target) ?? { kcal: 0 },
      items,
      totals: {
        kcal: sumOf(items, "kcal"),
        protein_g: sumOf(items, "protein_g"),
        fat_g: sumOf(items, "fat_g"),
        carbs_g: sumOf(items, "carbs_g"),
        fibre_g: sumOf(items, "fibre_g"),
      },
      status: "within",
      shortfalls: [],
    };
  });
  return { plan: { days }, keyOfId };
};

/** An item to write: one the planner built, or a kept one as it was stored. */
export type PlannedDayItem = ReturnType<typeof plannedDayItems>[number] | RestoredItem;

/** A day written again: its id, its date and the items it takes. */
export type DayRewrite = { dayId: string; localDate: string; items: RestoredItem[] };

export type ReplanStoredDayInput = {
  plan: StoredReplanPlan;
  dayId: string;
  recipes: readonly PlanRecipeCandidate[];
  foods: readonly PlanFoodCandidate[];
  /** The repeat limit now: the person's own, which a regenerated day follows. Null is no limit. */
  maxRepeats: number | null;
  /** What the person's new words ranked, or null when they gave none and the plan's stored ranking is used. */
  ranking: readonly string[] | null;
  foodRows: ReadonlyMap<string, Food>;
  recipeRows: ReadonlyMap<string, LoggableRecipe>;
};

export type ReplanStoredDayResult =
  | { status: "unreadable_day" }
  | { status: "no_items" }
  | {
      status: "replanned";
      localDate: string;
      /** Core's day, with its own totals and misses. */
      day: PlanDay;
      /** The keys of the items kept because other days eat their leftovers. */
      kept: string[];
      /** False when the new words ranked nothing, or nothing that could be placed, so the whole kitchen was used. */
      wishesKept: boolean;
      /** What the day takes. A kept item is the stored item, as it was. */
      items: PlannedDayItem[];
      /** How many later days eat a kept cook's leftovers but could not be written again (confirmed, or holding an item that could not be put back), so their link is lost. */
      skippedRelinks: number;
      /** Later days that eat a kept cook's leftovers, written again so the link is not lost, in date order. */
      relinks: DayRewrite[];
      /** What Undo needs: the day as it was, and the days of `relinks` as they were. */
      previous: { items: RestoredItem[]; relinked: DayRewrite[] };
      /** What the day holds now, for Undo to compare. */
      fingerprint: string;
    };

const dayOfPlan = (plan: Plan, localDate: string): PlanDay | undefined =>
  plan.days.find((day) => day.localDate === localDate);

/**
 * Plans one day of a stored plan again from the person's kitchen, against that day's own target. With new
 * words only what they ranked is planned, and if that places nothing the whole kitchen is used and
 * `wishesKept` is false. With none the plan's stored ranking only orders the choice. Every other day is left
 * as it is. A cook on the day that other days eat the leftovers of is kept as it was.
 *
 * Replacing a cook's day deletes the cook, which clears the link on the leftovers of other days, so each later
 * day that eats a kept cook's leftovers, and any day that cooks for those, is returned to be written again with
 * its link restored. A confirmed day is never written. A day with an item whose recipe or food is gone is not
 * written either, because it could not be put back whole.
 */
export const replanStoredDay = (input: ReplanStoredDayInput): ReplanStoredDayResult => {
  const stored = input.plan.days.find(({ id }) => id === input.dayId);
  if (stored === undefined || targetOfStored(stored.target) === null) {
    return { status: "unreadable_day" };
  }
  const { plan, keyOfId } = planOfStored(input.plan);
  const rules = {
    maxRepeats: input.maxRepeats,
    leftovers: input.plan.rules["leftovers"] !== false,
    slots: storedSlotsOf(input.plan.rules),
  };
  const replan = (pool: {
    recipes: readonly PlanRecipeCandidate[];
    foods: readonly PlanFoodCandidate[];
  }) =>
    replanDay(plan, stored.localDate, {
      ...pool,
      ranking: input.ranking ?? storedRankingOf(input.plan.rules),
      rules,
    });

  const isFocused = input.ranking !== null && input.ranking.length > 0;
  const ranked = new Set(input.ranking ?? []);
  let replanned = replan(
    isFocused
      ? {
          recipes: input.recipes.filter(({ id }) => ranked.has(id)),
          foods: input.foods.filter(({ id }) => ranked.has(id)),
        }
      : input,
  );
  let wishesKept = input.ranking === null || isFocused;
  if (isFocused && dayOfPlan(replanned.plan, stored.localDate)?.items.length === 0) {
    replanned = replan(input);
    wishesKept = false;
  }
  const day = dayOfPlan(replanned.plan, stored.localDate);
  if (day === undefined || day.items.length === 0) {
    return { status: "no_items" };
  }

  const entries = restorableEntriesOfDay(input.plan, input.dayId);
  const keptEntryOfKey = new Map(
    entries.flatMap(({ id, item }) => {
      const key = keyOfId.get(id);
      return key !== undefined && replanned.kept.includes(key)
        ? [[key, { id, item }] as const]
        : [];
    }),
  );
  // A kept item is the stored row, so only the other items need their food or recipe as it is now.
  const builtAt = new Map<number, PlannedDayItem>(
    plannedDayItems({
      plan: replanned.plan,
      localDate: stored.localDate,
      foods: input.foodRows,
      recipes: input.recipeRows,
      exceptKeys: new Set(keptEntryOfKey.keys()),
    }).map((built) => [built.position, built]),
  );
  const items = day.items.flatMap((item, position): PlannedDayItem[] => {
    const keptEntry = keptEntryOfKey.get(item.key);
    const placed =
      keptEntry === undefined ? builtAt.get(position) : { ...keptEntry.item, position };
    return placed === undefined ? [] : [placed];
  });
  const newPositionOfKeptId = new Map(
    day.items.flatMap(({ key }, position) => {
      const keptEntry = keptEntryOfKey.get(key);
      return keptEntry === undefined ? [] : [[keptEntry.id, position] as const];
    }),
  );

  const {
    relinks,
    relinked,
    skipped: skippedRelinks,
  } = relinkedDays({
    plan: input.plan,
    replacedDayId: input.dayId,
    replacedDate: stored.localDate,
    newPositionOfKeptId,
  });
  return {
    status: "replanned",
    localDate: stored.localDate,
    day,
    kept: replanned.kept,
    wishesKept,
    items,
    relinks,
    skippedRelinks,
    previous: { items: entries.map(({ item }) => item), relinked },
    fingerprint: dayFingerprint(items),
  };
};

type RelinkInput = {
  plan: StoredReplanPlan;
  replacedDayId: string;
  replacedDate: string;
  /** Where each kept cook sits in the replaced day now, by the id it had. */
  newPositionOfKeptId: ReadonlyMap<string, number>;
};

const relinkedDays = ({ plan, replacedDayId, replacedDate, newPositionOfKeptId }: RelinkInput) => {
  const rewritten = new Map<string, StoredReplanPlan["days"][number]>();
  let recreatedIds = new Set(newPositionOfKeptId.keys());
  const skipped = new Set<string>();
  while (recreatedIds.size > 0) {
    const next = new Set<string>();
    for (const day of plan.days) {
      const eatsRecreated = day.items.some(
        ({ leftoverOf }) => leftoverOf !== null && recreatedIds.has(leftoverOf),
      );
      if (day.id === replacedDayId || rewritten.has(day.id) || !eatsRecreated) {
        continue;
      }
      const isWhole = restorableEntriesOfDay(plan, day.id).length === day.items.length;
      if (day.confirmedAt === null && isWhole) {
        rewritten.set(day.id, day);
        day.items.forEach(({ id }) => next.add(id));
      } else {
        skipped.add(day.id);
      }
    }
    recreatedIds = next;
  }
  const ordered = [...rewritten.values()].sort((first, second) =>
    first.localDate.localeCompare(second.localDate),
  );
  const relinks: DayRewrite[] = [];
  const relinked: DayRewrite[] = [];
  for (const { id: dayId, localDate, items } of ordered) {
    const entries = restorableEntriesOfDay(plan, dayId);
    relinked.push({ dayId, localDate, items: entries.map(({ item }) => item) });
    relinks.push({
      dayId,
      localDate,
      items: entries.map(({ id, item }) => {
        const cook = items.find((candidate) => candidate.id === id)?.leftoverOf;
        const position =
          cook === null || cook === undefined ? undefined : newPositionOfKeptId.get(cook);
        return position === undefined
          ? item
          : { ...item, leftoverOf: { localDate: replacedDate, position } };
      }),
    });
  }
  return { relinks, relinked, skipped: skipped.size };
};
