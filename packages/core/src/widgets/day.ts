import { addCalendarDays, daysSinceMonday } from "../dates/calendarDay";
import { toLocalDate } from "../dates/toLocalDate";
import { weekSummary } from "../diary/rules/weekSummary";
import { dayTarget } from "../engine/dayTarget";
import { heatValues } from "../training/bodyMapValues";
import { MUSCLE_IDS } from "../training/muscles";
import { muscleState } from "../training/muscleState";
import { TRAINING_PARAMS_V2 } from "../training/params";

import type { WidgetDayTotals, WidgetSnapshot } from "./snapshot";
import type { WeekSummary, WeekSummaryDay } from "../diary/rules/weekSummary";
import type { MuscleId } from "../training/muscles";
import type { MuscleState } from "../training/muscleState";

const NO_TOTALS: WidgetDayTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
const DAYS_PER_WEEK = 7;

/** The snapshot read at a moment: the day the moment falls in, with the numbers that day starts from. */
export type DayReading = Readonly<{
  localDate: string;
  /** True when midnight has passed since the snapshot was built, so the day is new and nothing is logged yet. */
  isNewDay: boolean;
  eaten: WidgetDayTotals;
  /** The calorie target of this weekday, null when no target is set. */
  targetKcal: number | null;
  week: WeekSummary;
  muscleStates: Record<MuscleId, MuscleState>;
  heatSteps: Record<MuscleId, number>;
  volumeValues: Readonly<Record<MuscleId, number>>;
}>;

const weekOf = (localDate: string): string =>
  addCalendarDays(localDate, -daysSinceMonday(localDate));

/** The week's days for a new day: what the snapshot knows of them, and nothing logged on the new day. */
const daysForNewDay = (snapshot: WidgetSnapshot, localDate: string): WeekSummaryDay[] => {
  const monday = weekOf(localDate);

  return Array.from({ length: DAYS_PER_WEEK }, (_, position) => {
    const day = addCalendarDays(monday, position);
    const known =
      day === localDate
        ? undefined
        : snapshot.week.find((candidate) => candidate.localDate === day);

    return {
      localDate: day,
      totals: known?.totals ? toDayTotals(known.totals) : null,
      dayLog: known?.isComplete ? { is_complete: true } : null,
    };
  });
};

const toDayTotals = (totals: WidgetDayTotals): NonNullable<WeekSummaryDay["totals"]> => ({
  kcal: totals.kcal,
  protein_g: totals.proteinG,
  carbs_g: totals.carbsG,
  fat_g: totals.fatG,
});

const daysFromSnapshot = (snapshot: WidgetSnapshot): WeekSummaryDay[] =>
  snapshot.week.map((day) => ({
    localDate: day.localDate,
    totals: day.totals === null ? null : toDayTotals(day.totals),
    dayLog: day.isComplete ? { is_complete: true } : null,
  }));

export const targetOf = (snapshot: WidgetSnapshot, localDate: string): number | null =>
  snapshot.targets === null
    ? null
    : dayTarget(
        {
          caloriesKcal: snapshot.targets.caloriesKcal,
          ...(snapshot.targets.weekdayCaloriesKcal === undefined
            ? {}
            : { dowCaloriesKcal: snapshot.targets.weekdayCaloriesKcal }),
        },
        localDate,
      );

/** Each muscle's heat and volume at `at`, by the heat model, from the sets the snapshot holds. */
export const muscleStatesAt = (snapshot: WidgetSnapshot, at: Date): Record<MuscleId, MuscleState> =>
  muscleState(
    snapshot.bodyMap.heatSets.map((set) => ({
      performed_at: set.performedAt,
      deleted_at: null,
      set_type: set.setType,
      rir: set.rir,
      rpe: set.rpe,
      // The heat model reads a muscle and its weight only. The role is the map's, not the model's.
      snapshot: {
        muscles: set.muscles.map(({ muscleId, weight }) => ({
          muscle_id: muscleId,
          role: "primary" as const,
          weight,
        })),
      },
    })),
    at.toISOString(),
    TRAINING_PARAMS_V2,
  );

/**
 * What the snapshot shows at `now`. On the day it was built that is its own numbers. After one midnight it
 * is the new day with that weekday's target and nothing eaten yet, and a new week starts empty. After more
 * than one midnight the app has not loaded the day, so there is nothing to show and the result is null.
 * The heat is the heat model's, worked out at `now` from the sets the snapshot holds.
 */
export const readDay = (snapshot: WidgetSnapshot, now: Date): DayReading | null => {
  const localDate = toLocalDate(now, snapshot.timeZone);
  const isNewDay = localDate > snapshot.today;
  if (isNewDay && localDate !== addCalendarDays(snapshot.today, 1)) {
    return null;
  }
  const date = isNewDay ? localDate : snapshot.today;
  const days = isNewDay ? daysForNewDay(snapshot, date) : daysFromSnapshot(snapshot);
  const targetKcal = targetOf(snapshot, date);
  const todayTotals = days.find((day) => day.localDate === date)?.totals ?? null;
  const states = muscleStatesAt(snapshot, now);
  const isNewWeek = isNewDay && weekOf(date) !== weekOf(snapshot.today);
  // A new week has no sets yet, whatever the week before was.
  const volumeValues = { ...snapshot.bodyMap.volumeValues };
  if (isNewWeek) {
    for (const muscle of MUSCLE_IDS) {
      volumeValues[muscle] = 0;
    }
  }

  return {
    localDate: date,
    isNewDay,
    eaten: todayTotals === null ? NO_TOTALS : fromDayTotals(todayTotals),
    targetKcal,
    week: weekSummary({ days, today: date, targetKcal }),
    muscleStates: states,
    heatSteps: heatValues(states),
    volumeValues,
  };
};

const fromDayTotals = (totals: NonNullable<WeekSummaryDay["totals"]>): WidgetDayTotals => ({
  kcal: totals.kcal,
  proteinG: totals.protein_g,
  carbsG: totals.carbs_g,
  fatG: totals.fat_g,
});
