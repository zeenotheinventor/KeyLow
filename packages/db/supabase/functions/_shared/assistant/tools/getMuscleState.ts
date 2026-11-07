// How ready each muscle is and how much it has had this week, for "Am I doing enough for my back?" and as the
// numbers a training answer rests on. The rows are the body map's: the same calculation, the same rounding and
// the same words, so the model only phrases them. Nothing in the result is text a person wrote.
import { z } from "zod";

import {
  MUSCLE_GROUPS,
  currentMuscleState,
  describeMuscleCitation,
  muscleStateRows,
  targetedMuscles,
  toLocalDate,
} from "../../core.ts";
import { getMyTimeZone, readTrainingInputs } from "../../repos.ts";
import { citedResult, zoneOrUtc } from "./diaryView.ts";

import type { ReadToolDefinition } from "../tool.ts";

const SEVEN_DAYS_MILLISECONDS = 7 * 24 * 3_600_000;

// Unknown keys are dropped and not refused, so a model that sends one is not left with nothing.
const getMuscleStateInput = z.object({
  area: z
    .enum(MUSCLE_GROUPS)
    .nullable()
    .default(null)
    .describe("One group of muscles to read, or null for all 22."),
});

export const getMuscleStateTool: ReadToolDefinition<z.infer<typeof getMuscleStateInput>> = {
  name: "get_muscle_state",
  description:
    "Reads how recovered each muscle is and its training volume over the last 7 days, the body map's " +
    "figures, so never call it this week. With an area it reads that group's muscles and gives area " +
    'with the sets and target summed over the muscles the routine and goal target, for "Am I doing ' +
    'enough for my back?". Each muscle has its heat in words and percent, ready_at ("now" or a local ' +
    "time), sets (effort-weighted), target (the sets where Productive starts), status and targeted. " +
    "targeted false means the routine and goal do not train the muscle, say so instead of judging its " +
    "volume, and area.targeted false means they train none of the area, so its sums are of the whole area. " +
    "The citation is printed under your answer. Use these numbers as given and never work one out.",
  kind: "read",
  input: getMuscleStateInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { area }) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const now = new Date();
    const today = toLocalDate(now, timeZone);
    // The sets, the routine and the goal are the reads the Today card's suggestion makes, and the muscles are
    // worked out from the sets by core, as `readMuscleState` does.
    const { sets, activeRoutine, goal } = await readTrainingInputs(ctx.caller, { today });
    const {
      rows,
      area: areaTotals,
      totalSets,
    } = muscleStateRows(currentMuscleState(sets, now.toISOString()), {
      now: now.toISOString(),
      timeZone,
      area,
      targeted: targetedMuscles({
        routine: activeRoutine,
        priority: goal?.muscle_priority ?? null,
      }),
    });

    return citedResult(
      { muscles: rows, area: areaTotals },
      describeMuscleCitation({
        area,
        sets: areaTotals?.sets ?? totalSets,
        // The sets are those of a rolling 7 days, 168 hours back from now, so the first day is the one
        // that instant falls on, and only the part of it after that time of day counts.
        from: toLocalDate(new Date(now.getTime() - SEVEN_DAYS_MILLISECONDS), timeZone),
        to: today,
      }),
    );
  },
};
