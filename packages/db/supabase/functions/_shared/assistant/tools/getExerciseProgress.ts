// One exercise's weeks, for "why has my bench stalled?". Core works the trend out from the sets as the
// exercise progress screen does, in the person's unit and time zone, and counts the weeks without progress,
// because the model is told never to count. Ki-Lo has no figure for what to lift next (Zee, 2026-11-07), so
// the answer holds the last performance and the trend and nothing that reads as a load to try.
import { z } from "zod";

import {
  TREND_RANGES,
  TREND_RANGE_WEEKS,
  addCalendarDays,
  daysSinceMonday,
  describeProgressCitation,
  describeProgressWeek,
  exerciseWeeklyTrend,
  toLocalDate,
  weeksWithoutProgress,
} from "../../core.ts";
import { getExercise, getMyTimeZone, getMyWeightUnit, listTrendSets } from "../../repos.ts";
import { citedResult, zoneOrUtc } from "./diaryView.ts";

import type { TrendEntry } from "../../core.ts";
import type { ReadToolDefinition, ToolRunOutput } from "../tool.ts";

const DAYS_PER_WEEK = 7;

const getExerciseProgressInput = z.strictObject({
  exercise_id: z.guid().describe("The id of an exercise, from search_exercises or get_routines."),
  range: z
    .enum(TREND_RANGES)
    .default("3m")
    .describe("4w is 4 weeks, 3m is 3 months and 1y is a year. The current week counts."),
});

const weekOf = (entry: TrendEntry, unit: "kg" | "lb") => {
  const { weekLabel, value, change } = describeProgressWeek(entry, unit);
  return { week_start: weekLabel, best: value, change: change?.text ?? null };
};

export const getExerciseProgressTool: ReadToolDefinition<z.infer<typeof getExerciseProgressInput>> =
  {
    name: "get_exercise_progress",
    description:
      'Reads how one exercise\'s best set moved week by week, for "why has my bench stalled?". ' +
      "Answers trained weeks only, oldest first, at most 52. Each has week_start (a Monday), best " +
      "(the heaviest working set, in the user's unit) and change on the last trained week. latest is " +
      "the newest of them and may not be this week. weeks_without_progress is how many trained weeks " +
      "the best has stood still or fallen since it last rose: say it as given, never count or work " +
      "anything out. trained is false when the range holds no set. Ki-Lo has no figure for what to " +
      "lift next, so describe the last performance and the trend and never suggest a load. The " +
      "citation is printed under your answer.",
    kind: "read",
    input: getExerciseProgressInput,
    // Many nullable fields would not fit the strict budget (D2 of KEY-881).
    strict: false,
    annotations: { readOnlyHint: true },
    async run(ctx, { exercise_id, range }): Promise<ToolRunOutput> {
      const exercise = await getExercise(ctx.caller, exercise_id);
      if (exercise === null) {
        return { data: { error: "not_found" } };
      }
      const [timeZone, unit] = await Promise.all([
        getMyTimeZone(ctx.caller),
        getMyWeightUnit(ctx.caller),
      ]);
      const zone = zoneOrUtc(timeZone);
      const now = new Date().toISOString();
      // The window the progress screen reads: from the Monday that starts the range through today.
      const throughDay = toLocalDate(new Date(now), zone);
      const fromWeek = addCalendarDays(
        throughDay,
        -daysSinceMonday(throughDay) - (TREND_RANGE_WEEKS[range] - 1) * DAYS_PER_WEEK,
      );
      const { sets, earlier } = await listTrendSets(ctx.caller, [exercise_id], {
        fromWeek,
        throughDay,
      });
      const trend = exerciseWeeklyTrend(sets, { range, now, timeZone: zone, earlier });
      if (trend.latest === null) {
        return { data: { trained: false } };
      }
      return citedResult(
        {
          trained: true,
          weeks: trend.weeks
            .filter((entry) => entry.value !== null)
            .map((entry) => weekOf(entry, unit)),
          latest: weekOf(trend.latest, unit),
          weeks_without_progress: weeksWithoutProgress(trend),
        },
        describeProgressCitation(exercise.name, trend),
      );
    },
  };
