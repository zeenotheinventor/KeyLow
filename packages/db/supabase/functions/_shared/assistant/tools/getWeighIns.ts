// The user's weigh-ins over a range, for "how fast is my weight going down?". The trend weight and the
// weekly rate are core's, worked out over the whole history as the Weight screen does, and the answer
// says it is an estimate. The tool builds the citation line, so the model only phrases the answer.
import { z } from "zod";

import {
  TREND_ESTIMATE,
  computeTrend,
  describeWeighInCitation,
  isTrendSettling,
  roundKilograms,
  weeklyRateKg,
} from "../../core.ts";
import { listWeighIns } from "../../repos.ts";
import { citedResult } from "./diaryView.ts";
import {
  dataNotice,
  hasNoFieldProblem,
  isRangeOfAtMost,
  localDateSchema,
  maxRangeDays,
} from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getWeighInsInput = z
  .strictObject({
    from: localDateSchema.describe("The first day, YYYY-MM-DD, in the user's own time zone."),
    to: localDateSchema.describe(
      `The last day, YYYY-MM-DD, in the user's own time zone, at most ${maxRangeDays} days from the first.`,
    ),
  })
  .refine(isRangeOfAtMost(maxRangeDays), { path: ["to"], when: hasNoFieldProblem });

export const getWeighInsTool: ReadToolDefinition<z.infer<typeof getWeighInsInput>> = {
  name: "get_weigh_ins",
  description:
    `Reads the user's weigh-ins over a range of days, at most ${maxRangeDays}, both ends included, ` +
    "oldest first, each with its day and weight in kg. It also gives the trend weight at the first " +
    "and the last day of the range, and weekly_rate_kg, the change in the trend over the 7 days up " +
    "to the last day of the range (negative means the weight is falling), worked out from the whole history and already rounded to 0.1 kg. The " +
    "trend weight is an estimate and not a measurement, so say so. settling is true while the trend " +
    "has too few weigh-ins to trust, and then the weekly rate may be null. Use the numbers as " +
    "given and do not work out any change yourself. The citation is printed under " +
    `your answer. ${dataNotice}`,
  kind: "read",
  input: getWeighInsInput,
  annotations: { readOnlyHint: true },
  async run(ctx, { from, to }) {
    const history = await listWeighIns(ctx.caller);
    // The trend depends on the readings before the range, so it is worked out over all of them.
    const points = computeTrend(
      history.map((weighIn) => ({ localDate: weighIn.local_date, weightKg: weighIn.weight_kg })),
    ).filter((point) => point.date <= to);
    const weighIns = history
      .filter((weighIn) => weighIn.local_date >= from && weighIn.local_date <= to)
      .sort((first, second) =>
        `${first.local_date}${first.measured_at}`.localeCompare(
          `${second.local_date}${second.measured_at}`,
        ),
      );
    const pointsInRange = points.filter((point) => point.date >= from);
    const start = pointsInRange[0];
    const end = pointsInRange.at(-1);
    const hasTrend = weighIns.length > 0 && start !== undefined && end !== undefined;
    const weeklyRate = hasTrend ? weeklyRateKg(points) : null;

    return citedResult(
      {
        from,
        to,
        count: weighIns.length,
        weigh_ins: weighIns.map(({ local_date, weight_kg }) => ({
          date: local_date,
          weight_kg: roundKilograms(weight_kg),
        })),
        trend: hasTrend
          ? {
              start: { date: start.date, weight_kg: roundKilograms(start.trendKg) },
              end: { date: end.date, weight_kg: roundKilograms(end.trendKg) },
            }
          : null,
        weekly_rate_kg: weeklyRate === null ? null : roundKilograms(weeklyRate),
        settling: hasTrend && isTrendSettling(points),
      },
      describeWeighInCitation({ from, to, count: weighIns.length }),
      hasTrend ? TREND_ESTIMATE : null,
    );
  },
};
