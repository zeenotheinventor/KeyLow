import { z } from "zod";

import { MEAL_PLAN_BANDS, MEAL_PLAN_BAND_TIMES } from "./constants";
import { planServingGrams } from "./planWeek";
import {
  describePlanFoodAmount,
  describePlanFoodName,
  describePlanRecipeAmount,
} from "../copy/assistantPlanCards";
import {
  describePlanBandFigures,
  describePlanCookBadge,
  describePlanShortBody,
  describePlanShortTitle,
  describePlanRowCaption,
  describePlanRowTitle,
  MEAL_PLAN_WORDS,
} from "../copy/mealPlan";
import { addCalendarDays } from "../dates/calendarDay";
import { weekOf } from "../diary/rules/weekStrip";
import { formatCalories } from "../format/numbers";
import { outOfTolerance } from "../recipes/fit/judgeTargets";

import type { PlanBand } from "./types";
import type { ProgressTargets } from "../diary/rules/progressBars";
import type { FitNutrient, FitTarget } from "../recipes/fit/types";
import type { NullableNutrients } from "../schemas/nutrients";

/*
 * What the Plan screens draw, shaped from the plans as stored. Every figure is a sum core makes of the items'
 * frozen nutrients, and a day is judged by the one rule the planner uses (`outOfTolerance`), so a screen never
 * adds, compares or words anything itself.
 */

type JsonRecord = Readonly<Record<string, unknown>>;

/** One planned item as `listMealPlans` returns it. Its names and figures were frozen when the plan was made. */
export type PlanItemRow = {
  id: string;
  position: number;
  /** `HH:MM:SS` as the database stores it, or null. */
  slotTime: string | null;
  nutrients: JsonRecord;
  leftoverOf: string | null;
  snapshot: JsonRecord;
} & (
  | { kind: "recipe"; recipeId: string | null; servings: number }
  | { kind: "food"; foodId: string | null; grams: number }
);

export type PlanDayRow = {
  id: string;
  localDate: string;
  target: JsonRecord;
  confirmedAt: string | null;
  items: readonly PlanItemRow[];
};

export type PlanRow = {
  id: string;
  startDate: string;
  dayCount: number;
  createdAt: string;
  days: readonly PlanDayRow[];
};

export type PlanFigures = {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

export type PlanItemView = {
  id: string;
  /** A recipe's name, or a food's name as it was planned. */
  name: string;
  /** "1 serving · 340 g" or "130 g". */
  detail: string;
  /** "389 kcal", or null when the item has no calorie figure. */
  kcalText: string | null;
  /** "Leftover", "Makes 2, 1 for tomorrow", or null. */
  badge: string | null;
};

export type PlanBandView = {
  band: PlanBand;
  /** `HH:MM`. */
  time: string;
  /** "389 kcal · P 13 g". */
  summary: string;
  /** The week card's line: a recipe in full and a food by the part of its name before the first comma. */
  line: string;
  items: PlanItemView[];
};

/** A named target a day does not meet. `achieved` is null when no item has a figure for it. */
export type PlanMiss = { nutrient: FitNutrient; target: number; achieved: number | null };

export type PlanDayStatus = "confirmed" | "empty" | "within" | "short";

export type PlanDayView = {
  planId: string;
  dayId: string;
  localDate: string;
  /** The first and last day of the plan this day belongs to. */
  planStart: string;
  planEnd: string;
  isConfirmed: boolean;
  status: PlanDayStatus;
  target: PlanFigures;
  totals: PlanFigures;
  /** The targets the day does not meet. Empty when it is within, and not judged once confirmed. */
  shortfalls: PlanMiss[];
  /** The nutrients the day has a target for. */
  judged: FitNutrient[];
  itemCount: number;
  /** Only the bands that hold something, morning first. */
  bands: PlanBandView[];
};

const figureSchema = z.number();

const figuresOf = (record: JsonRecord): PlanFigures => {
  const read = (key: keyof PlanFigures): number | null => {
    const parsed = figureSchema.safeParse(record[key]);
    return parsed.success ? parsed.data : null;
  };
  return {
    kcal: read("kcal"),
    protein_g: read("protein_g"),
    carbs_g: read("carbs_g"),
    fat_g: read("fat_g"),
  };
};

const FIGURE_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

const sumOf = (rows: readonly JsonRecord[]): PlanFigures => {
  const parts = rows.map(figuresOf);
  const sum = (key: keyof PlanFigures): number | null => {
    const known = parts.map((part) => part[key]).filter((value): value is number => value !== null);
    return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
  };
  return {
    kcal: sum("kcal"),
    protein_g: sum("protein_g"),
    carbs_g: sum("carbs_g"),
    fat_g: sum("fat_g"),
  };
};

const targetOf = (figures: PlanFigures): FitTarget => {
  const target: FitTarget = {};
  for (const key of FIGURE_KEYS) {
    const value = figures[key];
    if (value !== null) {
      target[key] = value;
    }
  }
  return target;
};

const asNutrients = (figures: PlanFigures): NullableNutrients => ({
  ...figures,
  fibre_g: null,
});

const nameSchema = z.object({ name: z.string().min(1) });
const recipeSnapshotSchema = z.object({
  name: z.string().min(1),
  servings: z.number().positive(),
  effectiveGrams: z.number().nonnegative(),
});

const hourOf = (slotTime: string | null): number | null => {
  const hour = Number(slotTime?.slice(0, 2));
  return slotTime !== null && Number.isInteger(hour) ? hour : null;
};

/** Morning is before 11:00 and midday before 16:00, as the palate view splits the day. An item with no time is midday. */
const bandOfTime = (slotTime: string | null): PlanBand => {
  const hour = hourOf(slotTime);
  if (hour === null) {
    return "midday";
  }
  return hour < 11 ? "morning" : hour < 16 ? "midday" : "evening";
};

const clockOf = (slotTime: string | null, band: PlanBand): string =>
  slotTime === null ? MEAL_PLAN_BAND_TIMES[band] : slotTime.slice(0, 5);

type Leftovers = { count: number; allNextDay: boolean };

/** For each item that others are leftovers of, how many there are and whether they all sit on the day after. */
const leftoversOf = (plan: PlanRow): Map<string, Leftovers> => {
  const dateOfItem = new Map<string, string>();
  for (const day of plan.days) {
    for (const item of day.items) {
      dateOfItem.set(item.id, day.localDate);
    }
  }
  const found = new Map<string, Leftovers>();
  for (const day of plan.days) {
    for (const item of day.items) {
      if (item.leftoverOf === null) {
        continue;
      }
      const cookDate = dateOfItem.get(item.leftoverOf);
      const isNextDay = cookDate !== undefined && addCalendarDays(cookDate, 1) === day.localDate;
      const before = found.get(item.leftoverOf);
      found.set(item.leftoverOf, {
        count: (before?.count ?? 0) + 1,
        allNextDay: (before?.allNextDay ?? true) && isNextDay,
      });
    }
  }
  return found;
};

const itemView = (item: PlanItemRow, leftovers: ReadonlyMap<string, Leftovers>): PlanItemView => {
  const kcal = figuresOf(item.nutrients).kcal;
  const cooked = leftovers.get(item.id);
  const badge =
    item.leftoverOf !== null
      ? MEAL_PLAN_WORDS.leftover
      : cooked === undefined
        ? null
        : describePlanCookBadge({
            servingsMade: 1 + cooked.count,
            leftoverCount: cooked.count,
            isForTomorrow: cooked.count === 1 && cooked.allNextDay,
          });
  const common = {
    id: item.id,
    kcalText: kcal === null ? null : `${formatCalories(kcal)} kcal`,
    badge,
  };
  if (item.kind === "recipe") {
    const snapshot = recipeSnapshotSchema.safeParse(item.snapshot);
    return {
      ...common,
      name: snapshot.success ? snapshot.data.name : MEAL_PLAN_WORDS.recipeFallbackName,
      detail: describePlanRecipeAmount(snapshot.success ? planServingGrams(snapshot.data) : null),
    };
  }
  const snapshot = nameSchema.safeParse(item.snapshot);
  return {
    ...common,
    name: snapshot.success ? snapshot.data.name : MEAL_PLAN_WORDS.foodFallbackName,
    detail: describePlanFoodAmount(item.grams),
  };
};

const lineName = (item: PlanItemRow, view: PlanItemView): string =>
  item.kind === "recipe" ? view.name : describePlanFoodName(view.name);

const dayView = (
  plan: PlanRow,
  day: PlanDayRow,
  leftovers: ReadonlyMap<string, Leftovers>,
): PlanDayView => {
  const target = figuresOf(day.target);
  const totals = sumOf(day.items.map(({ nutrients }) => nutrients));
  const isConfirmed = day.confirmedAt !== null;
  // A day with nothing planned is not short of anything, it is empty.
  const shortfalls =
    isConfirmed || day.items.length === 0
      ? []
      : outOfTolerance(asNutrients(totals), targetOf(target)).map(
          ({ nutrient, target: wanted, achieved }) => ({
            nutrient,
            target: wanted,
            achieved,
          }),
        );
  const bands = MEAL_PLAN_BANDS.flatMap((band) => {
    const items = [...day.items]
      .sort(
        (first, second) => first.position - second.position || first.id.localeCompare(second.id),
      )
      .filter(({ slotTime }) => bandOfTime(slotTime) === band);
    const first = items[0];
    if (first === undefined) {
      return [];
    }
    const views = items.map((item) => itemView(item, leftovers));
    return [
      {
        band,
        time: clockOf(first.slotTime, band),
        summary: describePlanBandFigures(sumOf(items.map(({ nutrients }) => nutrients))),
        line: items
          .map((item, index) => lineName(item, views[index] ?? itemView(item, leftovers)))
          .join(", "),
        items: views,
      },
    ];
  });
  return {
    planId: plan.id,
    dayId: day.id,
    localDate: day.localDate,
    planStart: plan.startDate,
    planEnd: addCalendarDays(plan.startDate, Math.max(plan.dayCount, 1) - 1),
    isConfirmed,
    status: isConfirmed
      ? "confirmed"
      : day.items.length === 0
        ? "empty"
        : shortfalls.length === 0
          ? "within"
          : "short",
    target,
    totals,
    shortfalls,
    judged: FIGURE_KEYS.filter((key) => target[key] !== null),
    itemCount: day.items.length,
    bands,
  };
};

const isNewer = (candidate: PlanRow, current: PlanRow): boolean =>
  candidate.createdAt === current.createdAt
    ? candidate.id > current.id
    : Date.parse(candidate.createdAt) > Date.parse(current.createdAt);

/**
 * One view for each date the live plans cover, in date order. Where several plans cover a date (a new plan
 * that replaced part of an older one leaves the older plan's other days), the newest plan's day is the one
 * shown. `plans` are the plans that are not archived.
 */
export const planDayViewsOf = (plans: readonly PlanRow[]): PlanDayView[] => {
  const owner = new Map<string, { plan: PlanRow; day: PlanDayRow }>();
  for (const plan of plans) {
    for (const day of plan.days) {
      const current = owner.get(day.localDate);
      if (current === undefined || isNewer(plan, current.plan)) {
        owner.set(day.localDate, { plan, day });
      }
    }
  }
  const leftoversOfPlan = new Map(plans.map((plan) => [plan.id, leftoversOf(plan)] as const));
  return [...owner.values()]
    .sort((first, second) => first.day.localDate.localeCompare(second.day.localDate))
    .map(({ plan, day }) => dayView(plan, day, leftoversOfPlan.get(plan.id) ?? new Map()));
};

/** What the Diary's plan row says, and which day it opens. */
export type PlannedDayRow = { dayId: string; title: string; caption: string };

/**
 * The Diary's "Planned for today" row for the day on view, or null: only a day that is in a plan and not yet
 * confirmed has one, since a confirmed day's entries are already in the log.
 */
export const plannedDayRowOf = (
  views: readonly PlanDayView[],
  viewedDate: string,
  today: string,
): PlannedDayRow | null => {
  const view = views.find(({ localDate }) => localDate === viewedDate);
  if (view === undefined || view.isConfirmed || view.itemCount === 0) {
    return null;
  }
  return {
    dayId: view.dayId,
    title: describePlanRowTitle(viewedDate, viewedDate === today),
    caption: describePlanRowCaption({
      mealCount: view.bands.length,
      kcal: view.totals.kcal,
      protein: view.totals.protein_g,
    }),
  };
};

/** How a day's status is badged: the words and the badge's look. */
export const PLAN_STATUS_BADGE: Readonly<
  Record<PlanDayStatus, { label: string; tone: "success" | "neutral" | "warning" }>
> = {
  confirmed: { label: MEAL_PLAN_WORDS.statusConfirmed, tone: "success" },
  empty: { label: MEAL_PLAN_WORDS.statusEmpty, tone: "neutral" },
  within: { label: MEAL_PLAN_WORDS.statusWithin, tone: "neutral" },
  short: { label: MEAL_PLAN_WORDS.statusShort, tone: "warning" },
};

// The board names protein before calories when both miss ("22 g short on protein and 180 kcal under").
const BANNER_ORDER: readonly FitNutrient[] = ["protein_g", "kcal", "carbs_g", "fat_g"];

const inBannerOrder = (misses: readonly PlanMiss[]): PlanMiss[] =>
  [...misses].sort(
    (first, second) => BANNER_ORDER.indexOf(first.nutrient) - BANNER_ORDER.indexOf(second.nutrient),
  );

/** The review banner of a short day ("22 g short on protein"), or null for a day that is within or confirmed. */
export const planShortBannerOf = (view: PlanDayView): { title: string; body: string } | null =>
  view.status === "short"
    ? {
        title: describePlanShortTitle(inBannerOrder(view.shortfalls)),
        body: describePlanShortBody(inBannerOrder(view.shortfalls), view.judged),
      }
    : null;

/** The seven days of the week that holds `anchor`, each with the plan's day for it or null, and the days that have one. */
export const planWeekViewOf = (
  views: readonly PlanDayView[],
  anchor: string,
): {
  weekStart: string;
  days: { localDate: string; view: PlanDayView | null }[];
  planned: PlanDayView[];
} => {
  const dates = weekOf(anchor);
  const days = dates.map((localDate) => ({
    localDate,
    view: views.find((view) => view.localDate === localDate) ?? null,
  }));
  return {
    weekStart: dates[0] ?? anchor,
    days,
    planned: days.flatMap(({ view }) => (view === null ? [] : [view])),
  };
};

/**
 * The targets the day's bars are drawn against: what the day was planned to (calories and protein, and carbs or
 * fat when the person named them), and the person's own targets for the figures the plan did not judge, as
 * `plan · day` draws "C 158 / 150" beside the judged two.
 */
export const planProgressTargetsOf = (
  view: PlanDayView,
  profile: ProgressTargets | null,
): ProgressTargets => ({
  kcal: view.target.kcal ?? profile?.kcal ?? null,
  protein_g: view.target.protein_g ?? profile?.protein_g ?? null,
  carbs_g: view.target.carbs_g ?? profile?.carbs_g ?? null,
  fat_g: view.target.fat_g ?? profile?.fat_g ?? null,
});

/**
 * What the week strip draws under a day's pill: a success mark for a confirmed day and a warning mark for a short
 * one, each with the word added to the pill's name. A day within target, or with no plan, has none.
 */
export const planStripMarkOf = (
  view: PlanDayView | null,
): { tone: "success" | "warning"; label: string } | undefined =>
  view?.status === "confirmed"
    ? { tone: "success", label: MEAL_PLAN_WORDS.stripConfirmed }
    : view?.status === "short"
      ? { tone: "warning", label: MEAL_PLAN_WORDS.stripShort }
      : undefined;

/**
 * The day whose week the Plan screen opens on. A link names its own day. Otherwise it is today, unless today's week
 * has nothing planned and a later live plan exists, when it is the first planned day after today's week, so a plan
 * made for next week is found without hunting. Earlier weeks are reached by going back.
 */
export const planOpeningDayOf = (
  views: readonly PlanDayView[],
  today: string,
  linkedDay?: string,
): string => {
  if (linkedDay !== undefined) {
    return linkedDay;
  }
  const thisWeek = weekOf(today);
  if (views.some(({ localDate }) => thisWeek.includes(localDate))) {
    return today;
  }
  const lastDay = thisWeek.at(-1) ?? today;
  return views.find(({ localDate }) => localDate > lastDay)?.localDate ?? today;
};
