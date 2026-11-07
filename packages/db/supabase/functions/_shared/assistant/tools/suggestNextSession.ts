// The next session Ki-Lo would suggest, for "What should I train today?". The calculation is core's
// `nextSessionSuggestion`, the one the Today card runs, over the shared reads, and the words are the
// suggestion detail's, so the model only phrases them. It writes nothing: accepting a suggestion stays in the
// app. The exercise library is read here and never sent on, only the picks are.
import { z } from "zod";

import {
  EQUIPMENT,
  MAX_SESSION_MINUTES,
  MIN_SESSION_MINUTES,
  MUSCLE_NAMES,
  describeNothingToSuggest,
  describeSuggestionCitation,
  describeSuggestionDetail,
  localToday,
  nextSessionSuggestion,
  planRoutineOf,
  plannedDayOf,
} from "../../core.ts";
import {
  getMyTimeZone,
  getRoutine,
  listSuggestionLibrary,
  readTrainingInputs,
} from "../../repos.ts";
import { citedResult, zoneOrUtc } from "./diaryView.ts";
import { dataNotice } from "./shared.ts";

import type { ReadToolDefinition } from "../tool.ts";

const suggestNextSessionInput = z.strictObject({
  minutes: z
    .number()
    .int()
    .min(MIN_SESSION_MINUTES)
    .max(MAX_SESSION_MINUTES)
    .nullable()
    .default(null)
    .describe(
      `The session length to fit, ${MIN_SESSION_MINUTES} to ${MAX_SESSION_MINUTES}, or null for the goal's.`,
    ),
  equipment: z
    .array(z.enum(EQUIPMENT))
    .min(1)
    .nullable()
    .default(null)
    .describe("Only these kinds of equipment, within the goal's, or null for the goal's."),
});

export const suggestNextSessionTool: ReadToolDefinition<z.infer<typeof suggestNextSessionInput>> = {
  name: "suggest_next_session",
  description:
    'Gives the session Ki-Lo suggests for today, for "What should I train today?". It adds to ' +
    "today's routine day, or builds a session when there is none. Answers headline, plan_day (null " +
    "for a built session), exercises (exercise_id, name, target, origin plan or added, why), sets, " +
    "minutes, skipped (hot muscles left out) and no_room, or nothing with its reason, or needs_goal " +
    "true when the user has no goal. It writes nothing, and accepting a suggestion is done in the " +
    "app. The citation is printed under your answer. " +
    dataNotice,
  kind: "read",
  input: suggestNextSessionInput,
  // Many nullable fields would not fit the strict budget (D2 of KEY-881).
  strict: false,
  annotations: { readOnlyHint: true },
  async run(ctx, { minutes, equipment }) {
    const timeZone = zoneOrUtc(await getMyTimeZone(ctx.caller));
    const now = new Date().toISOString();
    const today = localToday(now, timeZone);
    const inputs = await readTrainingInputs(ctx.caller, { today });
    const { goal, activeRoutine } = inputs;
    // The goal's equipment is intersected with the narrowing, as `suggestSession` does, so only the
    // exercises that can be picked are read.
    const library =
      goal === null
        ? null
        : await listSuggestionLibrary(ctx.caller, {
            equipment:
              equipment === null
                ? goal.equipment
                : goal.equipment.filter((kind) => equipment.includes(kind)),
          });
    const read = nextSessionSuggestion({
      ...inputs,
      now,
      library,
      timeZone,
      day: today,
      constraints: {
        ...(minutes === null ? {} : { minutes }),
        ...(equipment === null ? {} : { equipment }),
      },
    });
    // With no goal the suggestion is none, and the goal is read before the library.
    if (goal === null || library === null || read.suggestion === null) {
      return { data: { needs_goal: true } };
    }

    const { suggestion } = read;
    const plannedDay = plannedDayOf(planRoutineOf(activeRoutine, timeZone), today);
    const routineDayName =
      activeRoutine?.days.find((day) => day.id === plannedDay?.id)?.name ?? null;
    const context = {
      localDate: today,
      todayLocalDate: today,
      routineDayName,
      exerciseNames: new Map([
        ...library.map(({ id, name }): [string, string] => [id, name]),
        ...(activeRoutine?.days ?? []).flatMap((day) =>
          day.exercises.map(({ exercise }): [string, string] => [exercise.id, exercise.name]),
        ),
      ]),
      goals: {
        goal: goal.goal,
        focus: goal.focus,
        limit_minutes: minutes ?? goal.session_minutes,
      },
    };
    const citation = describeSuggestionCitation({ localDate: today, today });
    const skipped = suggestion.skipped.map(({ muscle_id }) => MUSCLE_NAMES[muscle_id]);
    const noRoom =
      suggestion.no_room === null
        ? null
        : {
            muscle: MUSCLE_NAMES[suggestion.no_room.muscle_id],
            minutes_if_added: suggestion.no_room.minutes_if_added,
          };

    if (suggestion.kind === "nothing") {
      const { title, body } = describeNothingToSuggest(suggestion, context);
      return citedResult({ headline: title, nothing: body, skipped, no_room: noRoom }, citation);
    }

    // A kept exercise's rep range is the routine's, which the active routine read does not hold.
    const detailRoutine =
      suggestion.kind === "plan_adjusted" && activeRoutine !== null
        ? await getRoutine(ctx.caller, activeRoutine.id)
        : null;
    const detail = describeSuggestionDetail(suggestion, {
      ...context,
      plannedRepRanges: new Map(
        (detailRoutine?.days ?? []).flatMap((day) =>
          day.exercises.map(
            ({ id, rep_min, rep_max }): [string, { repMin: number; repMax: number }] => [
              id,
              { repMin: rep_min, repMax: rep_max },
            ],
          ),
        ),
      ),
    });

    return citedResult(
      {
        headline: detail.headline,
        plan_day: routineDayName,
        exercises: suggestion.exercises.flatMap((exercise, index) => {
          const row = detail.rows[index];
          return row === undefined
            ? []
            : [
                {
                  exercise_id: exercise.exercise_id,
                  name: row.name,
                  target: row.target,
                  origin: exercise.origin,
                  why: row.why,
                },
              ];
        }),
        sets: suggestion.sets,
        minutes: suggestion.minutes,
        skipped,
        no_room: noRoom,
      },
      citation,
    );
  },
};
