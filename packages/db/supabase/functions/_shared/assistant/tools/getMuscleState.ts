// How ready each muscle is and how much it has had this week, for "Am I doing enough for my back?" and as the
// numbers a training answer rests on. The rows are the body map's: the same calculation, the same rounding and
// the same words, so the model only phrases them. Nothing in the result is text a person wrote.
import { z } from "zod";

import {
  MUSCLE_GROUPS,
  addCalendarDays,
  describeMuscleCitation,
  muscleStateRows,
  toLocalDate,
} from "../../core.ts";
import { getMyTimeZone, readMuscleState } from "../../repos.ts";
import { citedResult, zoneOrUtc } from "./diaryView.ts";

import type { ReadToolDefinition } from "../tool.ts";

const getMuscleStateInput = z.strictObject({
  area: z
    .enum(MUSCLE_GROUPS)
    .nullable()
    .default(null)
    .describe("One group of muscles to read, or null for all 22."),
});

export const getMuscleStateTool: ReadToolDefinition<z.infer<typeof getMuscleStateInput>> = {
  name: "get_muscle_state",
  description:
    "Reads how recovered each muscle is and its training volume over the last 7 days. With an area " +
    "it reads that group's muscles and gives area with the group's sets and target summed, for " +
    '"Am I doing enough for my back?". Each muscle has its heat in words and percent, ready_at ("now" ' +
    "or a local time), sets (effort-weighted), target (the sets where Productive starts) and status. " +
    "The citation is printed under your answer. Use these numbers as given and never work one out.",
  kind: "read",
  input: getMuscleStateInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { area }) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const now = new Date();
    const states = await readMuscleState(ctx.caller, { now: now.toISOString(), timeZone });
    const {
      rows,
      area: areaTotals,
      totalSets,
    } = muscleStateRows(states, {
      now: now.toISOString(),
      timeZone,
      area,
    });
    const today = toLocalDate(now, timeZone);

    return citedResult(
      { muscles: rows, area: areaTotals },
      describeMuscleCitation({
        area,
        sets: areaTotals?.sets ?? totalSets,
        from: addCalendarDays(today, -6),
        to: today,
      }),
    );
  },
};
