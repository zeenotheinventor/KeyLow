// A range of diary days, for "how much protein did I average last week?". The tool does the arithmetic
// (totals, averages, days at or over target) from the per-day totals the database adds up from each
// entry's frozen nutrients, and builds the citation line, so the model only phrases the answer.
import { z } from "zod";

import { describeRangeCitation, roundCalories, roundGrams } from "../../core.ts";
import { getDiaryWeek, getMyTargets } from "../../repos.ts";
import { citedResult, noNutrientsEaten, nutrientsView, targetsOfDay } from "./diaryView.ts";
import {
  dataNotice,
  isRangeOfAtMost,
  localDateSchema,
  maxRangeDays,
  unknownNotice,
  weekStartsOf,
} from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";
import type { DayTargets, NutrientValues } from "./diaryView.ts";

const getRangeTotalsInput = z
  .strictObject({
    from: localDateSchema.describe(
      "The first day of the range, YYYY-MM-DD, in the user's own time zone.",
    ),
    to: localDateSchema.describe(
      `The last day of the range, YYYY-MM-DD, in the user's own time zone, at most ${maxRangeDays} days from the first.`,
    ),
  })
  .refine(isRangeOfAtMost(maxRangeDays), { path: ["to"] });

type LoggedDay = { localDate: string; entryCount: number; totals: NutrientValues };

// A logged day with no value for a nutrient counts as 0 once another logged day has one, as the weekly
// averages page does. The sum is null when no logged day had a value, which is unknown and not 0.
const sumOf = (days: readonly LoggedDay[], key: keyof NutrientValues): number | null =>
  days.every((day) => day.totals[key] === null)
    ? null
    : days.reduce((sum, day) => sum + (day.totals[key] ?? 0), 0);

const mean = (sum: number | null, count: number): number | null =>
  sum === null ? null : sum / count;

// What the average is measured against, per target: the mean of the own targets of the days it is taken
// over. That is the one target of a manual plan, and with a figure for each weekday it is the mean of the
// weekdays that were logged, so a logged weekend is not measured against a week of weekdays.
const meanTarget = (days: readonly DayTargets[], key: keyof DayTargets): number | null => {
  const figures = days.flatMap((day) => (day[key] === null ? [] : [day[key]]));
  return figures.length === 0
    ? null
    : figures.reduce((sum, figure) => sum + figure, 0) / figures.length;
};

export const getRangeTotalsTool: ReadToolDefinition<z.infer<typeof getRangeTotalsInput>> = {
  name: "get_range_totals",
  description:
    `Adds up the user's diary over a range of days, at most ${maxRangeDays}, both ends included: the ` +
    "total, the daily average over the days that have entries, each logged day's totals, and for " +
    "kcal, protein, carbs and fat the user's target, how far the average is from it (negative means " +
    "under) and on how many days the user reached it. The sums are worked out here from what each " +
    "entry was logged with, already rounded as the Diary rounds them, so use them as given and do " +
    "not add anything up. days_in_range is how many days the range has and days_logged how many " +
    "of them have entries. A range that includes today counts today as a partial day, so say so when " +
    "it does. The targets are the user's current targets, applied to past days as well. The " +
    "citation is the line the app prints under your answer. " +
    `${unknownNotice} A null target means none is set. ${dataNotice}`,
  kind: "read",
  input: getRangeTotalsInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { from, to }) {
    const [weeks, targets] = await Promise.all([
      Promise.all(weekStartsOf(from, to).map((weekStart) => getDiaryWeek(ctx.caller, weekStart))),
      getMyTargets(ctx.caller),
    ]);
    const daysInRange = weeks
      .flat()
      .filter(({ localDate }) => localDate >= from && localDate <= to);
    const logged: LoggedDay[] = daysInRange.flatMap(({ localDate, totals }) =>
      totals === null ? [] : [{ localDate, entryCount: totals.entry_count, totals }],
    );
    const entryCount = logged.reduce((sum, day) => sum + day.entryCount, 0);

    const total: NutrientValues = {
      kcal: sumOf(logged, "kcal"),
      protein_g: sumOf(logged, "protein_g"),
      fat_g: sumOf(logged, "fat_g"),
      carbs_g: sumOf(logged, "carbs_g"),
      fibre_g: sumOf(logged, "fibre_g"),
    };
    const average: NutrientValues | null =
      logged.length === 0
        ? null
        : {
            kcal: mean(total.kcal, logged.length),
            protein_g: mean(total.protein_g, logged.length),
            fat_g: mean(total.fat_g, logged.length),
            carbs_g: mean(total.carbs_g, logged.length),
            fibre_g: mean(total.fibre_g, logged.length),
          };

    const targetsByDate = new Map(
      daysInRange.map(({ localDate }) => [localDate, targetsOfDay(targets, localDate)]),
    );
    const against = (key: keyof DayTargets, round: (value: number) => number) => {
      // With nothing logged there is no average, and the target of the whole range is still shown.
      const measuredDays = logged.length === 0 ? daysInRange : logged;
      const target = meanTarget(
        measuredDays.flatMap(({ localDate }) => targetsByDate.get(localDate) ?? []),
        key,
      );
      const averageOfKey = average?.[key] ?? null;
      return {
        target: target === null ? null : round(target),
        average_minus_target:
          target === null || averageOfKey === null ? null : round(averageOfKey - target),
        days_at_or_over:
          target === null
            ? null
            : logged.filter((day) => {
                const eaten = day.totals[key];
                const dayTarget = targetsByDate.get(day.localDate)?.[key] ?? null;
                return eaten !== null && dayTarget !== null && eaten >= dayTarget;
              }).length,
      };
    };

    return citedResult(
      {
        from,
        to,
        days_in_range: daysInRange.length,
        days_logged: logged.length,
        entry_count: entryCount,
        days: logged.map(({ localDate, entryCount: dayEntryCount, totals }) => ({
          date: localDate,
          entry_count: dayEntryCount,
          ...nutrientsView(totals),
        })),
        total: nutrientsView(logged.length === 0 ? noNutrientsEaten : total),
        daily_average: average === null ? null : nutrientsView(average),
        against_targets: {
          kcal: against("kcal", roundCalories),
          protein_g: against("protein_g", roundGrams),
          carbs_g: against("carbs_g", roundGrams),
          fat_g: against("fat_g", roundGrams),
        },
      },
      describeRangeCitation({ from, to, entryCount }),
    );
  },
};
