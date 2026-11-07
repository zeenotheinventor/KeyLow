// One exercise's weeks, for "why has my bench stalled?". Core works the trend out from the sets as the
// exercise progress screen does, in the person's unit and time zone, and counts the weeks without progress,
// because the model is told never to count. Ki-Lo has no figure for what to lift next (Zee, 2026-11-07), so
// the answer holds the last performance and the trend and nothing that reads as a load to try.
import { z } from "zod";

import {
  TREND_RANGES,
  describeProgressCitation,
  describeProgressWeek,
  exerciseWeeklyTrend,
  trendReadWindow,
  weeksWithoutProgress,
} from "../../core.ts";
import { getExercise, getMyTimeZone, getMyWeightUnit, listTrendSets } from "../../repos.ts";
import { citedResult, zoneOrUtc } from "./diaryView.ts";

import type { TrendEntry } from "../../core.ts";
import type { ReadToolDefinition, ToolRunOutput } from "../tool.ts";

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
      "Answers trained weeks only for the range asked, oldest first, at most 52. Each has week_start " +
      "(a Monday), best (the heaviest working set, in the user's unit) and change on the last trained " +
      "week. The last is the newest and may not be this week. weeks_without_progress is how many " +
      "trained weeks, back from the newest, the best has stood still or fallen since it last rose, " +
      "read over the last year whatever the range: say it as given, never count or work anything out. " +
      "stall_may_be_longer true means it runs back past that year, so say at least. trained is false " +
      "when the range holds no set. Ki-Lo has no figure for what to lift next, so describe the last " +
      "performance and the trend and never suggest a load. The citation is printed under your answer.",
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
      // One read of the longest range serves them all: the weeks asked for are worked out from it as the
      // screen does, and the stall is counted over the year, so a short range does not cut it short.
      const { sets, earlier } = await listTrendSets(
        ctx.caller,
        [exercise_id],
        trendReadWindow("1y", now, zone),
      );
      const trendOf = (of: typeof range) =>
        exerciseWeeklyTrend(sets, { range: of, now, timeZone: zone, earlier });
      const trend = trendOf(range);
      if (trend.latest === null) {
        return { data: { trained: false } };
      }
      const stall = weeksWithoutProgress(range === "1y" ? trend : trendOf("1y"), unit);
      return citedResult(
        {
          trained: true,
          weeks: trend.weeks
            .filter((entry) => entry.value !== null)
            .map((entry) => weekOf(entry, unit)),
          weeks_without_progress: stall.weeks,
          stall_may_be_longer: stall.isAtLeast,
        },
        describeProgressCitation(exercise.name, trend),
      );
    },
  };
